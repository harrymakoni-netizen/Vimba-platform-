import { z } from 'zod';
import { asSystem, many, one, type Tx } from '@/lib/db';
import { newCaseRef, randomToken, sha256Hex, normaliseRef } from '@/lib/crypto';
import { env } from '@/lib/env';
import { AppError, conflict, invalid, notFound } from '@/lib/errors';
import { isLocale, translator, formatDate, type Locale } from '@/lib/i18n';
import { asMember, audit, authorize, elevate, type Actor } from './actor';
import { enqueue } from './outbox';
import { passageIn } from './passports';

export type CaseStatus = 'received' | 'in_review' | 'awaiting_information' | 'decision_issued' | 'closed';

const CASE_TOKEN_DAYS = 180;
export const MAX_CONCERN = 1000;

const intakeSchema = z.object({
  ref: z.string().min(1).max(200),
  passage: z.string().trim().min(3).max(1000),
  concern: z.string().trim().min(3).max(MAX_CONCERN),
  evidenceUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v ? v : undefined))
    .refine((v) => !v || /^https:\/\/[^\s]+$/i.test(v), 'Evidence must be an https:// link'),
  channel: z.enum(['web', 'whatsapp']),
  locale: z.string().optional(),
});

export type IntakeInput = z.input<typeof intakeSchema> & { senderKey?: string; replyAddressEnc?: string };

/**
 * Shared complaint intake for web and WhatsApp. A complaint is an allegation
 * awaiting review: it never changes the public story status.
 * Returns the case reference and the raw tracking token (shown once).
 */
export async function submitComplaint(input: IntakeInput) {
  return asSystem((tx) => submitComplaintTx(tx, input));
}

/** Same intake inside an existing system transaction (used by the WhatsApp adapter). */
export async function submitComplaintTx(tx: Tx, input: IntakeInput) {
  const parsed = intakeSchema.safeParse(input);
  if (!parsed.success) throw invalid('Check the form', { issues: parsed.error.issues.map((i) => i.path.join('.')) });
  const d = parsed.data;
  const ref = normaliseRef(d.ref);
  if (!ref) throw invalid('Unknown reference');
  const locale: Locale = isLocale(d.locale) ? d.locale : 'en';

  {
    const v = await one(tx, `select id, org_id, body from output_versions where public_ref = $1`, [ref]);
    if (!v) throw notFound();
    if (!passageIn(v.body, d.passage)) throw invalid('passage_not_found');

    if (input.senderKey) {
      const today = await one(
        tx,
        `select count(*)::int as n from case_access where sender_key = $1 and created_at > now() - interval '1 day'`,
        [input.senderKey],
      );
      if (today.n >= 3) throw new AppError('rate_limited', 'complaint_limit');
    }

    // Similar complaints share a group key but keep independent receipts and evidence.
    const groupKey = sha256Hex(`${v.id}:${d.passage.toLowerCase().replace(/\s+/g, ' ').trim()}`).slice(0, 16);
    const caseRef = newCaseRef();
    const c = await one(
      tx,
      `insert into complaints (org_id, case_ref, output_version_id, passage, concern, evidence_url, intake_channel, locale, group_key)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`,
      [v.org_id, caseRef, v.id, d.passage, d.concern, d.evidenceUrl ?? null, d.channel, locale, groupKey],
    );
    const token = randomToken(32);
    await tx.query(
      `insert into case_access (org_id, complaint_id, token_sha256, expires_at, sender_key, reply_address_enc)
       values ($1,$2,$3, now() + make_interval(days => $4), $5, $6)`,
      [v.org_id, c.id, sha256Hex(token), CASE_TOKEN_DAYS, input.senderKey ?? null, input.replyAddressEnc ?? null],
    );
    await tx.query(
      `insert into case_messages (org_id, complaint_id, author_kind, body, visibility) values ($1,$2,'system',$3,'shared')`,
      [v.org_id, c.id, `sys.received.${d.channel}`],
    );
    await audit(tx, { orgId: v.org_id, action: 'complaint.received', refType: 'complaint', refId: c.id, detail: { channel: d.channel } });
    return { caseRef, token, complaintId: c.id as string, trackingUrl: `${env.baseUrl()}/case/open?t=${token}` };
  }
}

// ---------------------------------------------------------------------------
// Complainant access (token-scoped)
// ---------------------------------------------------------------------------

/** Redeem a raw tracking token. Unknown and expired tokens are indistinguishable. */
export async function redeemCaseToken(token: string): Promise<{ accessId: string; complaintId: string } | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  return asSystem(async (tx) => {
    const a = await one(tx, `select id, complaint_id from case_access where token_sha256 = $1 and expires_at > now()`, [
      sha256Hex(token),
    ]);
    return a ? { accessId: a.id, complaintId: a.complaint_id } : null;
  });
}

async function accessRow(tx: Tx, accessId: string) {
  const a = await one(tx, `select id, complaint_id, org_id, permissions from case_access where id = $1 and expires_at > now()`, [accessId]);
  if (!a) throw notFound();
  return a;
}

export async function getCaseForComplainant(accessId: string) {
  return asSystem(async (tx) => {
    const a = await accessRow(tx, accessId);
    const c = await one(
      tx,
      `select c.case_ref, c.status, c.passage, c.concern, c.evidence_url, c.decision, c.complainant_accepts, c.correction_id,
              c.created_at, c.last_activity_at, c.locale, org.name as publisher, org.response_target_hours,
              v.public_ref, o.title as output_title,
              (select json_agg(r.public_ref) from affected_outputs af join output_versions r on r.id = af.result_version_id
                where af.correction_id = c.correction_id) as corrected_refs
         from complaints c join organisations org on org.id = c.org_id
         join output_versions v on v.id = c.output_version_id
         join outputs o on o.id = v.output_id
        where c.id = $1`,
      [a.complaint_id],
    );
    const messages = await many(
      tx,
      `select author_kind, body, created_at from case_messages
        where complaint_id = $1 and visibility = 'shared' order by created_at`,
      [a.complaint_id],
    );
    return { ...c, messages };
  });
}

export async function complainantReply(accessId: string, body: string) {
  const text = body?.trim();
  if (!text || text.length > MAX_CONCERN) throw invalid('Reply must be 1 to 1,000 characters');
  await asSystem(async (tx) => {
    const a = await accessRow(tx, accessId);
    if (!a.permissions.includes('reply')) throw notFound();
    await tx.query(`insert into case_messages (org_id, complaint_id, author_kind, body) values ($1,$2,'complainant',$3)`, [
      a.org_id,
      a.complaint_id,
      text,
    ]);
    // New information re-opens a decided or closed case; history is retained.
    await tx.query(
      `update complaints set last_activity_at = now(),
              status = case when status in ('awaiting_information','decision_issued','closed') then 'in_review' else status end
        where id = $1`,
      [a.complaint_id],
    );
    await audit(tx, { orgId: a.org_id, action: 'complaint.complainant_reply', refType: 'complaint', refId: a.complaint_id });
  });
}

export async function complainantAccepts(accessId: string, accepts: boolean) {
  await asSystem(async (tx) => {
    const a = await accessRow(tx, accessId);
    await tx.query(`update complaints set complainant_accepts = $1, last_activity_at = now() where id = $2`, [accepts, a.complaint_id]);
    await audit(tx, { orgId: a.org_id, action: 'complaint.complainant_response', refType: 'complaint', refId: a.complaint_id, detail: { accepts } });
  });
}

/** The complainant may export their own submission and the shared correspondence. */
export async function exportCase(accessId: string) {
  const c = await getCaseForComplainant(accessId);
  return {
    exported_at: new Date().toISOString(),
    case_ref: c.case_ref,
    publisher: c.publisher,
    story_reference: c.public_ref,
    disputed_passage: c.passage,
    concern: c.concern,
    evidence_url: c.evidence_url,
    status: c.status,
    decision: c.decision,
    submitted_at: c.created_at,
    correspondence: c.messages,
    note: 'Contains your submission and messages shared with you. Newsroom internal notes are not included.',
  };
}

// ---------------------------------------------------------------------------
// Newsroom corrections desk
// ---------------------------------------------------------------------------

export async function listComplaints(actor: Actor) {
  authorize(actor, 'complaint.handle');
  return asMember(actor, (tx) =>
    many(
      tx,
      `select c.id, c.case_ref, c.status, c.intake_channel, c.locale, c.created_at, c.last_activity_at, c.passage,
              u.display_name as assigned, o.title as output_title, v.public_ref, org.response_target_hours,
              (select count(*) from complaints g where g.group_key = c.group_key and g.org_id = c.org_id)::int as group_size
         from complaints c join output_versions v on v.id = c.output_version_id
         join outputs o on o.id = v.output_id
         join organisations org on org.id = c.org_id
         left join users u on u.id = c.assigned_editor_id
        where c.org_id = $1
        order by (c.status = 'closed'), c.last_activity_at desc`,
      [actor.orgId],
    ),
  );
}

export async function getComplaint(actor: Actor, id: string) {
  authorize(actor, 'complaint.handle');
  return asMember(actor, async (tx) => {
    const c = await one(
      tx,
      `select c.*, u.display_name as assigned, v.public_ref, v.seq, v.body as version_body, v.title as version_title,
              o.id as output_id, o.story_id, o.title as output_title, o.kind, o.language, org.response_target_hours
         from complaints c join output_versions v on v.id = c.output_version_id
         join outputs o on o.id = v.output_id
         join organisations org on org.id = c.org_id
         left join users u on u.id = c.assigned_editor_id
        where c.id = $1 and c.org_id = $2`,
      [id, actor.orgId],
    );
    if (!c) throw notFound();
    const messages = await many(
      tx,
      `select m.author_kind, m.body, m.visibility, m.created_at, u.display_name
         from case_messages m left join users u on u.id = m.author_id where m.complaint_id = $1 order by m.created_at`,
      [id],
    );
    const editors = await many(
      tx,
      `select u.id, u.display_name from memberships m join users u on u.id = m.user_id
        where m.org_id = $1 and m.role in ('editor','partner_editor') order by u.display_name`,
      [actor.orgId],
    );
    const claims = await many(
      tx,
      `select cl.id, cl.label, cl.text from claims cl where cl.story_id = $1 order by cl.label`,
      [c.story_id],
    );
    return { complaint: c, messages, editors, claims };
  });
}

export type DeskAction =
  | { action: 'assign'; editorId: string }
  | { action: 'start_review' }
  | { action: 'request_info'; body: string }
  | { action: 'reply'; body: string }
  | { action: 'note'; body: string }
  | { action: 'decide'; body: string }
  | { action: 'close'; body?: string };

const TRANSITIONS: Record<DeskAction['action'], CaseStatus[] | null> = {
  assign: null,
  start_review: ['received'],
  request_info: ['received', 'in_review'],
  reply: null,
  note: null,
  decide: ['received', 'in_review', 'awaiting_information'],
  close: ['decision_issued', 'in_review', 'received', 'awaiting_information'],
};

export async function deskAction(actor: Actor, id: string, a: DeskAction) {
  authorize(actor, 'complaint.handle');
  return asMember(actor, async (tx) => {
    const c = await one(tx, `select id, status, org_id from complaints where id = $1 and org_id = $2 for update`, [id, actor.orgId]);
    if (!c) throw notFound();
    const allowed = TRANSITIONS[a.action];
    if (allowed && !allowed.includes(c.status)) throw conflict('That action is not available for this case right now.');
    const body = 'body' in a ? a.body?.trim() : undefined;
    if (['request_info', 'reply', 'note', 'decide'].includes(a.action) && !body) throw invalid('Write a message');

    let newStatus: CaseStatus | null = null;
    let shared: string | null = null;
    switch (a.action) {
      case 'assign': {
        const ok = await one(
          tx,
          `select 1 from memberships where org_id = $1 and user_id = $2 and role in ('editor','partner_editor')`,
          [actor.orgId, a.editorId],
        );
        if (!ok) throw invalid('Choose an editor in this newsroom');
        await tx.query(`update complaints set assigned_editor_id = $1 where id = $2`, [a.editorId, id]);
        if (c.status === 'received') newStatus = 'in_review';
        break;
      }
      case 'start_review':
        newStatus = 'in_review';
        break;
      case 'request_info':
        newStatus = 'awaiting_information';
        shared = body!;
        break;
      case 'reply':
        shared = body!;
        break;
      case 'note':
        await tx.query(
          `insert into case_messages (org_id, complaint_id, author_kind, author_id, body, visibility) values ($1,$2,'editor',$3,$4,'internal')`,
          [actor.orgId, id, actor.userId, body],
        );
        break;
      case 'decide':
        newStatus = 'decision_issued';
        shared = body!;
        await tx.query(`update complaints set decision = $1 where id = $2`, [body, id]);
        break;
      case 'close':
        newStatus = 'closed';
        if (body) shared = body;
        break;
    }
    if (shared) {
      await tx.query(
        `insert into case_messages (org_id, complaint_id, author_kind, author_id, body, visibility) values ($1,$2,'editor',$3,$4,'shared')`,
        [actor.orgId, id, actor.userId, shared],
      );
    }
    await tx.query(`update complaints set last_activity_at = now() ${newStatus ? ', status = $2' : ''} where id = $1`, newStatus ? [id, newStatus] : [id]);
    await audit(tx, { orgId: actor.orgId, actorId: actor.userId, action: `complaint.${a.action}`, refType: 'complaint', refId: id });
    if (newStatus || shared) await notifyComplainant(tx, id, `desk:${id}:${Date.now()}`);
  });
}

/**
 * Queue a short WhatsApp status update when the complaint came from a
 * WhatsApp sender who is still inside the 24-hour service window and has not
 * sent STOP. Outside the window nothing is sent; the tracking page and the
 * TRACK command always show current status.
 * NOTE: elevates the transaction; call only as the final step.
 */
export async function notifyComplainant(tx: Tx, complaintId: string, idempotencyKey: string) {
  await elevate(tx);
  const row = await one(
    tx,
    `select c.case_ref, c.status, s.locale, a.reply_address_enc, a.sender_key, s.channel
       from complaints c
       join case_access a on a.complaint_id = c.id and a.sender_key is not null and a.reply_address_enc is not null
       join channel_sessions s on s.sender_key = a.sender_key
      where c.id = $1 and not s.stopped and s.last_inbound_at > now() - interval '24 hours'
      limit 1`,
    [complaintId],
  );
  if (!row) return false;
  const locale = (isLocale(row.locale) ? row.locale : 'en') as Locale;
  const t = translator(locale);
  const body = t('wa.case.update', { caseRef: row.case_ref, status: t(`case.status.${row.status as CaseStatus}`) });
  await enqueue(
    tx,
    'whatsapp.send',
    { toEnc: row.reply_address_enc, senderKey: row.sender_key, message: { type: 'text', body } },
    `notify:${idempotencyKey}`,
    row.channel,
  );
  return true;
}

/** Cases bound to a WhatsApp sender, for the TRACK command. */
export async function casesForSender(senderKey: string, locale: Locale) {
  const t = translator(locale);
  return asSystem(async (tx) => {
    const rows = await many(
      tx,
      `select c.case_ref, c.status, c.last_activity_at from case_access a join complaints c on c.id = a.complaint_id
        where a.sender_key = $1 and a.expires_at > now() order by c.created_at desc limit 5`,
      [senderKey],
    );
    return rows.map((r) =>
      t('wa.track.item', {
        caseRef: r.case_ref,
        status: t(`case.status.${r.status as CaseStatus}`),
        date: formatDate(r.last_activity_at, locale),
      }),
    );
  });
}
