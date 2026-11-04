import { loadEnv } from './load-env';

loadEnv();

// Creates the fictional demo newsrooms and stories (skipped if present).
// `--reset` wipes all data first. The same fixed references are used every time.
async function main() {
  const { seedDemo, DEMO_ACCOUNTS, DEMO_REFS } = await import('../src/services/demo');
  const reset = process.argv.includes('--reset');
  const r = await seedDemo({ reset });
  console.log(r.created ? 'Demo data created (fictional).' : 'Demo data already present (use --reset to recreate).');
  console.log('Demo accounts (sign in by choosing a role on /login):');
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.role.padEnd(15)} ${a.email}`);
  console.log('Published references:');
  for (const [k, v] of Object.entries(DEMO_REFS)) console.log(`  ${k.padEnd(12)} ${v}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
