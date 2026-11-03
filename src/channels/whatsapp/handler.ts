import { asSystem, one, type Tx } from '@/lib/db';
import { encrypt, hmacHex } from '@/lib/crypto';
import { env } from '@/lib/env';
import { formatDate, isLocale, translator } from '@/lib/i18n';
import { enqueue } from '@/services/outbox';
import { getPassport, passageIn } from '@/services/passports';
import { casesForSender, submitComplaintTx } from '@/services/complaints';
import { kapsoEventSchema, extractInbound, extractErrorCode, type Inbound } from './payload';
import { verifyKapsoSignature } from './verify';
import { step, type Deps, type OutMessage, type State, type Turn } from './conversation';

export type Channel = 'whatsapp' | 'simulator';

const SESSION_IDLE_MINUTES = 30;
const PER_SENDER_WINDOW_MINUTES = 10;
const PER_SENDER_MAX = 20;

/** Opaque, stable sender identity. Phone numbers never appear in logs or session keys. */
export const senderKeyFor = (id: string) => hmacHex(env.senderPepper(), `wa:${id}`);

const monthKey = () => new Date().toISOString().slice(0, 7);

function log(event: Record<string, string | number | boolean | null>) {
  // Safe fields only: sender_key, event kind, idempotency key, outcome codes.
  console.log(JSON.stringify({ level: 'info', component: 'whatsapp', ...event }));
}

// ---------------------------------------------------------------------------
// Webhook ingestion: verify, deduplicate, acknowledge, process.
// ---------------------------------------------------------------------------
export async function ingestKapsoWebhook(raw: string, headers: Headers): Promise<{ status: number; body: string }> {
  if (!verifyKapsoSignature(raw, headers.get('x-webhook-signature'), env.kapsoWebhookSecret())) {
    return { status: 401, body: 'invalid signature' };
  }
  const key = headers.get('x-idempotency-key');
  const kind = headers.get('x-webhook-event');
  if (!key || !kind) return { status: 400, body: 'missing headers' };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: 400, body: 'invalid json' };
  }
  const parsed = kapsoEventSchema.safeParse(json);
  if (!parsed.success) return { status: 400, body: 'invalid payload' };
  const event = parsed.data;
  const inbound = extractInbound(event);
  const isTest = event.test === true || headers.get('x-webhook-test') === 'true';
  const configured = env.kapsoPhoneNumberId();
  const wrongNumber = Boolean(configured) && event.phone_number_id !== configured;
  const senderId = inbound.bsuid ?? inbound.phone;
  const senderKey = senderId ? senderKeyFor(senderId) : null;

  const isNew = await asSystem(async (tx) => {
    const r = await tx.query(
      `insert into channel_events (idempotency_key, webhook_event, provider_message_id, kapso_conversation_id, sender_key, is_test, payload,
                                   processed_at, error)
       values ($1,$2,$3,$4,$5,$6,$7, $8, $9)
       on conflict (idempotency_key) do nothing returning id`,
      [
        key,
        kind,
        inbound.messageId,
        inbound.conversationId,
        senderKey,
        isTest,
        JSON.stringify(json),
        isTest || wrongNumber ? new Date() : null,
        wrongNumber ? 'phone_number_mismatch' : isTest ? 'test_event_ignored' : null,
      ],
    );
    return r.rows[0]?.id as string | undefined;
  });
  if (!isNew) {
    log({ event: kind, idempotency_key: key, outcome: 'duplicate' });
    return { status: 200, body: 'ok' };
  }
  if (isTest || wrongNumber) {
    log({ event: kind, idempotency_key: key, outcome: isTest ? 'test_ignored' : 'phone_number_mismatch' });
    return { status: 200, body: 'ok' };
  }

  try {
    if (kind === 'whatsapp.message.received') {
      if (!senderId) throw new Error('no_sender');
      await processInbound({ channel: 'whatsapp', senderId, inbound, eventId: isNew, idempotencyKey: key });
    } else if (kind.startsWith('whatsapp.message.')) {
      await recordDeliveryStatus(inbound.messageId, kind.replace('whatsapp.message.', ''), extractErrorCode(event), isNew);
    } else {
      await markProcessed(isNew, 'ignored_event');
    }
  } catch (err) {
    await markProcessed(isNew, (err as Error).message?.slice(0, 60) ?? 'error').catch(() => undefined);
    log({ event: kind, idempotency_key: key, sender_key: senderKey, outcome: 'error' });
  }
  return { status: 200, body: 'ok' };
}

async function markProcessed(eventId: string, error: string | null) {
  await asSystem((tx) => tx.query(`update channel_events set processed_at = now(), error = $2 where id = $1`, [eventId, error]));
}

/** Delivery status events update delivery records only; never case or correction state. */
async function recordDeliveryStatus(providerMessageId: string | null, status: string, errorCode: string | null, eventId: string) {
  await asSystem(async (tx) => {
    if (providerMessageId) {
      await tx.query(
        `update delivery_attempts set provider_status = $2, error_code = coalesce($3, error_code) where provider_message_id = $1`,
        [providerMessageId, status, errorCode],
      );
    }
    await tx.query(`update channel_events set processed_at = now() where id = $1`, [eventId]);
  });
}

// ---------------------------------------------------------------------------
// Inbound processing (shared by WhatsApp and the labelled simulator)
// ---------------------------------------------------------------------------
export async function processInbound(args: {
  channel: Channel;
  senderId: string;
  inbound: Pick<Inbound, 'type' | 'text' | 'choiceId' | 'phone'>;
  eventId: string;
  idempotencyKey: string;
}) {
  const senderKey = senderKeyFor(args.senderId);
  const replyTo = args.channel === 'simulator' ? args.senderId : args.inbound.phone;
  const replyEnc = replyTo ? encrypt(replyTo, env.appSecret()) : null;

  const replies = await asSystem(async (tx) => {
    if (args.channel === 'whatsapp') await countUsage(tx, 'inbound');

    await tx.query(
      `insert into channel_sessions (channel, sender_key) values ($1, $2) on conflict (channel, sender_key) do nothing`,
      [args.channel, senderKey],
    );
    const s = await one(tx, `select * from channel_sessions where channel = $1 and sender_key = $2 for update`, [args.channel, senderKey]);
    const expired = s.expires_at && new Date(s.expires_at) < new Date();
    const turn: Turn = {
      state: expired ? 'menu' : (s.state as State),
      draft: expired ? {} : s.draft,
      locale: isLocale(s.locale) ? s.locale : 'en',
      invalidCount: expired ? 0 : s.invalid_count,
      stopped: s.stopped,
    };
    const t = translator(turn.locale);

    // Per-sender rate limit: the excess receives one polite notice.
    const recent = await one(
      tx,
      `select count(*)::int as n from channel_events where sender_key = $1 and received_at > now() - make_interval(mins => $2)`,
      [senderKey, PER_SENDER_WINDOW_MINUTES],
    );
    if (args.channel === 'whatsapp' && recent.n > PER_SENDER_MAX) {
      const notified = s.rate_notified_at && Date.now() - new Date(s.rate_notified_at).getTime() < PER_SENDER_WINDOW_MINUTES * 60e3;
      await tx.query(`update channel_sessions set last_inbound_at = now(), rate_notified_at = coalesce($2, rate_notified_at) where id = $1`, [
        s.id,
        notified ? null : new Date(),
      ]);
      return notified ? [] : [{ type: 'text', body: t('wa.rateLimited') } as OutMessage];
    }

    // Monthly soft cap: new conversations get the web link; open drafts and cases continue.
    if (args.channel === 'whatsapp' && turn.state === 'menu' && (await softCapReached(tx))) {
      const bound = await one(tx, `select 1 from case_access where sender_key = $1 limit 1`, [senderKey]);
      if (!bound) {
        await tx.query(`update channel_sessions set last_inbound_at = now() where id = $1`, [s.id]);
        return [{ type: 'text', body: t('wa.softCap', { link: env.baseUrl() }) } as OutMessage];
      }
    }

    const deps: Deps = {
      lookup: async (ref) => {
        const p = await getPassport(ref);
        if (!p) return null;
        return {
          ref: p.ref,
          title: p.version.title,
          publisher: p.publisher.name,
          number: p.version.number,
          total: p.version.total,
          publishedAt: p.version.publishedAt,
          status: p.status,
          latestNumber: p.latest?.number ?? null,
          latestNote: p.latest?.changeNote ?? null,
          passportUrl: `${env.baseUrl()}/p/${p.ref}`,
        };
      },
      passageMatches: async (ref, passage) => {
        const v = await one(tx, `select body from output_versions where public_ref = $1`, [ref]);
        return Boolean(v && passageIn(v.body, passage));
      },
      submit: async (draft, locale) => {
        const r = await submitComplaintTx(tx, {
          ref: draft.ref,
          passage: draft.passage,
          concern: draft.concern,
          evidenceUrl: draft.evidence ?? undefined,
          channel: 'whatsapp',
          locale,
          senderKey,
          replyAddressEnc: replyEnc ?? undefined,
        });
        return { caseRef: r.caseRef, trackingUrl: r.trackingUrl };
      },
      track: (locale) => casesForSender(senderKey, locale),
      formatDate: (iso, locale) => formatDate(iso, locale),
      webUrl: env.baseUrl(),
    };

    const result = await step(turn, { type: args.inbound.type, text: args.inbound.text, choiceId: args.inbound.choiceId }, deps);
    const n = result.turn;
    await tx.query(
      `update channel_sessions set state = $2, draft = $3, locale = $4, invalid_count = $5, stopped = $6,
              state_version = state_version + 1, last_inbound_at = now(),
              expires_at = now() + make_interval(mins => $7), updated_at = now(),
              reply_address_enc = case when $6 then null else coalesce($8, reply_address_enc) end
        where id = $1`,
      [s.id, n.state, JSON.stringify(n.draft), n.locale, n.invalidCount, n.stopped, SESSION_IDLE_MINUTES, replyEnc],
    );

    if (replyEnc) {
      for (let i = 0; i < result.replies.length; i++) {
        await enqueue(tx, 'whatsapp.send', { toEnc: replyEnc, senderKey, message: result.replies[i] }, `reply:${args.idempotencyKey}:${i}`, args.channel);
        if (args.channel === 'whatsapp') await countUsage(tx, 'outbound');
      }
    }
    await tx.query(`update channel_events set processed_at = now() where id = $1`, [args.eventId]);
    log({ event: 'message.received', sender_key: senderKey, idempotency_key: args.idempotencyKey, state: n.state, replies: result.replies.length });
    return result.replies;
  });
  return replies;
}

async function countUsage(tx: Tx, dir: 'inbound' | 'outbound') {
  const col = dir === 'inbound' ? 'inbound_count' : 'outbound_count';
  await tx.query(
    `insert into channel_usage (month, ${col}) values ($1, 1)
     on conflict (month) do update set ${col} = channel_usage.${col} + 1,
       soft_cap_reached_at = case when channel_usage.soft_cap_reached_at is null
         and channel_usage.inbound_count + channel_usage.outbound_count + 1 >= $2 then now() else channel_usage.soft_cap_reached_at end`,
    [monthKey(), env.monthlyMessageSoftCap()],
  );
}

async function softCapReached(tx: Tx) {
  const u = await one(tx, `select soft_cap_reached_at from channel_usage where month = $1`, [monthKey()]);
  return Boolean(u?.soft_cap_reached_at);
}

export async function usageSummary() {
  return asSystem(async (tx) => {
    const u = await one(tx, `select * from channel_usage where month = $1`, [monthKey()]);
    return {
      month: monthKey(),
      inbound: u?.inbound_count ?? 0,
      outbound: u?.outbound_count ?? 0,
      softCap: env.monthlyMessageSoftCap(),
      softCapReachedAt: u?.soft_cap_reached_at ?? null,
    };
  });
}

/** Simulator entry point. Clearly labelled in the UI; never evidence of a WhatsApp integration. */
export async function simulateInbound(simUser: string, input: { text?: string; choiceId?: string }) {
  const senderId = `sim:${simUser}`;
  const key = `sim:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const inbound: Pick<Inbound, 'type' | 'text' | 'choiceId' | 'phone'> = {
    type: input.choiceId ? 'interactive' : 'text',
    text: input.text?.trim() || null,
    choiceId: input.choiceId ?? null,
    phone: null,
  };
  const eventId = await asSystem(async (tx) => {
    const r = await one(
      tx,
      `insert into channel_events (idempotency_key, webhook_event, sender_key, is_test, payload) values ($1, 'simulator.message', $2, false, $3) returning id`,
      [key, senderKeyFor(senderId), JSON.stringify({ simulator: true, ...inbound })],
    );
    return r.id as string;
  });
  return processInbound({ channel: 'simulator', senderId, inbound, eventId, idempotencyKey: key });
}


/** Transcript for the labelled simulator page. */
export async function simulatorTranscript(simUser: string) {
  const senderKey = senderKeyFor(`sim:${simUser}`);
  return asSystem(async (tx) => {
    const inbound = await tx.query(
      `select received_at as at, payload from channel_events where sender_key = $1 and webhook_event = 'simulator.message' order by received_at`,
      [senderKey],
    );
    const outbound = await tx.query(
      `select created_at as at, payload->'message' as message from outbox
        where channel = 'simulator' and payload->>'senderKey' = $1 order by created_at, idempotency_key`,
      [senderKey],
    );
    const items = [
      ...inbound.rows.map((r) => ({ at: new Date(r.at).getTime(), dir: 'in' as const, text: r.payload.text as string | null, choiceId: r.payload.choiceId as string | null })),
      ...outbound.rows.map((r) => ({ at: new Date(r.at).getTime() + 1, dir: 'out' as const, message: r.message as OutMessage })),
    ];
    return items.sort((a, b) => a.at - b.at);
  });
}
