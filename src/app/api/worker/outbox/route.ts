import { timingSafeEqualStr } from '@/lib/crypto';
import { env } from '@/lib/env';
import { runWorkerOnce } from '@/services/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Authenticated worker endpoint for a scheduler: Authorization: Bearer $VIMBA_WORKER_SECRET */
export async function POST(req: Request) {
  const secret = env.workerSecret();
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!secret || !timingSafeEqualStr(got, secret)) return new Response('unauthorized', { status: 401 });
  const results = await runWorkerOnce(50);
  return Response.json({ processed: results.length, ok: results.filter((r) => r.ok).length });
}
