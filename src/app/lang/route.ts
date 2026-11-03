import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/lib/env';
import { availableLocales, isLocale } from '@/lib/i18n';
import { LOCALE_COOKIE } from '@/lib/i18n/server';

/** Set the interface language and return to the same page (same-origin paths only). */
export function GET(req: NextRequest) {
  const l = req.nextUrl.searchParams.get('l');
  const base = req.nextUrl.origin;
  let next = req.nextUrl.searchParams.get('next') ?? '';
  if (!next) {
    const ref = req.headers.get('referer');
    try {
      const u = ref ? new URL(ref) : null;
      if (u && u.origin === base) next = u.pathname + u.search;
    } catch {}
  }
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/case/open')) next = '/';
  const res = NextResponse.redirect(new URL(next, base), 303);
  if (isLocale(l) && availableLocales(env.allowDraftLocales()).includes(l)) {
    res.cookies.set(LOCALE_COOKIE, l, { path: '/', maxAge: 365 * 864e2, sameSite: 'lax' });
  }
  return res;
}
