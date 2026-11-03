import { env } from '@/lib/env';
import { availableLocales, LOCALE_META, type Locale } from '@/lib/i18n';

/** Plain links: works without JavaScript and with keyboard and screen readers. */
export function LanguageSwitcher({ locale, label, next }: { locale: Locale; label: string; next?: string }) {
  const locales = availableLocales(env.allowDraftLocales());
  return (
    <nav className="lang-switch" aria-label={label}>
      <span className="muted" aria-hidden="true">{label}:</span>
      {locales.map((l) => (
        <a
          key={l}
          href={`/lang?l=${l}${next ? `&next=${encodeURIComponent(next)}` : ''}`}
          hrefLang={LOCALE_META[l].htmlLang}
          lang={LOCALE_META[l].htmlLang}
          aria-current={l === locale ? 'true' : undefined}
        >
          {LOCALE_META[l].name}
          {LOCALE_META[l].status === 'draft' && <span className="draft-tag">draft</span>}
        </a>
      ))}
    </nav>
  );
}
