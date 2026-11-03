import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import { loadEnv } from './load-env';

loadEnv();

async function main() {
  // Migrations need a direct (non-pooled) connection for DO blocks and role grants.
  const url =
    process.env.DATABASE_URL_UNPOOLED ?? process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query(`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`);
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const done = await client.query('select 1 from schema_migrations where name = $1', [file]);
    if (done.rowCount) continue;
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`applied ${file}`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    }
  }
  // The connecting owner must be able to `set role vimba_app`.
  const me = (await client.query('select current_user as u')).rows[0].u as string;
  await client.query(`grant vimba_app to "${me.replace(/"/g, '')}"`).catch((e) => {
    console.warn(`could not grant vimba_app to ${me}: ${e.message}`);
  });
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
