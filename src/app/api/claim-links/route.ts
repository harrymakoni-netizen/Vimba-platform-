import { api, apiActor, body } from '@/lib/api';
import { confirmClaimLink } from '@/services/claims';

export async function POST(req: Request) {
  return api(async () => {
    const actor = await apiActor();
    const b = await body(req);
    return { id: await confirmClaimLink(actor, { claimId: b.claimId, outputId: b.outputId, passage: b.passage, sourceRecordId: b.sourceRecordId }) };
  }, { status: 201 });
}
