export const MAX_AUDIO_BYTES = 3 * 1024 * 1024;
export type AudioMime = 'audio/webm' | 'audio/ogg' | 'audio/mp4' | 'audio/wav' | 'audio/mpeg';

/** Identify audio by its first bytes, never by a client-supplied type or name. */
export function sniffAudio(b: Uint8Array): AudioMime | null {
  const s = (from: number, to: number) => String.fromCharCode(...Array.from(b.slice(from, to)));
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm';
  if (b.length >= 4 && s(0, 4) === 'OggS') return 'audio/ogg';
  if (b.length >= 12 && s(4, 8) === 'ftyp') return 'audio/mp4';
  if (b.length >= 12 && s(0, 4) === 'RIFF' && s(8, 12) === 'WAVE') return 'audio/wav';
  if (b.length >= 3 && (s(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0))) return 'audio/mpeg';
  return null;
}

export type AudioCheck = { ok: true; mime: AudioMime; bytes: Buffer } | { ok: false; reason: 'empty' | 'too_large' | 'not_audio' };

export function checkAudio(input: Uint8Array | Buffer): AudioCheck {
  const bytes = Buffer.from(input);
  if (!bytes.length) return { ok: false, reason: 'empty' };
  if (bytes.length > MAX_AUDIO_BYTES) return { ok: false, reason: 'too_large' };
  const mime = sniffAudio(bytes);
  return mime ? { ok: true, mime, bytes } : { ok: false, reason: 'not_audio' };
}
