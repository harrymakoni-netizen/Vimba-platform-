import { sha256Hex } from './crypto';

// Small in-process limiter for public web intake. A multi-instance deployment
// should move this to the database or an edge limiter.
const buckets = new Map<string, number[]>();

export function allow(key: string, max: number, windowMs: number): boolean {
  const k = sha256Hex(key);
  const now = Date.now();
  const hits = (buckets.get(k) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(k, hits);
    return false;
  }
  hits.push(now);
  buckets.set(k, hits);
  if (buckets.size > 10_000) buckets.clear();
  return true;
}

export function clientKey(headers: Headers): string {
  return (headers.get('x-forwarded-for')?.split(',')[0] ?? headers.get('x-real-ip') ?? 'local').trim();
}
