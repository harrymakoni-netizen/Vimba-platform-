import { sha256Hex } from './crypto';
import type { Tx } from './db';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export type PhotoMime = 'image/jpeg' | 'image/png' | 'image/webp';

/** Identify an image by its first bytes, never by a client-supplied type or name. */
export function sniffImage(buf: Uint8Array): PhotoMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (
    buf.length >= 12 &&
    String.fromCharCode(buf[0], buf[1], buf[2], buf[3]) === 'RIFF' &&
    String.fromCharCode(buf[8], buf[9], buf[10], buf[11]) === 'WEBP'
  )
    return 'image/webp';
  return null;
}

export type PhotoCheck = { ok: true; mime: PhotoMime; bytes: Buffer } | { ok: false; reason: 'empty' | 'too_large' | 'not_image' };

export function checkPhoto(input: Uint8Array | Buffer): PhotoCheck {
  const bytes = Buffer.from(input);
  if (!bytes.length) return { ok: false, reason: 'empty' };
  if (bytes.length > MAX_PHOTO_BYTES) return { ok: false, reason: 'too_large' };
  const mime = sniffImage(bytes);
  if (!mime) return { ok: false, reason: 'not_image' };
  return { ok: true, mime, bytes };
}

/** Store a photo that has arrived before its complaint exists (WhatsApp). System transactions only. */
export async function storePendingPhoto(tx: Tx, senderKey: string, photo: { mime: PhotoMime; bytes: Buffer }) {
  const r = await tx.query(
    `insert into complaint_photos (sender_key, mime, bytes, size_bytes, sha256) values ($1,$2,$3,$4,$5) returning id`,
    [senderKey, photo.mime, photo.bytes, photo.bytes.length, sha256Hex(photo.bytes)],
  );
  return r.rows[0].id as string;
}

/** Delete photos that were never attached to a complaint. */
export async function purgeUnlinkedPhotos(tx: Tx) {
  await tx.query(`delete from complaint_photos where complaint_id is null and created_at < now() - interval '1 day'`);
}
