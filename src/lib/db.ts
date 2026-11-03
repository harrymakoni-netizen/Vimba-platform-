import { Pool, type PoolClient } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var __vimbaPool: Pool | undefined;
}

export function pool(): Pool {
  if (!globalThis.__vimbaPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');
    globalThis.__vimbaPool = new Pool({ connectionString, max: 10 });
  }
  return globalThis.__vimbaPool;
}

export type Tx = PoolClient;

export type DbContext =
  | { kind: 'system' }
  | { kind: 'member'; orgIds: string[] };

/**
 * Run `fn` in a transaction as the restricted `vimba_app` role with the
 * tenant context applied, so row level security agrees with the
 * application-level permission checks.
 */
export async function withTx<T>(ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query('begin');
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
    await client.query('rollback').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
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
