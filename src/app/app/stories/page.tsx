import { requireActor } from '@/lib/session';
import { listStories } from '@/services/newsroom';
import { getT } from '@/lib/i18n/server';
import { formatDate } from '@/lib/i18n';
import { ErrorBanner } from '@/components/ErrorBanner';
import { createStoryAction } from '../actions';

export default async function StoriesPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const actor = await requireActor();
  const { locale, t } = await getT();
  const { error } = await searchParams;
  const stories = await listStories(actor);
  return (
    <div>
      <h1>{t('app.stories')}</h1>
      <ErrorBanner error={error} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>{t('app.storyTitle')}</th><th>{t('app.owner')}</th><th>{t('app.lastRelease')}</th><th>{t('app.openCorrections')}</th></tr></thead>
          <tbody>
            {stories.map((s) => (
              <tr key={s.id}>
                <td><a href={`/app/stories/${s.id}`}>{s.title}</a></td>
                <td>{s.owner}</td>
                <td>{s.last_release ? formatDate(s.last_release, locale) : <span className="muted">{t('app.unpublished')}</span>}</td>
                <td>{s.open_corrections}{s.open_complaints ? <span className="pill" style={{ marginLeft: 6 }}>{s.open_complaints} complaints</span> : null}</td>
              </tr>
            ))}
            {!stories.length && <tr><td colSpan={4} className="muted">No stories yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <form action={createStoryAction} className="card">
        <h2 style={{ marginTop: 0 }}>{t('app.newStory')}</h2>
        <label htmlFor="title">{t('app.storyTitle')}</label>
        <input id="title" name="title" type="text" required maxLength={300} />
        <div className="actions"><button type="submit">{t('app.newStory')}</button></div>
      </form>
    </div>
  );
}
