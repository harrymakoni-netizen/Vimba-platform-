import crypto from 'node:crypto';
import { generateSigningKeyPair } from '@/lib/crypto';

// Isolated test configuration. Never points at the development database.
const { privateKeyPem, publicKeyPem } = generateSigningKeyPair();
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgres://vimba_owner:owner@127.0.0.1:54329/vimba_test';
process.env.VIMBA_SIGNING_KEY_ID = 'test-key';
process.env.VIMBA_SIGNING_PRIVATE_KEY = privateKeyPem;
process.env.VIMBA_SIGNING_PUBLIC_KEY = publicKeyPem;
process.env.VIMBA_APP_SECRET = crypto.randomBytes(32).toString('hex');
process.env.CHANNEL_SENDER_PEPPER = crypto.randomBytes(32).toString('hex');
process.env.KAPSO_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.KAPSO_PHONE_NUMBER_ID = 'pn_test';
process.env.VIMBA_BASE_URL = 'https://vimba.test';
