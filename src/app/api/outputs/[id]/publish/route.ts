import { api, apiActor, body } from '@/lib/api';
import { publishOutput } from '@/services/publication';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return api(async () => {
    const actor = await apiActor();
    const b = await body(req);
    const r = await publishOutput(actor, id, { expectedBaseVersionId: b.expectedBaseVersionId ?? null, changeNote: b.changeNote });
    return { versionId: r.versionId, publicRef: r.publicRef, receipt: r.receipt, signature: r.signature };
  }, { status: 201 });
}
