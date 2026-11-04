import { asSystem } from '@/lib/db';
import { randomToken, sha256Hex, verifyPassword } from '@/lib/crypto';
import type { Actor, Role } from './actor';

const SESSION_DAYS = 7;

/** Sessions are stored as token digests only; the raw token lives in an httpOnly cookie. */
export async function login(email: string, password: string): Promise<{ token: string; expires: Date } | null> {
  return asSystem(async (tx) => {
    const u = await tx.query('select id, password_hash from users where lower(email) = lower($1)', [email.trim()]);
    const user = u.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) return null;
    const token = randomToken(32);
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
    await tx.query('insert into sessions (token_sha256, user_id, expires_at) values ($1, $2, $3)', [
      sha256Hex(token),
      user.id,
      expires,
    ]);
    return { token, expires };
  });
}

/** Demo mode only: start a session for a seeded demo account without a password. */
export async function loginAsDemoUser(email: string): Promise<{ token: string; expires: Date } | null> {
  return asSystem(async (tx) => {
    const u = await tx.query('select id from users where lower(email) = lower($1)', [email]);
    const user = u.rows[0];
    if (!user) return null;
    const token = randomToken(32);
    const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
    await tx.query('insert into sessions (token_sha256, user_id, expires_at) values ($1, $2, $3)', [sha256Hex(token), user.id, expires]);
    return { token, expires };
  });
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await asSystem((tx) => tx.query('delete from sessions where token_sha256 = $1', [sha256Hex(token)]));
}

export interface Membership {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: Role;
}

export async function resolveActor(
  token: string | undefined,
  preferredOrgId?: string,
): Promise<{ actor: Actor; memberships: Membership[] } | null> {
  if (!token) return null;
  return asSystem(async (tx) => {
    const s = await tx.query(
      `select u.id, u.display_name, u.email from sessions s join users u on u.id = s.user_id
        where s.token_sha256 = $1 and s.expires_at > now()`,
      [sha256Hex(token)],
    );
    const user = s.rows[0];
    if (!user) return null;
    const m = await tx.query(
      `select o.id as org_id, o.name, o.slug, m.role from memberships m join organisations o on o.id = m.org_id
        where m.user_id = $1 order by o.name`,
      [user.id],
    );
    const memberships: Membership[] = m.rows.map((r) => ({ orgId: r.org_id, orgName: r.name, orgSlug: r.slug, role: r.role }));
    if (!memberships.length) return null;
    const current = memberships.find((x) => x.orgId === preferredOrgId) ?? memberships[0];
    return {
      actor: {
        userId: user.id,
        name: user.display_name,
        email: user.email,
        orgId: current.orgId,
        orgName: current.orgName,
        orgSlug: current.orgSlug,
        role: current.role,
      },
      memberships,
    };
  });
}
