/**
 * Runs once per server instance. Warming the demo secrets here is only an
 * optimisation: it must never throw, or Next.js would fail every request on
 * this instance. Every database call loads them on demand anyway.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return;
  try {
    const { ensureSecrets } = await import('./lib/db');
    await ensureSecrets();
  } catch (err) {
    console.error(JSON.stringify({ level: 'warn', component: 'startup', msg: 'secrets warm-up skipped', code: (err as { code?: string }).code ?? 'error' }));
  }
}
