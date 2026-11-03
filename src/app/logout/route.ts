import { NextResponse, type NextRequest } from 'next/server';
import { logout } from '@/services/auth';
import { SESSION_COOKIE } from '@/lib/session';

export async function POST(req: NextRequest) {
  await logout(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(new URL('/login', req.nextUrl.origin), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
