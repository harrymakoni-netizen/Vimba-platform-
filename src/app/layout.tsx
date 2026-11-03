import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getT } from '@/lib/i18n/server';
import { LOCALE_META } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export const metadata: Metadata = {
  title: 'Vimba',
  description: 'Accountability that travels with the story.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getT();
  const meta = LOCALE_META[locale];
  return (
    <html lang={meta.htmlLang}>
      <body>
        <a className="skip" href="#main">{t('common.skip')}</a>
        <header className="site-header">
          <div className="inner">
            <a href="/" className="logo" aria-label="Vimba home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vimba-logo.png" alt="Vimba" width={200} height={64} />
            </a>
            <span className="header-spacer" />
            <LanguageSwitcher locale={locale} label={t('lang.switch')} />
          </div>
        </header>
        {meta.status === 'draft' && (
          <div className="notice warn" role="note" style={{ maxWidth: 1080, margin: '12px auto 0', borderRadius: 8 }}>
            {t('lang.draftNotice')}
          </div>
        )}
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="inner">
            {t('common.tagline')} · Vimba MVP · ZMC-NUST Media Innovation Hackathon 2026 · Demo data is fictional.
          </div>
        </footer>
      </body>
    </html>
  );
}
