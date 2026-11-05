import { describe, expect, it } from 'vitest';
import { asSystem } from '@/lib/db';
import { formatDate, renderSystemMessage, translateError, translator } from '@/lib/i18n';
import { DEMO_REFS, demoStories, seedDemo } from '@/services/demo';
import { loginAsDemoUser, resolveActor } from '@/services/auth';
import { getPassport } from '@/services/passports';
import { approveCorrection, proposeCorrection } from '@/services/corrections';
import { resetDb } from './fixtures';

describe('demo seed', () => {
  it('creates the demo with fixed references and resets back to them', async () => {
    await resetDb();
    expect((await seedDemo({ reset: false })).created).toBe(true);
    expect((await seedDemo({ reset: false })).created).toBe(false);
    for (const ref of Object.values(DEMO_REFS)) {
      const p = await getPassport(ref);
      expect(p?.status, ref).toBe('current');
      expect(p?.verification.signatureValid).toBe(true);
    }
    const nd = (await getPassport(DEMO_REFS.bulletinNd))!;
    expect(nd.output.language).toBe('nd');
    expect((await getPassport(DEMO_REFS.partner))!.republishedFrom?.ref).toBe(DEMO_REFS.article);

    // Make a correction, then reset: the original refs are current again.
    const session = (await loginAsDemoUser('editor@zambezidaily.example'))!;
    const { actor } = (await resolveActor(session.token))!;
    const story = await asSystem((tx) => tx.query(`select o.id, o.story_id from outputs o join output_versions v on v.output_id = o.id where v.public_ref = $1`, [DEMO_REFS.article]));
    const cid = await proposeCorrection(actor, {
      storyId: story.rows[0].story_id,
      reason: 'Revised bulletin',
      replacements: [{ outputId: story.rows[0].id, title: 'Flooding closes 2 schools', body: 'Flooding has closed 2 schools.', changeNote: '2, not 12' }],
    });
    await approveCorrection(actor, cid);
    expect((await getPassport(DEMO_REFS.article))!.status).toBe('superseded');
    expect((await demoStories()).find((s) => s.ref === DEMO_REFS.article)?.total).toBe(2);

    expect((await seedDemo({ reset: true })).created).toBe(true);
    expect((await getPassport(DEMO_REFS.article))!.status).toBe('current');
    // The old session belonged to the wiped data.
    expect(await resolveActor(session.token)).toBeNull();
  });

  it('signs in by role without a password', async () => {
    for (const email of ['editor@zambezidaily.example', 'reporter@zambezidaily.example', 'editor@matobomirror.example']) {
      const s = await loginAsDemoUser(email);
      expect(s).not.toBeNull();
      expect((await resolveActor(s!.token))?.actor.email).toBe(email);
    }
    expect(await loginAsDemoUser('nobody@example.com')).toBeNull();
  });
});

describe('language helpers', () => {
  it('formats dates with Shona and Ndebele month names in Zimbabwe time', () => {
    const d = new Date('2026-11-03T23:38:00Z'); // 4 Nov 01:38 in Harare
    expect(formatDate(d, 'en')).toBe('4 Nov 2026, 01:38');
    expect(formatDate(d, 'sn')).toBe('4 Mbudzi 2026, 01:38');
    expect(formatDate(d, 'nd')).toBe('4 Lwezi 2026, 01:38');
  });
  it('translates service errors and system messages', () => {
    expect(translateError('Story title is required', 'sn')).toBe('Musoro wenyaya unodiwa');
    expect(translateError('Story title is required', 'nd')).toBe('Isihloko sendaba siyadingeka');
    expect(translateError('something unexpected', 'nd')).toBe('something unexpected');
    expect(renderSystemMessage('sys.received.web', translator('nd'))).toBe('Isicelo sokulungisa samukelwe ngewebhusayithi.');
    expect(renderSystemMessage('sys.correctionPublished|VMB-1, VMB-2', translator('sn'))).toBe('Kugadzirisa kwakabvumirwa kwaburitswa: VMB-1, VMB-2');
    expect(renderSystemMessage('Plain editor reply', translator('sn'))).toBe('Plain editor reply');
  });
});
