import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hmacHex } from '@/lib/crypto';
import { asSystem } from '@/lib/db';
import { ingestKapsoWebhook } from '@/channels/whatsapp/handler';
import { listComplaints, deskAction, getComplaint } from '@/services/complaints';
import { runWorkerOnce } from '@/services/worker';
import { demo } from './fixtures';

const SECRET = 'test-webhook-secret';
const PHONE = '263771234567';
let d: Awaited<ReturnType<typeof demo>>;
let n = 0;
const sys = (sql: string, params: unknown[] = []) => asSystem((tx) => tx.query(sql, params));

function event(message: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    phone_number_id: 'pn_test',
    message: { id: `wamid.${++n}`, timestamp: '1762180000', from: PHONE, from_user_id: 'bsuid-1', ...message },
    conversation: { id: 'conv_1', phone_number: PHONE, business_scoped_user_id: 'bsuid-1', phone_number_id: 'pn_test' },
    ...extra,
  });
}
const text = (body: string) => event({ type: 'text', text: { body } });
const pick = (id: string) => event({ type: 'interactive', interactive: { type: 'button_reply', button_reply: { id, title: 'x' } } });

function headers(raw: string, opts: { key?: string; sig?: string; kind?: string } = {}) {
  return new Headers({
    'x-webhook-signature': opts.sig ?? hmacHex(SECRET, raw),
    'x-idempotency-key': opts.key ?? `idem-${++n}`,
    'x-webhook-event': opts.kind ?? 'whatsapp.message.received',
  });
}
const send = (raw: string, opts?: Parameters<typeof headers>[1]) => ingestKapsoWebhook(raw, headers(raw, opts));
const outCount = async () => (await sys(`select count(*)::int as n from outbox where kind = 'whatsapp.send'`)).rows[0].n as number;

beforeEach(async () => {
  d = await demo();
});
afterEach(() => vi.restoreAllMocks());

describe('Kapso webhook', () => {
  it('Signature: wrong secret, edited body or missing header returns 401 and stores nothing', async () => {
    const raw = text('MENU');
    expect((await ingestKapsoWebhook(raw, headers(raw, { sig: hmacHex('wrong', raw) }))).status).toBe(401);
    expect((await ingestKapsoWebhook(raw.replace('MENU', 'STOP'), headers(raw))).status).toBe(401);
    const h = headers(raw);
    h.delete('x-webhook-signature');
    expect((await ingestKapsoWebhook(raw, h)).status).toBe(401);
    expect((await sys(`select count(*)::int as n from channel_events`)).rows[0].n).toBe(0);
    expect(await outCount()).toBe(0);
  });

  it('Replay: the same delivery twice produces one event, one state change and one reply', async () => {
    const raw = text('MENU');
    expect((await send(raw, { key: 'same' })).status).toBe(200);
    expect((await send(raw, { key: 'same' })).status).toBe(200);
    expect((await sys(`select count(*)::int as n from channel_events`)).rows[0].n).toBe(1);
    expect((await sys(`select state_version from channel_sessions`)).rows[0].state_version).toBe(1);
    expect(await outCount()).toBe(1);
  });

  it('Test events never create a case', async () => {
    await send(text(`CHECK ${d.article.ref}`), {});
    const raw = event({ type: 'text', text: { body: 'anything' } }, { test: true });
    expect((await send(raw)).status).toBe(200);
    const ev = await sys(`select is_test, error from channel_events where is_test`);
    expect(ev.rows[0]).toMatchObject({ is_test: true, error: 'test_event_ignored' });
    expect((await sys(`select count(*)::int as n from complaints`)).rows[0].n).toBe(0);
  });

  it('Rejects events for another phone number id', async () => {
    const raw = JSON.stringify({ phone_number_id: 'someone-else', message: { type: 'text', text: { body: 'MENU' }, from: PHONE } });
    await send(raw);
    expect(await outCount()).toBe(0);
  });

  it('Parity: a WhatsApp complaint appears in the editor desk like a web complaint, marked WhatsApp', async () => {
    const steps = [pick('menu.report'), text(d.ndebele.ref), text('Izikolo ezingu-12 zivaliwe'), text('Yizikolo ezi-2 kuphela.'), pick('report.skip'), pick('confirm.submit')];
    await send(text('SALIBONANI'));
    for (const raw of steps) expect((await send(raw)).status).toBe(200);
    const rows = await listComplaints(d.A);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ intake_channel: 'whatsapp', locale: 'nd' });
    const last = (await sys(`select payload->'message'->>'body' as body from outbox order by created_at desc limit 1`)).rows[0].body;
    expect(last).toContain(rows[0].case_ref);
    expect(last).toContain('Isicelo samukelwe');
  });

  it('Privacy: logs carry no message bodies or phone numbers', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((...a) => void logs.push(a.join(' ')));
    vi.spyOn(console, 'error').mockImplementation((...a) => void logs.push(a.join(' ')));
    await send(text(`CHECK ${d.article.ref}`));
    await send(text('My secret concern text'));
    const all = logs.join('\n');
    expect(all).not.toContain(PHONE);
    expect(all).not.toContain('secret concern');
    expect(all).not.toContain(SECRET);
    // Session keys are opaque, never the phone number.
    const s = (await sys(`select sender_key, reply_address_enc from channel_sessions`)).rows[0];
    expect(s.sender_key).not.toContain(PHONE);
    expect(s.reply_address_enc).not.toContain(PHONE);
  });

  it('Window: case updates are sent only inside 24 hours', async () => {
    for (const raw of [pick('menu.report'), text(d.article.ref), text('closed 12 schools'), text('It was two schools'), pick('report.skip'), pick('confirm.submit')]) await send(raw);
    const [c] = await listComplaints(d.A);
    const before = await outCount();
    await deskAction(d.A, c.id, { action: 'reply', body: 'Reviewing' });
    expect(await outCount()).toBe(before + 1);
    await sys(`update channel_sessions set last_inbound_at = now() - interval '25 hours'`);
    await deskAction(d.A, c.id, { action: 'reply', body: 'Still reviewing' });
    expect(await outCount()).toBe(before + 1);
    expect((await getComplaint(d.A, c.id)).complaint.intake_channel).toBe('whatsapp');
  });

  it('Outage: with Kapso unreachable the outbox keeps the job for retry; 131047 is recorded without retry', async () => {
    process.env.KAPSO_API_KEY = 'k';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await send(text('MENU'));
    await runWorkerOnce();
    const job = (await sys(`select status, attempts, last_error from outbox`)).rows[0];
    expect(job).toMatchObject({ status: 'pending', attempts: 1 });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 131047 } }), { status: 400 }));
    await sys(`update outbox set next_attempt_at = now()`);
    await runWorkerOnce();
    const dead = (await sys(`select status, last_error from outbox`)).rows[0];
    expect(dead).toMatchObject({ status: 'dead', last_error: '131047' });
    delete process.env.KAPSO_API_KEY;
  });
});
