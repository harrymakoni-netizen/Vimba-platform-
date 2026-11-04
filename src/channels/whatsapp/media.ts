import { env } from '@/lib/env';
import { MAX_PHOTO_BYTES } from '@/lib/photos';
import type { InboundMedia } from './conversation';

/** The API key is only ever sent to Kapso's own hosts, never to a CDN or a URL taken from a payload elsewhere. */
function isKapsoHost(url: string) {
  try {
    const h = new URL(url).host;
    return h === 'kapso.ai' || h.endsWith('.kapso.ai') || h === new URL(env.kapsoApiBase()).host;
  } catch {
    return false;
  }
}

function log(event: Record<string, string | number | boolean | null>) {
  console.log(JSON.stringify({ level: 'info', component: 'whatsapp_media', ...event }));
}

async function fetchBytes(url: string, signal: AbortSignal): Promise<{ status: number; bytes: Buffer | null }> {
  if (!/^https?:\/\//i.test(url)) return { status: 0, bytes: null };
  const headers: Record<string, string> = isKapsoHost(url) ? { 'X-API-Key': env.kapsoApiKey() } : {};
  const res = await fetch(url, { headers, signal, redirect: 'follow' });
  if (!res.ok) return { status: res.status, bytes: null };
  const len = Number(res.headers.get('content-length') ?? 0);
  if (len > MAX_PHOTO_BYTES) return { status: res.status, bytes: null };
  const buf = Buffer.from(await res.arrayBuffer());
  return { status: res.status, bytes: buf.length <= MAX_PHOTO_BYTES ? buf : null };
}

/**
 * Download a photo a reader sent on WhatsApp. Kapso usually includes a hosted
 * media URL in the webhook; otherwise the media id is resolved through Kapso's
 * Meta-compatible media endpoint. Download links expire within minutes, so this
 * runs while the webhook is being handled.
 */
export async function downloadWhatsAppMedia(media: InboundMedia): Promise<Buffer | null> {
  const apiKey = env.kapsoApiKey();
  const pnid = env.kapsoPhoneNumberId();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9_000);
  try {
    if (media.url) {
      const r = await fetchBytes(media.url, controller.signal).catch(() => ({ status: -1, bytes: null }));
      log({ via: 'url', http: r.status, ok: Boolean(r.bytes), bytes: r.bytes?.length ?? 0 });
      if (r.bytes) return r.bytes;
    }
    if (media.id && apiKey) {
      const q = pnid ? `?phone_number_id=${encodeURIComponent(pnid)}` : '';
      const res = await fetch(`${env.kapsoApiBase()}/meta/whatsapp/v24.0/${encodeURIComponent(media.id)}${q}`, {
        headers: { 'X-API-Key': apiKey },
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      const candidates = [data.download_url, data.kapso_url, data.url]
        .filter((u): u is string => typeof u === 'string' && u.length > 0)
        .sort((a, b) => Number(isKapsoHost(b)) - Number(isKapsoHost(a)));
      log({ via: 'id', http: res.status, candidates: candidates.length });
      for (const u of candidates) {
        const r = await fetchBytes(u, controller.signal).catch(() => ({ status: -1, bytes: null }));
        log({ via: 'id_download', http: r.status, ok: Boolean(r.bytes), bytes: r.bytes?.length ?? 0, kapso_host: isKapsoHost(u) });
        if (r.bytes) return r.bytes;
      }
    }
    return null;
  } catch (err) {
    log({ via: 'error', error: (err as Error).name });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
