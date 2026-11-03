'use server';

import { redirect } from 'next/navigation';
import { login } from '@/services/auth';
import { setSessionCookie } from '@/lib/session';
import { allow, clientKey } from '@/lib/ratelimit';
import { headers } from 'next/headers';

export async function loginAction(form: FormData) {
  if (!allow(`login:${clientKey(await headers())}`, 10, 15 * 60e3)) redirect('/login?error=rate');
  const r = await login(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
  if (!r) redirect('/login?error=1');
  await setSessionCookie(r.token, r.expires);
  redirect('/app/stories');
}
