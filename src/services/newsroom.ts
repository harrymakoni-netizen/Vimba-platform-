import { many, one } from '@/lib/db';
import { notFound } from '@/lib/errors';
import { asMember, type Actor } from './actor';

export async function listStories(actor: Actor) {
  return asMember(actor, (tx) =>
    many(
      tx,
      `select s.id, s.title, s.created_at, u.display_name as owner,
              (select max(v.approved_at) from output_versions v join outputs o on o.id = v.output_id where o.story_id = s.id) as last_release,
              (select count(*) from corrections c where c.story_id = s.id and c.status in ('draft','in_review'))::int as open_corrections,
              (select count(*) from complaints c join output_versions v on v.id = c.output_version_id join outputs o on o.id = v.output_id
                 where o.story_id = s.id and c.status <> 'closed')::int as open_complaints
         from stories s join users u on u.id = s.owner_id
        where s.org_id = $1 order by s.created_at desc`,
      [actor.orgId],
    ),
  );
}

export async function storyWorkspace(actor: Actor, storyId: string) {
  return asMember(actor, async (tx) => {
    const story = await one(
      tx,
      `select s.*, u.display_name as owner from stories s join users u on u.id = s.owner_id where s.id = $1 and s.org_id = $2`,
      [storyId, actor.orgId],
    );
    if (!story) throw notFound();
    const outputs = await many(
      tx,
      `select o.*, v.id as version_id, v.seq, v.public_ref, v.approved_at, v.body as released_body, v.title as released_title,
              (select count(*) from output_versions where output_id = o.id)::int as version_count
         from outputs o
         left join lateral (select * from output_versions where output_id = o.id order by seq desc limit 1) v on true
        where o.story_id = $1 order by o.created_at`,
      [storyId],
    );
    const sources = await many(tx, `select * from source_records where story_id = $1 order by label`, [storyId]);
    const claims = await many(tx, `select * from claims where story_id = $1 order by label`, [storyId]);
    const links = await many(
      tx,
      `select l.*, o.kind, o.language, s.label as source_label from claim_links l
         join outputs o on o.id = l.output_id left join source_records s on s.id = l.source_record_id
        where o.story_id = $1 order by l.created_at`,
      [storyId],
    );
    const corrections = await many(
      tx,
      `select id, status, reason, created_at, approved_at from corrections where story_id = $1 order by created_at desc`,
      [storyId],
    );
    return { story, outputs, sources, claims, links, corrections };
  });
}

/** Outputs to offer in a new correction: confirmed claim links first, else every released output of the story. */
export async function correctionCandidates(actor: Actor, storyId: string, claimId?: string) {
  return asMember(actor, async (tx) => {
    const rows = await many(
      tx,
      `select o.id as output_id, o.kind, o.language, v.id as version_id, v.seq, v.title, v.body, v.public_ref,
              (select string_agg(l.passage, ' | ') from claim_links l
                where l.output_id = o.id and l.status = 'confirmed' and ($2::uuid is null or l.claim_id = $2)) as passages
         from outputs o
         join lateral (select * from output_versions where output_id = o.id order by seq desc limit 1) v on true
        where o.story_id = $1 and o.org_id = $3 and o.withdrawn_at is null
        order by o.created_at`,
      [storyId, claimId || null, actor.orgId],
    );
    const story = await one(tx, `select id, title from stories where id = $1 and org_id = $2`, [storyId, actor.orgId]);
    if (!story) throw notFound();
    const claim = claimId ? await one(tx, `select id, label, text from claims where id = $1 and story_id = $2`, [claimId, storyId]) : null;
    // Partner copies of these outputs are held by other newsrooms; count only (no partner content is exposed).
    return { story, claim, rows };
  });
}
