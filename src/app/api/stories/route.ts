import { api, apiActor, body } from '@/lib/api';
import { createOutput, createStory } from '@/services/publication';

/** Create a private story and optional initial output drafts (reporter or editor in the owning newsroom). */
export async function POST(req: Request) {
  return api(async () => {
    const actor = await apiActor();
    const b = await body(req);
    const storyId = await createStory(actor, { title: String(b.title ?? '') });
    const outputIds: string[] = [];
    for (const o of Array.isArray(b.outputs) ? b.outputs : []) {
      outputIds.push(await createOutput(actor, { storyId, kind: o.kind, language: o.language, title: o.title, body: o.body ?? '', sourceOutputRef: o.sourceOutputRef }));
    }
    return { storyId, outputIds };
  }, { status: 201 });
}
