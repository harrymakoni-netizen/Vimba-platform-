import crypto from 'node:crypto';
import { canonicalJson, newVersionRef, sha256Hex, signCanonical, verifyCanonical } from '@/lib/crypto';
import { env } from '@/lib/env';
import { conflict, invalid, notFound } from '@/lib/errors';
import { one, type Tx } from '@/lib/db';
import { isLocale, type Locale } from '@/lib/i18n';
import { asMember, audit, authorize, type Actor } from './actor';

export const RECEIPT_SCHEMA_VERSION = 1;

export type OutputKind = 'article' | 'bulletin' | 'graphic' | 'partner_copy';
const KINDS: OutputKind[] = ['article', 'bulletin', 'graphic', 'partner_copy'];

/** Fields covered by the signature. The signature itself is never part of the signed payload. */
export interface Receipt {
  schema_version: number;
  issuer_id: string;
  key_id: string;
  organisation_id: string;
  story_id: string;
  output_id: string;
  version_id: string;
  version_number: number;
  public_ref: string;
  language: Locale;
  content_sha256: string;
  issued_at_utc: string;
  predecessor_version_id: string | null;
  signature_algorithm: 'Ed25519';
}

/** Digest of the approved public text: canonical JSON of title, body and language. */
export const contentDigest = (c: { title: string; body: string; language: string }) =>
  sha256Hex(canonicalJson({ body: c.body, language: c.language, title: c.title }));

export function verifyReceipt(
  receipt: Receipt,
  signature: string,
  publicKeyPem: string,
  content?: { title: string; body: string; language: string },
): { signatureValid: boolean; contentMatches: boolean | null } {
  const signatureValid = verifyCanonical(receipt as unknown as Record<string, unknown>, signature, publicKeyPem);
  const contentMatches = content ? contentDigest(content) === receipt.content_sha256 : null;
  return { signatureValid, contentMatches };
}

async function ensureSigningKey(tx: Tx) {
  await tx.query(
    `insert into signing_keys (key_id, public_key_pem, issuer_id) values ($1, $2, $3) on conflict (key_id) do nothing`,
    [env.signingKeyId(), env.signingPublicKey(), env.issuerId()],
  );
}

/**
 * Seal and persist a new immutable version. The caller must hold a lock on
 * the output row and have verified the expected predecessor. Any failure
 * (validation, signing) throws, rolling back the whole approval.
 */
export async function releaseVersion(
  tx: Tx,
  v: {
    orgId: string;
    storyId: string;
    outputId: string;
    title: string;
    body: string;
    language: Locale;
    approvedBy: string;
    predecessorVersionId: string | null;
    seq: number;
    changeNote?: string | null;
    correctionId?: string | null;
  },
) {
  if (!v.title.trim() || !v.body.trim()) throw invalid('Title and content are required before release');
  await ensureSigningKey(tx);
  const versionId = crypto.randomUUID();
  const publicRef = newVersionRef();
  const receipt: Receipt = {
    schema_version: RECEIPT_SCHEMA_VERSION,
    issuer_id: env.issuerId(),
    key_id: env.signingKeyId(),
    organisation_id: v.orgId,
    story_id: v.storyId,
    output_id: v.outputId,
    version_id: versionId,
    version_number: v.seq,
    public_ref: publicRef,
    language: v.language,
    content_sha256: contentDigest({ title: v.title, body: v.body, language: v.language }),
    issued_at_utc: new Date().toISOString(),
    predecessor_version_id: v.predecessorVersionId,
    signature_algorithm: 'Ed25519',
  };
  const signature = signCanonical(receipt as unknown as Record<string, unknown>, env.signingPrivateKey());
  // Self-check before persisting: never release something we cannot verify.
  if (!verifyCanonical(receipt as unknown as Record<string, unknown>, signature, env.signingPublicKey())) {
    throw new Error('Signing self-check failed; nothing was released');
  }
  await tx.query(
    `insert into output_versions (id, org_id, output_id, seq, public_ref, title, body, language, content_sha256,
       receipt, signature, key_id, approved_by, approved_at, predecessor_version_id, change_note, correction_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [
      versionId,
      v.orgId,
      v.outputId,
      v.seq,
      publicRef,
      v.title,
      v.body,
      v.language,
      receipt.content_sha256,
      JSON.stringify(receipt),
      signature,
      receipt.key_id,
      v.approvedBy,
      receipt.issued_at_utc,
      v.predecessorVersionId,
      v.changeNote ?? null,
      v.correctionId ?? null,
    ],
  );
  await audit(tx, {
    orgId: v.orgId,
    actorId: v.approvedBy,
    action: 'version.released',
    refType: 'output_version',
    refId: versionId,
    detail: { output_id: v.outputId, seq: v.seq, public_ref: publicRef, correction_id: v.correctionId ?? null },
  });
  return { versionId, publicRef, receipt, signature };
}

/** Latest released version of an output, locking the output row against concurrent releases. */
export async function lockOutputForRelease(tx: Tx, orgId: string, outputId: string) {
  const out = await one(
    tx,
    `select o.*, s.id as story_id from outputs o join stories s on s.id = o.story_id
      where o.id = $1 and o.org_id = $2 for update of o`,
    [outputId, orgId],
  );
  if (!out) throw notFound();
  const latest = await one(
    tx,
    `select id, seq from output_versions where output_id = $1 order by seq desc limit 1`,
    [outputId],
  );
  return { output: out, latest: latest as { id: string; seq: number } | null };
}

// ---------------------------------------------------------------------------
// Newsroom operations
// ---------------------------------------------------------------------------

export async function createStory(actor: Actor, input: { title: string }) {
  authorize(actor, 'story.create');
  const title = input.title?.trim();
  if (!title) throw invalid('Story title is required');
  return asMember(actor, async (tx) => {
    const s = await one(tx, `insert into stories (org_id, title, owner_id) values ($1, $2, $3) returning id`, [
      actor.orgId,
      title.slice(0, 300),
      actor.userId,
    ]);
    await audit(tx, { orgId: actor.orgId, actorId: actor.userId, action: 'story.created', refType: 'story', refId: s.id });
    return s.id as string;
  });
}

export async function createOutput(
  actor: Actor,
  input: { storyId: string; kind: string; language: string; title: string; body: string; sourceOutputRef?: string },
) {
  authorize(actor, 'output.draft');
  if (!KINDS.includes(input.kind as OutputKind)) throw invalid('Unknown output type');
  if (!isLocale(input.language)) throw invalid('Language must be English, Shona or Ndebele');
  if (!input.title?.trim()) throw invalid('Output title is required');
  return asMember(actor, async (tx) => {
    const story = await one(tx, `select id from stories where id = $1 and org_id = $2`, [input.storyId, actor.orgId]);
    if (!story) throw notFound();
    let sourceOutputId: string | null = null;
    if (input.kind === 'partner_copy') {
      // A partner copy names the origin output by any of its public refs.
      const ref = input.sourceOutputRef?.trim().toUpperCase();
      if (!ref) throw invalid('A partner copy needs the Vimba reference of the origin output');
      // Public refs are public: elevate only for this single lookup.
      await tx.query(`select set_config('app.system', 'on', true)`);
      const { rows } = await tx.query(`select output_id from output_versions where public_ref = $1`, [ref]);
      await tx.query(`select set_config('app.system', 'off', true)`);
      sourceOutputId = rows[0]?.output_id ?? null;
      if (!sourceOutputId) throw invalid('No published output has that Vimba reference');
    }
    const o = await one(
      tx,
      `insert into outputs (org_id, story_id, kind, language, title, draft_body, source_output_id, created_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [actor.orgId, input.storyId, input.kind, input.language, input.title.trim(), input.body ?? '', sourceOutputId, actor.userId],
    );
    await audit(tx, { orgId: actor.orgId, actorId: actor.userId, action: 'output.created', refType: 'output', refId: o.id });
    return o.id as string;
  });
}

export async function saveDraft(actor: Actor, outputId: string, input: { title: string; body: string; expectedRevision: number }) {
  authorize(actor, 'output.draft');
  return asMember(actor, async (tx) => {
    const r = await tx.query(
      `update outputs set title = $1, draft_body = $2, draft_revision = draft_revision + 1
        where id = $3 and org_id = $4 and draft_revision = $5 returning draft_revision`,
      [input.title.trim(), input.body, outputId, actor.orgId, input.expectedRevision],
    );
    if (!r.rowCount) {
      const exists = await one(tx, `select draft_revision from outputs where id = $1 and org_id = $2`, [outputId, actor.orgId]);
      if (!exists) throw notFound();
      throw conflict('Someone else changed this draft. Reload to see their version.', { currentRevision: exists.draft_revision });
    }
    return r.rows[0].draft_revision as number;
  });
}

/**
 * Editor-approved release of the current draft. `expectedBaseVersionId` is
 * the version the editor was looking at (null for a first release); a
 * different latest version produces an explicit conflict.
 */
export async function publishOutput(
  actor: Actor,
  outputId: string,
  input: { expectedBaseVersionId: string | null; changeNote?: string },
) {
  authorize(actor, 'output.publish');
  return asMember(actor, async (tx) => {
    const { output, latest } = await lockOutputForRelease(tx, actor.orgId, outputId);
    if ((latest?.id ?? null) !== (input.expectedBaseVersionId ?? null)) {
      throw conflict('A newer version was released while you were reviewing. Reload and review again.');
    }
    if (latest && !input.changeNote?.trim()) throw invalid('Describe what changed in this version');
    return releaseVersion(tx, {
      orgId: actor.orgId,
      storyId: output.story_id,
      outputId,
      title: output.title,
      body: output.draft_body,
      language: output.language,
      approvedBy: actor.userId,
      predecessorVersionId: latest?.id ?? null,
      seq: (latest?.seq ?? 0) + 1,
      changeNote: input.changeNote?.trim() || null,
    });
  });
}
