import { getT } from '@/lib/i18n/server';
import { loginAction } from './actions';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { t } = await getT();
  const { error } = await searchParams;
  return (
    <div className="narrow" style={{ maxWidth: 440 }}>
      <h1>{t('login.title')}</h1>
      <form action={loginAction} className="card">
        {error && <p className="notice bad" role="alert">{t('login.failed')}</p>}
        <label htmlFor="email">{t('login.email')}</label>
        <input id="email" name="email" type="email" autoComplete="username" required />
        <label htmlFor="password">{t('login.password')}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <div className="actions"><button type="submit">{t('common.signIn')}</button></div>
      </form>
      <p className="small muted">Demo accounts are listed by <code>npm run db:seed</code>.</p>
    </div>
  );
}
