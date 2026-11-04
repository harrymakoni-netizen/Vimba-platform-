import { z } from 'zod';

// Kapso v2 webhook payload. Field presence varies by message type and user
// privacy settings: everything except phone_number_id is optional.
const optStr = z.string().optional().nullable();

export const kapsoEventSchema = z
  .object({
    phone_number_id: z.string(),
    is_new_conversation: z.boolean().optional(),
    test: z.boolean().optional(),
    message: z
      .object({
        id: optStr,
        timestamp: optStr,
        type: optStr,
        from: optStr,
        from_user_id: optStr,
        status: optStr,
        text: z.object({ body: optStr }).partial().optional().nullable(),
        interactive: z
          .object({
            type: optStr,
            button_reply: z.object({ id: optStr, title: optStr }).partial().optional().nullable(),
            list_reply: z.object({ id: optStr, title: optStr }).partial().optional().nullable(),
          })
          .partial()
          .optional()
          .nullable(),
        button: z.object({ payload: optStr, text: optStr }).partial().optional().nullable(),
        image: z.object({ id: optStr, mime_type: optStr, caption: optStr, link: optStr }).partial().passthrough().optional().nullable(),
        kapso: z
          .object({
            direction: optStr,
            status: optStr,
            has_media: z.boolean().optional().nullable(),
            media_url: optStr,
            transcript: z.object({ text: optStr }).partial().optional().nullable(),
          })
          .partial()
          .optional()
          .nullable(),
        errors: z.array(z.object({ code: z.union([z.number(), z.string()]).optional() }).passthrough()).optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
    conversation: z
      .object({
        id: optStr,
        phone_number: optStr,
        business_scoped_user_id: optStr,
        phone_number_id: optStr,
      })
      .partial()
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export type KapsoEvent = z.infer<typeof kapsoEventSchema>;

export interface Inbound {
  messageId: string | null;
  type: 'text' | 'interactive' | 'image' | 'audio' | 'other';
  text: string | null;
  /** ID of a button or list row that Vimba issued. Never match on visible titles. */
  choiceId: string | null;
  /** Business-scoped user ID when present (preferred stable identity). */
  bsuid: string | null;
  /** Reply address (phone digits) when present. */
  phone: string | null;
  conversationId: string | null;
  /** Photo sent by the reader: WhatsApp media id and/or Kapso-hosted URL. */
  media: { id: string | null; url: string | null; mime: string | null } | null;
}

const MAX_TEXT = 2000;

export function extractInbound(e: KapsoEvent): Inbound {
  const m = e.message ?? {};
  const rawType = m.type ?? '';
  const type: Inbound['type'] =
    rawType === 'text' ? 'text' : rawType === 'interactive' || rawType === 'button' ? 'interactive' : rawType === 'audio' ? 'audio' : rawType === 'image' ? 'image' : 'other';
  const choiceId = m.interactive?.button_reply?.id ?? m.interactive?.list_reply?.id ?? m.button?.payload ?? null;
  const text = (m.text?.body ?? '').trim().slice(0, MAX_TEXT) || null;
  const phone = (m.from ?? e.conversation?.phone_number ?? '').replace(/\D/g, '') || null;
  return {
    messageId: m.id ?? null,
    type,
    text,
    choiceId,
    bsuid: m.from_user_id ?? e.conversation?.business_scoped_user_id ?? null,
    phone,
    conversationId: e.conversation?.id ?? null,
    media:
      type === 'image'
        ? { id: m.image?.id ?? null, url: m.kapso?.media_url ?? m.image?.link ?? null, mime: m.image?.mime_type ?? null }
        : null,
  };
}

/** WhatsApp error codes from a failed status event, e.g. 131047 (re-engagement required). */
export function extractErrorCode(e: KapsoEvent): string | null {
  const code = e.message?.errors?.[0]?.code;
  return code === undefined || code === null ? null : String(code);
}
