import { api } from '@/lib/api';
import { notFound } from '@/lib/errors';
import { getPassport } from '@/services/passports';

/** Public allowlisted snapshot, signed receipt, current status, successor reference and checked_at. */
export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return api(async () => {
    const p = await getPassport(ref);
    if (!p) throw notFound();
    return p;
  }, { headers: { 'Cache-Control': 'no-cache', 'Access-Control-Allow-Origin': '*' } });
}
