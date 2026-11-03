import { api, body } from '@/lib/api';
import { AppError } from '@/lib/errors';
import { allow, clientKey } from '@/lib/ratelimit';
import { submitComplaint } from '@/services/complaints';

/** Public intake tied to a registered version. The tracking token is returned once. */
export async function POST(req: Request) {
  return api(async () => {
    if (!allow(`complaint:${clientKey(req.headers)}`, 5, 3600e3)) throw new AppError('rate_limited', 'Too many requests');
    const b = await body(req);
    const r = await submitComplaint({
      ref: String(b.ref ?? ''),
      passage: String(b.passage ?? ''),
      concern: String(b.concern ?? ''),
      evidenceUrl: b.evidenceUrl ? String(b.evidenceUrl) : undefined,
      channel: 'web',
      locale: typeof b.locale === 'string' ? b.locale : 'en',
    });
    return { caseRef: r.caseRef, trackingUrl: r.trackingUrl };
  }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
