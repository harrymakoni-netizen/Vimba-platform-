import { hmacHex, timingSafeEqualStr } from '@/lib/crypto';

/**
 * Kapso signs the exact raw request bytes with HMAC-SHA256 (hex) using the
 * webhook secret and sends it in X-Webhook-Signature. Verify BEFORE parsing.
 */
export function verifyKapsoSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const want = hmacHex(secret, rawBody);
  return timingSafeEqualStr(header.trim().toLowerCase(), want);
}
