import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveActor, type Membership } from '@/services/auth';
import type { Actor } from '@/services/actor';
import { env } from './env';
import { sealValue, unsealValue } from './crypto';
import { ensureSecrets } from './db';

export const SESSION_COOKIE = 'vimba_session';
export const ORG_COOKIE = 'vimba_org';
export const CASE_COOKIE = 'vimba_case';

export async function currentActor(): Promise<{ actor: Actor; memberships: Membership[] } | null> {
  const jar = await cookies();
  return resolveActor(jar.get(SESSION_COOKIE)?.value, jar.get(ORG_COOKIE)?.value);
}

export async function requireActor(): Promise<Actor> {
  const r = await currentActor();
  if (!r) redirect('/login');
  return r.actor;
}

const secure = () => env.baseUrl().startsWith('https://');

export async function setSessionCookie(token: string, expires: Date) {
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: secure(), path: '/', expires });
}

/** Case access is a sealed cookie scoped to /case; the raw tracking token never stays in the URL. */
export function caseCookie(accessId: string) {
  const exp = Date.now() + 12 * 3600e3;
  return {
    name: CASE_COOKIE,
    value: sealValue({ a: accessId, exp }, env.appSecret()),
    options: { httpOnly: true, sameSite: 'lax' as const, secure: secure(), path: '/case', expires: new Date(exp) },
  };
}

export async function currentCaseAccess(): Promise<string | null> {
  const v = (await cookies()).get(CASE_COOKIE)?.value;
  if (!v) return null;
  await ensureSecrets();
  return unsealValue<{ a: string }>(v, env.appSecret())?.a ?? null;
}
