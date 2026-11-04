import { redirect } from 'next/navigation';
import { currentActor } from '@/lib/session';
import { getT } from '@/lib/i18n/server';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await currentActor();
  if (!session) redirect('/login');
  const { actor } = session;
  const { t } = await getT();
  return (
    <div>
      <div className="app-bar">
        {env.demoMode() && <span className="pill demo">{t('demo.mode')}</span>}
        <span className="who">{t('demo.signedInAs', { role: t(`app.role.${actor.role}`), org: actor.orgName })}</span>
        <span className="muted small">{actor.name}</span>
        <span style={{ flex: 1 }} />
        <a className="btn secondary" href="/login" style={{ minHeight: 38 }}>{t('demo.switchRole')}</a>
      </div>
      <nav className="app-nav" aria-label="Vimba">
        <a href="/app/stories">{t('app.stories')}</a>
        <a href="/app/complaints">{t('app.complaints')}</a>
        <a href="/app/relay">{t('app.relay')}</a>
        <a href="/app/simulator">{t('app.simulator')}</a>
        <a href="/app/channel">{t('app.channel')}</a>
      </nav>
      {children}
    </div>
  );
}
