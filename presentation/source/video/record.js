// Records the Vimba demo journey on the live site, paced to the voice-over clips.
// Usage: node record.js <workdir>   (workdir holds vo/durations.json, vo/reader.wav)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const WORK = path.resolve(process.argv[2] || '.');
const BASE = 'https://vimba-platform.vercel.app';
const DUR = JSON.parse(fs.readFileSync(path.join(WORK, 'vo/durations.json'), 'utf8'));
const PHOTO = path.resolve(WORK, '../shots/graphic.png');
const LOGO = 'data:image/png;base64,' + fs.readFileSync(path.resolve(WORK, '../build/media/logo-light.png')).toString('base64');
const W = 1280, H = 720;

const OVERLAY = `(() => {
  const css = '#vc-cap{position:fixed;left:0;right:0;bottom:0;height:62px;background:rgba(20,33,31,.97);display:flex;align-items:center;gap:16px;padding:0 30px;z-index:2147483646;font:600 22px/1.25 Arial,Helvetica,sans-serif;color:#F4F2EC;box-shadow:0 -6px 18px rgba(0,0,0,.18)}'
    + '#vc-cap b{flex:none;width:36px;height:36px;border-radius:50%;background:#0F5E52;display:flex;align-items:center;justify-content:center;font-size:18px;color:#F4F2EC}'
    + '#vc-cur{position:fixed;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;background:rgba(15,94,82,.28);border:2px solid #0F5E52;z-index:2147483647;pointer-events:none;transition:transform .12s ease}'
    + '#vc-cur.down{transform:scale(.7);background:rgba(154,84,16,.45);border-color:#9A5410}';
  const mem = {};
  const sessionStorage = (() => { try { const s = window.sessionStorage; s.getItem('x'); return s; } catch (e) { return { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = v; } }; } })();
  function ensure() {
    if (!document.body || document.getElementById('vc-style')) return;
    const st = document.createElement('style'); st.id = 'vc-style'; st.textContent = css; document.head.appendChild(st);
    const cur = document.createElement('div'); cur.id = 'vc-cur'; document.body.appendChild(cur);
    const p = JSON.parse(sessionStorage.getItem('vc-pos') || '[640,360]'); cur.style.left = p[0] + 'px'; cur.style.top = p[1] + 'px';
    addEventListener('mousemove', (e) => { cur.style.left = e.clientX + 'px'; cur.style.top = e.clientY + 'px'; sessionStorage.setItem('vc-pos', JSON.stringify([e.clientX, e.clientY])); }, true);
    addEventListener('mousedown', () => cur.classList.add('down'), true);
    addEventListener('mouseup', () => setTimeout(() => cur.classList.remove('down'), 120), true);
    render();
  }
  function render() {
    const c = JSON.parse(sessionStorage.getItem('vc-cap') || 'null');
    let bar = document.getElementById('vc-cap');
    if (!c) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'vc-cap'; document.body.appendChild(bar); }
    bar.innerHTML = '<b>' + c[0] + '</b><span></span>'; bar.querySelector('span').textContent = c[1];
  }
  window.__vc = (n, text) => { sessionStorage.setItem('vc-cap', JSON.stringify(n ? [n, text] : null)); ensure(); render(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensure); else ensure();
})();`;

const card = (title, sub) => `<html><body style="margin:0;width:${W}px;height:${H}px;background:#14211F;display:flex;flex-direction:column;justify-content:center;padding:0 96px;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif">
<img src="${LOGO}" style="width:230px;height:auto;margin-bottom:44px" alt="Vimba">
<div style="font-family:Georgia,serif;font-size:54px;line-height:1.12;color:#F4F2EC;max-width:960px">${title}</div>
<div style="margin-top:26px;font-size:24px;line-height:1.4;color:#9FB8B2">${sub}</div></body></html>`;

(async () => {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await chromium.launch({
    proxy: proxy ? { server: proxy } : undefined,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${path.join(WORK, 'vo/reader.wav')}`, '--autoplay-policy=no-user-gesture-required'],
  });

  // 1. Start from a clean demo (not recorded).
  {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: 'en-GB' });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/lang?l=en&next=/login`, { waitUntil: 'networkidle', timeout: 90000 });
    const card = p.locator('form.role-card').filter({ has: p.locator('input[name=role][value=editor]') });
    await Promise.all([p.waitForURL((u) => !u.toString().includes('/login'), { timeout: 60000 }), card.locator('button[type=submit]').click()]);
    await p.goto(`${BASE}/app/stories`, { waitUntil: 'networkidle' });
    await p.locator('summary', { hasText: 'Reset demo' }).click();
    await Promise.all([p.waitForURL(/\/login/, { timeout: 90000 }), p.locator('button', { hasText: 'Yes, reset the demo' }).click()]);
    console.log('demo reset:', p.url());
    await ctx.close();
  }

  // 2. The recorded journey.
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: 'en-GB',
    recordVideo: { dir: path.join(WORK, 'raw'), size: { width: W, height: H } },
  });
  await ctx.grantPermissions(['microphone'], { origin: BASE });
  await ctx.addInitScript(OVERLAY);
  const page = await ctx.newPage();
  const t0 = Date.now();
  const log = { scenes: [], marks: {} };
  const wait = (ms) => page.waitForTimeout(ms);
  const cap = (n, text) => page.evaluate(([n, t]) => window.__vc && window.__vc(n, t), [n, text]);
  const go = async (url) => { await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 }); await page.evaluate(OVERLAY); };
  const moveTo = async (loc) => {
    await loc.scrollIntoViewIfNeeded();
    const b = await loc.boundingBox();
    if (b) await page.mouse.move(b.x + Math.min(b.width / 2, 120), b.y + b.height / 2, { steps: 16 });
    await wait(120);
  };
  const click = async (loc) => { await moveTo(loc); await loc.click(); };
  const scrollTo = async (y) => { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'smooth' }), y); await wait(800); };
  const intoView = async (loc) => { await loc.evaluate((el) => el.scrollIntoView({ behavior: 'smooth', block: 'center' })); await wait(800); };
  async function scene(id, vo, fn, pad = 450) {
    const start = Date.now();
    log.scenes.push({ id, vo, at: start - t0 });
    await fn();
    const left = (DUR[vo] || 0) * 1000 + pad - (Date.now() - start);
    if (left > 0) await wait(left);
  }

  // Title card
  await page.setContent(card('The whole journey, in the real system', 'vimba-platform.vercel.app · a demo newsroom and a fictional story'));
  await scene('title', 'vo0', async () => {}, 700);

  // 1. The passport
  await go(`${BASE}/lang?l=en&next=/p/VMB-5DSN6ZBGGZ`);
  await scene('passport', 'vo1', async () => {
    await cap(1, 'A reader scans the QR code: the story is Current, and signed');
    await wait(6300);
    await scrollTo(330);
    await wait(1000);
    await moveTo(page.locator('a', { hasText: 'Request a correction' }).first());
  });

  // 2. The private complaint
  await scene('complaint', 'vo2', async () => {
    await click(page.locator('a', { hasText: 'Request a correction' }).first());
    await page.waitForLoadState('networkidle');
    await cap(2, 'She challenges one sentence privately, with a voice note and a photo');
    await click(page.locator('#passage'));
    await page.locator('#passage').pressSequentially('Flooding has closed 12 schools', { delay: 20 });
    await click(page.locator('#concern'));
    await page.locator('#concern').pressSequentially('The district office says only 2 schools closed, not 12.', { delay: 15 });
    await click(page.locator('button', { hasText: 'Start recording' }));
    await wait(3600);
    await click(page.locator('button', { hasText: /^Stop$/ }));
    await wait(700);
    await intoView(page.locator('#photo'));
    await page.locator('#photo').setInputFiles(PHOTO);
    await wait(1200);
    const submit = page.locator('button[type=submit]', { hasText: 'Send correction request' });
    await click(submit);
    await page.locator('dd.mono').first().waitFor({ timeout: 60000 });
    log.marks.caseRef = (await page.locator('dd.mono').first().innerText()).trim();
    await scrollTo(0);
    await wait(900);
  }, 300);

  // 3. The editor opens the case
  await go(`${BASE}/login`);
  await cap(3, 'The editor opens the case: the sentence, the voice note, the photo');
  await scene('case', 'vo3', async () => {
    const s0 = Date.now();
    const editor = page.locator('form.role-card').filter({ has: page.locator('input[name=role][value=editor]') });
    await moveTo(editor.locator('button[type=submit]'));
    await Promise.all([page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 60000 }), editor.locator('button[type=submit]').click()]);
    await go(`${BASE}/app/complaints`);
    const link = log.marks.caseRef ? page.locator('a', { hasText: log.marks.caseRef }).first() : page.locator('a[href^="/app/complaints/"]').first();
    await click((await link.count()) ? link : page.locator('a[href^="/app/complaints/"]').first());
    await page.waitForLoadState('networkidle');
    await page.evaluate(OVERLAY);
    await wait(900);
    const audio = page.locator('audio').first();
    await intoView(audio);
    await moveTo(audio);
    const remain = DUR.vo3 * 1000 + 350 - (Date.now() - s0);   // let the narrator finish first
    if (remain > 0) await wait(remain);
    log.marks.voiceNote = Date.now() - t0;
    await audio.evaluate((a) => { a.muted = true; return a.play().catch(() => {}); });
    await wait(4900);
    const img = page.locator('img[src*="/photos/"]').first();
    if (await img.count()) await intoView(img); else await scrollTo(900);
    await wait(1400);
  }, 300);

  // 4. One correction, written for every copy
  await scene('correction', 'vo4', async () => {
    await click(page.locator('a[href*="/app/corrections/new"][href*="claim="]').first());
    await page.waitForLoadState('networkidle');
    await page.evaluate(OVERLAY);
    await cap(4, 'One correction, written for every copy, in every language');
    await click(page.locator('#reason'));
    await page.locator('#reason').pressSequentially('The district education office confirmed 2 schools closed, not 12.', { delay: 12 });
    const notes = { English: 'Corrected: 2 schools, not 12.', chiShona: 'Kugadziriswa: zvikoro 2, kwete 12.', isiNdebele: 'Kulungisiwe: izikolo ezi-2, hatshi ezingu-12.' };
    const sets = page.locator('form fieldset');
    const n = await sets.count();
    for (let i = 0; i < n; i++) {
      const fs_ = sets.nth(i);
      if (!(await fs_.locator('input[type=checkbox][name=outputId]').isChecked())) continue;
      const lang = (await fs_.locator('legend .pill').first().innerText()).trim();
      const fix = (s) => s.replace(/ezingu-12/g, 'ezi-2').replace(/\b12\b/g, '2');
      const title = fs_.locator('input[name^="title:"]');
      const body = fs_.locator('textarea[name^="body:"]');
      const note = fs_.locator('input[name^="note:"]');
      await intoView(title);
      await title.fill(fix(await title.inputValue()));
      await body.fill(fix(await body.inputValue()));
      await click(note);
      await note.pressSequentially(notes[lang] || notes.English, { delay: 10 });
      await wait(250);
    }
    await click(page.locator('button[type=submit]', { hasText: 'Review correction' }));
    await page.waitForLoadState('networkidle');
  }, 200);

  // 5. One approval
  await page.evaluate(OVERLAY);
  await cap(5, 'One approval signs a new version of every copy');
  await scene('approve', 'vo5', async () => {
    await wait(700);
    await scrollTo(520);
    await wait(900);
    await scrollTo(1100);
    await wait(700);
    const approve = page.locator('button[type=submit]', { hasText: 'Approve and release correction' });
    await click(approve);
    await page.waitForLoadState('networkidle');
    await page.evaluate(OVERLAY);
    await scrollTo(0);
    await wait(1400);
  }, 300);

  // 6. The same code now says Superseded, in every language
  await go(`${BASE}/lang?l=en&next=/p/VMB-5DSN6ZBGGZ`);
  await cap(6, 'The same printed code now says Superseded, and explains what changed');
  await scene('rescan', 'vo6a', async () => { await wait(3800); await scrollTo(260); }, 500);
  await go(`${BASE}/lang?l=nd&next=/p/VMB-WWYFCTP00H`);
  await cap(6, 'In every language: the isiNdebele passport says Isithathelwe indawo');
  await scene('rescan-nd', 'vo6b', async () => { await wait(2700); await scrollTo(200); }, 600);

  // 7. WhatsApp
  await go(`${BASE}/lang?l=en&next=/app/simulator`);
  await cap(7, 'On WhatsApp, the answer is corrected too');
  await scene('whatsapp', 'vo7', async () => {
    const reset = page.locator('button', { hasText: 'Start a new chat' });
    if (await reset.count()) { await reset.first().click(); await page.waitForLoadState('networkidle'); await page.evaluate(OVERLAY); }
    await click(page.locator('#text'));
    await page.locator('#text').pressSequentially('HLOLA VMB-WWYFCTP00H', { delay: 30 });
    await click(page.locator('button[type=submit]', { hasText: /^Send$/ }));
    await page.waitForLoadState('networkidle');
    await page.evaluate(OVERLAY);
    await wait(600);
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }));
    await wait(900);
  }, 700);

  // 8. The partner newsroom
  await go(`${BASE}/login`);
  await cap(8, 'The partner newsroom is notified, and publishes its own fix');
  await scene('partner', 'vo8', async () => {
    const partner = page.locator('form.role-card').filter({ has: page.locator('input[name=role][value=partner_editor]') });
    await moveTo(partner.locator('button[type=submit]'));
    await Promise.all([page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 60000 }), partner.locator('button[type=submit]').click()]);
    await go(`${BASE}/app/relay`);
    await wait(1200);
    await scrollTo(220);
  }, 600);

  // End card
  await page.setContent(card('Accountability that travels with the story.', 'Try it: vimba-platform.vercel.app · WhatsApp +1 202 443 4476'));
  await scene('end', 'vo9', async () => {}, 1400);

  log.total = Date.now() - t0;
  const video = page.video();
  await ctx.close();
  log.video = await video.path();
  fs.writeFileSync(path.join(WORK, 'timings.json'), JSON.stringify(log, null, 1));
  console.log(JSON.stringify(log, null, 1));

  // 3. Leave the demo clean for the pitch (not recorded).
  {
    const c2 = await browser.newContext({ viewport: { width: W, height: H }, locale: 'en-GB' });
    const p = await c2.newPage();
    await p.goto(`${BASE}/lang?l=en&next=/login`, { waitUntil: 'networkidle', timeout: 90000 });
    const card = p.locator('form.role-card').filter({ has: p.locator('input[name=role][value=editor]') });
    await Promise.all([p.waitForURL((u) => !u.toString().includes('/login'), { timeout: 60000 }), card.locator('button[type=submit]').click()]);
    await p.goto(`${BASE}/app/stories`, { waitUntil: 'networkidle' });
    await p.locator('summary', { hasText: 'Reset demo' }).click();
    await Promise.all([p.waitForURL(/\/login/, { timeout: 90000 }), p.locator('button', { hasText: 'Yes, reset the demo' }).click()]);
    await p.goto(`${BASE}/p/VMB-5DSN6ZBGGZ`, { waitUntil: 'networkidle' });
    console.log('demo reset after recording; passport says Current:', (await p.locator('body').innerText()).includes('Current'));
    await c2.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
