export function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="notice bad" role="alert">{error}</p>;
}
