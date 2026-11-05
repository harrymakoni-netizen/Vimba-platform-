import { getT } from '@/lib/i18n/server';
import { env } from '@/lib/env';
import { demoStories } from '@/services/demo';
import { LANGUAGE_LABEL, type Locale } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  const { t } = await getT();
  const { invalid } = await searchParams;
  const stories = env.demoMode() ? await demoStories().catch(() => []) : [];
  return (
    <div className="narrow">
      <p className="eyebrow">{t('passport.title')}</p>
      <h1>{t('home.title')}</h1>
      <p className="lead">{t('home.lead')}</p>
      <form action="/check" method="get" className="card">
        <label htmlFor="ref">{t('home.refLabel')}</label>
        <input id="ref" name="ref" type="text" autoComplete="off" placeholder="VMB-5DSN6ZBGGZ or 12 schools closed" required
          aria-describedby={invalid ? 'ref-error' : undefined} aria-invalid={invalid ? true : undefined} />
        {invalid && <p id="ref-error" className="notice bad" role="alert">{t('home.invalidRef')}</p>}
        <div className="actions"><button type="submit">{t('home.check')}</button></div>
      </form>

      {stories.length > 0 && (
        <section aria-labelledby="demo-h">
          <h2 id="demo-h">{t('demo.storiesTitle')}</h2>
          <p className="muted">{t('demo.storiesLead')}</p>
          <div className="card table-wrap demo-list">
            <table className="stack compact">
              <tbody>
                {stories.map((s) => {
                  const status = s.withdrawn_at ? 'withdrawn' : s.total > 1 ? 'superseded' : 'current';
                  return (
                    <tr key={s.ref}>
                      <td>
                        <a href={`/p/${s.ref}`} className="mono">{s.ref}</a>
                        <div className="small muted">{s.publisher}</div>
                      </td>
                      <td style={{ gridRow: 2 }}>
                        {t(`passport.kind.${s.kind}` as 'passport.kind.article')}
                        <div className="small muted">{LANGUAGE_LABEL[s.language as Locale]}</div>
                      </td>
                      <td style={{ gridRow: '1 / span 2', gridColumn: 2 }}><span className={`status ${status}`}>{t(`passport.status.${status}` as 'passport.status.current')}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
