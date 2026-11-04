import { wordDiff } from '@/lib/diff';

export function Diff({ before, after, lang, labels }: { before: string; after: string; lang?: string; labels: [string, string] }) {
  const parts = wordDiff(before, after);
  return (
    <div className="diff">
      <div className="before content small" lang={lang} aria-label={labels[0]}>
        {parts.filter((p) => p.kind !== 'add').map((p, i) => (p.kind === 'del' ? <del key={i}>{p.text}</del> : <span key={i}>{p.text}</span>))}
      </div>
      <div className="after content small" lang={lang} aria-label={labels[1]}>
        {parts.filter((p) => p.kind !== 'del').map((p, i) => (p.kind === 'add' ? <ins key={i}>{p.text}</ins> : <span key={i}>{p.text}</span>))}
      </div>
    </div>
  );
}
