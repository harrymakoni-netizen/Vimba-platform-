/** Runs once per server instance before requests are handled. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return;
  const { loadSecretsIntoEnv } = await import('./lib/secrets');
  const applied = await loadSecretsIntoEnv();
  if (applied.length) console.log(JSON.stringify({ level: 'warn', component: 'secrets', msg: 'using database-stored demo secrets', keys: applied }));
}
