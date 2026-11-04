import { currentActor } from '@/lib/session';
import { getComplaintPhoto } from '@/services/complaints';
import { AppError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reader-supplied photo for a complaint. Newsroom members of the owning organisation only. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const session = await currentActor();
  if (!session) return new Response('Not found', { status: 404 });
  if (!UUID.test(id) || !UUID.test(photoId)) return new Response('Not found', { status: 404 });
  try {
    const p = await getComplaintPhoto(session.actor, id, photoId);
    if (!p) return new Response('Not found', { status: 404 });
    return new Response(new Uint8Array(p.bytes as Buffer), {
      headers: {
        'Content-Type': p.mime,
        'Cache-Control': 'private, no-store',
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
      },
    });
  } catch (e) {
    if (e instanceof AppError) return new Response('Not found', { status: 404 });
    throw e;
  }
}
