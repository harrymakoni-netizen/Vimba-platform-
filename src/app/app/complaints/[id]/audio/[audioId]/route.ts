import { currentActor } from '@/lib/session';
import { getComplaintAudio } from '@/services/complaints';
import { AppError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A reader's voice recording. Newsroom members of the owning organisation only. Supports Range requests (Safari needs them). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; audioId: string }> }) {
  const { id, audioId } = await params;
  const session = await currentActor();
  if (!session || !UUID.test(id) || !UUID.test(audioId)) return new Response('Not found', { status: 404 });
  try {
    const a = await getComplaintAudio(session.actor, id, audioId);
    if (!a) return new Response('Not found', { status: 404 });
    const bytes = new Uint8Array(a.bytes as Buffer);
    const headers: Record<string, string> = {
      'Content-Type': a.mime,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    };
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get('range') ?? '');
    if (m && (m[1] || m[2])) {
      const start = m[1] ? Number(m[1]) : Math.max(0, bytes.length - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), bytes.length - 1) : bytes.length - 1;
      if (start > end || start >= bytes.length) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${bytes.length}` } });
      return new Response(bytes.slice(start, end + 1), {
        status: 206,
        headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${bytes.length}`, 'Content-Length': String(end - start + 1) },
      });
    }
    return new Response(bytes, { headers: { ...headers, 'Content-Length': String(bytes.length) } });
  } catch (e) {
    if (e instanceof AppError) return new Response('Not found', { status: 404 });
    throw e;
  }
}
