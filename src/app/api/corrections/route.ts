import { api, apiActor, body } from '@/lib/api';
import { proposeCorrection } from '@/services/corrections';

export async function POST(req: Request) {
  return api(async () => {
    const actor = await apiActor();
    const b = await body(req);
    const id = await proposeCorrection(actor, {
      storyId: b.storyId,
      reason: b.reason,
      claimId: b.claimId,
      complaintId: b.complaintId,
      replacements: Array.isArray(b.replacements) ? b.replacements : [],
    });
    return { id };
  }, { status: 201 });
}
