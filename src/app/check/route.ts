import { NextResponse, type NextRequest } from 'next/server';
import { normaliseRef } from '@/lib/crypto';

export function GET(req: NextRequest) {
  const ref = normaliseRef(req.nextUrl.searchParams.get('ref') ?? '');
  return NextResponse.redirect(new URL(ref ? `/p/${ref}` : '/?invalid=1', req.nextUrl.origin), 303);
}
