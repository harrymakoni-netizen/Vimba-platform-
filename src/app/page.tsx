import { getT } from '@/lib/i18n/server';

export default async function Home({ searchParams }: { searchParams: Promise<{ invalid?: string }> }) {
  const { t } = await getT();
  const { invalid } = await searchParams;
  return (
    <div className="narrow">
      <p className="eyebrow">{t('passport.title')}</p>
      <h1>{t('home.title')}</h1>
      <p className="lead">{t('home.lead')}</p>
      <form action="/check" method="get" className="card">
        <label htmlFor="ref">{t('home.refLabel')}</label>
        <input id="ref" name="ref" type="text" autoComplete="off" autoCapitalize="characters" placeholder="VMB-7K2Q9XF3MA" required
          aria-describedby={invalid ? 'ref-error' : undefined} aria-invalid={invalid ? true : undefined} />
        {invalid && <p id="ref-error" className="notice bad" role="alert">{t('home.invalidRef')}</p>}
        <div className="actions"><button type="submit">{t('home.check')}</button></div>
      </form>
      <p className="small"><a href="/login">{t('home.newsroomLink')}</a></p>
    </div>
  );
}
