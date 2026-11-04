import type { Metadata, Viewport } from 'next';
import './globals.css';
import { getT } from '@/lib/i18n/server';
import { LOCALE_META } from '@/lib/i18n';
import { LanguageMenu } from '@/components/LanguageMenu';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: 'Vimba',
  description: 'Accountability that travels with the story.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#ffffff', colorScheme: 'light' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getT();
  return (
    <html lang={LOCALE_META[locale].htmlLang}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:wght@400..600&family=Public+Sans:wght@400;500;600;700&display=swap" />
      </head>
      <body>
        <a className="skip" href="#main">{t('common.skip')}</a>
        <header className="site-header">
          <div className="inner">
            <a href="/" className="logo" aria-label="Vimba">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vimba-logo.png" alt="Vimba" width={150} height={30} />
            </a>
            <span className="header-spacer" />
            {env.demoMode() && <a className="header-link" href="/app">{t('home.newsroomLink')}</a>}
            <LanguageMenu locale={locale} label={t('lang.choose')} />
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="inner">{t('common.tagline')}</div>
        </footer>
      </body>
    </html>
  );
}
