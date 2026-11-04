import { asSystem, ensureSecrets, many, pool } from '@/lib/db';
import { hashPassword, randomToken } from '@/lib/crypto';
import type { Actor, Role } from './actor';
import { createOutput, createStory, publishOutput } from './publication';
import { addClaim, addSource, confirmClaimLink } from './claims';

// Fictional demonstration data. "Ruvimbo District" does not exist.

export const DEMO_ACCOUNTS: { email: string; name: string; role: Role; org: 'a' | 'b' }[] = [
  { email: 'editor@newsroom-a.example', name: 'Rudo Moyo', role: 'editor', org: 'a' },
  { email: 'reporter@newsroom-a.example', name: 'Tendai Chikwanha', role: 'reporter', org: 'a' },
  { email: 'editor@partner-b.example', name: 'Sipho Ndlovu', role: 'partner_editor', org: 'b' },
];

/** Fixed references so printed demo graphics and QR codes always work, even after a reset. */
export const DEMO_REFS = {
  article: 'VMB-5DSN6ZBGGZ',
  bulletinSn: 'VMB-2N2P3KWETY',
  bulletinNd: 'VMB-WWYFCTP00H',
  graphic: 'VMB-J39WZC0N6Q',
  partner: 'VMB-X3KXEG4K6Z',
} as const;

const OUTPUTS = [
  {
    key: 'article',
    kind: 'article',
    language: 'en',
    title: 'Flooding closes 12 schools in Ruvimbo District',
    body:
      'Flooding has closed 12 schools in Ruvimbo District, according to the district education office.\n\n' +
      'Officials said pupils would return once roads are passable. Parents are asked to follow notices from their schools.',
    passage: 'Flooding has closed 12 schools in Ruvimbo District',
  },
  {
    key: 'bulletinSn',
    kind: 'bulletin',
    language: 'sn',
    title: 'Mafashamo avhara zvikoro 12 mudunhu reRuvimbo',
    body:
      'Zvikoro 12 zvakavharwa mudunhu reRuvimbo nekuda kwemafashamo, sekutaura kwehofisi yedzidzo yedunhu.\n\n' +
      'Vabereki vanokurudzirwa kuteerera zviziviso zvinobva kuzvikoro.',
    passage: 'Zvikoro 12 zvakavharwa mudunhu reRuvimbo',
  },
  {
    key: 'bulletinNd',
    kind: 'bulletin',
    language: 'nd',
    title: 'Izikhukhula zivala izikolo ezingu-12 esiqintini seRuvimbo',
    body:
      'Izikolo ezingu-12 zivaliwe esiqintini seRuvimbo ngenxa yezikhukhula, njengokutsho kwehofisi yezemfundo yesiqinti.\n\n' +
      'Abazali bayacelwa ukuthi balalele izaziso ezivela ezikolweni.',
    passage: 'Izikolo ezingu-12 zivaliwe esiqintini seRuvimbo',
  },
  {
    key: 'graphic',
    kind: 'graphic',
    language: 'en',
    title: '12 schools closed',
    body: '12 schools closed in Ruvimbo District by flooding.\nSource: district education office.',
    passage: '12 schools closed in Ruvimbo District',
  },
] as const;

let running: Promise<{ created: boolean }> | null = null;

/** Create the demo newsrooms and stories. With `reset`, wipe all data first. */
export function seedDemo(opts: { reset: boolean }) {
  running ??= doSeed(opts).finally(() => {
    running = null;
  });
  return running;
}

async function doSeed({ reset }: { reset: boolean }): Promise<{ created: boolean }> {
  await ensureSecrets();
  const db = pool();
  if (reset) {
    // Owner connection: TRUNCATE bypasses row-level policies. Demo secrets are kept.
    await db.query(
      `truncate organisations, users, signing_keys, outbox, delivery_attempts, channel_events, channel_sessions, channel_usage, audit_events, sessions cascade`,
    );
  }
  const exists = await db.query(`select 1 from organisations where slug = 'newsroom-a'`);
  if (exists.rowCount) return { created: false };

  const orgs: Record<'a' | 'b', string> = {
    a: (
      await db.query(
        `insert into organisations (slug, name, domain, default_language, response_target_hours)
         values ('newsroom-a', 'Demo Newsroom A', 'newsroom-a.example', 'en', 72) returning id`,
      )
    ).rows[0].id,
    b: (
      await db.query(
        `insert into organisations (slug, name, domain, default_language, response_target_hours)
         values ('partner-b', 'Demo Partner B', 'partner-b.example', 'nd', 72) returning id`,
      )
    ).rows[0].id,
  };
  const actors: Record<string, Actor> = {};
  for (const acc of DEMO_ACCOUNTS) {
    // Demo accounts sign in by role; their passwords are random and never shown.
    const id = (
      await db.query(`insert into users (email, display_name, password_hash, locale) values ($1, $2, $3, 'en') returning id`, [
        acc.email,
        acc.name,
        hashPassword(randomToken(24)),
      ])
    ).rows[0].id as string;
    await db.query(`insert into memberships (org_id, user_id, role) values ($1, $2, $3)`, [orgs[acc.org], id, acc.role]);
    actors[acc.email] = {
      userId: id,
      name: acc.name,
      email: acc.email,
      orgId: orgs[acc.org],
      orgName: acc.org === 'a' ? 'Demo Newsroom A' : 'Demo Partner B',
      orgSlug: acc.org === 'a' ? 'newsroom-a' : 'partner-b',
      role: acc.role,
    };
  }
  const A = actors['editor@newsroom-a.example'];
  const B = actors['editor@partner-b.example'];

  const storyId = await createStory(A, { title: 'Flooding closes schools in Ruvimbo District' });
  const s1 = await addSource(A, {
    storyId,
    label: 'S-01',
    description: 'District education office bulletin, morning edition (fictional).',
    evidencePointer: 'private://sources/s-01-district-bulletin.pdf',
  });
  const claimId = await addClaim(A, { storyId, label: 'C-01', text: 'Schools closed by flooding in Ruvimbo District = 12' });
  for (const o of OUTPUTS) {
    const id = await createOutput(A, { storyId, kind: o.kind, language: o.language, title: o.title, body: o.body });
    await publishOutput(A, id, { expectedBaseVersionId: null, publicRef: DEMO_REFS[o.key] });
    await confirmClaimLink(A, { claimId, outputId: id, passage: o.passage, sourceRecordId: s1 });
  }
  await addSource(A, {
    storyId,
    label: 'S-02',
    description: 'Revised district bulletin: 2 schools closed, 10 reopened (fictional).',
    evidencePointer: 'private://sources/s-02-revised-bulletin.pdf',
  });

  const partnerStory = await createStory(B, { title: 'Ruvimbo flooding (republished from Demo Newsroom A)' });
  const partnerOutput = await createOutput(B, {
    storyId: partnerStory,
    kind: 'partner_copy',
    language: 'en',
    title: 'Flooding closes 12 schools in Ruvimbo District',
    body: 'Republished from Demo Newsroom A.\n\nFlooding has closed 12 schools in Ruvimbo District, according to the district education office.',
    sourceOutputRef: DEMO_REFS.article,
  });
  await publishOutput(B, partnerOutput, { expectedBaseVersionId: null, publicRef: DEMO_REFS.partner });
  return { created: true };
}

/** First (printed) version of every output, with whether it has since been superseded. */
export async function demoStories() {
  return asSystem((tx) =>
    many(
      tx,
      `select o.kind, o.language, org.name as publisher, f.public_ref as ref, f.title, o.withdrawn_at,
              (select count(*) from output_versions where output_id = o.id)::int as total
         from outputs o
         join organisations org on org.id = o.org_id
         join lateral (select public_ref, title from output_versions where output_id = o.id and seq = 1) f on true
        order by org.slug, o.created_at`,
    ),
  );
}
