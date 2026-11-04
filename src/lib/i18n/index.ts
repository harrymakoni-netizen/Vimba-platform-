import { en, type Dict, type MessageKey } from './en';
import { sn } from './sn';
import { nd } from './nd';

export type Locale = 'en' | 'sn' | 'nd';
export const LOCALES: Locale[] = ['en', 'sn', 'nd'];

export const LOCALE_META: Record<Locale, { name: string; htmlLang: string }> = {
  en: { name: 'English', htmlLang: 'en' },
  sn: { name: 'chiShona', htmlLang: 'sn' },
  nd: { name: 'isiNdebele', htmlLang: 'nd' },
};

const PACKS: Record<Locale, Dict> = { en, sn, nd };

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as string[]).includes(v);

export type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translator(locale: Locale): T {
  const pack = PACKS[locale] ?? en;
  return (key, vars) => {
    let s = pack[key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };
}

export function packs() {
  return PACKS;
}

export const LANGUAGE_LABEL: Record<Locale, string> = { en: 'English', sn: 'chiShona', nd: 'isiNdebele' };

const MONTHS: Record<Locale, string[]> = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  sn: ['Ndira', 'Kukadzi', 'Kurume', 'Kubvumbi', 'Chivabvu', 'Chikumi', 'Chikunguru', 'Nyamavhuvhu', 'Gunyana', 'Gumiguru', 'Mbudzi', 'Zvita'],
  nd: ['Zibandlela', 'Nhlolanja', 'Mbimbitho', 'Mabasa', 'Nkwenkwezi', 'Nhlangula', 'Ntulikazi', 'Ncwabakazi', 'Mpandula', 'Mfumfu', 'Lwezi', 'Mpalakazi'],
};

/** "4 Nov 2026, 14:05" (or the Shona/Ndebele month name), always in Zimbabwe time. */
export function formatDate(d: Date | string, locale: Locale): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Harare',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const month = MONTHS[locale][Number(get('month')) - 1];
  return `${Number(get('day'))} ${month} ${get('year')}, ${get('hour')}:${get('minute')}`;
}

/** Translate an error message thrown by the services (English text) when a translation exists. */
export function translateError(message: string, locale: Locale): string {
  const key = (Object.keys(en) as MessageKey[]).find((k) => k.startsWith('err.') && en[k] === message);
  return key ? translator(locale)(key) : message;
}

/** System messages are stored as "sys.key|argument" and rendered in the reader's language. */
export function renderSystemMessage(body: string, t: T): string {
  if (!body.startsWith('sys.')) return body;
  const [key, arg] = body.split('|');
  if (!(key in en)) return body;
  return t(key as MessageKey, { refs: arg ?? '' });
}

export type { MessageKey, Dict };
