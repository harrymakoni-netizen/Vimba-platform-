'use server';

import { headers } from 'next/headers';
import { submitComplaint } from '@/services/complaints';
import { AppError } from '@/lib/errors';
import { allow, clientKey } from '@/lib/ratelimit';
import { getLocale } from '@/lib/i18n/server';

export type ComplaintState =
  | { status: 'idle' }
  | { status: 'error'; error: 'passage' | 'form' | 'rate' | 'server' }
  | { status: 'done'; caseRef: string; trackingUrl: string };

export async function submitComplaintAction(_prev: ComplaintState, form: FormData): Promise<ComplaintState> {
  const h = await headers();
  if (!allow(`complaint:${clientKey(h)}`, 5, 3600e3)) return { status: 'error', error: 'rate' };
  try {
    const r = await submitComplaint({
      ref: String(form.get('ref') ?? ''),
      passage: String(form.get('passage') ?? ''),
      concern: String(form.get('concern') ?? ''),
      evidenceUrl: String(form.get('evidence') ?? ''),
      channel: 'web',
      locale: await getLocale(),
    });
    return { status: 'done', caseRef: r.caseRef, trackingUrl: r.trackingUrl };
  } catch (err) {
    if (err instanceof AppError && err.message === 'passage_not_found') return { status: 'error', error: 'passage' };
    if (err instanceof AppError) return { status: 'error', error: 'form' };
    console.error(JSON.stringify({ level: 'error', where: 'complaint.web', code: (err as { code?: string }).code ?? 'internal' }));
    return { status: 'error', error: 'server' };
  }
}
