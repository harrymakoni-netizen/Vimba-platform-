import { beforeEach, describe, expect, it } from 'vitest';
import { asSystem, pool, withTx } from '@/lib/db';

const sys = (sql: string, params: unknown[] = []) => asSystem((tx) => tx.query(sql, params));
import { AppError } from '@/lib/errors';
import { getPassport } from '@/services/passports';
import { verifyReceipt } from '@/services/publication';
import { approveCorrection, getCorrection, proposeCorrection } from '@/services/corrections';
import { getComplaint, listComplaints, redeemCaseToken, submitComplaint, getCaseForComplainant, deskAction } from '@/services/complaints';
import { listRelay, respondToRelay } from '@/services/relay';
import { storyWorkspace } from '@/services/newsroom';
import { runWorkerOnce } from '@/services/worker';
import { demo, replacementsFor } from './fixtures';

let d: Awaited<ReturnType<typeof demo>>;
beforeEach(async () => {
  d = await demo();
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof AppError ? e.code : `other:${(e as Error).message}`;
  }
};

describe('QR continuity', () => {
  it('version 1 stays identifiable after correction and links to version 2 in every language', async () => {
    const cid = await proposeCorrection(d.A, { storyId: d.storyId, claimId: d.claimId, reason: 'Revised bulletin', replacements: replacementsFor(d) });
    const res = await approveCorrection(d.A, cid);
    expect(res.released).toHaveLength(3);
    for (const o of [d.article, d.shona, d.ndebele]) {
      const p = (await getPassport(o.ref))!;
      expect(p.ref).toBe(o.ref);
      expect(p.status).toBe('superseded');
      expect(p.version.number).toBe(1);
      expect(p.latest?.number).toBe(2);
      expect(p.latest?.correctionReason).toBe('Revised bulletin');
      const latest = (await getPassport(p.latest!.ref))!;
      expect(latest.status).toBe('current');
    }
    const nd = (await getPassport(d.ndebele.ref))!;
    expect(nd.output.language).toBe('nd');
    expect(nd.latest?.changeNote).toContain('ezi-2');
  });
});

describe('Signature integrity', () => {
  it('approved payload verifies; changed text or field fails', async () => {
    const p = (await getPassport(d.article.ref))!;
    expect(p.verification).toMatchObject({ signatureValid: true, contentMatches: true });
    const pub = process.env.VIMBA_SIGNING_PUBLIC_KEY!;
    expect(verifyReceipt(p.receipt, p.signature, pub, { title: p.version.title, body: 'Flooding has closed 2 schools', language: 'en' }).contentMatches).toBe(false);
    expect(verifyReceipt({ ...p.receipt, version_number: 9 }, p.signature, pub).signatureValid).toBe(false);
  });
  it('published versions are immutable in the database', async () => {
    await expect(sys(`update output_versions set body = 'x'`)).rejects.toThrow(/immutable/);
  });
});

describe('Tenant isolation', () => {
  it('newsroom B cannot read A sources, drafts or complaints through services', async () => {
    expect(await code(storyWorkspace(d.B, d.storyId))).toBe('not_found');
    const c = await submitComplaint({ ref: d.article.ref, passage: 'closed 12 schools', concern: 'It was 2', channel: 'web' });
    expect(await code(getComplaint(d.B, c.complaintId))).toBe('not_found');
    expect((await listComplaints(d.B)).length).toBe(0);
  });
  it('row level security blocks direct database access across tenants', async () => {
    const rows = await withTx({ kind: 'member', orgIds: [d.orgB] }, async (tx) => ({
      sources: (await tx.query(`select * from source_records`)).rowCount,
      stories: (await tx.query(`select * from stories where org_id = $1`, [d.orgA])).rowCount,
      complaints: (await tx.query(`select * from complaints`)).rowCount,
    }));
    expect(rows).toEqual({ sources: 0, stories: 0, complaints: 0 });
    await expect(
      withTx({ kind: 'member', orgIds: [d.orgB] }, (tx) => tx.query(`insert into stories (org_id, title, owner_id) values ($1, 'x', $2)`, [d.orgA, d.B.userId])),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('Approval control', () => {
  it('reporters and partners cannot approve the origin correction', async () => {
    const cid = await proposeCorrection(d.R, { storyId: d.storyId, reason: 'r', replacements: replacementsFor(d).slice(0, 1) });
    expect(await code(approveCorrection(d.R, cid))).toBe('forbidden');
    expect(await code(approveCorrection(d.B, cid))).toBe('not_found');
    expect(await code(approveCorrection(d.A, cid))).toBe('ok');
  });
});

describe('Stale writes', () => {
  it('two corrections on the same base: the second gets an explicit conflict', async () => {
    const one = await proposeCorrection(d.A, { storyId: d.storyId, reason: 'first', replacements: replacementsFor(d).slice(0, 1) });
    const two = await proposeCorrection(d.A, { storyId: d.storyId, reason: 'second', replacements: replacementsFor(d).slice(0, 1) });
    await approveCorrection(d.A, one);
    expect(await code(approveCorrection(d.A, two))).toBe('conflict');
    const after = (await getPassport(d.article.ref))!;
    expect(after.version.total).toBe(2);
  });
  it('concurrent approvals of the same correction release once', async () => {
    const cid = await proposeCorrection(d.A, { storyId: d.storyId, reason: 'r', replacements: replacementsFor(d) });
    const results = await Promise.allSettled([approveCorrection(d.A, cid), approveCorrection(d.A, cid)]);
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const n = await sys(`select count(*)::int as n from output_versions where correction_id = $1`, [cid]);
    expect(n.rows[0].n).toBe(3);
  });
});

describe('Reliable delivery and partner independence', () => {
  it('repeat approval returns the original result; relay is one request per partner copy', async () => {
    const cid = await proposeCorrection(d.A, { storyId: d.storyId, claimId: d.claimId, reason: 'r', replacements: replacementsFor(d) });
    const first = await approveCorrection(d.A, cid);
    const again = await approveCorrection(d.A, cid);
    expect(again.alreadyApplied).toBe(true);
    expect(first.released).toHaveLength(3);
    const relays = await sys(`select count(*)::int as n from relay_requests where correction_id = $1`, [cid]);
    expect(relays.rows[0].n).toBe(1);
    await runWorkerOnce();
    const inbox = await listRelay(d.B);
    expect(inbox.incoming[0].status).toBe('sent');
    // Partner sees only the public notice, not A's sources or complaint.
    expect(inbox.incoming[0].public_evidence).not.toContain('Confidential');
  });

  it('acknowledged is distinct from completed; completion points to the partner successor', async () => {
    const cid = await proposeCorrection(d.A, { storyId: d.storyId, reason: 'r', replacements: replacementsFor(d).slice(0, 1) });
    await approveCorrection(d.A, cid);
    const [req] = (await listRelay(d.B)).incoming;
    expect((await respondToRelay(d.B, req.id, { action: 'acknowledge' })).status).toBe('acknowledged');
    expect((await getPassport(d.partner.ref))!.status).toBe('current');
    expect(await code(respondToRelay(d.A, req.id, { action: 'acknowledge' }))).toBe('not_found');
    const done = await respondToRelay(d.B, req.id, {
      action: 'complete', title: 'Flooding closes 2 schools', body: 'Republished. 2 schools.', changeNote: 'Corrected', expectedBaseVersionId: d.partner.versionId,
    });
    expect(done.status).toBe('completed');
    const pp = (await getPassport(d.partner.ref))!;
    expect(pp.status).toBe('superseded');
    const origin = await getCorrection(d.A, cid);
    expect(origin.relays[0].status).toBe('completed');
  });
});

describe('Case confidentiality and fair intake', () => {
  it('a case reference alone reveals nothing; the token does', async () => {
    const c = await submitComplaint({ ref: d.shona.ref, passage: 'zvikoro 12 zvakavharwa', concern: 'Zvikoro 2 chete', channel: 'web', locale: 'sn' });
    expect(await redeemCaseToken(c.caseRef)).toBeNull();
    const access = (await redeemCaseToken(c.token))!;
    const view = await getCaseForComplainant(access.accessId);
    expect(view.case_ref).toBe(c.caseRef);
    expect(view.locale).toBe('sn');
    const raw = await sys(`select token_sha256 from case_access`);
    expect(raw.rows.length).toBe(1);
    for (const r of raw.rows) expect(r.token_sha256).not.toBe(c.token);
  });
  it('complaints never change public status and internal notes stay private', async () => {
    const c = await submitComplaint({ ref: d.article.ref, passage: 'closed 12 schools', concern: 'It was 2', channel: 'web' });
    expect((await getPassport(d.article.ref))!.status).toBe('current');
    await deskAction(d.A, c.complaintId, { action: 'note', body: 'SECRET internal note' });
    await deskAction(d.A, c.complaintId, { action: 'reply', body: 'Thanks, reviewing.' });
    const access = (await redeemCaseToken(c.token))!;
    const view = await getCaseForComplainant(access.accessId);
    expect(view.messages.map((m: { body: string }) => m.body).join(' ')).not.toContain('SECRET');
    expect(view.messages.map((m: { body: string }) => m.body)).toContain('Thanks, reviewing.');
  });
  it('rejects passages that are not in the registered version', async () => {
    expect(await code(submitComplaint({ ref: d.article.ref, passage: 'never published words', concern: 'x y z', channel: 'web' }))).toBe('validation');
  });
  it('grouped submissions keep independent receipts', async () => {
    const one = await submitComplaint({ ref: d.article.ref, passage: 'closed 12 schools', concern: 'It was 2', channel: 'web' });
    const two = await submitComplaint({ ref: d.article.ref, passage: 'Closed 12 Schools', concern: 'Also 2', channel: 'web' });
    expect(one.caseRef).not.toBe(two.caseRef);
    const rows = await listComplaints(d.A);
    expect(rows.every((r) => r.group_size === 2)).toBe(true);
  });
});

describe('Complaint to correction, end to end', () => {
  it('links the approved correction to the case', async () => {
    const c = await submitComplaint({ ref: d.ndebele.ref, passage: 'Izikolo ezingu-12 zivaliwe', concern: 'Yizikolo ezi-2 kuphela', channel: 'web', locale: 'nd' });
    const cid = await proposeCorrection(d.A, { storyId: d.storyId, claimId: d.claimId, complaintId: c.complaintId, reason: 'Revised bulletin', replacements: replacementsFor(d) });
    await approveCorrection(d.A, cid);
    const access = (await redeemCaseToken(c.token))!;
    const view = await getCaseForComplainant(access.accessId);
    expect(view.correction_id).toBe(cid);
    expect(view.corrected_refs).toHaveLength(3);
  });
});
