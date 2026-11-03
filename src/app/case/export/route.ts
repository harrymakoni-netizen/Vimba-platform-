import { exportCase } from '@/services/complaints';
import { currentCaseAccess } from '@/lib/session';

export async function GET() {
  const access = await currentCaseAccess();
  if (!access) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const data = await exportCase(access);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="vimba-${data.case_ref}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
