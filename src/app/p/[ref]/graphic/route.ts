import { getPassport } from '@/services/passports';
import { passportUrl, qrSvg, whatsappCheckUrl } from '@/lib/qr';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      if ((line + ' ' + word).trim().length > max) {
        if (line) lines.push(line);
        line = word;
      } else line = (line + ' ' + word).trim();
    }
    lines.push(line);
  }
  return lines;
}

const inner = (svg: string) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const viewBox = (svg: string) => svg.match(/viewBox="([^"]+)"/)?.[1] ?? '0 0 33 33';

/**
 * Printable share graphic. The QR carries the version reference (not the
 * signature), so the same printout always resolves to this registered
 * version and its latest status.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const p = await getPassport(ref);
  if (!p) return new Response('Not found', { status: 404 });
  const q1 = await qrSvg(passportUrl(p.ref));
  const wa = whatsappCheckUrl(p.ref);
  const q2 = wa ? await qrSvg(wa) : null;
  const title = wrap(p.version.title, 26).slice(0, 3);
  const body = wrap(p.version.body, 48).slice(0, 6);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080" font-family="Georgia, serif">
  <rect width="1080" height="1080" fill="#f6f8f7"/>
  <rect x="0" y="0" width="1080" height="18" fill="#0f5e52"/>
  <text x="72" y="120" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#0f5e52">${esc(p.publisher.name)}</text>
  ${title.map((l, i) => `<text x="72" y="${230 + i * 84}" font-size="74" fill="#1b2e31">${esc(l)}</text>`).join('\n  ')}
  ${body.map((l, i) => `<text x="72" y="${270 + title.length * 84 + i * 44}" font-size="32" fill="#3c4d4f">${esc(l)}</text>`).join('\n  ')}
  <line x1="72" y1="760" x2="1008" y2="760" stroke="#d6dfdc" stroke-width="2"/>
  <svg x="72" y="790" width="220" height="220" viewBox="${viewBox(q1)}">${inner(q1)}</svg>
  <text x="312" y="840" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#1b2e31">Scan to check this story</text>
  <text x="312" y="880" font-family="Arial, sans-serif" font-size="24" fill="#3c4d4f">Tarisa nyaya · Hlola indaba</text>
  <text x="312" y="930" font-family="monospace" font-size="30" fill="#0f5e52">${esc(p.ref)}</text>
  <text x="312" y="975" font-family="Arial, sans-serif" font-size="20" fill="#5b6b6d">Version ${p.version.number} · Vimba Story Passport</text>
  ${q2 ? `<svg x="828" y="790" width="180" height="180" viewBox="${viewBox(q2)}">${inner(q2)}</svg>
  <text x="918" y="1000" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#3c4d4f">WhatsApp</text>` : ''}
</svg>`;
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}
