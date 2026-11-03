import { after } from 'next/server';
import { ingestKapsoWebhook } from '@/channels/whatsapp/handler';
import { runWorkerOnce } from '@/services/worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Kapso webhook: verify the raw bytes, deduplicate, acknowledge fast; sends go through the outbox. */
export async function POST(req: Request) {
  const raw = await req.text(); // sign the bytes, not parsed JSON
  const r = await ingestKapsoWebhook(raw, req.headers);
  if (r.status === 200) {
    // Deliver replies after the response is sent; the cron worker retries anything left.
    after(() => runWorkerOnce(10).then(() => undefined).catch(() => undefined));
  }
  return new Response(r.body, { status: r.status });
}
