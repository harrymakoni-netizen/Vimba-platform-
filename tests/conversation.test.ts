import { describe, expect, it, vi } from 'vitest';
import { step, type Deps, type Turn, type OutMessage } from '@/channels/whatsapp/conversation';

const REF = 'VMB-7K2Q9XF3MA';
const deps = (over: Partial<Deps> = {}): Deps => ({
  lookup: async (ref) =>
    ref === REF
      ? { ref, title: 'Flooding closes 12 schools', publisher: 'Demo Newsroom A', number: 1, total: 2, publishedAt: new Date().toISOString(),
          status: 'superseded', latestNumber: 2, latestNote: '2 schools, not 12', passportUrl: `https://vimba.test/p/${ref}` }
      : null,
  passageMatches: async (_r, p) => p.toLowerCase().includes('12 schools'),
  submit: vi.fn(async () => ({ caseRef: 'VC-TEST0001', trackingUrl: 'https://vimba.test/case/open?t=x' })),
  search: vi.fn(async (q: string) =>
    q.includes('12 schools')
      ? [{ ref: REF, title: 'Flooding closes 12 schools', publisher: 'Demo Newsroom A', status: 'superseded' as const },
         { ref: 'VMB-AAAAAAAAAA', title: '12 schools closed', publisher: 'Demo Newsroom A', status: 'superseded' as const }]
      : q.includes('graphic only') ? [{ ref: REF, title: 'Flooding closes 12 schools', publisher: 'Demo Newsroom A', status: 'superseded' as const }] : []),
  savePhoto: vi.fn(async (m) => (m.id === 'bad' ? null : 'photo-1')),
  track: async () => [],
  formatDate: (iso) => iso.slice(0, 10),
  webUrl: 'https://vimba.test',
  ...over,
});
const start: Turn = { state: 'menu', draft: {}, locale: 'en', invalidCount: 0, stopped: false };
const text = (t: string) => ({ type: 'text' as const, text: t, choiceId: null });
const choose = (id: string) => ({ type: 'interactive' as const, text: null, choiceId: id });
const bodyOf = (m: OutMessage) => m.body;

describe('WhatsApp conversation', () => {
  it('CHECK <ref> returns a result card with an Open passport button', async () => {
    const r = await step(start, text(`check ${REF}`), deps());
    expect(r.replies[0].type).toBe('cta');
    expect(bodyOf(r.replies[0])).toContain('Superseded');
    expect(bodyOf(r.replies[0])).toContain('2 schools, not 12');
  });

  it('runs the full report flow and only submits after confirmation', async () => {
    const d = deps();
    let r = await step(start, choose('menu.report'), d);
    r = await step(r.turn, text(REF), d);
    expect(r.turn.state).toBe('report.passage');
    r = await step(r.turn, text('Flooding has closed 12 schools'), d);
    r = await step(r.turn, text('The revised bulletin says 2 schools.'), d);
    r = await step(r.turn, choose('report.skip'), d);
    expect(r.turn.state).toBe('report.photo');
    r = await step(r.turn, choose('report.skip'), d);
    expect(r.turn.state).toBe('report.confirm');
    expect(d.submit).not.toHaveBeenCalled();
    r = await step(r.turn, choose('confirm.submit'), d);
    expect(d.submit).toHaveBeenCalledOnce();
    expect(bodyOf(r.replies[0])).toContain('VC-TEST0001');
    expect(r.turn.state).toBe('menu');
  });

  it('attaches an optional photo of the article and submits it with the complaint', async () => {
    const d = deps();
    const photo = (id: string) => ({ type: 'image' as const, text: null, choiceId: null, media: { id, url: null, mime: 'image/jpeg' } });
    let r = await step(start, choose('menu.report'), d);
    r = await step(r.turn, text(REF), d);
    r = await step(r.turn, text('Flooding has closed 12 schools'), d);
    r = await step(r.turn, text('The revised bulletin says 2 schools.'), d);
    r = await step(r.turn, text('https://example.org/notice'), d);
    expect(r.turn.state).toBe('report.photo');
    r = await step(r.turn, photo('bad'), d);
    expect(r.turn.state).toBe('report.photo');
    r = await step(r.turn, photo('wamid-media-1'), d);
    expect(r.turn.state).toBe('report.confirm');
    expect(bodyOf(r.replies[0])).toContain('Photo: attached');
    r = await step(r.turn, choose('confirm.submit'), d);
    expect(d.submit).toHaveBeenCalledWith(expect.objectContaining({ photoId: 'photo-1', evidence: 'https://example.org/notice' }), 'en');
  });

  it('accepts a photo sent at the evidence step and ignores photos elsewhere', async () => {
    const d = deps();
    const photo = { type: 'image' as const, text: null, choiceId: null, media: { id: 'm', url: null, mime: 'image/jpeg' } };
    let r = await step(start, photo, d);
    expect(d.savePhoto).not.toHaveBeenCalled();
    r = await step(start, choose('menu.report'), d);
    r = await step(r.turn, text(REF), d);
    r = await step(r.turn, text('Flooding has closed 12 schools'), d);
    r = await step(r.turn, text('The revised bulletin says 2 schools.'), d);
    r = await step(r.turn, photo, d);
    expect(r.turn.state).toBe('report.confirm');
    expect(r.turn.draft.photoId).toBe('photo-1');
  });

  it('CHECK with words instead of a reference searches registered stories', async () => {
    let r = await step(start, text('CHECK 12 schools closed'), deps());
    expect(r.replies[0].type).toBe('text');
    expect(bodyOf(r.replies[0])).toContain('2 registered stories match');
    expect(bodyOf(r.replies[0])).toContain(REF);
    r = await step(start, text('HLOLA graphic only'), deps());
    expect(r.replies[0].type).toBe('cta');
    r = await step(start, text('CHECK zebra words'), deps());
    expect(bodyOf(r.replies[0])).toContain('No registered story matches');
  });

  it('rejects a passage that is not in the registered version', async () => {
    const d = deps();
    let r = await step(start, choose('menu.report'), d);
    r = await step(r.turn, text(REF), d);
    r = await step(r.turn, text('something never published'), d);
    expect(r.turn.state).toBe('report.passage');
  });

  it('resends the menu after two unrecognised replies', async () => {
    let r = await step(start, text('blah'), deps());
    r = await step(r.turn, text('blah again'), deps());
    expect(r.replies.at(-1)!.type).toBe('list');
    expect(r.turn.invalidCount).toBe(0);
  });

  it('Shona and Ndebele command words switch language', async () => {
    const sn = await step(start, text('mhoro'), deps());
    expect(sn.turn.locale).toBe('sn');
    expect(bodyOf(sn.replies[0])).toContain('Vimba inotarisa');
    const nd = await step(start, text(`HLOLA ${REF}`), deps());
    expect(nd.turn.locale).toBe('nd');
    expect(bodyOf(nd.replies[0])).toContain('Isithathelwe indawo');
  });

  it('language buttons set the locale', async () => {
    const r = await step(start, choose('lang.nd'), deps());
    expect(r.turn.locale).toBe('nd');
    expect(bodyOf(r.replies[0])).toBe('Ulimi selumiswe kusiNdebele.');
  });

  it('STOP silences the session until MENU', async () => {
    let r = await step(start, text('STOP'), deps());
    expect(r.turn.stopped).toBe(true);
    r = await step(r.turn, text('what is this?'), deps());
    expect(r.replies).toHaveLength(0);
    r = await step(r.turn, text('MENU'), deps());
    expect(r.turn.stopped).toBe(false);
    expect(r.replies[0].type).toBe('list');
  });

  it('CANCEL discards a draft in any state', async () => {
    let r = await step(start, choose('menu.report'), deps());
    r = await step(r.turn, text(REF), deps());
    r = await step(r.turn, text('kanzura'), deps());
    expect(r.turn.state).toBe('menu');
    expect(r.turn.draft).toEqual({});
  });
});
