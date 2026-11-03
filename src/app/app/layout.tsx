import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import { switchOrgAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentActor();
  if (!session) redirect('/login');
  const { actor, memberships } = session;
  const { t } = await getT();
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <strong>{actor.orgName}</strong>
        <span className="pill">{t(`app.role.${actor.role}`)}</span>
        <span className="muted small">{actor.name}</span>
        <span style={{ flex: 1 }} />
        {memberships.length > 1 && (
          <form action={switchOrgAction} style={{ display: 'flex', gap: 6 }}>
            <label htmlFor="org" className="sr-only" style={{ margin: 0 }}>Newsroom</label>
            <select id="org" name="orgId" defaultValue={actor.orgId} style={{ minHeight: 38, width: 'auto' }}>
              {memberships.map((m) => <option key={m.orgId} value={m.orgId}>{m.orgName}</option>)}
            </select>
            <button type="submit" className="secondary" style={{ minHeight: 38 }}>Switch</button>
          </form>
        )}
        <form action="/logout" method="post"><button type="submit" className="secondary" style={{ minHeight: 38 }}>{t('common.signOut')}</button></form>
      </div>
      <nav className="app-nav" aria-label="Newsroom">
        <a href="/app/stories">{t('app.stories')}</a>
        <a href="/app/complaints">{t('app.complaints')}</a>
        <a href="/app/relay">{t('app.relay')}</a>
        <a href="/app/simulator">{t('app.simulator')}</a>
        <a href="/app/channel">{t('app.channel')}</a>
        <a href="/app/languages">{t('app.languageReview')}</a>
      </nav>
      {children}
    </div>
  );
}
