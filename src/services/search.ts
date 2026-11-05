import { asSystem, many } from '@/lib/db';
import type { PassportStatus } from './passports';

export interface SearchHit {
  ref: string;
  title: string;
  kind: string;
  language: string;
  publisher: string;
  version: number;
  total: number;
  status: PassportStatus;
  latestRef: string;
  latestTitle: string;
}

/** Split a query into search words: letters/digits, at least 2 characters, at most 8 words. */
export function searchWords(q: string): string[] {
  return Array.from(new Set(q.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []))
    .filter((w) => w.length >= 2)
    .slice(0, 8);
}

const escapeLike = (w: string) => w.replace(/[\\%_]/g, (c) => '\\' + c);

/**
 * Public search over registered versions (published content only; never drafts, sources or complaints).
 * Every word must appear in the version's title or text. One hit per output: its newest matching version,
 * that version's status, and the output's latest version, so a reader who types what they saw on an old
 * graphic is pointed to the correction.
 */
export async function searchVersions(q: string, limit = 20): Promise<SearchHit[]> {
  const words = searchWords(q);
  if (!words.length) return [];
  const conds = words.map((_, i) => `(v.title || ' ' || v.body) ilike $${i + 1}`).join(' and ');
  const params = words.map((w) => `%${escapeLike(w)}%`);
  const cap = Math.max(1, Math.min(limit, 50));
  return asSystem(async (tx) => {
    const rows = await many(
      tx,
      `select * from (
         select distinct on (v.output_id)
                v.public_ref, v.title, v.seq, o.kind, o.language, o.withdrawn_at, org.name as publisher,
                l.public_ref as latest_ref, l.title as latest_title, l.seq as total
           from output_versions v
           join outputs o on o.id = v.output_id
           join organisations org on org.id = v.org_id
           join lateral (select public_ref, title, seq from output_versions where output_id = v.output_id order by seq desc limit 1) l on true
          where ${conds}
          order by v.output_id, v.seq desc
       ) hits
       limit ${cap}`,
      params,
    );
    return rows
      .map((r) => ({
        ref: r.public_ref as string,
        title: r.title as string,
        kind: r.kind as string,
        language: r.language as string,
        publisher: r.publisher as string,
        version: r.seq as number,
        total: r.total as number,
        status: (r.withdrawn_at ? 'withdrawn' : r.total > r.seq ? 'superseded' : 'current') as PassportStatus,
        latestRef: r.latest_ref as string,
        latestTitle: r.latest_title as string,
      }))
      .sort((a, b) => Number(b.status === 'superseded') - Number(a.status === 'superseded'));
  });
}
