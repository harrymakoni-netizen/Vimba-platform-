import { getT } from '@/lib/i18n/server';
import { LANGUAGE_LABEL, LOCALE_META, type Locale } from '@/lib/i18n';
import { searchVersions, searchWords } from '@/services/search';

export const dynamic = 'force-dynamic';

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { t } = await getT();
  const q = ((await searchParams).q ?? '').slice(0, 200);
  const words = searchWords(q);
  const hits = words.length ? await searchVersions(q) : [];
  return (
    <div className="narrow">
      <p className="eyebrow">{t('passport.title')}</p>
      <h1>{t('search.title')}</h1>
      <p className="lead">{t('search.lead')}</p>
      <form action="/search" method="get" className="card" role="search">
        <label htmlFor="q">{t('search.label')}</label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="12 schools closed" autoComplete="off" required minLength={3} />
        <div className="actions"><button type="submit">{t('search.button')}</button></div>
      </form>
      {q && !words.length && <p className="notice bad" role="alert">{t('search.tooShort')}</p>}
      {words.length > 0 && (
        <section aria-live="polite">
          <p className="muted">{hits.length ? t('search.results', { n: hits.length }) : t('search.none')}</p>
          {hits.map((h) => {
            const lang = LOCALE_META[h.language as Locale]?.htmlLang;
            return (
              <div key={h.ref} className="card">
                <p style={{ margin: 0 }}>
                  <span className={`status ${h.status}`}>{t(`passport.status.${h.status}` as 'passport.status.current')}</span>
                </p>
                <h3 style={{ margin: '10px 0 4px' }} lang={lang}>
                  <a href={`/p/${h.ref}`}>{h.title}</a>
                </h3>
                <p className="small muted" style={{ margin: 0 }}>
                  {h.publisher} · {t(`passport.kind.${h.kind}` as 'passport.kind.article')} · {LANGUAGE_LABEL[h.language as Locale]} ·{' '}
                  {t('passport.version', { n: h.version, total: h.total })} · <span className="mono">{h.ref}</span>
                </p>
                {h.status === 'superseded' && (
                  <p className="small" style={{ margin: '10px 0 0' }}>
                    {t('search.latest')}: <a href={`/p/${h.latestRef}`} lang={lang}>{h.latestTitle}</a>{' '}
                    <span className="mono muted">{h.latestRef}</span>
                  </p>
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
