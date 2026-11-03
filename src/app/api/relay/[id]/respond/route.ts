import { api, apiActor, body } from '@/lib/api';
import { respondToRelay, type RelayResponse } from '@/services/relay';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api(async () => respondToRelay(await apiActor(), id, (await body(req)) as RelayResponse));
}
