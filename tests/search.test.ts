import { beforeEach, describe, expect, it } from 'vitest';
import { approveCorrection, proposeCorrection } from '@/services/corrections';
import { createOutput } from '@/services/publication';
import { searchVersions, searchWords } from '@/services/search';
import { demo, replacementsFor } from './fixtures';

let d: Awaited<ReturnType<typeof demo>>;
beforeEach(async () => {
  d = await demo();
});

describe('Public search', () => {
  it('splits a query into words and ignores punctuation and single characters', () => {
    expect(searchWords('  12 schools, closed!! a ')).toEqual(['12', 'schools', 'closed']);
    expect(searchWords('%_')).toEqual([]);
  });

  it('finds registered versions by the words a reader saw, in any language', async () => {
    const en = await searchVersions('12 schools closed');
    expect(en.map((h) => h.ref)).toContain(d.article.ref);
    expect(en.every((h) => h.status === 'current')).toBe(true);
    const nd = await searchVersions('izikolo ezingu-12');
    expect(nd.map((h) => h.ref)).toContain(d.ndebele.ref);
  });

  it('after a correction, an old wording points to the superseded version and its latest version', async () => {
    const cid = await proposeCorrection(d.A, { storyId: d.storyId, claimId: d.claimId, reason: 'District office figure', replacements: replacementsFor(d) });
    const r = await approveCorrection(d.A, cid);
    const hit = (await searchVersions('closed 12 schools')).find((h) => h.ref === d.article.ref)!;
    expect(hit.status).toBe('superseded');
    expect(hit.total).toBe(2);
    expect(hit.latestRef).not.toBe(d.article.ref);
    expect(r).toBeTruthy();
    // The corrected wording finds the current version.
    const now = await searchVersions('closed 2 schools');
    expect(now.find((h) => h.latestRef === hit.latestRef)?.status).toBe('current');
  });

  it('never exposes unpublished drafts', async () => {
    await createOutput(d.A, { storyId: d.storyId, kind: 'article', language: 'en', title: 'Unpublished zebra draft', body: 'zebra quagga secret draft text' });
    expect(await searchVersions('zebra quagga')).toEqual([]);
  });
});
