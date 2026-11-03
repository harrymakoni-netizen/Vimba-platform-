import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { pool } from '@/lib/db';
import { signCanonical, verifyCanonical } from '@/lib/crypto';

const KEYS = ['VIMBA_SIGNING_KEY_ID', 'VIMBA_SIGNING_PRIVATE_KEY', 'VIMBA_SIGNING_PUBLIC_KEY', 'VIMBA_APP_SECRET', 'VIMBA_WORKER_SECRET', 'CHANNEL_SENDER_PEPPER', 'KAPSO_WEBHOOK_SECRET'];
const saved: Record<string, string | undefined> = {};

beforeAll(async () => {
  for (const k of KEYS) saved[k] = process.env[k];
  await clear();
});
afterAll(async () => {
  for (const k of KEYS) process.env[k] = saved[k];
  await clear();
});

// Cleanup as the owner: the app role may only read and insert secrets.
async function clear() {
  const c = await pool().connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('app.system', 'on', true)`);
    await c.query('delete from system_secrets');
    await c.query('commit');
  } finally {
    c.release();
  }
}

const freshLoad = async () => {
  vi.resetModules();
  return (await import('@/lib/secrets')).loadSecretsIntoEnv();
};

describe('database-stored demo secrets', () => {
  it('generates missing secrets once and every instance reads the same values', async () => {
    for (const k of KEYS) delete process.env[k];
    const applied = await freshLoad();
    expect(applied.sort()).toEqual([...KEYS].sort());
    const first = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    const sig = signCanonical({ a: 1 }, process.env.VIMBA_SIGNING_PRIVATE_KEY!);
    expect(verifyCanonical({ a: 1 }, sig, process.env.VIMBA_SIGNING_PUBLIC_KEY!)).toBe(true);

    // A second cold start gets identical values from the database.
    for (const k of KEYS) delete process.env[k];
    await freshLoad();
    for (const k of KEYS) expect(process.env[k]).toBe(first[k]);
  });

  it('environment variables take precedence', async () => {
    process.env.VIMBA_APP_SECRET = 'from-env';
    await freshLoad();
    expect(process.env.VIMBA_APP_SECRET).toBe('from-env');
  });
});
