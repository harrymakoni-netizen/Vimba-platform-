import { AppError, forbidden } from '@/lib/errors';
import { withTx, type Tx } from '@/lib/db';

export type Role = 'reporter' | 'editor' | 'partner_editor';

/** An authenticated newsroom member acting inside exactly one organisation. */
export interface Actor {
  userId: string;
  name: string;
  email: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: Role;
}

export type Permission =
  | 'story.create'
  | 'output.draft'
  | 'output.publish'
  | 'claim.link'
  | 'correction.propose'
  | 'correction.approve'
  | 'complaint.handle'
  | 'relay.respond';

const GRANTS: Record<Role, Permission[]> = {
  reporter: ['story.create', 'output.draft', 'correction.propose'],
  editor: [
    'story.create',
    'output.draft',
    'output.publish',
    'claim.link',
    'correction.propose',
    'correction.approve',
    'complaint.handle',
    'relay.respond',
  ],
  // A partner editor fully controls their own newsroom's copy.
  partner_editor: [
    'story.create',
    'output.draft',
    'output.publish',
    'claim.link',
    'correction.propose',
    'correction.approve',
    'complaint.handle',
    'relay.respond',
  ],
};

export const can = (actor: Actor, p: Permission) => GRANTS[actor.role].includes(p);

export function authorize(actor: Actor | null | undefined, p: Permission): asserts actor is Actor {
  if (!actor) throw new AppError('unauthenticated', 'Sign in required');
  if (!can(actor, p)) throw forbidden();
}

/** Member transaction: RLS restricted to the actor's current organisation. */
export const asMember = <T>(actor: Actor, fn: (tx: Tx) => Promise<T>) =>
  withTx({ kind: 'member', orgIds: [actor.orgId] }, fn);

/**
 * Elevate an in-flight member transaction to system scope after the
 * application has authorised the operation (e.g. fanning a correction out to
 * partner newsrooms). Use sparingly and only after permission checks.
 */
export async function elevate(tx: Tx) {
  await tx.query(`select set_config('app.system', 'on', true)`);
}

export async function audit(
  tx: Tx,
  e: { orgId?: string | null; actorId?: string | null; action: string; refType: string; refId: string; detail?: Record<string, unknown> },
) {
  await tx.query(
    `insert into audit_events (org_id, actor_id, action, ref_type, ref_id, detail) values ($1, $2, $3, $4, $5, $6)`,
    [e.orgId ?? null, e.actorId ?? null, e.action, e.refType, e.refId, JSON.stringify(e.detail ?? {})],
  );
}
