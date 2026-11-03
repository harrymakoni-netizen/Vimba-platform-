import { NextResponse } from 'next/server';
import { body } from '@/lib/api';
import { caseCookie } from '@/lib/session';
import { getCaseForComplainant, redeemCaseToken } from '@/services/complaints';

/** Redeem a protected token into a scoped session. No lookup from a case reference alone. */
export async function POST(req: Request) {
  const b = await body(req).catch(() => ({}) as Record<string, unknown>);
  const access = await redeemCaseToken(String(b.token ?? ''));
  if (!access) return NextResponse.json({ error: { code: 'not_found', message: 'Not found' } }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const data = await getCaseForComplainant(access.accessId);
  const res = NextResponse.json(data, { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
  const c = caseCookie(access.accessId);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
