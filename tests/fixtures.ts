import { pool } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';
import type { Actor } from '@/services/actor';
import { createOutput, createStory, publishOutput } from '@/services/publication';
import { addClaim, addSource, confirmClaimLink } from '@/services/claims';

export async function resetDb() {
  await pool().query(
    `truncate organisations, users, signing_keys, outbox, channel_events, channel_sessions, channel_usage, audit_events, sessions cascade`,
  );
}

async function org(slug: string) {
  return (await pool().query(`insert into organisations (slug, name) values ($1, $2) returning id`, [slug, `Org ${slug}`])).rows[0].id as string;
}
async function user(email: string) {
  return (await pool().query(`insert into users (email, display_name, password_hash) values ($1,$1,$2) returning id`, [email, hashPassword('pw')])).rows[0].id as string;
}
async function member(orgId: string, userId: string, role: string) {
  await pool().query(`insert into memberships (org_id, user_id, role) values ($1,$2,$3)`, [orgId, userId, role]);
}
const actor = (userId: string, orgId: string, role: Actor['role']): Actor => ({ userId, orgId, role, name: 'x', email: 'x', orgName: 'Org', orgSlug: 'org' });

/** Two newsrooms, one story with an English article, Shona and Ndebele bulletins, and a partner copy. */
export async function demo() {
  await resetDb();
  const a = await org('a');
  const b = await org('b');
  const ea = await user('editor@a');
  const ra = await user('reporter@a');
  const eb = await user('editor@b');
  await member(a, ea, 'editor');
  await member(a, ra, 'reporter');
  await member(b, eb, 'partner_editor');
  const A = actor(ea, a, 'editor');
  const R = actor(ra, a, 'reporter');
  const B = actor(eb, b, 'partner_editor');

  const storyId = await createStory(A, { title: 'Flooding' });
  const src = await addSource(A, { storyId, label: 'S-01', description: 'Confidential district memo' });
  const claimId = await addClaim(A, { storyId, label: 'C-01', text: 'schools closed = 12' });
  const mk = async (kind: string, language: string, title: string, body: string, passage: string) => {
    const id = await createOutput(A, { storyId, kind, language, title, body });
    const v = await publishOutput(A, id, { expectedBaseVersionId: null });
    await confirmClaimLink(A, { claimId, outputId: id, passage, sourceRecordId: src });
    return { id, ref: v.publicRef, versionId: v.versionId };
  };
  const article = await mk('article', 'en', 'Flooding closes 12 schools', 'Flooding has closed 12 schools in Ruvimbo District.', 'closed 12 schools');
  const shona = await mk('bulletin', 'sn', 'Mafashamo avhara zvikoro 12', 'Zvikoro 12 zvakavharwa mudunhu reRuvimbo.', 'Zvikoro 12 zvakavharwa');
  const ndebele = await mk('bulletin', 'nd', 'Izikhukhula zivala izikolo ezingu-12', 'Izikolo ezingu-12 zivaliwe esiqintini seRuvimbo.', 'Izikolo ezingu-12 zivaliwe');

  const pStory = await createStory(B, { title: 'Republished' });
  const partnerId = await createOutput(B, {
    storyId: pStory, kind: 'partner_copy', language: 'en', title: 'Flooding closes 12 schools',
    body: 'Republished. Flooding has closed 12 schools in Ruvimbo District.', sourceOutputRef: article.ref,
  });
  const partner = await publishOutput(B, partnerId, { expectedBaseVersionId: null });

  return { A, R, B, orgA: a, orgB: b, storyId, claimId, sourceId: src, article, shona, ndebele, partner: { id: partnerId, ref: partner.publicRef, versionId: partner.versionId } };
}

export const replacementsFor = (d: Awaited<ReturnType<typeof demo>>) => [
  { outputId: d.article.id, title: 'Flooding closes 2 schools', body: 'Flooding has closed 2 schools in Ruvimbo District.', changeNote: 'Corrected: 2 schools, not 12.' },
  { outputId: d.shona.id, title: 'Mafashamo avhara zvikoro 2', body: 'Zvikoro 2 zvakavharwa mudunhu reRuvimbo.', changeNote: 'Kugadziriswa: zvikoro 2, kwete 12.' },
  { outputId: d.ndebele.id, title: 'Izikhukhula zivala izikolo ezi-2', body: 'Izikolo ezi-2 zivaliwe esiqintini seRuvimbo.', changeNote: 'Kulungisiwe: izikolo ezi-2, hatshi ezingu-12.' },
];
