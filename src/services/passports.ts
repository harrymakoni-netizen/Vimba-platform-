import { asSystem, many, one } from '@/lib/db';
import { normaliseRef, signCanonical } from '@/lib/crypto';
import { env } from '@/lib/env';
import type { Locale } from '@/lib/i18n';
import { verifyReceipt, type Receipt } from './publication';

export type PassportStatus = 'current' | 'superseded' | 'withdrawn' | 'unavailable';

/**
 * Public projection of one registered version. Only allowlisted, released
 * fields are returned: never drafts, sources, claim maps or case evidence.
 */
export interface Passport {
  ref: string;
  publisher: { name: string; domain: string | null; domainCheck: string };
  output: { kind: string; title: string; language: Locale };
  version: { number: number; total: number; title: string; body: string; publishedAt: string; changeNote: string | null };
  status: PassportStatus;
  latest: { ref: string; number: number; title: string; changeNote: string | null; correctionReason: string | null; publishedAt: string } | null;
  history: { ref: string; number: number; publishedAt: string }[];
  republishedFrom: { publisher: string; ref: string | null } | null;
  receipt: Receipt;
  signature: string;
  verification: { signatureValid: boolean; contentMatches: boolean | null; issuerId: string; issuerBasis: string; keyStatus: string | null };
  statusResponse: { body: Record<string, unknown>; signature: string };
  checkedAt: string;
}

export async function getPassport(rawRef: string): Promise<Passport | null> {
  const ref = normaliseRef(rawRef);
  if (!ref) return null;
  return asSystem(async (tx) => {
    const v = await one(
      tx,
      `select v.*, o.kind, o.title as output_title, o.language as output_language, o.withdrawn_at,
              o.source_output_id, o.story_id, org.name as org_name, org.domain, org.domain_check_status
         from output_versions v
         join outputs o on o.id = v.output_id
         join organisations org on org.id = v.org_id
        where v.public_ref = $1`,
      [ref],
    );
    if (!v) return null;

    const versions = await many(
      tx,
      `select v.id, v.public_ref, v.seq, v.title, v.approved_at, v.change_note, c.reason
         from output_versions v left join corrections c on c.id = v.correction_id
        where v.output_id = $1 order by v.seq`,
      [v.output_id],
    );
    const latestRow = versions[versions.length - 1];
    const status: PassportStatus = v.withdrawn_at ? 'withdrawn' : latestRow.seq > v.seq ? 'superseded' : 'current';

    let republishedFrom: Passport['republishedFrom'] = null;
    if (v.source_output_id) {
      const src = await one(
        tx,
        `select org.name, (select public_ref from output_versions where output_id = o.id order by seq desc limit 1) as ref
           from outputs o join organisations org on org.id = o.org_id where o.id = $1`,
        [v.source_output_id],
      );
      if (src) republishedFrom = { publisher: src.name, ref: src.ref };
    }

    const key = await one(tx, `select public_key_pem, status from signing_keys where key_id = $1`, [v.key_id]);
    const verification = key
      ? verifyReceipt(v.receipt, v.signature, key.public_key_pem, { title: v.title, body: v.body, language: v.language })
      : { signatureValid: false, contentMatches: null };

    const checkedAt = new Date().toISOString();
    // A signed, timestamped status response: separate from the historic receipt.
    const statusBody = {
      type: 'vimba.status.v1',
      issuer_id: env.issuerId(),
      key_id: env.signingKeyId(),
      public_ref: ref,
      status,
      latest_ref: latestRow.public_ref,
      latest_version_number: latestRow.seq,
      checked_at_utc: checkedAt,
    };

    return {
      ref,
      publisher: { name: v.org_name, domain: v.domain, domainCheck: v.domain_check_status },
      output: { kind: v.kind, title: v.output_title, language: v.output_language },
      version: {
        number: v.seq,
        total: versions.length,
        title: v.title,
        body: v.body,
        publishedAt: new Date(v.approved_at).toISOString(),
        changeNote: v.change_note,
      },
      status,
      latest:
        latestRow.seq > v.seq
          ? {
              ref: latestRow.public_ref,
              number: latestRow.seq,
              title: latestRow.title,
              changeNote: latestRow.change_note,
              correctionReason: latestRow.reason,
              publishedAt: new Date(latestRow.approved_at).toISOString(),
            }
          : null,
      history: versions.map((h) => ({ ref: h.public_ref, number: h.seq, publishedAt: new Date(h.approved_at).toISOString() })),
      republishedFrom,
      receipt: v.receipt,
      signature: v.signature,
      verification: {
        ...verification,
        issuerId: v.receipt.issuer_id,
        issuerBasis: env.issuerBasis(),
        keyStatus: key?.status ?? null,
      },
      statusResponse: { body: statusBody, signature: signCanonical(statusBody, env.signingPrivateKey()) },
      checkedAt,
    };
  });
}

/** Public keys for independent receipt verification. */
export async function listPublicKeys() {
  return asSystem((tx) =>
    many(tx, `select key_id, algorithm, public_key_pem, issuer_id, status, created_at, retired_at from signing_keys order by created_at`),
  );
}

/** Case-insensitive, whitespace-tolerant check that a quoted passage exists in a version. */
export function passageIn(body: string, passage: string): boolean {
  const norm = (s: string) =>
    s
      .normalize('NFKC')
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  const p = norm(passage).replace(/[.!?]+$/, '');
  return p.length >= 3 && norm(body).includes(p);
}
