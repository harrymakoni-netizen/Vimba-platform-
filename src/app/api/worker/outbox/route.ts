import { timingSafeEqualStr } from '@/lib/crypto';
import { env } from '@/lib/env';
import { runWorkerOnce } from '@/services/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorised(req: Request) {
  const got = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return [env.workerSecret(), env.cronSecret()].some((s) => s && timingSafeEqualStr(got, s));
}

async function run(req: Request) {
  if (!authorised(req)) return new Response('unauthorized', { status: 401 });
  const results = await runWorkerOnce(50);
  return Response.json({ processed: results.length, ok: results.filter((r) => r.ok).length });
}

/** Scheduler: POST with Authorization: Bearer $VIMBA_WORKER_SECRET. */
export const POST = run;
/** Vercel Cron: GET with Authorization: Bearer $CRON_SECRET. */
export const GET = run;
