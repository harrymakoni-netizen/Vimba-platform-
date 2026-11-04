'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AppError } from '@/lib/errors';
import { ORG_COOKIE, requireActor } from '@/lib/session';
import { createOutput, createStory, publishOutput, saveDraft } from '@/services/publication';
import { addClaim, addSource, confirmClaimLink } from '@/services/claims';
import { approveCorrection, proposeCorrection, updateReplacement, type ReplacementInput } from '@/services/corrections';
import { deskAction, type DeskAction } from '@/services/complaints';
import { respondToRelay } from '@/services/relay';
import { retryJob } from '@/services/outbox';
import { runWorkerOnce } from '@/services/worker';
import { simulateInbound } from '@/channels/whatsapp/handler';
import { seedDemo } from '@/services/demo';
import { env } from '@/lib/env';
import { authorize } from '@/services/actor';

const s = (f: FormData, k: string) => String(f.get(k) ?? '');

/** Run a service call; on a safe AppError go back with its message, never internal details. */
async function run(back: string, fn: () => Promise<string | void>) {
  let to: string | void;
  try {
    to = await fn();
  } catch (err) {
    const known =
      err instanceof AppError
        ? err.message
        : (err as { code?: string })?.code === '23505'
          ? 'That label is already used in this story.'
          : null;
    if (known) redirect(`${back}${back.includes('?') ? '&' : '?'}error=${encodeURIComponent(known)}`);
    throw err;
  }
  revalidatePath('/app', 'layout');
  redirect(to || back);
}

export async function switchOrgAction(f: FormData) {
  (await cookies()).set(ORG_COOKIE, s(f, 'orgId'), { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect('/app/stories');
}

export async function createStoryAction(f: FormData) {
  const actor = await requireActor();
  await run('/app/stories', async () => `/app/stories/${await createStory(actor, { title: s(f, 'title') })}`);
}

export async function createOutputAction(f: FormData) {
  const actor = await requireActor();
  const storyId = s(f, 'storyId');
  await run(`/app/stories/${storyId}`, async () => {
    await createOutput(actor, {
      storyId,
      kind: s(f, 'kind'),
      language: s(f, 'language'),
      title: s(f, 'title'),
      body: s(f, 'body'),
      sourceOutputRef: s(f, 'sourceRef') || undefined,
    });
  });
}

export async function saveDraftAction(f: FormData) {
  const actor = await requireActor();
  const back = `/app/stories/${s(f, 'storyId')}`;
  await run(back, async () => {
    await saveDraft(actor, s(f, 'outputId'), { title: s(f, 'title'), body: s(f, 'body'), expectedRevision: Number(s(f, 'revision')) });
    if (s(f, 'intent') === 'publish') {
      await publishOutput(actor, s(f, 'outputId'), {
        expectedBaseVersionId: s(f, 'baseVersionId') || null,
        changeNote: s(f, 'changeNote'),
      });
    }
  });
}

export async function addSourceAction(f: FormData) {
  const actor = await requireActor();
  const storyId = s(f, 'storyId');
  await run(`/app/stories/${storyId}`, async () => {
    await addSource(actor, { storyId, label: s(f, 'label'), description: s(f, 'description'), evidencePointer: s(f, 'pointer') });
  });
}

export async function addClaimAction(f: FormData) {
  const actor = await requireActor();
  const storyId = s(f, 'storyId');
  await run(`/app/stories/${storyId}`, async () => {
    await addClaim(actor, { storyId, label: s(f, 'label'), text: s(f, 'text') });
  });
}

export async function confirmLinkAction(f: FormData) {
  const actor = await requireActor();
  await run(`/app/stories/${s(f, 'storyId')}`, async () => {
    await confirmClaimLink(actor, {
      claimId: s(f, 'claimId'),
      outputId: s(f, 'outputId'),
      passage: s(f, 'passage'),
      sourceRecordId: s(f, 'sourceId') || undefined,
    });
  });
}

export async function proposeCorrectionAction(f: FormData) {
  const actor = await requireActor();
  const selected = f.getAll('outputId').map(String);
  const replacements: ReplacementInput[] = selected.map((id) => ({
    outputId: id,
    title: s(f, `title:${id}`),
    body: s(f, `body:${id}`),
    changeNote: s(f, `note:${id}`),
  }));
  const back = `/app/corrections/new?story=${s(f, 'storyId')}${s(f, 'claimId') ? `&claim=${s(f, 'claimId')}` : ''}${s(f, 'complaintId') ? `&complaint=${s(f, 'complaintId')}` : ''}`;
  await run(back, async () => {
    const id = await proposeCorrection(actor, {
      storyId: s(f, 'storyId'),
      reason: s(f, 'reason'),
      claimId: s(f, 'claimId') || null,
      complaintId: s(f, 'complaintId') || null,
      replacements,
    });
    return `/app/corrections/${id}`;
  });
}

export async function updateReplacementAction(f: FormData) {
  const actor = await requireActor();
  const id = s(f, 'correctionId');
  await run(`/app/corrections/${id}`, async () => {
    await updateReplacement(actor, id, { outputId: s(f, 'outputId'), title: s(f, 'title'), body: s(f, 'body'), changeNote: s(f, 'note') });
  });
}

export async function approveCorrectionAction(f: FormData) {
  const actor = await requireActor();
  const id = s(f, 'correctionId');
  await run(`/app/corrections/${id}`, async () => {
    await approveCorrection(actor, id);
    // Deliver partner notices promptly; failures stay queued for retry.
    await runWorkerOnce().catch(() => undefined);
    return `/app/corrections/${id}?approved=1`;
  });
}

export async function deskAction_(f: FormData) {
  const actor = await requireActor();
  const id = s(f, 'complaintId');
  const action = s(f, 'action') as DeskAction['action'];
  const a = (action === 'assign' ? { action, editorId: s(f, 'editorId') } : { action, body: s(f, 'body') }) as DeskAction;
  await run(`/app/complaints/${id}`, async () => {
    await deskAction(actor, id, a);
    await runWorkerOnce().catch(() => undefined);
  });
}

export async function relayAction(f: FormData) {
  const actor = await requireActor();
  const id = s(f, 'relayId');
  const action = s(f, 'action');
  await run('/app/relay', async () => {
    if (action === 'acknowledge') await respondToRelay(actor, id, { action: 'acknowledge' });
    else if (action === 'decline') await respondToRelay(actor, id, { action: 'decline', note: s(f, 'note') });
    else
      await respondToRelay(actor, id, {
        action: 'complete',
        title: s(f, 'title'),
        body: s(f, 'body'),
        changeNote: s(f, 'changeNote'),
        expectedBaseVersionId: s(f, 'baseVersionId') || null,
      });
  });
}

export async function simulatorAction(f: FormData) {
  await requireActor();
  const jar = await cookies();
  let sim = jar.get('vimba_sim')?.value;
  if (!sim || f.get('reset')) {
    sim = Math.random().toString(36).slice(2, 10);
    jar.set('vimba_sim', sim, { httpOnly: true, sameSite: 'lax', path: '/app' });
  }
  if (!f.get('reset')) {
    await simulateInbound(sim, { text: s(f, 'text') || undefined, choiceId: s(f, 'choiceId') || undefined });
    await runWorkerOnce().catch(() => undefined);
  }
  revalidatePath('/app/simulator');
  redirect('/app/simulator');
}

export async function workerAction(f: FormData) {
  await requireActor();
  if (f.get('retry')) await retryJob(s(f, 'retry'));
  await runWorkerOnce();
  revalidatePath('/app/channel');
  redirect('/app/channel');
}

/** Demo mode: put the fictional newsrooms back to their starting state. Editors only. */
export async function resetDemoAction() {
  const actor = await requireActor();
  if (!env.demoMode()) redirect('/app/stories');
  authorize(actor, 'correction.approve');
  await seedDemo({ reset: true });
  redirect('/login?reset=1');
}
