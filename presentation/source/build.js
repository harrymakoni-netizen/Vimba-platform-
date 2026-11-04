// Vimba pitch, final 4-minute deck. Rebuilds the design of Vimba_Pitch_4-minute_final.pptx
// exactly (colours, Georgia/Arial type scale, positions, frames, cards, tables, QR cards)
// and adds: The Herald example, the VMCZ numbers, the "newsroom registers a story" step,
// and the live demo as the last slide.
// QA=1 builds without shrink-on-overflow so overflow is visible in the preview render.
// Rebuild: npm install pptxgenjs@3.12.0 && node build.js && python3 postprocess.py Vimba_Pitch_Final.pptx
const path = require('path');
const pptxgen = require('pptxgenjs');
// Optional: writes THEME's colours and fonts into the deck's theme part. Set APPLY_THEME to the
// path of an apply_theme.js helper; without it the deck is identical except for theme metadata.
let applyTheme = null;
try { if (process.env.APPLY_THEME) ({ applyTheme } = require(process.env.APPLY_THEME)); } catch (e) { console.warn('theme helper not loaded:', e.message); }

const QA = process.env.QA === '1';
const OUT = process.env.OUT || 'Vimba_Pitch_Final.pptx';
const FIT = QA ? undefined : 'shrink';
const M = (f) => path.join(__dirname, 'media', f);

const C = {
  ink: '14211F', paper: 'F7F6F1', green: '0F5E52', greenDeep: '0B4A40', amber: '9A5410',
  body: '45514E', muted: '5E6764',
  onDarkTitle: 'F4F2EC', onDarkBody: 'BFD3CE', onDarkMuted: '9FB8B2', mint: '9FD3C4',
  onGreenLabel: 'CFE9E1', onGreenBody: 'DCEFE9', onGreenTitle: 'F7F6F1',
  qrCard: 'FBFAF6', frame: 'D6DFDC', frameAmber: 'E3C9A8',
  waBg: 'ECE5DD', waBubble: 'D3EEDD', white: 'FFFFFF', waRule: 'E1E6E3',
  callout: 'E4EEEA', cardBorder: 'DCD8CC', tHead: 'E5E4DF', tLine: 'C5C4C0', tLineDark: 'B7B6B2',
  barMuted: 'B7B6B2',
};

const THEME = {
  name: 'Vimba',
  headFontFace: 'Georgia',
  bodyFontFace: 'Arial',
  colors: {
    dk1: '14211F', lt1: 'F7F6F1', dk2: '4D5654', lt2: 'E0E1DC',
    accent1: '0F5E52', accent2: '9FD3C4', accent3: '0B4A40', accent4: '9A5410', accent5: '45514E', accent6: '5E6764',
    hlink: '0563C1', folHlink: '954F72',
  },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5, same as the original
pres.title = 'Vimba Pitch: final';
pres.subject = 'ZMC-NUST Media Innovation Hackathon 2026, Track 7';
pres.author = 'Vimba Labs';
pres.company = 'Vimba Labs';
pres.theme = { headFontFace: 'Georgia', bodyFontFace: 'Arial' };

pres.defineSlideMaster({
  title: 'Title and body',
  background: { color: C.paper },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.889, y: 1.229, w: 11.556, h: 0.549, fontFace: 'Georgia', fontSize: 36, color: C.ink, margin: 0, valign: 'top' }, text: '' } },
  ],
});

// ---------- helpers ----------
function txt(slide, t, o) {
  const size = o.size || 14;
  const opt = {
    x: o.x, y: o.y, w: o.w, h: o.h,
    fontFace: o.font || 'Arial', fontSize: size, color: o.color || C.body, bold: !!o.bold,
    margin: 0, valign: o.valign || 'top', align: o.align || 'left',
    lineSpacing: o.lsp || Math.round(size * 1.4 * 10) / 10,
    objectName: o.name || 'Text',
  };
  if (o.charSpacing) opt.charSpacing = o.charSpacing;
  if (FIT) opt.fit = FIT;
  // Titles are explicit text boxes named "Title"; postprocess.py marks them as the slide's title
  // placeholder (as the original deck does), so they keep their own position, size and colour.
  if (o.placeholder === 'title') opt.objectName = 'Title'; else opt.isTextBox = true;
  if (o.wrap === false) opt.wrap = false;
  if (o.shape) { opt.shape = o.shape; opt.fill = { color: o.fill }; if (o.rectRadius) opt.rectRadius = o.rectRadius; }
  slide.addText(t, opt);
}
// bold lead + regular rest, as used in every caption of the original
const lead = (b, rest, cb = C.ink, cr = C.body) => [
  { text: b, options: { bold: true, color: cb } },
  { text: rest, options: { color: cr } },
];

function kicker(slide, label, color) {
  txt(slide, label, { x: 0.889, y: 0.889, w: 11.902, h: 0.257, size: 12, bold: true, color, charSpacing: 1.5, lsp: 16.8, name: 'Section label' });
}
function title(slide, t) {
  txt(slide, t, { x: 0.889, y: 1.229, w: 11.902, h: 0.576, font: 'Georgia', size: 36, color: C.ink, lsp: 39.6, placeholder: 'title', name: 'Title' });
}
function footer(slide, t, { dark = false, logo = true, w = 8.583 } = {}) {
  txt(slide, t, { x: 0.889, y: 6.826, w, h: 0.257, size: 12, color: dark ? C.onDarkMuted : C.muted, lsp: 16.8, name: 'Footer' });
  if (logo) slide.addImage({ path: M('logo-dark.png'), x: 11.333, y: 6.861, w: 1.111, h: 0.2219, altText: 'Vimba', objectName: 'Vimba logo' });
}
function rrect(slide, o) {
  const opt = { x: o.x, y: o.y, w: o.w, h: o.h, rectRadius: o.r, objectName: o.name || 'Shape' };
  if (o.fill) opt.fill = { color: o.fill };
  if (o.line) opt.line = { color: o.line, width: o.lineW || 1 }; else opt.line = { type: 'none' };
  if (o.shadow) opt.shadow = o.shadow;
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, opt);
}
function rule(slide, x, y, w, color, width) {
  slide.addShape(pres.shapes.LINE, { x, y, w, h: 0, line: { color, width }, objectName: 'Rule' });
}
function vrule(slide, x, y, h, color, width) {
  slide.addShape(pres.shapes.LINE, { x, y, w: 0, h, line: { color, width }, objectName: 'Rule' });
}
// Screenshot: rounded picture with a 1 pt frame drawn on top (exactly how the original does it).
// The "ROUND:r:" prefix is turned into real rounded corners in post-processing.
function screen(slide, file, fx, fy, fw, fh, alt, frameColor = C.frame, rFrame = 0.16) {
  const ix = fx + 0.007, iy = fy + 0.007, iw = fw - 0.014, ih = fh - 0.014;
  slide.addImage({ path: M(file), x: ix, y: iy, w: iw, h: ih, sizing: { type: 'cover', w: iw, h: ih }, altText: alt, objectName: `ROUND:${(rFrame - 0.007).toFixed(3)}:Screenshot` });
  rrect(slide, { x: fx, y: fy, w: fw, h: fh, r: rFrame, line: frameColor, lineW: 1, name: 'Screenshot frame' });
}
function logoLight(slide) {
  slide.addImage({ path: M('logo-light.png'), x: 0.889, y: 0.722, w: 2.292, h: 0.458, altText: 'Vimba', objectName: 'Vimba logo' });
}
function qrCard(slide, file, x, y, w, h, qr, label, alt) {
  rrect(slide, { x, y, w, h, r: 0.139, fill: C.qrCard, name: 'QR card' });
  slide.addImage({ path: M(file), x: x + (w - qr) / 2, y: y + 0.2, w: qr, h: qr, altText: alt, objectName: 'QR code' });
  txt(slide, label, { x: x + 0.05, y: y + 0.2 + qr + 0.11, w: w - 0.1, h: 0.5, size: label.length > 22 ? 13 : 12, bold: true, color: C.ink, align: 'center', lsp: label.length > 22 ? 16.9 : 15.6, name: 'QR label' });
}
// WhatsApp conversation panel (bubble + reply card), as on the original reader and re-scan slides
function waPanel(slide, px, pw, lines, caption, captionW) {
  rrect(slide, { x: px, y: 2.056, w: pw, h: 3.889, r: 0.167, fill: C.waBg, name: 'WhatsApp panel' });
  txt(slide, 'HLOLA VMB-WWYFCTP00H', { x: 9.833, y: 2.25, w: 2.417, h: 0.389, size: 12, color: C.ink, align: 'center', valign: 'middle', lsp: 16.2, shape: pres.shapes.ROUNDED_RECTANGLE, fill: C.waBubble, rectRadius: 0.111, wrap: false, name: 'Reader message' });
  rrect(slide, { x: px + 0.194, y: 2.75, w: pw - 0.389, h: 1.75, r: 0.111, fill: C.white, name: 'Vimba reply' });
  const runs = [];
  lines.forEach((l, i) => runs.push({ text: l.t, options: { bold: !!l.b, color: l.c || C.ink, breakLine: i < lines.length - 1 } }));
  txt(slide, runs, { x: px + 0.333, y: 2.875, w: pw - 0.5, h: 1.139, size: 12, color: C.ink, lsp: 16.2, name: 'Vimba reply text' });
  rule(slide, px + 0.333, 4.059, pw - 0.667, C.waRule, 0.5);
  txt(slide, 'Vula iphasiphothi', { x: px + 0.194, y: 4.146, w: pw - 0.389, h: 0.243, size: 12, bold: true, color: C.green, align: 'center', lsp: 16.2, name: 'Reply button' });
  txt(slide, caption, { x: px, y: 6.042, w: captionW, h: 0.243, size: 12, lsp: 15.6, name: 'Caption' });
}

// ---------- slides ----------

// 1. COVER
pres.addSection({ title: 'Opening' });
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Opening' });
  s.background = { color: C.ink };
  logoLight(s);
  txt(s, 'When a story is corrected, every copy should know.', { x: 0.889, y: 1.93, w: 8.15, h: 2.47, font: 'Georgia', size: 56, color: C.onDarkTitle, lsp: 58.8, placeholder: 'title', name: 'Title' });
  txt(s, 'Vimba is a public record for news in Zimbabwe. A newsroom registers each story once; a QR code then tells readers whether it was corrected, and one approval fixes every copy, in every language.', { x: 0.889, y: 4.61, w: 7.6, h: 1.3, size: 16, color: C.onDarkBody, lsp: 23.2, name: 'Subtitle' });
  qrCard(s, 'qr-passport-cover.png', 9.667, 2.083, 2.778, 3.042, 1.944, 'Scan now: a live Story Passport', 'QR code opening a live Vimba Story Passport');
  footer(s, 'Harry James Makoni & Fabulous Lashidi · Vimba Labs · Track 7: Digital Media Trust & RegTech · ZMC-NUST Media Innovation Hackathon 2026', { dark: true, logo: false, w: 11.9 });
  s.addNotes(
    '(0:00–0:20 · 20 seconds)\n' +
    'Good day, ladies and gentlemen. My name is Harry James Makoni, and this is my partner, Fabulous Lashidi. ' +
    'Here is our idea in one line: when a news story is corrected, every copy of it should know. ' +
    'Please scan the code on screen. It opens a live Story Passport for a story in our system. Keep it open: by the end of our pitch, it will have changed.'
  );
}

// 2. THE PROBLEM (The Herald example)
pres.addSection({ title: 'Problem' });
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Problem' });
  kicker(s, 'THE PROBLEM', C.green);
  title(s, 'One correction. Five copies. Four still wrong.');
  txt(s, [
    { text: 'Say The Herald reports that floods closed ', options: {} },
    { text: '12 schools', options: { bold: true, color: C.ink } },
    { text: '. The district office later confirms it was ', options: {} },
    { text: '2', options: { bold: true, color: C.ink } },
    { text: '.', options: {} },
  ], { x: 0.889, y: 2.11, w: 4.29, h: 0.97, size: 15, color: C.body, lsp: 22.5, name: 'Example' });
  txt(s, 'The Herald corrects its website. Nothing tells the other copies.', { x: 0.889, y: 3.24, w: 4.29, h: 0.65, size: 15, color: C.body, lsp: 22.5, name: 'Example, continued' });
  vrule(s, 0.9, 4.06, 1.257, C.amber, 2);
  txt(s, 'And the reader who spots it?', { x: 1.11, y: 4.09, w: 4.06, h: 0.33, size: 15, bold: true, color: C.ink, lsp: 21.75, name: 'Callout heading' });
  txt(s, 'A public comment that exposes them, or an email that disappears. No receipt, no outcome.', { x: 1.11, y: 4.46, w: 4.06, h: 0.86, size: 14, color: C.body, lsp: 20.3, name: 'Callout text' });

  const bHead = [{ color: C.tLine, pt: 1 }, { color: C.tLineDark, pt: 1 }, { color: C.tLineDark, pt: 1 }, { color: C.tLine, pt: 1 }];
  const bBody = [{ color: C.tLineDark, pt: 1 }, { color: C.tLine, pt: 1 }, { color: C.tLine, pt: 1 }, { color: C.tLine, pt: 1 }];
  const H = (t) => ({ text: t, options: { bold: true, color: C.ink, fill: { color: C.tHead }, border: bHead } });
  const D = (t, color = C.ink) => ({ text: t, options: { color, border: bBody } });
  s.addTable([
    [H('Where the story lives'), H('A day later')],
    [D('The Herald website (English)'), D('Corrected', C.green)],
    [D('Radio bulletin (chiShona)'), D('Still says 12', C.amber)],
    [D('Radio bulletin (isiNdebele)'), D('Still says 12', C.amber)],
    [D('Graphic forwarded on WhatsApp'), D('Still circulating', C.amber)],
    [D('Other newsrooms’ copies'), D('Still say 12', C.amber)],
  ], { x: 5.62, y: 2.12, w: 6.819, colW: [4.228, 2.591], rowH: 0.451, fontFace: 'Arial', fontSize: 15, color: C.ink, margin: 4.55, valign: 'top', lineSpacing: 21, objectName: 'Copies table' });
  footer(s, 'Illustrative example, used all the way through · Vimba · Track 7');
  s.addNotes(
    '(0:20–0:50 · 30 seconds)\n' +
    'One example, all the way through. Say The Herald reports that floods closed 12 schools. The district office says it was 2, so The Herald corrects its website. ' +
    'But in Zimbabwe a story lives in many places: a Shona bulletin, an Ndebele bulletin, a graphic forwarded on WhatsApp, and other newsrooms that share the same story. ' +
    'A day later, every copy except The Herald’s website still says 12. ' +
    'And the reader who spots it can comment publicly, which can expose them, or email and hear nothing back.'
  );
}

// 3. THE NEED IS GROWING (VMCZ numbers)
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Problem' });
  kicker(s, 'THE NEED IS GROWING', C.green);
  title(s, 'Complaints are rising, led by accuracy');
  s.addChart(pres.charts.BAR, [{ name: 'Complaints received by the VMCZ', labels: ['2023', '2024'], values: [31, 39] }], {
    x: 0.889, y: 2.0, w: 5.0, h: 3.55, barDir: 'col', barGapWidthPct: 65,
    chartColors: [C.barMuted, C.green],
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontFace: 'Georgia', dataLabelFontSize: 30, dataLabelColor: C.ink,
    catAxisLabelFontFace: 'Arial', catAxisLabelFontSize: 14, catAxisLabelColor: C.body, catAxisLineShow: true, catAxisLineColor: C.tLine,
    valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: 46, valAxisLineShow: false,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    showLegend: false, showTitle: false, objectName: 'VMCZ complaints chart',
    altText: 'Column chart: complaints received by the Voluntary Media Council of Zimbabwe rose from 31 in 2023 to 39 in 2024',
  });
  txt(s, 'Complaints received by the Voluntary Media Council of Zimbabwe (VMCZ)', { x: 0.889, y: 5.65, w: 5.0, h: 0.45, size: 12, color: C.body, lsp: 16.8, name: 'Chart caption' });

  const rx = 6.6, rw = 5.845;
  const rows = [
    { h: [{ text: '+26%', options: { color: C.green } }, { text: ' in one year', options: { color: C.ink } }], b: '39 complaints in 2024, up from 31 in 2023' },
    { h: 'Accuracy and fairness', b: 'the largest share of complaints' },
    { h: 'Redress is hard to get', b: 'from online platforms and news aggregators' },
  ];
  rows.forEach((r, i) => {
    const y = 2.09 + i * 1.0;
    rule(s, rx, y, rw, C.ink, 1);
    txt(s, r.h, { x: rx, y: y + 0.13, w: rw, h: 0.38, font: 'Georgia', size: 22, color: C.ink, lsp: 25.3, name: 'Finding' });
    txt(s, r.b, { x: rx, y: y + 0.56, w: rw, h: 0.3, size: 14, color: C.body, lsp: 20.3, name: 'Finding detail' });
  });
  vrule(s, rx + 0.011, 5.18, 0.95, C.amber, 2);
  txt(s, 'Small newsrooms have no affordable tool', { x: rx + 0.221, y: 5.21, w: rw - 0.221, h: 0.33, size: 15, bold: true, color: C.ink, lsp: 21.75, name: 'Callout heading' });
  txt(s, 'to record what they approved, handle complaints and correct every copy.', { x: rx + 0.221, y: 5.58, w: rw - 0.221, h: 0.55, size: 14, color: C.body, lsp: 20.3, name: 'Callout text' });
  footer(s, 'Source: Voluntary Media Council of Zimbabwe (VMCZ), complaints received in 2023 and 2024');
  s.addNotes(
    '(0:50–1:10 · 20 seconds)\n' +
    'And the need is growing. The Voluntary Media Council of Zimbabwe received 39 complaints in 2024, up from 31 the year before. ' +
    'Accuracy and fairness made up the largest share, and getting redress from online platforms and news aggregators was reported as difficult. ' +
    'Small newsrooms have no affordable tool to record what they approved, handle complaints and correct every copy. ' +
    'So accountability stays slow, invisible and enforced from outside, when newsrooms should be practising it themselves.'
  );
}

// 4. WHAT VIMBA DOES (green)
pres.addSection({ title: 'Solution' });
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Solution' });
  s.background = { color: C.green };
  txt(s, 'WHAT VIMBA DOES', { x: 0.889, y: 0.889, w: 11.902, h: 0.257, size: 12, bold: true, color: C.onGreenLabel, charSpacing: 1.5, lsp: 16.8, name: 'Section label' });
  txt(s, [{ text: 'Register the story once.' }, { text: 'The correction follows every copy.', options: { softBreakBefore: true } }], { x: 0.889, y: 1.229, w: 11.16, h: 1.35, font: 'Georgia', size: 44, color: C.onGreenTitle, lsp: 47.52, placeholder: 'title', name: 'Title' });
  const cards = [
    ['01', 'Register the story', 'Every version, from article to radio bulletin to share graphic, gets a signed Story Passport and a QR code.'],
    ['02', 'Challenge privately', 'Readers check the status, then quote the exact sentence on the web or WhatsApp, with a voice note or photo.'],
    ['03', 'Correct once', 'The editor approves one correction. Every copy, in every language, gets a new signed version.'],
  ];
  cards.forEach(([n, h, b], i) => {
    const x = 0.889 + i * 3.944;
    rrect(s, { x, y: 2.94, w: 3.667, h: 2.5, r: 0.139, fill: C.greenDeep, name: 'Step card' });
    txt(s, n, { x: x + 0.278, y: 3.22, w: 3.2, h: 0.33, font: 'Georgia', size: 22, color: C.mint, lsp: 22, name: 'Step number' });
    txt(s, h, { x: x + 0.278, y: 3.63, w: 3.2, h: 0.38, font: 'Georgia', size: 22, color: C.onGreenTitle, lsp: 25.3, name: 'Step name' });
    txt(s, b, { x: x + 0.278, y: 4.09, w: 3.2, h: 1.2, size: 14, color: C.onGreenBody, lsp: 20.3, name: 'Step text' });
  });
  txt(s, 'English · chiShona · isiNdebele · Vimba never judges truth: editors decide', { x: 0.889, y: 6.826, w: 11.902, h: 0.257, size: 12, color: C.onGreenLabel, lsp: 16.8, name: 'Footer' });
  s.addNotes(
    '(1:10–1:30 · 20 seconds)\n' +
    'Vimba fixes this in three moves. One: the newsroom registers the story once, and every version gets a signed Story Passport and a QR code. ' +
    'Two: readers check that code and challenge the exact sentence privately, on the web or WhatsApp, by typing, recording their voice or sending a photo. ' +
    'Three: the editor approves one correction that fixes every copy, in every language. Vimba never decides what’s true. Editors do.'
  );
}

// 5. STEP 1 · THE NEWSROOM (registration)
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Solution' });
  kicker(s, 'STEP 1 · THE NEWSROOM', C.green);
  title(s, 'Register the story and every copy, once');
  // three framed screens, same height and frame style as the other step slides
  screen(s, 'story-outputs.jpg', 0.896, 2.062, 3.743, 3.875, 'Story workspace listing four registered copies, each with its own passport reference: English article, chiShona and isiNdebele bulletins, share graphic');
  screen(s, 'story-claims.jpg', 4.915, 2.062, 3.883, 3.875, 'Claim C-01, schools closed = 12, linked to the exact sentence in the English article, both bulletins and the share graphic');
  screen(s, 'share-graphic.jpg', 9.074, 2.062, 3.375, 3.875, 'Printable share graphic with the Story Passport QR code, reference VMB-5DSN6ZBGGZ and a WhatsApp QR code');
  txt(s, lead('Registered:', ' article, bulletins, graphic'), { x: 0.889, y: 6.042, w: 3.75, h: 0.243, size: 12, lsp: 15.6, name: 'Caption' });
  txt(s, lead('Linked:', ' “12 schools” in every copy'), { x: 4.908, y: 6.042, w: 3.9, h: 0.243, size: 12, lsp: 15.6, name: 'Caption' });
  txt(s, lead('Published:', ' signed, with a QR code'), { x: 9.067, y: 6.042, w: 3.4, h: 0.243, size: 12, lsp: 15.6, name: 'Caption' });
  footer(s, 'Real screens from the working system (demo newsroom) · sources stay private to the newsroom');
  s.addNotes(
    '(1:30–1:50 · 20 seconds)\n' +
    'Step one, in the real system. The Herald registers the story and every copy of it: the English article, the Shona and Ndebele bulletins, the share graphic. ' +
    'It links the key fact, 12 schools, to the exact sentence in each copy. ' +
    'Publishing signs each version and gives it a Story Passport, with a QR code to print, post or read out on air.'
  );
}

// 6. STEP 2 · THE READER
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Solution' });
  kicker(s, 'STEP 2 · THE READER', C.green);
  title(s, 'Check any story, then challenge one sentence');
  screen(s, 'passport-current.jpg', 0.896, 2.062, 2.382, 3.875, 'Story Passport on a phone showing the status Current');
  screen(s, 'complaint-form.jpg', 3.569, 2.062, 3.569, 3.875, 'Correction form with the reader’s concern and a recorded voice note', C.frame, 0.16);
  txt(s, lead('Scan:', ' status Current, signed'), { x: 0.889, y: 6.042, w: 2.468, h: 0.243, size: 12, lsp: 15.6, name: 'Caption' });
  txt(s, lead('Complain privately:', ' type it or record it'), { x: 3.562, y: 6.042, w: 3.691, h: 0.243, size: 12, lsp: 15.6, name: 'Caption' });
  waPanel(s, 7.424, 5.021, [
    { t: 'Iphasiphothi yeNdaba yeVimba', b: true },
    { t: '“Izikhukhula zivala izikolo ezingu-12 esiqintini seRuvimbo”' },
    { t: 'Inguqulo 1 ku-1 · 4 Lwezi 2026' },
    { t: 'Isimo: Yamanje.', b: true },
    { t: 'Kuhlolwe khathesi.' },
  ], lead('Or on WhatsApp', ', in isiNdebele: “Status: Current”'), 5.171);
  footer(s, 'Real screens and replies from the working system · vimba-platform.vercel.app');
  s.addNotes(
    '(1:50–2:10 · 20 seconds)\n' +
    'Now the reader. She scans the code and sees the status first: Current, with a valid signature. No app, no login. ' +
    'If a sentence is wrong, she quotes it and tells the newsroom privately. She can type, or simply record her voice, and add a photo. ' +
    'On WhatsApp the same check works in three languages: here a reader sends HLOLA, Ndebele for “check”, and Vimba answers in isiNdebele.'
  );
}

// 7. STEP 3 · THE EDITOR
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Solution' });
  kicker(s, 'STEP 3 · THE EDITOR', C.green);
  title(s, 'Fix the claim once. Every copy follows.');
  screen(s, 'editor-case.jpg', 0.896, 2.062, 2.833, 3.986, 'Corrections desk case showing the disputed sentence, the reader’s concern, a voice recording and a photo of the article', C.frame, 0.132);
  txt(s, 'The case: sentence, voice note, photo', { x: 0.889, y: 6.153, w: 3.417, h: 0.243, size: 12, color: C.body, lsp: 15.6, name: 'Caption' });
  const bHead = [{ color: C.tLine, pt: 1 }, { color: C.tLineDark, pt: 1 }, { color: C.tLineDark, pt: 1 }, { color: C.tLine, pt: 1 }];
  const bBody = [{ color: C.tLineDark, pt: 1 }, { color: C.tLine, pt: 1 }, { color: C.tLine, pt: 1 }, { color: C.tLine, pt: 1 }];
  const H = (t) => ({ text: t, options: { bold: true, color: C.ink, fill: { color: C.tHead }, border: bHead } });
  const D = (t, color = C.ink) => ({ text: t, options: { color, border: bBody } });
  s.addTable([
    [H('Copy'), H('Before'), H('After approval')],
    [D('English article'), D('closed 12 schools', C.amber), D('closed 2 schools', C.green)],
    [D('chiShona bulletin'), D('Zvikoro 12 zvakavharwa', C.amber), D('Zvikoro 2 zvakavharwa', C.green)],
    [D('isiNdebele bulletin'), D('Izikolo ezingu-12 zivaliwe', C.amber), D('Izikolo ezi-2 zivaliwe', C.green)],
    [D('Share graphic'), D('12 schools closed', C.amber), D('2 schools closed', C.green)],
    [D('Partner newsrooms'), D('Notified at once', C.body), D('Publish their own fix', C.green)],
  ], { x: 4.139, y: 2.069, w: 8.306, colW: [1.993, 3.156, 3.156], rowH: 0.393, fontFace: 'Arial', fontSize: 13, color: C.ink, margin: 4.55, valign: 'top', lineSpacing: 18.2, objectName: 'Before and after table' });
  rrect(s, { x: 4.125, y: 4.566, w: 8.319, h: 0.875, r: 0.111, fill: C.callout, name: 'One approval callout' });
  s.addImage({ path: M('icon-verified.png'), x: 4.347, y: 4.85, w: 0.267, h: 0.306, sizing: { type: 'contain', w: 0.267, h: 0.306 }, altText: 'Verified', objectName: 'Verified icon' });
  txt(s, lead('One approval', ' signs a new version of every copy in one step. If anything fails, nothing is published.', C.ink, C.ink), { x: 4.781, y: 4.732, w: 7.664, h: 0.569, size: 14, color: C.ink, lsp: 20.3, name: 'Callout text' });
  footer(s, 'Each change note is written in the copy’s own language · Vimba never edits another newsroom’s site');
  s.addNotes(
    '(2:10–2:30 · 20 seconds)\n' +
    'The editor sees every complaint, from the web and WhatsApp, on one desk: the sentence, the voice note, the photo. ' +
    'Because the claim was linked when the story was registered, Vimba already knows every copy that carries it. ' +
    'The editor checks a before-and-after for each copy, in each language, and approves once. ' +
    'Partner newsrooms aren’t edited by us: they’re notified, and publish their own fix.'
  );
}

// 8. STEP 4 · THE RE-SCAN
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Solution' });
  kicker(s, 'STEP 4 · THE RE-SCAN', C.amber);
  title(s, 'The same printed code now says Superseded');
  screen(s, 'passport-superseded-en.jpg', 0.896, 2.062, 2.382, 3.875, 'The English Story Passport now showing Superseded', C.frameAmber);
  screen(s, 'passport-superseded-nd.jpg', 3.569, 2.062, 2.382, 3.875, 'The isiNdebele Story Passport now showing Isithathelwe indawo', C.frameAmber);
  txt(s, lead('English:', ' Superseded'), { x: 0.889, y: 6.042, w: 2.468, h: 0.243, size: 12, lsp: 15.6, name: 'Caption' });
  txt(s, lead('isiNdebele:', ' Isithathelwe indawo'), { x: 3.562, y: 6.042, w: 2.674, h: 0.243, size: 12, lsp: 15.6, name: 'Caption' });
  waPanel(s, 6.236, 6.208, [
    { t: 'Iphasiphothi yeNdaba yeVimba', b: true },
    { t: 'Inguqulo 1 ku-2 · 4 Lwezi 2026' },
    { t: 'Isimo: Isithathelwe indawo.', b: true, c: C.amber },
    { t: 'Inguqulo 2: Kulungisiwe: izikolo ezi-2, hatshi ezingu-12.' },
    { t: 'Kuhlolwe khathesi.' },
  ], lead('WhatsApp:', ' “Superseded. Version 2: 2 schools, not 12.”'), 6.395);
  footer(s, 'Real screens and replies from the working system, after one approval');
  s.addNotes(
    '(2:30–2:45 · 15 seconds)\n' +
    'And this is the moment that matters. The same printed QR code now says Superseded, and explains what changed, in every language. ' +
    'Ask on WhatsApp and the answer is corrected too: version 2, two schools, not twelve.'
  );
}

// 9. BUILT AND TESTED
pres.addSection({ title: 'Proof and plan' });
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Proof and plan' });
  kicker(s, 'BUILT AND TESTED', C.green);
  title(s, 'Working today, and cheap to run');
  const stats = [
    [0.889, 2.09, '63', 'automated tests, incl. newsroom privacy'],
    [4.458, 2.09, '<$100', 'a year to run a pilot'],
    [0.889, 3.333, '3', 'languages on every screen and reply'],
    [4.458, 3.333, '8,400', 'lines of our own code, public on GitHub'],
  ];
  stats.forEach(([x, y, n, l]) => {
    rule(s, x, y, 3.236, C.ink, 1);
    txt(s, n, { x, y: y + 0.132, w: 3.333, h: 0.639, font: 'Georgia', size: 44, color: C.green, lsp: 47.5, name: 'Stat' });
    txt(s, l, { x, y: y + 0.785, w: 3.333, h: 0.257, size: 13, color: C.body, lsp: 18.2, name: 'Stat label' });
  });
  txt(s, [
    { text: 'Ready-made:', options: { bold: true, color: C.ink } },
    { text: ' Next.js, Vercel and Neon hosting, the WhatsApp Cloud API through Kapso.', options: { color: C.body, breakLine: true } },
    { text: 'Ours:', options: { bold: true, color: C.ink } },
    { text: ' signatures, newsroom isolation, the one-step correction, the WhatsApp assistant.', options: { color: C.body } },
  ], { x: 0.889, y: 4.597, w: 7.01, h: 0.5, size: 12, color: C.body, lsp: 16.8, name: 'Build note' });
  screen(s, 'whatsapp-channel.jpg', 8.146, 2.09, 4.292, 2.965, 'WhatsApp channel page tracking monthly messages against the free 2,000-message allowance and every delivery', C.frame, 0.104);
  txt(s, lead('Usage and cost, tracked live.', ' First limit at 10 newsrooms: the free WhatsApp allowance.'), { x: 8.139, y: 5.16, w: 4.435, h: 0.472, size: 12, lsp: 16.8, name: 'Caption' });
  footer(s, 'Reader phone numbers encrypted, never logged · each newsroom’s records walled off in the database');
  s.addNotes(
    '(2:45–3:00 · 15 seconds)\n' +
    'Everything you’ve seen works today. 63 automated tests, including checks that one newsroom can never see another’s complaints. ' +
    'Under 100 dollars a year to run a pilot. Three languages on every screen and every WhatsApp reply. ' +
    'About 8,400 lines of our own code, public on GitHub, and usage and cost tracked live.'
  );
}

// 10. IMPACT, GROWTH AND OUR ASK
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Proof and plan' });
  kicker(s, 'IMPACT, GROWTH AND OUR ASK', C.green);
  title(s, 'Free for readers. Grows with every partner.');
  const cards = [
    ['WHO BENEFITS', 'Readers and newsrooms', 'Readers check and complain free, privately, in their language. Newsrooms get a traceable record of every correction.'],
    ['WHO PAYS', 'Institutions, not readers', 'A ZMC-supported pilot, then group licences for organisations such as ZBC, Zimpapers and ZIANA. Grants keep community radio free.'],
    ['HOW IT GROWS', 'Through the network', 'Every partner that receives a correction is a newsroom that can join. Next: CMS plug-ins, a .co.zw address and a +263 number.'],
  ];
  cards.forEach(([k, h, b], i) => {
    const x = [0.889, 4.84, 8.785][i];
    rrect(s, { x, y: 2.11, w: 3.66, h: 2.819, r: 0.135, fill: C.white, line: C.cardBorder, lineW: 0.5, name: 'Card' });
    txt(s, k, { x: x + 0.278, y: 2.4, w: 3.19, h: 0.26, size: 12, bold: true, color: C.green, charSpacing: 1.5, lsp: 16.8, name: 'Card label' });
    txt(s, h, { x: x + 0.278, y: 2.74, w: 3.19, h: 0.72, font: 'Georgia', size: 22, color: C.ink, lsp: 25.3, name: 'Card heading' });
    txt(s, b, { x: x + 0.278, y: 3.54, w: 3.19, h: 1.2, size: 14, color: C.body, lsp: 20.3, name: 'Card text' });
  });
  rrect(s, { x: 0.889, y: 5.236, w: 11.556, h: 0.875, r: 0.111, fill: C.callout, name: 'Ask callout' });
  s.addImage({ path: M('icon-verified.png'), x: 1.111, y: 5.52, w: 0.267, h: 0.306, sizing: { type: 'contain', w: 0.267, h: 0.306 }, altText: 'Verified', objectName: 'Verified icon' });
  txt(s, lead('Our ask:', ' a ZMC-supported pilot with one newsroom and one republication partner, on real stories.', C.ink, C.ink), { x: 1.545, y: 5.5, w: 10.8, h: 0.35, size: 16, color: C.ink, lsp: 23.2, valign: 'top', name: 'Our ask' });
  footer(s, 'Editorial control stays with each newsroom');
  s.addNotes(
    '(3:00–3:20 · 20 seconds)\n' +
    'Readers never pay: checking and complaining is free, private and in their own language. Newsrooms get a traceable record of every correction. ' +
    'Institutions pay: a ZMC-supported pilot, then group licences for organisations such as ZBC, Zimpapers and ZIANA, with grants keeping community radio free. ' +
    'And every partner that receives a correction is a newsroom that can join. ' +
    'So our ask: a ZMC-supported pilot with one newsroom and one republication partner, on real stories.'
  );
}

// 11. LIVE DEMO (last)
pres.addSection({ title: 'Live demo' });
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Live demo' });
  s.background = { color: C.ink };
  logoLight(s);
  txt(s, 'LIVE DEMO', { x: 0.889, y: 1.93, w: 6.9, h: 0.257, size: 12, bold: true, color: C.mint, charSpacing: 1.5, lsp: 16.8, name: 'Section label' });
  txt(s, [{ text: 'The passport you scanned' }, { text: 'is about to change', options: { softBreakBefore: true } }], { x: 0.889, y: 2.25, w: 7.1, h: 1.25, font: 'Georgia', size: 40, color: C.onDarkTitle, lsp: 43.2, placeholder: 'title', name: 'Title' });
  const steps = [
    ['Check:', ' the story says Current, and signed'],
    ['Challenge:', ' a reader quotes the sentence, with a voice note'],
    ['Approve once:', ' every copy, in all three languages'],
    ['Re-scan:', ' the same code now says Superseded'],
  ];
  steps.forEach(([b, r], i) => {
    const y = 3.88 + i * 0.46;
    txt(s, String(i + 1), { x: 0.889, y, w: 0.32, h: 0.32, size: 12, bold: true, color: C.onDarkTitle, align: 'center', valign: 'middle', lsp: 14.4, shape: pres.shapes.OVAL, fill: C.green, name: 'Demo step number' });
    txt(s, lead(b, r, C.onDarkTitle, C.onDarkBody), { x: 1.36, y: y + 0.02, w: 6.6, h: 0.3, size: 16, lsp: 19.2, name: 'Demo step' });
  });
  txt(s, 'Accountability that travels with the story.', { x: 0.889, y: 5.95, w: 7.2, h: 0.45, font: 'Georgia', size: 24, color: C.mint, lsp: 28.8, name: 'Closing line' });
  qrCard(s, 'qr-passport.png', 8.167, 2.25, 2.056, 2.243, 1.528, 'Open a live passport', 'QR code opening a live Vimba Story Passport');
  qrCard(s, 'qr-whatsapp.png', 10.389, 2.25, 2.056, 2.243, 1.528, 'Check on WhatsApp', 'QR code opening WhatsApp with CHECK VMB-5DSN6ZBGGZ typed in');
  txt(s, 'Try it now, on your phone', { x: 8.167, y: 4.62, w: 4.278, h: 0.257, size: 12, color: C.onDarkMuted, align: 'center', lsp: 16.8, name: 'QR caption' });
  footer(s, 'Vimba Labs · vimba-platform.vercel.app · WhatsApp +1 202 443 4476 · Tatenda · Siyabonga · Thank you', { dark: true, logo: false, w: 11.9 });
  s.addNotes(
    '(3:20–4:00 · 40 seconds)\n' +
    'Now let’s change that passport, live. [Switch to vimba-platform.vercel.app] ' +
    'A reader has challenged our sentence with a voice note. The editor opens the case, hears her, and Vimba lists every copy that carries the claim, in English, Shona and Ndebele. One approval. ' +
    'Now refresh the passport on your phone: it says Superseded. ' +
    'That’s Vimba: accountability that travels with the story. Tatenda, siyabonga, thank you.\n\n' +
    'Before the pitch: on the Stories page, press Reset demo so the passport shows Current. File the reader’s complaint with a voice note in advance, and keep the Corrections desk open as Editor in a second tab.\n' +
    'If the internet fails: say “You’ve seen the real screens on the last few slides”, invite the judges to scan the codes afterwards, and close with the line above.'
  );
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  if (applyTheme) await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
