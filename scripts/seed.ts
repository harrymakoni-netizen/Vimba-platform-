import { Client } from 'pg';
import { loadEnv } from './load-env';

loadEnv();

// Fictional demonstration data only. "Ruvimbo District" does not exist.
// The Shona and Ndebele bulletins are drafts and must be reviewed by fluent
// speakers before any demo, especially names, dates and figures.

const PASSWORD = process.env.SEED_PASSWORD ?? 'vimba-demo-2026';

async function main() {
  const { hashPassword } = await import('../src/lib/crypto');
  const { createStory, createOutput, publishOutput } = await import('../src/services/publication');
  const { addSource, addClaim, confirmClaimLink } = await import('../src/services/claims');
  type Actor = import('../src/services/actor').Actor;

  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  if (process.argv.includes('--reset')) {
    await db.query(`truncate organisations, users, signing_keys, outbox, channel_events, channel_sessions, channel_usage, audit_events cascade`);
    console.log('reset: all demo data removed');
  }
  const exists = await db.query(`select 1 from organisations where slug = 'newsroom-a'`);
  if (exists.rowCount) {
    console.log('demo data already present (use --reset to recreate)');
    await db.end();
    return;
  }

  const org = async (slug: string, name: string, domain: string, lang: string) =>
    (
      await db.query(
        `insert into organisations (slug, name, domain, domain_check_status, default_language, response_target_hours)
         values ($1,$2,$3,'unchecked',$4, 72) returning id`,
        [slug, name, domain, lang],
      )
    ).rows[0].id as string;
  const user = async (email: string, name: string, locale: string) =>
    (
      await db.query(`insert into users (email, display_name, password_hash, locale) values ($1,$2,$3,$4) returning id`, [
        email,
        name,
        hashPassword(PASSWORD),
        locale,
      ])
    ).rows[0].id as string;

  const orgA = await org('newsroom-a', 'Demo Newsroom A', 'newsroom-a.example', 'en');
  const orgB = await org('partner-b', 'Demo Partner B', 'partner-b.example', 'nd');
  const editorA = await user('editor@newsroom-a.example', 'Rudo (Editor, A)', 'en');
  const reporterA = await user('reporter@newsroom-a.example', 'Tendai (Reporter, A)', 'sn');
  const editorB = await user('editor@partner-b.example', 'Sipho (Partner editor, B)', 'nd');
  await db.query(`insert into memberships (org_id, user_id, role) values ($1,$2,'editor'), ($1,$3,'reporter'), ($4,$5,'partner_editor')`, [
    orgA,
    editorA,
    reporterA,
    orgB,
    editorB,
  ]);
  await db.end();

  const A: Actor = { userId: editorA, name: 'Rudo', email: '', orgId: orgA, orgName: 'Demo Newsroom A', orgSlug: 'newsroom-a', role: 'editor' };
  const B: Actor = { userId: editorB, name: 'Sipho', email: '', orgId: orgB, orgName: 'Demo Partner B', orgSlug: 'partner-b', role: 'partner_editor' };

  const storyId = await createStory(A, { title: 'Flooding closes schools in Ruvimbo District' });

  const outputs = [
    {
      kind: 'article',
      language: 'en',
      title: 'Flooding closes 12 schools in Ruvimbo District',
      body:
        'Flooding has closed 12 schools in Ruvimbo District, according to the district education office.\n\n' +
        'Officials said pupils would return once roads are passable. Parents are asked to follow notices from their schools.',
      passage: 'Flooding has closed 12 schools in Ruvimbo District',
    },
    {
      kind: 'bulletin',
      language: 'sn',
      title: 'Mafashamo avhara zvikoro 12 mudunhu reRuvimbo',
      body:
        'Zvikoro 12 zvakavharwa mudunhu reRuvimbo nekuda kwemafashamo, sekutaura kwehofisi yedzidzo yedunhu.\n\n' +
        'Vabereki vanokurudzirwa kuteerera zviziviso zvinobva kuzvikoro.',
      passage: 'Zvikoro 12 zvakavharwa mudunhu reRuvimbo',
    },
    {
      kind: 'bulletin',
      language: 'nd',
      title: 'Izikhukhula zivala izikolo ezingu-12 esiqintini seRuvimbo',
      body:
        'Izikolo ezingu-12 zivaliwe esiqintini seRuvimbo ngenxa yezikhukhula, njengokutsho kwehofisi yezemfundo yesiqinti.\n\n' +
        'Abazali bayacelwa ukuthi balalele izaziso ezivela ezikolweni.',
      passage: 'Izikolo ezingu-12 zivaliwe esiqintini seRuvimbo',
    },
    {
      kind: 'graphic',
      language: 'en',
      title: '12 schools closed',
      body: '12 schools closed in Ruvimbo District by flooding.\nSource: district education office.',
      passage: '12 schools closed in Ruvimbo District',
    },
  ] as const;

  const s1 = await addSource(A, {
    storyId,
    label: 'S-01',
    description: 'District education office bulletin, morning edition (fictional).',
    evidencePointer: 'private://sources/s-01-district-bulletin.pdf',
  });
  const claimId = await addClaim(A, { storyId, label: 'C-01', text: 'Schools closed by flooding in Ruvimbo District = 12' });

  const refs: Record<string, string> = {};
  let articleId = '';
  for (const o of outputs) {
    const id = await createOutput(A, { storyId, kind: o.kind, language: o.language, title: o.title, body: o.body });
    const rel = await publishOutput(A, id, { expectedBaseVersionId: null });
    await confirmClaimLink(A, { claimId, outputId: id, passage: o.passage, sourceRecordId: s1 });
    refs[`${o.kind}.${o.language}`] = rel.publicRef;
    if (o.kind === 'article') articleId = id;
  }
  void articleId;

  await addSource(A, {
    storyId,
    label: 'S-02',
    description: 'Revised district bulletin: 2 schools closed, 10 reopened (fictional).',
    evidencePointer: 'private://sources/s-02-revised-bulletin.pdf',
  });

  // Partner B republishes the English article in its own newsroom.
  const partnerStory = await createStory(B, { title: 'Ruvimbo flooding (republished from Demo Newsroom A)' });
  const partnerOutput = await createOutput(B, {
    storyId: partnerStory,
    kind: 'partner_copy',
    language: 'en',
    title: 'Flooding closes 12 schools in Ruvimbo District',
    body:
      'Republished from Demo Newsroom A.\n\nFlooding has closed 12 schools in Ruvimbo District, according to the district education office.',
    sourceOutputRef: refs['article.en'],
  });
  const partnerRel = await publishOutput(B, partnerOutput, { expectedBaseVersionId: null });

  console.log('\nDemo data created (fictional).');
  console.log(`Sign in password for all demo accounts: ${PASSWORD}`);
  console.log('  editor@newsroom-a.example   (editor, Demo Newsroom A)');
  console.log('  reporter@newsroom-a.example (reporter, Demo Newsroom A)');
  console.log('  editor@partner-b.example    (partner editor, Demo Partner B)');
  console.log('\nPublished references:');
  for (const [k, v] of Object.entries(refs)) console.log(`  ${k.padEnd(14)} ${v}`);
  console.log(`  partner_copy   ${partnerRel.publicRef}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
