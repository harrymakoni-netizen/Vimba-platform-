import { conflict, invalid, notFound } from '@/lib/errors';
import { asSystem, many, one } from '@/lib/db';
import { asMember, audit, authorize, type Actor } from './actor';
import { lockOutputForRelease, releaseVersion } from './publication';

export type RelayStatus = 'pending' | 'sent' | 'acknowledged' | 'completed' | 'declined' | 'failed' | 'withdrawn';

/** Incoming requests for this newsroom, plus outgoing requests it originated. */
export async function listRelay(actor: Actor) {
  return asMember(actor, async (tx) => {
    const incoming = await many(
      tx,
      `select r.*, origin.name as origin_name, p.title as partner_title, p.language, p.draft_body, p.draft_revision,
              (select public_ref from output_versions where output_id = p.id order by seq desc limit 1) as partner_ref,
              (select id from output_versions where output_id = p.id order by seq desc limit 1) as partner_version_id,
              cv.public_ref as completed_ref
         from relay_requests r
         join organisations origin on origin.id = r.origin_org_id
         join outputs p on p.id = r.partner_output_id
         left join output_versions cv on cv.id = r.completed_version_id
        where r.recipient_org_id = $1 order by r.created_at desc`,
      [actor.orgId],
    );
    const outgoing = await many(
      tx,
      `select r.id, r.status, r.response_note, r.updated_at, rec.name as recipient_name
         from relay_requests r join organisations rec on rec.id = r.recipient_org_id
        where r.origin_org_id = $1 order by r.created_at desc`,
      [actor.orgId],
    );
    return { incoming, outgoing };
  });
}

export type RelayResponse =
  | { action: 'acknowledge' }
  | { action: 'decline'; note: string }
  | { action: 'complete'; title: string; body: string; changeNote: string; expectedBaseVersionId: string | null };

/**
 * The partner controls its own copy. Acknowledged is distinct from
 * completed; completion requires the partner's own approved successor.
 */
export async function respondToRelay(actor: Actor, relayId: string, r: RelayResponse) {
  authorize(actor, 'relay.respond');
  return asMember(actor, async (tx) => {
    const req = await one(tx, `select * from relay_requests where id = $1 and recipient_org_id = $2 for update`, [relayId, actor.orgId]);
    if (!req) throw notFound();
    const open: RelayStatus[] = ['pending', 'sent', 'acknowledged'];
    if (!open.includes(req.status)) throw conflict('This request has already been answered.');

    if (r.action === 'acknowledge') {
      if (req.status === 'acknowledged') return { status: 'acknowledged' as const };
      await tx.query(`update relay_requests set status = 'acknowledged', updated_at = now() where id = $1`, [relayId]);
    } else if (r.action === 'decline') {
      if (!r.note?.trim()) throw invalid('Give a reason for declining');
      await tx.query(`update relay_requests set status = 'declined', response_note = $2, updated_at = now() where id = $1`, [
        relayId,
        r.note.trim(),
      ]);
    } else {
      authorize(actor, 'output.publish');
      if (!r.changeNote?.trim()) throw invalid('Describe what changed in your copy');
      const { output, latest } = await lockOutputForRelease(tx, actor.orgId, req.partner_output_id);
      if ((latest?.id ?? null) !== (r.expectedBaseVersionId ?? null)) {
        throw conflict('Your copy changed while you were reviewing. Reload and review again.');
      }
      const rel = await releaseVersion(tx, {
        orgId: actor.orgId,
        storyId: output.story_id,
        outputId: output.id,
        title: r.title,
        body: r.body,
        language: output.language,
        approvedBy: actor.userId,
        predecessorVersionId: latest?.id ?? null,
        seq: (latest?.seq ?? 0) + 1,
        changeNote: r.changeNote.trim(),
      });
      await tx.query(`update outputs set title = $1, draft_body = $2, draft_revision = draft_revision + 1 where id = $3`, [
        r.title,
        r.body,
        output.id,
      ]);
      await tx.query(
        `update relay_requests set status = 'completed', completed_version_id = $2, updated_at = now() where id = $1`,
        [relayId, rel.versionId],
      );
    }
    await audit(tx, { orgId: actor.orgId, actorId: actor.userId, action: `relay.${r.action}`, refType: 'relay_request', refId: relayId });
    const after = await one(tx, `select status from relay_requests where id = $1`, [relayId]);
    return { status: after.status as RelayStatus };
  });
}

/** Outbox handler: deliver to the recipient's internal inbox. */
export async function deliverRelayNotice(relayRequestId: string) {
  return asSystem(async (tx) => {
    const r = await tx.query(
      `update relay_requests set status = 'sent', updated_at = now() where id = $1 and status = 'pending' returning id`,
      [relayRequestId],
    );
    const exists = r.rowCount || (await one(tx, `select 1 from relay_requests where id = $1`, [relayRequestId]));
    return { ok: Boolean(exists), providerStatus: 'internal_inbox' };
  });
}
