import { cookies } from 'next/headers';
import { isLocale, translator, type Locale } from './index';

export const LOCALE_COOKIE = 'vimba_locale';

/** Locale for the current request: cookie, else English. */
export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : 'en';
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}
