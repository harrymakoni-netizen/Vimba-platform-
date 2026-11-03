import { invalid, notFound } from '@/lib/errors';
import { many, one } from '@/lib/db';
import { asMember, audit, authorize, type Actor } from './actor';
import { passageIn } from './passports';

export async function addSource(
  actor: Actor,
  input: { storyId: string; label: string; description: string; evidencePointer?: string; accessRule?: string },
) {
  authorize(actor, 'output.draft');
  if (!input.label?.trim() || !input.description?.trim()) throw invalid('Source label and description are required');
  return asMember(actor, async (tx) => {
    const s = await one(tx, `select id from stories where id = $1 and org_id = $2`, [input.storyId, actor.orgId]);
    if (!s) throw notFound();
    const r = await one(
      tx,
      `insert into source_records (org_id, story_id, label, description, evidence_pointer, access_rule, created_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [
        actor.orgId,
        input.storyId,
        input.label.trim(),
        input.description.trim(),
        input.evidencePointer?.trim() || null,
        input.accessRule === 'editors_only' ? 'editors_only' : 'newsroom_only',
        actor.userId,
      ],
    );
    await audit(tx, { orgId: actor.orgId, actorId: actor.userId, action: 'source.added', refType: 'source_record', refId: r.id });
    return r.id as string;
  });
}

/** Revising a source bumps its revision; existing links keep the revision they were confirmed against. */
export async function reviseSource(actor: Actor, sourceId: string, input: { description: string; evidencePointer?: string }) {
  authorize(actor, 'output.draft');
  return asMember(actor, async (tx) => {
    const r = await tx.query(
      `update source_records set description = $1, evidence_pointer = $2, revision = revision + 1
        where id = $3 and org_id = $4 returning revision`,
      [input.description.trim(), input.evidencePointer?.trim() || null, sourceId, actor.orgId],
    );
    if (!r.rowCount) throw notFound();
    return r.rows[0].revision as number;
  });
}

export async function addClaim(actor: Actor, input: { storyId: string; label: string; text: string }) {
  authorize(actor, 'output.draft');
  if (!input.label?.trim() || !input.text?.trim()) throw invalid('Claim label and text are required');
  return asMember(actor, async (tx) => {
    const s = await one(tx, `select id from stories where id = $1 and org_id = $2`, [input.storyId, actor.orgId]);
    if (!s) throw notFound();
    const r = await one(tx, `insert into claims (org_id, story_id, label, text) values ($1,$2,$3,$4) returning id`, [
      actor.orgId,
      input.storyId,
      input.label.trim(),
      input.text.trim(),
    ]);
    return r.id as string;
  });
}

/**
 * Confirm that a claim appears in an output at a specific passage, backed by
 * a specific source revision. Only editors confirm; the correction engine
 * uses confirmed links only.
 */
export async function confirmClaimLink(
  actor: Actor,
  input: { claimId: string; outputId: string; passage: string; sourceRecordId?: string },
) {
  authorize(actor, 'claim.link');
  if (!input.passage?.trim()) throw invalid('Quote the passage where the claim appears');
  return asMember(actor, async (tx) => {
    const claim = await one(tx, `select id, story_id from claims where id = $1 and org_id = $2`, [input.claimId, actor.orgId]);
    if (!claim) throw notFound();
    const output = await one(tx, `select id, draft_body from outputs where id = $1 and org_id = $2 and story_id = $3`, [
      input.outputId,
      actor.orgId,
      claim.story_id,
    ]);
    if (!output) throw notFound();
    const latest = await one(tx, `select id, body from output_versions where output_id = $1 order by seq desc limit 1`, [
      input.outputId,
    ]);
    const text = latest?.body ?? output.draft_body;
    if (!passageIn(text, input.passage)) throw invalid('That passage does not appear in the output');
    let sourceRevision: number | null = null;
    if (input.sourceRecordId) {
      const src = await one(tx, `select revision from source_records where id = $1 and org_id = $2`, [
        input.sourceRecordId,
        actor.orgId,
      ]);
      if (!src) throw notFound();
      sourceRevision = src.revision;
    }
    const r = await one(
      tx,
      `insert into claim_links (org_id, claim_id, source_record_id, source_revision, output_id, output_version_id, passage,
                                status, confirmed_by, confirmed_at)
       values ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8, now())
       on conflict (claim_id, output_id, passage) do update set status = 'confirmed', confirmed_by = excluded.confirmed_by,
          confirmed_at = now(), source_record_id = excluded.source_record_id, source_revision = excluded.source_revision,
          output_version_id = excluded.output_version_id
       returning id`,
      [actor.orgId, input.claimId, input.sourceRecordId || null, sourceRevision, input.outputId, latest?.id ?? null, input.passage.trim(), actor.userId],
    );
    await audit(tx, { orgId: actor.orgId, actorId: actor.userId, action: 'claim_link.confirmed', refType: 'claim_link', refId: r.id });
    return r.id as string;
  });
}

/** Outputs connected to a claim through confirmed links, with their current release. */
export async function affectedByClaim(actor: Actor, claimId: string) {
  return asMember(actor, (tx) =>
    many(
      tx,
      `select distinct on (o.id) o.id as output_id, o.kind, o.language, o.title, l.passage,
              v.id as version_id, v.seq, v.title as version_title, v.body as version_body, v.public_ref
         from claim_links l
         join outputs o on o.id = l.output_id
         left join lateral (select * from output_versions where output_id = o.id order by seq desc limit 1) v on true
        where l.claim_id = $1 and l.org_id = $2 and l.status = 'confirmed'
        order by o.id`,
      [claimId, actor.orgId],
    ),
  );
}
