import { execSync } from 'node:child_process';

// Vercel build: migrate (idempotent), optionally seed fictional demo data, then build.
const hasDb = Boolean(
  process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.POSTGRES_URL,
);
const sh = (cmd: string) => execSync(cmd, { stdio: 'inherit' });

if (hasDb) {
  sh('tsx scripts/migrate.ts');
  if (process.env.VIMBA_SEED_DEMO === 'true') sh('tsx scripts/seed.ts');
} else {
  console.warn('WARNING: no database URL configured; skipping migrations. Connect a Postgres database to this project.');
}
sh('next build');
