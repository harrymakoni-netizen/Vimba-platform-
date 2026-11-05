import { NextResponse, type NextRequest } from 'next/server';
import { normaliseRef } from '@/lib/crypto';

/** One box for both: a Vimba reference opens its passport; anything else is searched as words. */
export function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get('ref') ?? '').trim();
  const ref = normaliseRef(raw);
  if (ref) return NextResponse.redirect(new URL(`/p/${ref}`, req.nextUrl.origin), 303);
  if (raw.length >= 3) {
    return NextResponse.redirect(new URL(`/search?q=${encodeURIComponent(raw.slice(0, 200))}`, req.nextUrl.origin), 303);
  }
  return NextResponse.redirect(new URL('/?invalid=1', req.nextUrl.origin), 303);
}
