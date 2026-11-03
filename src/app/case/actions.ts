'use server';

import { revalidatePath } from 'next/cache';
import { complainantAccepts, complainantReply } from '@/services/complaints';
import { currentCaseAccess } from '@/lib/session';

export async function replyAction(form: FormData) {
  const access = await currentCaseAccess();
  if (!access) return;
  await complainantReply(access, String(form.get('body') ?? ''));
  revalidatePath('/case');
}

export async function acceptAction(form: FormData) {
  const access = await currentCaseAccess();
  if (!access) return;
  await complainantAccepts(access, form.get('accepts') === 'yes');
  revalidatePath('/case');
}
