import { getT } from '@/lib/i18n/server';

export default async function NotFound() {
  const { t } = await getT();
  return (
    <div className="narrow">
      <p className="eyebrow">404</p>
      <h1>{t('notFound.title')}</h1>
      <p className="lead">{t('notFound.lead')}</p>
      <form action="/check" method="get" className="card">
        <label htmlFor="ref">{t('home.refLabel')}</label>
        <input id="ref" name="ref" type="text" autoComplete="off" autoCapitalize="characters" placeholder="VMB-5DSN6ZBGGZ" required />
        <div className="actions">
          <button type="submit">{t('home.check')}</button>
          <a className="btn secondary" href="/">{t('notFound.home')}</a>
        </div>
      </form>
    </div>
  );
}
