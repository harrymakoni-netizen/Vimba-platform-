import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { availableLocales, isLocale, translator, type Locale } from './index';

export const LOCALE_COOKIE = 'vimba_locale';

/** Locale for the current request: cookie, else English. */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  const allowed = availableLocales(env.allowDraftLocales());
  return isLocale(c) && allowed.includes(c) ? c : 'en';
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}
