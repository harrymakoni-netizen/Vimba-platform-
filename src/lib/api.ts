import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { AppError, logError } from './errors';
import { currentActor } from './session';
import type { Actor } from '@/services/actor';

/** Consistent JSON responses with a request ID and safe error codes. */
export async function api<T>(fn: (requestId: string) => Promise<T>, init?: { status?: number; headers?: Record<string, string> }) {
  const requestId = crypto.randomUUID();
  try {
    const data = await fn(requestId);
    return NextResponse.json(data, { status: init?.status ?? 200, headers: { 'X-Request-Id': requestId, ...init?.headers } });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: { code: err.code, message: err.message, requestId } }, { status: err.status, headers: { 'X-Request-Id': requestId } });
    }
    logError(requestId, err);
    return NextResponse.json({ error: { code: 'internal', message: 'Something went wrong', requestId } }, { status: 500, headers: { 'X-Request-Id': requestId } });
  }
}

export async function apiActor(): Promise<Actor> {
  const s = await currentActor();
  if (!s) throw new AppError('unauthenticated', 'Sign in required');
  return s.actor;
}

export async function body(req: Request): Promise<Record<string, any>> {
  try {
    const j = await req.json();
    return j && typeof j === 'object' ? j : {};
  } catch {
    throw new AppError('validation', 'Request body must be JSON');
  }
}
