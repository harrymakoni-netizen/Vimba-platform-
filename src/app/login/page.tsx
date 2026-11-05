import { getT } from '@/lib/i18n/server';
import { env } from '@/lib/env';
import { DEMO_ACCOUNTS } from '@/services/demo';
import { demoSignInAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reset?: string; missing?: string }> }) {
  const { t } = await getT();
  const sp = await searchParams;
  if (!env.demoMode()) {
    return (
      <div className="narrow">
        <h1>{t('demo.title')}</h1>
        <p className="notice">{t('demo.unavailable')}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="eyebrow">{t('demo.mode')}</p>
      <h1>{t('demo.title')}</h1>
      <p className="lead">{t('demo.lead')}</p>
      {sp.reset && <p className="notice ok" role="status">{t('demo.resetDone')}</p>}
      {sp.missing && <p className="notice bad" role="alert">{t('common.error')}</p>}
      <div className="roles">
        {DEMO_ACCOUNTS.map((a) => (
          <form key={a.role} action={demoSignInAction} className="role-card">
            <input type="hidden" name="role" value={a.role} />
            <p className="org">{a.org === 'a' ? 'The Zambezi Daily' : 'Matobo Mirror'}</p>
            <h2>{t(`demo.role.${a.role}`)}</h2>
            <p className="muted small">{a.name}</p>
            <p>{t(`demo.desc.${a.role}`)}</p>
            <button type="submit">{t('demo.continue')}</button>
          </form>
        ))}
      </div>
    </div>
  );
}
