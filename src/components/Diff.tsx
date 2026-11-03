import { wordDiff } from '@/lib/diff';

export function Diff({ before, after, lang }: { before: string; after: string; lang?: string }) {
  const parts = wordDiff(before, after);
  return (
    <div className="diff">
      <div className="before content small" lang={lang} aria-label="Before">
        {parts.filter((p) => p.kind !== 'add').map((p, i) => (p.kind === 'del' ? <del key={i}>{p.text}</del> : <span key={i}>{p.text}</span>))}
      </div>
      <div className="after content small" lang={lang} aria-label="After">
        {parts.filter((p) => p.kind !== 'del').map((p, i) => (p.kind === 'add' ? <ins key={i}>{p.text}</ins> : <span key={i}>{p.text}</span>))}
      </div>
    </div>
  );
}
