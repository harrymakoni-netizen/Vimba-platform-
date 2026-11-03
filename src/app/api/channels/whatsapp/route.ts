import { ingestKapsoWebhook } from '@/channels/whatsapp/handler';
import { runWorkerOnce } from '@/services/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Kapso webhook: verify the raw bytes, deduplicate, acknowledge fast; sends go through the outbox. */
export async function POST(req: Request) {
  const raw = await req.text(); // sign the bytes, not parsed JSON
  const r = await ingestKapsoWebhook(raw, req.headers);
  if (r.status === 200) {
    // Best-effort prompt delivery; the worker route/script retries anything left.
    setTimeout(() => void runWorkerOnce(10).catch(() => undefined), 0);
  }
  return new Response(r.body, { status: r.status });
}
