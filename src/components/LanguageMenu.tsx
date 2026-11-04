import { LOCALE_META, LOCALES, type Locale } from '@/lib/i18n';

/** One language button with a small menu. Plain links: works without JavaScript. */
export function LanguageMenu({ locale, label, next }: { locale: Locale; label: string; next?: string }) {
  return (
    <details className="lang-menu">
      <summary aria-label={`${label}: ${LOCALE_META[locale].name}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
        <span>{LOCALE_META[locale].name}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </summary>
      <div className="lang-menu-list">
        <p className="lang-menu-title">{label}</p>
        {LOCALES.map((l) => (
          <a
            key={l}
            href={`/lang?l=${l}${next ? `&next=${encodeURIComponent(next)}` : ''}`}
            hrefLang={LOCALE_META[l].htmlLang}
            lang={LOCALE_META[l].htmlLang}
            aria-current={l === locale ? 'true' : undefined}
          >
            {LOCALE_META[l].name}
            {l === locale && <span aria-hidden="true">✓</span>}
          </a>
        ))}
      </div>
    </details>
  );
}
