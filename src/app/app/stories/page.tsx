import { requireActor } from '@/lib/session';
import { listStories } from '@/services/newsroom';
import { can } from '@/services/actor';
import { env } from '@/lib/env';
import { getT } from '@/lib/i18n/server';
import { formatDate } from '@/lib/i18n';
import { ErrorBanner } from '@/components/ErrorBanner';
import { createStoryAction, resetDemoAction } from '../actions';

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { locale, t } = await getT();
  const { error } = await searchParams;
  const stories = await listStories(actor);
  return (
    <div>
      <h1>{t('app.stories')}</h1>
      <ErrorBanner error={error} locale={locale} />
      <div className="card table-wrap">
        <table className="stack">
          <thead><tr><th>{t('app.storyTitle')}</th><th>{t('app.owner')}</th><th>{t('app.lastRelease')}</th><th>{t('app.openCorrections')}</th></tr></thead>
          <tbody>
            {stories.map((s) => (
              <tr key={s.id}>
                <td><a href={`/app/stories/${s.id}`}>{s.title}</a></td>
                <td data-label={t('app.owner')}>{s.owner}</td>
                <td data-label={t('app.lastRelease')}>{s.last_release ? formatDate(s.last_release, locale) : <span className="muted">{t('app.unpublished')}</span>}</td>
                <td data-label={t('app.openCorrections')}>
                  {s.open_corrections}
                  {s.open_complaints ? <div className="small"><span className="pill">{t('app.openComplaints', { n: s.open_complaints })}</span></div> : null}
                </td>
              </tr>
            ))}
            {!stories.length && <tr><td colSpan={4} className="muted">{t('app.noStories')}</td></tr>}
          </tbody>
        </table>
      </div>
      <form action={createStoryAction} className="card">
        <h2 style={{ marginTop: 0 }}>{t('app.newStory')}</h2>
        <label htmlFor="title">{t('app.storyTitle')}</label>
        <input id="title" name="title" type="text" required maxLength={300} />
        <div className="actions"><button type="submit">{t('app.newStory')}</button></div>
      </form>
      {env.demoMode() && can(actor, 'correction.approve') && (
        <details className="card soft">
          <summary>{t('demo.reset')}</summary>
          <p className="muted">{t('demo.resetHelp')}</p>
          <form action={resetDemoAction}>
            <button type="submit" className="danger">{t('demo.resetConfirm')}</button>
          </form>
        </details>
      )}
    </div>
  );
}
