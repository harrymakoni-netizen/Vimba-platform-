import { conflict, invalid, notFound } from '@/lib/errors';
import { many, one } from '@/lib/db';
import { asMember, audit, authorize, elevate, type Actor } from './actor';
import { releaseVersion, lockOutputForRelease } from './publication';
import { enqueue } from './outbox';
import { notifyComplainant } from './complaints';

export interface ReplacementInput {
  outputId: string;
  title: string;
  body: string;
  changeNote: string;
}

/**
 * Create an editorial correction proposal. Base versions are captured now;
 * approval later rejects the proposal if any base has moved on.
 */
export async function proposeCorrection(
  actor: Actor,
  input: { storyId: string; reason: string; claimId?: string | null; complaintId?: string | null; replacements: ReplacementInput[] },
) {
  authorize(actor, 'correction.propose');
  if (!input.reason?.trim()) throw invalid('Give the reason for the correction');
  const reps = input.replacements.filter((r) => r.outputId);
  if (!reps.length) throw invalid('Choose at least one affected output');
  for (const r of reps) {
    if (!r.body?.trim() || !r.title?.trim()) throw invalid('Each affected output needs replacement content');
    if (!r.changeNote?.trim()) throw invalid('Each affected output needs a change note in its own language');
  }
  return asMember(actor, async (tx) => {
    const story = await one(tx, `select id from stories where id = $1 and org_id = $2`, [input.storyId, actor.orgId]);
    if (!story) throw notFound();
    if (input.complaintId) {
      const c = await one(tx, `select id from complaints where id = $1 and org_id = $2`, [input.complaintId, actor.orgId]);
      if (!c) throw notFound();
    }
    const corr = await one(
      tx,
      `insert into corrections (org_id, story_id, claim_id, complaint_id, reason, status, created_by)
       values ($1,$2,$3,$4,$5,'in_review',$6) returning id`,
      [actor.orgId, input.storyId, input.claimId || null, input.complaintId || null, input.reason.trim(), actor.userId],
    );
    for (const r of reps) {
      const base = await one(
        tx,
        `select v.id from output_versions v join outputs o on o.id = v.output_id
          where v.output_id = $1 and o.org_id = $2 and o.story_id = $3 order by v.seq desc limit 1`,
        [r.outputId, actor.orgId, input.storyId],
      );
      if (!base) throw invalid('Only released outputs of this story can be corrected');
      await tx.query(
        `insert into affected_outputs (org_id, correction_id, output_id, base_version_id, replacement_title, replacement_body, change_note)
         values ($1,$2,$3,$4,$5,$6,$7)`,
        [actor.orgId, corr.id, r.outputId, base.id, r.title.trim(), r.body, r.changeNote.trim()],
      );
    }
    if (input.complaintId) {
      await tx.query(
        `update complaints set correction_id = $1, status = case when status = 'received' then 'in_review' else status end,
                last_activity_at = now() where id = $2`,
        [corr.id, input.complaintId],
      );
    }
    await audit(tx, { orgId: actor.orgId, actorId: actor.userId, action: 'correction.proposed', refType: 'correction', refId: corr.id });
    return corr.id as string;
  });
}

export async function getCorrection(actor: Actor, id: string) {
  return asMember(actor, async (tx) => {
    const c = await one(
      tx,
      `select c.*, s.title as story_title, cl.label as claim_label, cl.text as claim_text, u.display_name as approved_by_name
         from corrections c join stories s on s.id = c.story_id
         left join claims cl on cl.id = c.claim_id
         left join users u on u.id = c.approved_by
        where c.id = $1 and c.org_id = $2`,
      [id, actor.orgId],
    );
    if (!c) throw notFound();
    const affected = await many(
      tx,
      `select a.*, o.kind, o.language, b.title as before_title, b.body as before_body, b.seq as base_seq, b.public_ref as base_ref,
              (select id from output_versions where output_id = a.output_id order by seq desc limit 1) as current_version_id,
              r.public_ref as result_ref, r.seq as result_seq
         from affected_outputs a join outputs o on o.id = a.output_id
         join output_versions b on b.id = a.base_version_id
         left join output_versions r on r.id = a.result_version_id
        where a.correction_id = $1 order by o.kind, o.language`,
      [id],
    );
    const sources = c.claim_id
      ? await many(
          tx,
          `select distinct s.label, s.description, s.evidence_pointer, s.revision, l.source_revision
             from claim_links l join source_records s on s.id = l.source_record_id
            where l.claim_id = $1 and l.status = 'confirmed'`,
          [c.claim_id],
        )
      : [];
    const relays = await many(
      tx,
      `select r.id, r.status, r.response_note, org.name as recipient
         from relay_requests r join organisations org on org.id = r.recipient_org_id
        where r.correction_id = $1 order by org.name`,
      [id],
    );
    return { correction: c, affected, sources, relays };
  });
}

export async function updateReplacement(actor: Actor, correctionId: string, r: ReplacementInput) {
  authorize(actor, 'correction.propose');
  return asMember(actor, async (tx) => {
    const res = await tx.query(
      `update affected_outputs a set replacement_title = $1, replacement_body = $2, change_note = $3
         from corrections c
        where a.correction_id = c.id and c.id = $4 and c.org_id = $5 and a.output_id = $6 and c.status in ('draft','in_review')`,
      [r.title.trim(), r.body, r.changeNote.trim(), correctionId, actor.orgId, r.outputId],
    );
    if (!res.rowCount) throw conflict('This correction can no longer be edited');
  });
}

/**
 * Approve a correction. In ONE transaction: verify every base version is
 * still current, sign and release a successor for each owned output, record
 * the approval and audit, notify the complainant and queue partner relay
 * requests. If any step fails, nothing is released. Approving an already
 * applied correction returns the original result (idempotent).
 */
export async function approveCorrection(actor: Actor, correctionId: string) {
  authorize(actor, 'correction.approve');
  return asMember(actor, async (tx) => {
    const c = await one(tx, `select * from corrections where id = $1 and org_id = $2 for update`, [correctionId, actor.orgId]);
    if (!c) throw notFound();
    if (c.status === 'applied' || c.status === 'approved') {
      const done = await many(tx, `select output_id, result_version_id from affected_outputs where correction_id = $1`, [correctionId]);
      return { correctionId, alreadyApplied: true, released: done };
    }
    const affected = await many(tx, `select * from affected_outputs where correction_id = $1 order by output_id`, [correctionId]);
    if (!affected.length) throw invalid('Nothing to release');

    const released: { outputId: string; versionId: string; publicRef: string }[] = [];
    for (const a of affected) {
      const { output, latest } = await lockOutputForRelease(tx, actor.orgId, a.output_id);
      if (!latest || latest.id !== a.base_version_id) {
        throw conflict('An affected output changed after this correction was prepared. Review the latest version.', {
          outputId: a.output_id,
        });
      }
      const rel = await releaseVersion(tx, {
        orgId: actor.orgId,
        storyId: output.story_id,
        outputId: a.output_id,
        title: a.replacement_title,
        body: a.replacement_body,
        language: output.language,
        approvedBy: actor.userId,
        predecessorVersionId: latest.id,
        seq: latest.seq + 1,
        changeNote: a.change_note,
        correctionId,
      });
      // Keep the working draft aligned with what was released.
      await tx.query(`update outputs set title = $1, draft_body = $2, draft_revision = draft_revision + 1 where id = $3`, [
        a.replacement_title,
        a.replacement_body,
        a.output_id,
      ]);
      await tx.query(`update affected_outputs set result_version_id = $1 where id = $2`, [rel.versionId, a.id]);
      released.push({ outputId: a.output_id, versionId: rel.versionId, publicRef: rel.publicRef });
    }

    await tx.query(`update corrections set status = 'applied', approved_by = $1, approved_at = now() where id = $2`, [
      actor.userId,
      correctionId,
    ]);
    await audit(tx, {
      orgId: actor.orgId,
      actorId: actor.userId,
      action: 'correction.applied',
      refType: 'correction',
      refId: correctionId,
      detail: { released: released.map((r) => r.publicRef) },
    });

    // Fan out to partner copies held by other newsrooms. Authorisation is
    // complete; elevate only to find and notify those recipients.
    await elevate(tx);
    const partners = await many(
      tx,
      `select p.id as partner_output_id, p.org_id as recipient_org_id, p.source_output_id
         from outputs p where p.source_output_id = any($1::uuid[]) and p.org_id <> $2 and p.withdrawn_at is null`,
      [affected.map((a) => a.output_id), actor.orgId],
    );
    for (const p of partners) {
      const a = affected.find((x) => x.output_id === p.source_output_id)!;
      const rel = released.find((x) => x.outputId === p.source_output_id)!;
      const evidence = `${c.reason}\n\n${a.change_note}\n\nsys.correctedRelease|${rel.publicRef}`;
      const r = await one(
        tx,
        `insert into relay_requests (origin_org_id, recipient_org_id, correction_id, origin_output_id, partner_output_id, public_evidence)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (correction_id, recipient_org_id, partner_output_id) do nothing returning id`,
        [actor.orgId, p.recipient_org_id, correctionId, p.source_output_id, p.partner_output_id, evidence],
      );
      if (r) await enqueue(tx, 'relay.notify', { relayRequestId: r.id }, `relay:${r.id}:notify`);
    }

    if (c.complaint_id) {
      await tx.query(`update complaints set correction_id = $1, last_activity_at = now() where id = $2`, [correctionId, c.complaint_id]);
      await tx.query(
        `insert into case_messages (org_id, complaint_id, author_kind, body, visibility)
         values ($1, $2, 'system', $3, 'shared')`,
        [actor.orgId, c.complaint_id, `sys.correctionPublished|${released.map((r) => r.publicRef).join(', ')}`],
      );
      await notifyComplainant(tx, c.complaint_id, `correction:${correctionId}`);
    }
    return { correctionId, alreadyApplied: false, released };
  });
}

export async function listCorrections(actor: Actor, storyId?: string) {
  return asMember(actor, (tx) =>
    many(
      tx,
      `select c.id, c.status, c.reason, c.created_at, c.approved_at, s.title as story_title
         from corrections c join stories s on s.id = c.story_id
        where c.org_id = $1 and ($2::uuid is null or c.story_id = $2) order by c.created_at desc`,
      [actor.orgId, storyId ?? null],
    ),
  );
}
