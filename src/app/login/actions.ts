'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { loginAsDemoUser } from '@/services/auth';
import { DEMO_ACCOUNTS } from '@/services/demo';
import { ORG_COOKIE, setSessionCookie } from '@/lib/session';
import { env } from '@/lib/env';

export async function demoSignInAction(form: FormData) {
  if (!env.demoMode()) redirect('/login');
  const role = String(form.get('role') ?? '');
  const account = DEMO_ACCOUNTS.find((a) => a.role === role);
  if (!account) redirect('/login');
  const r = await loginAsDemoUser(account.email);
  if (!r) redirect('/login?missing=1');
  await setSessionCookie(r.token, r.expires);
  (await cookies()).delete(ORG_COOKIE);
  redirect(role === 'partner_editor' ? '/app/relay' : '/app/stories');
}
