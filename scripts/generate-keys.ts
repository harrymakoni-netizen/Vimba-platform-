import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { generateSigningKeyPair } from '../src/lib/crypto';

// Writes development secrets to .env.local (git-ignored; never commit it).
const file = path.join(process.cwd(), '.env.local');
const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const has = (k: string) => new RegExp(`^${k}=`, 'm').test(existing);
const lines: string[] = [];
const rnd = () => crypto.randomBytes(32).toString('hex');

if (!has('VIMBA_SIGNING_PRIVATE_KEY')) {
  const { privateKeyPem, publicKeyPem } = generateSigningKeyPair();
  lines.push(`VIMBA_SIGNING_KEY_ID=demo-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`);
  lines.push(`VIMBA_SIGNING_PRIVATE_KEY=${Buffer.from(privateKeyPem).toString('base64')}`);
  lines.push(`VIMBA_SIGNING_PUBLIC_KEY=${Buffer.from(publicKeyPem).toString('base64')}`);
}
for (const k of ['VIMBA_APP_SECRET', 'VIMBA_WORKER_SECRET', 'CHANNEL_SENDER_PEPPER', 'KAPSO_WEBHOOK_SECRET']) {
  if (!has(k)) lines.push(`${k}=${rnd()}`);
}
if (lines.length) {
  fs.appendFileSync(file, (existing && !existing.endsWith('\n') ? '\n' : '') + lines.join('\n') + '\n');
  console.log(`wrote ${lines.length} value(s) to .env.local`);
} else {
  console.log('.env.local already has keys');
}
