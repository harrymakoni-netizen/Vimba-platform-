import { decrypt } from '@/lib/crypto';
import { env } from '@/lib/env';
import type { DeliveryResult } from '@/services/outbox';
import type { OutMessage } from './conversation';

/** WhatsApp Cloud API message body for one outbound message. */
export function toCloudApi(to: string, m: OutMessage) {
  const base = { messaging_product: 'whatsapp', recipient_type: 'individual', to };
  switch (m.type) {
    case 'text':
      return { ...base, type: 'text', text: { body: m.body, preview_url: false } };
    case 'buttons':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: m.body },
          action: { buttons: m.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
        },
      };
    case 'list':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: m.body },
          action: { button: m.button, sections: [{ title: 'Vimba', rows: m.rows.slice(0, 10) }] },
        },
      };
    case 'cta':
      return {
        ...base,
        type: 'interactive',
        interactive: {
          type: 'cta_url',
          body: { text: m.body },
          action: { name: 'cta_url', parameters: { display_text: m.label, url: m.url } },
        },
      };
  }
}

/** Outbox handler for whatsapp.send jobs. Only the worker calls this. */
export async function deliverWhatsApp(job: { channel: string | null; payload: { toEnc: string; message: OutMessage } }): Promise<DeliveryResult> {
  // The labelled simulator never touches the network.
  if (job.channel === 'simulator') return { ok: true, providerStatus: 'simulated' };

  const apiKey = env.kapsoApiKey();
  const phoneNumberId = env.kapsoPhoneNumberId();
  if (!apiKey || !phoneNumberId) return { ok: false, errorCode: 'kapso_not_configured' };

  const to = decrypt(job.payload.toEnc, env.appSecret());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`https://api.kapso.ai/meta/whatsapp/v24.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(toCloudApi(to, job.payload.message)),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => ({}))) as any;
    if (res.ok) {
      return { ok: true, providerMessageId: data?.messages?.[0]?.id, providerStatus: 'accepted' };
    }
    const code = String(data?.error?.code ?? res.status);
    // Provider error text only (no recipient, no key) so failures are diagnosable from logs.
    console.log(JSON.stringify({ level: 'warn', component: 'whatsapp_send', http: res.status, code, message: String(data?.error?.message ?? data?.error ?? '').slice(0, 200) }));
    // 131047: outside the 24-hour window (re-engagement required). Record, never retry.
    const permanent = code === '131047' || (res.status >= 400 && res.status < 500 && res.status !== 429);
    return { ok: false, errorCode: code, permanent };
  } finally {
    clearTimeout(timer);
  }
}
