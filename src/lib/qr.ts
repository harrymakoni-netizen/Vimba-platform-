import QRCode from 'qrcode';
import { env } from './env';

export const passportUrl = (ref: string) => `${env.baseUrl()}/p/${ref}`;

/** wa.me link with the CHECK command pre-filled, or null if no public number is configured. */
export function whatsappCheckUrl(ref: string): string | null {
  const n = env.whatsappPublicNumber();
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(`CHECK ${ref}`)}` : null;
}

export function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: 'svg', errorCorrectionLevel: 'M', margin: 1, color: { dark: '#1b2e31', light: '#ffffff' } });
}
