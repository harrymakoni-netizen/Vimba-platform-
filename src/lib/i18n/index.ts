import { en, type Dict, type MessageKey } from './en';
import { sn } from './sn';
import { nd } from './nd';

export type Locale = 'en' | 'sn' | 'nd';
export const LOCALES: Locale[] = ['en', 'sn', 'nd'];

/**
 * Review status per language pack. Change a pack to 'reviewed' only after a
 * fluent reviewer has signed off every string (record who and when).
 * The plan: core interface in English and Shona with human-reviewed strings,
 * Ndebele through a reviewed language pack.
 */
export const LOCALE_META: Record<Locale, { name: string; htmlLang: string; status: 'reviewed' | 'draft'; reviewedBy?: string }> = {
  en: { name: 'English', htmlLang: 'en', status: 'reviewed' },
  sn: { name: 'chiShona', htmlLang: 'sn', status: 'draft' },
  nd: { name: 'isiNdebele', htmlLang: 'nd', status: 'draft' },
};

const PACKS: Record<Locale, Dict> = { en, sn, nd };

export const isLocale = (v: unknown): v is Locale => typeof v === 'string' && (LOCALES as string[]).includes(v);

export function availableLocales(allowDraft: boolean): Locale[] {
  return LOCALES.filter((l) => allowDraft || LOCALE_META[l].status === 'reviewed');
}

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

export function formatDate(d: Date | string, locale: Locale): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  // Intl data for sn/nd is sparse; use an unambiguous numeric-month format
  // (3 Nov 2026, 14:05) with English month abbreviations as a stable fallback.
  const intlLocale = locale === 'en' ? 'en-GB' : `${locale}-ZW`;
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Africa/Harare',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

export type { MessageKey, Dict };
