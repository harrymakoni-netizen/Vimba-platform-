import { asSystem, many, type Tx } from '@/lib/db';

export type OutboxKind = 'relay.notify' | 'whatsapp.send';

/** Enqueue in the caller's transaction. The idempotency key makes retries produce one job. */
export async function enqueue(tx: Tx, kind: OutboxKind, payload: Record<string, unknown>, idempotencyKey: string, channel?: string) {
  await tx.query(
    `insert into outbox (kind, channel, payload, idempotency_key) values ($1, $2, $3, $4)
     on conflict (idempotency_key) do nothing`,
    [kind, channel ?? null, JSON.stringify(payload), idempotencyKey],
  );
}

export interface DeliveryResult {
  ok: boolean;
  providerMessageId?: string;
  providerStatus?: string;
  errorCode?: string;
  /** Permanent failures are recorded and never retried (e.g. WhatsApp 131047). */
  permanent?: boolean;
}

export type Handler = (job: { id: string; kind: OutboxKind; channel: string | null; payload: any }) => Promise<DeliveryResult>;

const MAX_ATTEMPTS = 6;
const backoffSeconds = (attempt: number) => Math.min(3600, 15 * 2 ** (attempt - 1));

/**
 * Claim due jobs with SKIP LOCKED, deliver each outside the claiming
 * transaction, then record the attempt. A crash between delivery and record
 * can repeat a send; provider-side idempotency is preferred where offered.
 */
export async function processDue(handlers: Partial<Record<OutboxKind, Handler>>, limit = 20) {
  const jobs = await asSystem(async (tx) => {
    const rows = await many(
      tx,
      `select id, kind, channel, payload, attempts from outbox
        where status = 'pending' and next_attempt_at <= now()
        order by created_at limit $1 for update skip locked`,
      [limit],
    );
    // Lease: push next_attempt_at forward so a parallel worker will not pick them up.
    if (rows.length) {
      await tx.query(`update outbox set next_attempt_at = now() + interval '2 minutes' where id = any($1::uuid[])`, [
        rows.map((r) => r.id),
      ]);
    }
    return rows;
  });

  const results: { id: string; ok: boolean }[] = [];
  for (const job of jobs) {
    const handler = handlers[job.kind as OutboxKind];
    let res: DeliveryResult;
    try {
      res = handler ? await handler(job) : { ok: false, errorCode: 'no_handler' };
    } catch (err) {
      res = { ok: false, errorCode: (err as Error).name === 'AbortError' ? 'timeout' : 'exception' };
    }
    console.log(JSON.stringify({ level: res.ok ? 'info' : 'warn', component: 'outbox', kind: job.kind, ok: res.ok, error_code: res.errorCode ?? null, attempt: job.attempts + 1 }));
    await asSystem(async (tx) => {
      await tx.query(
        `insert into delivery_attempts (outbox_id, ok, provider_message_id, provider_status, error_code) values ($1,$2,$3,$4,$5)`,
        [job.id, res.ok, res.providerMessageId ?? null, res.providerStatus ?? null, res.errorCode ?? null],
      );
      const attempts = job.attempts + 1;
      if (res.ok) {
        await tx.query(`update outbox set status = 'sent', attempts = $2, sent_at = now(), last_error = null where id = $1`, [job.id, attempts]);
      } else if (res.permanent || attempts >= MAX_ATTEMPTS) {
        await tx.query(`update outbox set status = 'dead', attempts = $2, last_error = $3 where id = $1`, [job.id, attempts, res.errorCode ?? 'failed']);
      } else {
        await tx.query(
          `update outbox set attempts = $2, last_error = $3, next_attempt_at = now() + make_interval(secs => $4) where id = $1`,
          [job.id, attempts, res.errorCode ?? 'failed', backoffSeconds(attempts)],
        );
      }
    });
    results.push({ id: job.id, ok: res.ok });
  }
  return results;
}

/** Make a dead or failed job eligible again (operator action from the dashboard). */
export async function retryJob(id: string) {
  await asSystem((tx) =>
    tx.query(`update outbox set status = 'pending', next_attempt_at = now() where id = $1 and status in ('dead','failed')`, [id]),
  );
}
