import { api, apiActor } from '@/lib/api';
import { approveCorrection } from '@/services/corrections';

/** Editor approval. Idempotent: repeating returns the original result. Stale or cross-tenant writes are rejected. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api(async () => approveCorrection(await apiActor(), id));
}
