import { api } from '@/lib/api';
import { listPublicKeys } from '@/services/passports';

export async function GET() {
  return api(async () => ({ keys: await listPublicKeys() }), { headers: { 'Access-Control-Allow-Origin': '*' } });
}
