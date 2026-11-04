// Vimba pitch, final 4-minute deck. Rebuilds the design of Vimba_Pitch_4-minute_final.pptx
// exactly (colours, Georgia/Arial type scale, positions, frames, cards, tables, QR cards)
// and adds: The Herald example, the VMCZ numbers, the "newsroom registers a story" step,
// and the live demo as the last slide.
// QA=1 builds without shrink-on-overflow so overflow is visible in the preview render.
// Rebuild: npm install pptxgenjs@3.12.0 && node build.js && python3 postprocess.py Vimba_Pitch_Final.pptx
const path = require('path');
const fs = require('fs');
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
  s.addNotes("(0:00–0:20 · 20 seconds)\nGood day, ladies and gentlemen. I’m Harry James Makoni, and this is my partner, Fabulous Lashidi. Our idea: when a news story is corrected, every copy of it should know. Please scan this code now. It opens a live Story Passport. Keep it open: before we finish, it will change.");
}

// 2. THE PROBLEM, in the layout the team chose (canvas px / 144 = inches)
pres.addSection({ title: 'Problem' });
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Problem' });
  const P = (px) => px / 144;
  kicker(s, 'THE PROBLEM', C.green);
  txt(s, [
    { text: 'One story spreads across newsrooms.', options: { color: C.ink } },
    { text: 'Its correction can stop at the source.', options: { color: C.amber, softBreakBefore: true } },
  ], { x: 0.889, y: 1.229, w: 11.902, h: 1.0, font: 'Georgia', size: 32, color: C.ink, lsp: 35.2, placeholder: 'title', name: 'Title' });
  // the example card
  rrect(s, { x: P(128), y: P(346), w: P(556), h: P(412), r: P(16), fill: C.white, line: C.cardBorder, lineW: 0.75, name: 'Example card' });
  txt(s, 'A fictional example', { x: P(165), y: P(389), w: P(278), h: P(37), size: 12, bold: true, color: C.muted, align: 'center', valign: 'middle', lsp: 14.4, shape: pres.shapes.ROUNDED_RECTANGLE, fill: 'EEEAE0', rectRadius: P(18.5), name: 'Example label' });
  txt(s, 'A newsroom reports that floods closed', { x: P(165), y: P(446), w: P(482), h: P(40), size: 14, color: C.body, lsp: 20, name: 'Example line' });
  s.addText('12 schools', { x: P(165), y: P(500), w: P(482), h: P(80), fontFace: 'Georgia', fontSize: 36, color: C.amber, strike: 'sngStrike', margin: 0, valign: 'top', lineSpacing: 40, isTextBox: true, objectName: 'Wrong figure', ...(FIT ? { fit: FIT } : {}) });
  txt(s, 'The source corrects the figure to', { x: P(165), y: P(592), w: P(482), h: P(40), size: 14, color: C.body, lsp: 20, name: 'Example line' });
  txt(s, '2 schools', { x: P(165), y: P(646), w: P(482), h: P(80), font: 'Georgia', size: 36, color: C.green, lsp: 40, name: 'Corrected figure' });
  // arrow from the source to the copies
  s.addShape(pres.shapes.LINE, { x: P(727), y: P(552), w: P(72), h: 0, line: { color: C.amber, width: 4, endArrowType: 'triangle' }, objectName: 'Arrow' });
  // where the story went
  const rows = [['Smaller newsrooms', ' republish it'], ['Radio stations', ' translate it'], ['Readers forward graphics', ' on WhatsApp']];
  rows.forEach(([b, r], i) => {
    const y = [383, 480, 579][i];
    rrect(s, { x: P(840), y: P(y), w: P(950), h: P(78), r: P(12), fill: C.white, line: C.cardBorder, lineW: 0.75, name: 'Copy row' });
    txt(s, lead(b, r, C.ink, C.ink), { x: P(869), y: P(y), w: P(600), h: P(78), size: 14, color: C.ink, valign: 'middle', lsp: 18, name: 'Copy' });
    txt(s, 'still 12 schools', { x: P(1461), y: P(y), w: P(300), h: P(78), size: 13, bold: true, color: C.amber, align: 'right', valign: 'middle', lsp: 18, name: 'Copy status' });
  });
  txt(s, 'Who tells everyone else?', { x: P(840), y: P(676), w: P(950), h: P(52), font: 'Georgia', size: 22, color: C.ink, lsp: 25, name: 'Question' });
  txt(s, 'Readers also need a private way to report errors and track the response.', { x: 0.889, y: 6.826, w: 10.2, h: 0.257, size: 13, bold: true, color: C.ink, lsp: 16.8, name: 'Footer' });
  s.addImage({ path: M('logo-dark.png'), x: 11.333, y: 6.861, w: 1.111, h: 0.2219, altText: 'Vimba', objectName: 'Vimba logo' });
  s.addNotes("(0:20–0:48 · 28 seconds)\nOne example, all the way through. Say The Herald reports that floods closed 12 schools, then corrects it to 2. But smaller newsrooms have republished it, radio stations have translated it, and readers are forwarding the graphic on WhatsApp. They all still say 12. Who tells everyone else? And the reader who spots the error has no private way to report it and track the response.");
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
  txt(s, 'so accountability is slow, invisible and enforced from outside, instead of practised by newsrooms themselves.', { x: rx + 0.221, y: 5.58, w: rw - 0.221, h: 0.6, size: 14, color: C.body, lsp: 20.3, name: 'Callout text' });
  footer(s, 'Source: Voluntary Media Council of Zimbabwe (VMCZ), complaints received in 2023 and 2024');
  s.addNotes("(0:48–1:10 · 22 seconds)\nAnd the need is growing. The Voluntary Media Council of Zimbabwe received 39 complaints in 2024, up from 31. Accuracy and fairness were the largest share, and redress from online platforms was hard to get. Small newsrooms have no tool for this, so accountability gets enforced from outside. For media freedom, newsrooms should practise it themselves.");
}

// 4. WHAT VIMBA DOES (green)
pres.addSection({ title: 'Solution' });
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Solution' });
  s.background = { color: C.green };
  txt(s, 'WHAT’S NEW', { x: 0.889, y: 0.889, w: 11.902, h: 0.257, size: 12, bold: true, color: C.onGreenLabel, charSpacing: 1.5, lsp: 16.8, name: 'Section label' });
  txt(s, [{ text: 'Register the story once.' }, { text: 'The correction follows every copy.', options: { softBreakBefore: true } }], { x: 0.889, y: 1.229, w: 11.16, h: 1.35, font: 'Georgia', size: 44, color: C.onGreenTitle, lsp: 47.52, placeholder: 'title', name: 'Title' });
  const cards = [
    ['01', 'A living QR code', 'The newsroom registers each version once. Its signed QR code always shows the latest status, even in print.'],
    ['02', 'Challenge privately', 'Readers quote the exact sentence on WhatsApp or the web, in English, chiShona or isiNdebele, and get a receipt.'],
    ['03', 'Fixes follow the claim', 'Each fact is linked in every copy, so one approval corrects them all and alerts every partner.'],
  ];
  cards.forEach(([n, h, b], i) => {
    const x = 0.889 + i * 3.944;
    rrect(s, { x, y: 2.94, w: 3.667, h: 2.5, r: 0.139, fill: C.greenDeep, name: 'Step card' });
    txt(s, n, { x: x + 0.278, y: 3.22, w: 3.2, h: 0.33, font: 'Georgia', size: 22, color: C.mint, lsp: 22, name: 'Step number' });
    txt(s, h, { x: x + 0.278, y: 3.63, w: 3.2, h: 0.38, font: 'Georgia', size: 22, color: C.onGreenTitle, lsp: 25.3, name: 'Step name' });
    txt(s, b, { x: x + 0.278, y: 4.09, w: 3.2, h: 1.2, size: 14, color: C.onGreenBody, lsp: 20.3, name: 'Step text' });
  });
  txt(s, 'English · chiShona · isiNdebele · Vimba never judges truth: editors decide', { x: 0.889, y: 6.826, w: 11.902, h: 0.257, size: 12, color: C.onGreenLabel, lsp: 16.8, name: 'Footer' });
  s.addNotes("(1:10–1:30 · 20 seconds)\nWhat’s new: the correction follows the claim, not the web page. The newsroom registers the story once, and each version gets a signed passport whose QR code always shows the latest status, even in print. Readers challenge one sentence privately, in three languages. One approval fixes every copy. Vimba never decides what’s true: editors do.");
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
  s.addNotes("(1:30–1:50 · 20 seconds)\nHere it is in the real system. The Herald registers the story and every copy: the English article, the Shona and Ndebele bulletins, the share graphic. It links the key fact, 12 schools, to the exact sentence in each. Publishing signs each version and gives it a passport and a QR code.");
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
  s.addNotes("(1:50–2:07 · 17 seconds)\nNow the reader. She scans and sees the status first: Current, and signed. No app, no login. To challenge a sentence, she quotes it privately, by typing, or by recording her voice on the web. On WhatsApp it works in three languages. That’s access to information.");
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
  s.addNotes("(2:07–2:28 · 21 seconds)\nThe editor sees every complaint, from the web and WhatsApp, on one desk. Because the claim was linked at registration, Vimba already knows every copy that carries it. The editor checks a before-and-after for each, in each language, and approves once. If anything fails, nothing is published. Partners are notified and publish their own fix.");
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
  s.addNotes("(2:28–2:40 · 12 seconds)\nAnd here’s the moment that matters: the same printed code now says Superseded, in every language. Ask on WhatsApp, and the answer is corrected too: two schools, not twelve.");
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
    [4.458, 3.333, 'Ed25519', 'signed versions anyone can verify'],
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
  footer(s, 'Reader phone numbers encrypted (AES-256-GCM), never logged · each newsroom walled off by row-level security', { w: 10.2 });
  s.addNotes("(2:40–2:58 · 18 seconds)\nAll of this works today, and it’s responsible by design: every version is signed with Ed25519, each newsroom is walled off by row-level security, reader numbers are encrypted, and no AI decides what’s true. 63 automated tests check it. A pilot costs under 100 dollars a year.");
}

// 10. IMPACT, GROWTH AND OUR ASK
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Proof and plan' });
  kicker(s, 'IMPACT, SUSTAINABILITY AND SCALE', C.green);
  title(s, 'Free for readers. Grows with every partner.');
  const cards = [
    ['SOCIAL IMPACT', 'Readers and newsrooms', 'Readers check and complain free, privately, in their language. People harmed by an error get a route to an outcome.'],
    ['SUSTAINABILITY', 'Institutions, not readers', 'A ZMC-supported pilot, then group licences for organisations such as ZBC, Zimpapers and ZIANA. Grants keep community radio free.'],
    ['SCALABILITY', 'Through the network', 'Every partner that receives a correction is a newsroom that can join. A new language is one file of nearly 400 phrases.'],
  ];
  cards.forEach(([k, h, b], i) => {
    const x = [0.889, 4.84, 8.785][i];
    rrect(s, { x, y: 2.11, w: 3.66, h: 2.819, r: 0.135, fill: C.white, line: C.cardBorder, lineW: 0.5, name: 'Card' });
    txt(s, k, { x: x + 0.278, y: 2.4, w: 3.19, h: 0.26, size: 12, bold: true, color: C.green, charSpacing: 1.5, lsp: 16.8, name: 'Card label' });
    txt(s, h, { x: x + 0.278, y: 2.74, w: 3.19, h: 0.72, font: 'Georgia', size: 22, color: C.ink, lsp: 25.3, name: 'Card heading' });
    txt(s, b, { x: x + 0.278, y: 3.54, w: 3.19, h: 1.2, size: 14, color: C.body, lsp: 20.3, name: 'Card text' });
  });
  rrect(s, { x: 0.889, y: 5.15, w: 11.556, h: 1.05, r: 0.111, fill: C.callout, name: 'Ask callout' });
  s.addImage({ path: M('icon-verified.png'), x: 1.111, y: 5.522, w: 0.267, h: 0.306, sizing: { type: 'contain', w: 0.267, h: 0.306 }, altText: 'Verified', objectName: 'Verified icon' });
  txt(s, [
    { text: 'Our ask:', options: { bold: true, color: C.ink } },
    { text: ' a ZMC-supported 90-day pilot with one newsroom and one republication partner, on real stories.', options: { color: C.ink, breakLine: true } },
    { text: 'We will report how fast every copy was corrected and every complaint answered.', options: { color: C.body, fontSize: 14 } },
  ], { x: 1.545, y: 5.33, w: 10.8, h: 0.7, size: 16, color: C.ink, lsp: 22, valign: 'top', name: 'Our ask' });
  footer(s, 'Editorial control stays with each newsroom');
  s.addNotes("(2:58–3:20 · 22 seconds)\nThe impact: readers check and complain free, privately, in their own language. It’s sustainable: institutions pay, from a ZMC-supported pilot to group licences for ZBC, Zimpapers and ZIANA. And it scales through the network: every partner we notify is a newsroom that can join. Our ask: a 90-day pilot with one newsroom and one partner, on real stories.\n\nTime check: if you are past 3:20, go straight to the demo.");
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
  s.addNotes("(3:20–4:00 · 40 seconds)\nNow let’s change that passport, live. [Switch to the browser.] A reader has challenged our sentence with a voice note. [Play two seconds.] Here is the editor’s fix in all four copies, in English, Shona and Ndebele. One approval. [Click Approve and release correction.] Now refresh the passport on your phone: it says Superseded. That’s Vimba: accountability that travels with the story. Tatenda, siyabonga, thank you.\n\nSet up 10 minutes before:\n1. Sign in as Editor. On the Stories page, press Reset demo, so the passport shows Current.\n2. As a reader, open vimba-platform.vercel.app/p/VMB-5DSN6ZBGGZ, tap Request a correction, quote “Flooding has closed 12 schools” and record a short voice note.\n3. As Editor, open the case, start a new correction, change 12 to 2 in all four copies with a change note in each language, and save it. Do not approve.\n4. Keep three tabs ready: the case, the correction with its Approve button, and the passport.\nIf the internet fails: go to the next slide and play the 36-second recorded demo. It narrates itself; then say “Tatenda, siyabonga, thank you.”");
}

// 12. RECORDED DEMO: the same journey as a video, for when the venue internet fails
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Live demo' });
  s.background = { color: C.ink };
  txt(s, 'RECORDED DEMO · BACKUP', { x: 2.57, y: 0.889, w: 6.59, h: 0.257, size: 12, bold: true, color: C.mint, charSpacing: 1.5, lsp: 16.8, name: 'Section label' });
  txt(s, 'The whole journey, in the real system', { x: 2.57, y: 1.19, w: 6.61, h: 0.45, font: 'Georgia', size: 28, color: C.onDarkTitle, lsp: 30.8, placeholder: 'title', name: 'Title' });
  txt(s, '0:36', { x: 9.26, y: 1.40, w: 1.5, h: 0.24, size: 12, color: C.onDarkMuted, align: 'right', lsp: 15.6, name: 'Video length' });
  rrect(s, { x: 2.57, y: 1.86, w: 8.19, h: 4.61, r: 0.111, fill: '0B1514', name: 'Video frame', shadow: { type: 'outer', color: '000000', opacity: 0.45, blur: 30, offset: 10, angle: 90 } });
  s.addMedia({ type: 'video', path: M('demo.mp4'), cover: 'data:image/png;base64,' + fs.readFileSync(M('demo-poster.png')).toString('base64'), x: 2.57, y: 1.86, w: 8.19, h: 4.61, objectName: 'Recorded demo video' });
  txt(s, 'Tap to play · 36 seconds, cut from one live run of vimba-platform.vercel.app', { x: 2.57, y: 6.62, w: 8.19, h: 0.257, size: 12, color: C.onDarkMuted, align: 'center', lsp: 16.8, name: 'Footer' });
  s.addNotes("(3:20–4:00) Backup for the live demo: if the venue internet fails, tap the video to play it. It runs 36 seconds, narrates itself and ends on “Accountability that travels with the story.” Then say: Tatenda, siyabonga, thank you.");
}

// 12. BACKUP · QUESTIONS (hidden in the slideshow; the demo stays the last slide shown)
pres.addSection({ title: 'Backup' });
{
  const s = pres.addSlide({ masterName: 'Title and body', sectionTitle: 'Backup' });
  s.hidden = process.env.SHOW_BACKUP !== '1'; // SHOW_BACKUP=1 only for preview renders
  kicker(s, 'BACKUP · QUESTIONS WE EXPECT', C.green);
  title(s, 'Ready for your questions');
  const qa = [
    ['How is this different from a correction note?', 'A note fixes one web page. Vimba links the claim in every copy, language and partner republication, and the same printed QR code shows the fix.'],
    ['Who decides what is true?', 'The newsroom’s editors. Vimba signs and records what they approve. A complaint never changes a story’s public status on its own.'],
    ['What stops spam or abuse?', 'Complaints are private and tied to an exact sentence. WhatsApp has rate limits and a monthly cap, and similar complaints are grouped.'],
    ['Is readers’ data safe?', 'Phone numbers are encrypted and never logged. Each newsroom’s records are walled off by row-level security in the database.'],
    ['Why would a newsroom pay?', 'A traceable record of every correction, complaints handled privately before they escalate, and every copy fixed in one step.'],
    ['What is not built yet?', 'CMS plug-ins, a +263 number and .co.zw address, and voice notes on WhatsApp (voice works on the web today). The pilot adds them.'],
  ];
  qa.forEach(([q, a], i) => {
    const x = [0.889, 4.84, 8.785][i % 3], y = 2.11 + Math.floor(i / 3) * 2.2;
    rrect(s, { x, y, w: 3.66, h: 2.0, r: 0.135, fill: C.white, line: C.cardBorder, lineW: 0.5, name: 'Card' });
    txt(s, q, { x: x + 0.278, y: y + 0.22, w: 3.19, h: 0.55, font: 'Georgia', size: 16, color: C.ink, lsp: 19.2, name: 'Question' });
    txt(s, a, { x: x + 0.278, y: y + 0.86, w: 3.19, h: 1.0, size: 12, color: C.body, lsp: 16.8, name: 'Answer' });
  });
  footer(s, 'Backup slide, hidden in the slideshow: open it only if the judges ask');
  s.addNotes('Backup for questions. Hidden in the slideshow, so the live demo stays the last slide shown.');
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  if (applyTheme) await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
