import { loadEnv } from './load-env';

loadEnv();

async function main() {
  const { runWorkerOnce } = await import('../src/services/worker');
  const once = process.argv.includes('--once');
  console.log(`vimba outbox worker started${once ? ' (single pass)' : ''}`);
  do {
    const results = await runWorkerOnce();
    if (results.length) console.log(JSON.stringify({ processed: results.length, ok: results.filter((r) => r.ok).length }));
    if (!once) await new Promise((r) => setTimeout(r, 3000));
  } while (!once);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
