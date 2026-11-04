import { translateError, type Locale } from '@/lib/i18n';

export function ErrorBanner({ error, locale }: { error?: string; locale: Locale }) {
  if (!error) return null;
  return <p className="notice bad" role="alert">{translateError(error, locale)}</p>;
}
