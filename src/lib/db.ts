import { Pool, type PoolClient } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __vimbaPool: Pool | undefined;
}

export function pool(): Pool {
  if (!globalThis.__vimbaPool) {
    // DATABASE_URL (Neon) or POSTGRES_URL (Supabase/Vercel Postgres integrations).
    const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    const p = new Pool({
      connectionString,
      // Serverless functions: few connections per instance, short idle life.
      max: process.env.VERCEL ? 3 : 10,
      connectionTimeoutMillis: 15_000,
      idleTimeoutMillis: 10_000,
    });
    // An idle client dropped by the server must never crash the process.
    p.on('error', (err) => {
      console.error(JSON.stringify({ level: 'warn', component: 'db', msg: 'idle client error', code: (err as { code?: string }).code ?? null }));
    });
    globalThis.__vimbaPool = p;
  }
  return globalThis.__vimbaPool;
}

export type Tx = PoolClient;

export type DbContext =
  | { kind: 'system' }
  | { kind: 'member'; orgIds: string[] };

const TRANSIENT = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', '57P01', '57P03', '08006', '08001', '08004']);

export function isTransient(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  if (e?.code && TRANSIENT.has(e.code)) return true;
  const m = e?.message ?? '';
  return /Connection terminated|socket disconnected|timeout exceeded when trying to connect|Client has encountered a connection error/i.test(m);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Connect and open a transaction, retrying while the database wakes up
 * (serverless Postgres suspends when idle). Only the connect/BEGIN phase is
 * retried, never the work itself.
 */
async function begin(): Promise<PoolClient> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    let client: PoolClient | undefined;
    try {
      client = await pool().connect();
      await client.query('begin');
      return client;
    } catch (err) {
      lastErr = err;
      client?.release(true); // destroy a broken client instead of returning it to the pool
      if (!isTransient(err)) throw err;
      await sleep(300 * 2 ** attempt);
    }
  }
  throw lastErr;
}

/** Transaction without loading demo secrets first (used by the secrets loader itself). */
export async function rawTx<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await begin();
  let broken = false;
  try {
    await client.query('set local role vimba_app');
    if (ctx.kind === 'system') {
      await client.query(`select set_config('app.system', 'on', true), set_config('app.org_ids', '', true)`);
    } else {
      const ids = ctx.orgIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id));
      await client.query(`select set_config('app.system', 'off', true), set_config('app.org_ids', $1, true)`, [
        `{${ids.join(',')}}`,
      ]);
    }
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    broken = isTransient(err);
    await client.query('rollback').catch(() => {
      broken = true;
    });
    throw err;
  } finally {
    client.release(broken);
  }
}

/** Make sure secrets missing from the environment are loaded (demo mode). Never runs twice at once. */
export async function ensureSecrets(): Promise<void> {
  const { loadSecretsIntoEnv } = await import('./secrets');
  await loadSecretsIntoEnv();
}

/**
 * Run `fn` in a transaction as the restricted `vimba_app` role with the
 * tenant context applied, so row level security agrees with the
 * application-level permission checks.
 */
export async function withTx<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  await ensureSecrets();
  return rawTx(ctx, fn);
}

export const asSystem = <T>(fn: (tx: Tx) => Promise<T>) => withTx({ kind: 'system' }, fn);

export async function one<T = any>(tx: Tx, sql: string, params: unknown[] = []): Promise<T | null> {
  const r = await tx.query(sql, params);
  return (r.rows[0] as T) ?? null;
}

export async function many<T = any>(tx: Tx, sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await tx.query(sql, params);
  return r.rows as T[];
}
