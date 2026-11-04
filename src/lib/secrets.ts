import crypto from 'node:crypto';
import { rawTx } from './db';
import { generateSigningKeyPair } from './crypto';

/**
 * DEMO CONVENIENCE. Fills any secret missing from the environment with a
 * value generated once and stored in `system_secrets`. Environment variables
 * always win, so moving to properly managed secrets is just a matter of
 * setting them in the hosting provider.
 *
 * Idempotent and safe under concurrent cold starts: inserts use ON CONFLICT
 * DO NOTHING and every instance then reads back the same stored values.
 */
const RANDOM_SECRETS = ['VIMBA_APP_SECRET', 'VIMBA_WORKER_SECRET', 'CHANNEL_SENDER_PEPPER', 'KAPSO_WEBHOOK_SECRET'] as const;
const SIGNING = ['VIMBA_SIGNING_KEY_ID', 'VIMBA_SIGNING_PRIVATE_KEY', 'VIMBA_SIGNING_PUBLIC_KEY'] as const;

let loaded: Promise<string[]> | null = null;

export function loadSecretsIntoEnv(): Promise<string[]> {
  loaded ??= load().catch((err) => {
    loaded = null; // allow a retry on the next request
    throw err;
  });
  return loaded;
}

async function load(): Promise<string[]> {
  const missingRandom = RANDOM_SECRETS.filter((k) => !process.env[k]);
  // The signing key pair is only generated when none of its parts is configured.
  const needSigning = SIGNING.every((k) => !process.env[k]);
  if (!missingRandom.length && !needSigning) return [];

  return rawTx({ kind: 'system' }, async (tx) => {
    for (const k of missingRandom) {
      await tx.query(`insert into system_secrets (name, value) values ($1, $2) on conflict (name) do nothing`, [
        k,
        crypto.randomBytes(32).toString('hex'),
      ]);
    }
    if (needSigning) {
      const { privateKeyPem, publicKeyPem } = generateSigningKeyPair();
      // One row for the whole key pair keeps it consistent.
      await tx.query(`insert into system_secrets (name, value) values ('SIGNING_KEY_PAIR', $1) on conflict (name) do nothing`, [
        JSON.stringify({ keyId: `demo-${crypto.randomBytes(4).toString('hex')}`, privateKeyPem, publicKeyPem }),
      ]);
    }
    const { rows } = await tx.query(`select name, value from system_secrets`);
    const applied: string[] = [];
    for (const r of rows as { name: string; value: string }[]) {
      if (r.name === 'SIGNING_KEY_PAIR') {
        if (!needSigning) continue;
        const kp = JSON.parse(r.value);
        process.env.VIMBA_SIGNING_KEY_ID = kp.keyId;
        process.env.VIMBA_SIGNING_PRIVATE_KEY = kp.privateKeyPem;
        process.env.VIMBA_SIGNING_PUBLIC_KEY = kp.publicKeyPem;
        applied.push(...SIGNING);
      } else if ((RANDOM_SECRETS as readonly string[]).includes(r.name) && !process.env[r.name]) {
        process.env[r.name] = r.value;
        applied.push(r.name);
      }
    }
    return applied;
  });
}
