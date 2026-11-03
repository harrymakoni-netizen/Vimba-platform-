import { NextResponse, type NextRequest } from 'next/server';
import { redeemCaseToken } from '@/services/complaints';
import { caseCookie } from '@/lib/session';

/** Redeem the bearer tracking link into a scoped cookie, then drop the token from the URL. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? '';
  const access = await redeemCaseToken(token);
  const res = NextResponse.redirect(new URL(access ? '/case' : '/case?invalid=1', req.nextUrl.origin), 303);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('Referrer-Policy', 'no-referrer');
  if (access) {
    const c = caseCookie(access.accessId);
    res.cookies.set(c.name, c.value, c.options);
  }
  return res;
}
