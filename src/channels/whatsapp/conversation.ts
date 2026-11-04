import { normaliseRef } from '@/lib/crypto';
import { AppError } from '@/lib/errors';
import { translator, type Locale, type T } from '@/lib/i18n';
import type { PassportStatus } from '@/services/passports';

// ---------------------------------------------------------------------------
// Conversation state machine. Pure apart from the injected dependencies so it
// can be tested without WhatsApp, Kapso or a database. Each state asks one
// question; nothing becomes a complaint until the sender confirms.
// ---------------------------------------------------------------------------

export type State =
  | 'menu'
  | 'check.ref'
  | 'report.ref'
  | 'report.passage'
  | 'report.concern'
  | 'report.evidence'
  | 'report.photo'
  | 'report.confirm';

export interface Draft {
  ref?: string;
  publisher?: string;
  passage?: string;
  concern?: string;
  evidence?: string | null;
  /** Stored photo of the article, attached on submit. */
  photoId?: string | null;
}

export interface Turn {
  state: State;
  draft: Draft;
  locale: Locale;
  invalidCount: number;
  stopped: boolean;
}

export type OutMessage =
  | { type: 'text'; body: string }
  | { type: 'buttons'; body: string; buttons: { id: string; title: string }[] }
  | { type: 'list'; body: string; button: string; rows: { id: string; title: string; description?: string }[] }
  | { type: 'cta'; body: string; label: string; url: string };

export interface LookupResult {
  ref: string;
  title: string;
  publisher: string;
  number: number;
  total: number;
  publishedAt: string;
  status: PassportStatus;
  latestNumber: number | null;
  latestNote: string | null;
  passportUrl: string;
}

export interface Deps {
  lookup(ref: string): Promise<LookupResult | null>;
  passageMatches(ref: string, passage: string): Promise<boolean>;
  submit(
    draft: Required<Pick<Draft, 'ref' | 'passage' | 'concern'>> & { evidence: string | null; photoId: string | null },
    locale: Locale,
  ): Promise<{ caseRef: string; trackingUrl: string }>;
  /** Download and store an inbound photo; returns its id, or null if it could not be used. */
  savePhoto(media: InboundMedia): Promise<string | null>;
  track(locale: Locale): Promise<string[]>;
  formatDate(iso: string, locale: Locale): string;
  webUrl: string;
}

export interface InboundMedia {
  id: string | null;
  url: string | null;
  mime: string | null;
}

export interface Input {
  type: 'text' | 'interactive' | 'image' | 'audio' | 'other';
  text: string | null;
  choiceId: string | null;
  media?: InboundMedia | null;
}

// Command words in English, Shona and Ndebele. A Shona or Ndebele command
// also switches the conversation to that language.
const COMMANDS: Record<string, { cmd: 'check' | 'menu' | 'cancel' | 'help' | 'stop' | 'track' | 'lang'; locale?: Locale }> = {
  CHECK: { cmd: 'check' }, TARISA: { cmd: 'check', locale: 'sn' }, HLOLA: { cmd: 'check', locale: 'nd' },
  MENU: { cmd: 'menu' }, HI: { cmd: 'menu' }, HELLO: { cmd: 'menu' },
  MHORO: { cmd: 'menu', locale: 'sn' }, MHORORO: { cmd: 'menu', locale: 'sn' }, MAKADII: { cmd: 'menu', locale: 'sn' },
  SALIBONANI: { cmd: 'menu', locale: 'nd' }, SAWUBONA: { cmd: 'menu', locale: 'nd' }, SALIBONA: { cmd: 'menu', locale: 'nd' },
  CANCEL: { cmd: 'cancel' }, KANZURA: { cmd: 'cancel', locale: 'sn' }, YEKELA: { cmd: 'cancel', locale: 'nd' },
  HELP: { cmd: 'help' }, RUBATSIRO: { cmd: 'help', locale: 'sn' }, USIZO: { cmd: 'help', locale: 'nd' },
  STOP: { cmd: 'stop' }, MIRA: { cmd: 'stop', locale: 'sn' }, YIMA: { cmd: 'stop', locale: 'nd' },
  TRACK: { cmd: 'track' }, TEVERA: { cmd: 'track', locale: 'sn' }, LANDELELA: { cmd: 'track', locale: 'nd' },
  LANG: { cmd: 'lang' }, LANGUAGE: { cmd: 'lang' }, MUTAURO: { cmd: 'lang', locale: 'sn' }, ULIMI: { cmd: 'lang', locale: 'nd' },
};

export function parseCommand(text: string | null) {
  if (!text) return null;
  const [first, ...rest] = text.trim().split(/\s+/);
  const c = COMMANDS[first.toUpperCase().replace(/[^A-Z]/g, '')];
  return c ? { ...c, arg: rest.join(' ') } : null;
}

export function menu(t: T): OutMessage {
  return {
    type: 'list',
    body: t('wa.menu.body'),
    button: t('wa.menu.button'),
    rows: [
      { id: 'menu.check', title: t('wa.menu.check'), description: t('wa.menu.checkDesc') },
      { id: 'menu.report', title: t('wa.menu.report'), description: t('wa.menu.reportDesc') },
      { id: 'menu.track', title: t('wa.menu.track'), description: t('wa.menu.trackDesc') },
      { id: 'menu.help', title: t('wa.menu.help') },
      { id: 'menu.lang', title: t('wa.menu.lang'), description: t('wa.menu.langDesc') },
    ],
  };
}

const langButtons = (t: T): OutMessage => ({
  type: 'buttons',
  body: t('wa.lang.ask'),
  buttons: [
    { id: 'lang.en', title: 'English' },
    { id: 'lang.sn', title: 'chiShona' },
    { id: 'lang.nd', title: 'isiNdebele' },
  ],
});

export function resultCard(r: LookupResult, t: T, locale: Locale, fmt: Deps['formatDate']): OutMessage {
  const change =
    r.status === 'superseded' && r.latestNumber
      ? t('wa.result.change', { latest: r.latestNumber, note: r.latestNote ?? '' })
      : '';
  return {
    type: 'cta',
    body: t('wa.result', {
      ref: r.ref,
      title: r.title,
      publisher: r.publisher,
      n: r.number,
      total: r.total,
      date: fmt(r.publishedAt, locale),
      status: t(`passport.status.${r.status}`),
      change,
    }),
    label: t('wa.openPassport'),
    url: r.passportUrl,
  };
}

const reset = (turn: Turn, state: State = 'menu'): Turn => ({ ...turn, state, draft: {}, invalidCount: 0 });

export async function step(turn: Turn, input: Input, deps: Deps): Promise<{ turn: Turn; replies: OutMessage[] }> {
  const cmd = input.type === 'text' ? parseCommand(input.text) : null;
  let locale = cmd?.locale ?? turn.locale;
  let t = translator(locale);
  let next: Turn = { ...turn, locale };

  // After STOP, stay silent unless the sender explicitly starts again.
  if (turn.stopped) {
    if (!cmd || !['menu', 'check'].includes(cmd.cmd)) return { turn, replies: [] };
    next = { ...next, stopped: false };
  }

  const invalidReply = (msg: OutMessage): { turn: Turn; replies: OutMessage[] } => {
    const count = next.invalidCount + 1;
    if (count >= 2) return { turn: reset(next), replies: [msg, menu(t)] };
    return { turn: { ...next, invalidCount: count }, replies: [msg] };
  };

  const doLookup = async (raw: string): Promise<{ turn: Turn; replies: OutMessage[] }> => {
    const ref = normaliseRef(raw);
    const found = ref ? await deps.lookup(ref) : null;
    if (!found) return invalidReply({ type: 'text', body: t('wa.ref.invalid') });
    return { turn: reset(next), replies: [resultCard(found, t, locale, deps.formatDate)] };
  };

  // ----- Commands that work in any state ---------------------------------
  if (cmd) {
    switch (cmd.cmd) {
      case 'check':
        if (cmd.arg) return doLookup(cmd.arg);
        return { turn: reset(next, 'check.ref'), replies: [{ type: 'text', body: t('wa.ask.ref') }] };
      case 'menu':
        return { turn: reset(next), replies: [menu(t)] };
      case 'cancel':
        return { turn: reset(next), replies: [{ type: 'text', body: t('wa.cancelled') }, menu(t)] };
      case 'help':
        return { turn: next, replies: [{ type: 'text', body: t('wa.help', { link: deps.webUrl }) }] };
      case 'stop':
        return { turn: { ...reset(next), stopped: true }, replies: [{ type: 'text', body: t('wa.stopped') }] };
      case 'track': {
        const items = await deps.track(locale);
        return { turn: reset(next), replies: [{ type: 'text', body: items.length ? items.join('\n') : t('wa.track.none') }] };
      }
      case 'lang':
        return { turn: next, replies: [langButtons(t)] };
    }
  }

  // ----- Interactive choices (stable IDs only) ---------------------------
  const choice = input.choiceId;
  if (choice?.startsWith('lang.')) {
    const l = choice.slice(5) as Locale;
    if (['en', 'sn', 'nd'].includes(l)) {
      locale = l;
      t = translator(l);
      next = { ...next, locale: l };
      return { turn: reset(next), replies: [{ type: 'text', body: t('wa.lang.set') }, menu(t)] };
    }
  }
  if (choice?.startsWith('menu.')) {
    switch (choice) {
      case 'menu.check':
        return { turn: reset(next, 'check.ref'), replies: [{ type: 'text', body: t('wa.ask.ref') }] };
      case 'menu.report':
        return { turn: reset(next, 'report.ref'), replies: [{ type: 'text', body: t('wa.ask.ref') }] };
      case 'menu.track': {
        const items = await deps.track(locale);
        return { turn: reset(next), replies: [{ type: 'text', body: items.length ? items.join('\n') : t('wa.track.none') }] };
      }
      case 'menu.help':
        return { turn: next, replies: [{ type: 'text', body: t('wa.help', { link: deps.webUrl }) }] };
      case 'menu.lang':
        return { turn: next, replies: [langButtons(t)] };
    }
  }

  const photoStep = next.state === 'report.evidence' || next.state === 'report.photo';
  if (input.type === 'audio' || input.type === 'other' || (input.type === 'image' && !photoStep)) {
    return invalidReply({ type: 'text', body: t('wa.unsupported') });
  }
  const skipButton = [{ id: 'report.skip', title: t('wa.skip') }];
  const acceptPhoto = async (d: Draft): Promise<{ turn: Turn; replies: OutMessage[] }> => {
    const photoId = input.media ? await deps.savePhoto(input.media) : null;
    if (!photoId) return invalidReply({ type: 'buttons', body: t('wa.photo.failed'), buttons: skipButton });
    const draft = { ...d, photoId };
    return { turn: { ...next, state: 'report.confirm', draft, invalidCount: 0 }, replies: [confirmCard(draft, t)] };
  };

  const text = input.text ?? '';
  const d = next.draft;

  switch (next.state) {
    case 'menu':
      // A bare reference typed at the menu is treated as a check.
      if (normaliseRef(text)) return doLookup(text);
      return invalidReply(menu(t));

    case 'check.ref':
      return doLookup(text);

    case 'report.ref': {
      const ref = normaliseRef(text);
      const found = ref ? await deps.lookup(ref) : null;
      if (!found) return invalidReply({ type: 'text', body: t('wa.ref.invalid') });
      return {
        turn: { ...next, state: 'report.passage', draft: { ref: found.ref, publisher: found.publisher }, invalidCount: 0 },
        replies: [{ type: 'text', body: t('wa.ask.passage') }],
      };
    }

    case 'report.passage': {
      if (!d.ref || !(await deps.passageMatches(d.ref, text))) {
        return invalidReply({ type: 'text', body: t('complaint.passageNotFound') });
      }
      return {
        turn: { ...next, state: 'report.concern', draft: { ...d, passage: text.slice(0, 1000) }, invalidCount: 0 },
        replies: [{ type: 'text', body: t('wa.ask.concern') }],
      };
    }

    case 'report.concern': {
      if (text.length > 1000) return { turn: next, replies: [{ type: 'text', body: t('wa.concern.tooLong') }] };
      if (text.length < 3) return invalidReply({ type: 'text', body: t('wa.ask.concern') });
      return {
        turn: { ...next, state: 'report.evidence', draft: { ...d, concern: text }, invalidCount: 0 },
        replies: [{ type: 'buttons', body: t('wa.ask.evidence'), buttons: [{ id: 'report.skip', title: t('wa.skip') }] }],
      };
    }

    case 'report.evidence': {
      // A photo sent here is the article photo; the link is then left empty.
      if (input.type === 'image') return acceptPhoto({ ...d, evidence: null });
      let evidence: string | null = null;
      if (choice !== 'report.skip') {
        const url = text.match(/https:\/\/\S+/i)?.[0];
        if (!url || url.length > 500) {
          return invalidReply({ type: 'buttons', body: t('wa.evidence.invalid'), buttons: [{ id: 'report.skip', title: t('wa.skip') }] });
        }
        evidence = url;
      }
      return {
        turn: { ...next, state: 'report.photo', draft: { ...d, evidence }, invalidCount: 0 },
        replies: [{ type: 'buttons', body: t('wa.ask.photo'), buttons: skipButton }],
      };
    }

    case 'report.photo': {
      if (input.type === 'image') return acceptPhoto(d);
      if (choice === 'report.skip') {
        const draft = { ...d, photoId: null };
        return { turn: { ...next, state: 'report.confirm', draft, invalidCount: 0 }, replies: [confirmCard(draft, t)] };
      }
      return invalidReply({ type: 'buttons', body: t('wa.photo.invalid'), buttons: skipButton });
    }

    case 'report.confirm': {
      if (choice === 'confirm.cancel') return { turn: reset(next), replies: [{ type: 'text', body: t('wa.cancelled') }, menu(t)] };
      if (choice === 'confirm.edit') {
        return {
          turn: { ...next, state: 'report.passage', draft: { ref: d.ref, publisher: d.publisher }, invalidCount: 0 },
          replies: [{ type: 'text', body: t('wa.ask.passage') }],
        };
      }
      if (choice === 'confirm.submit' && d.ref && d.passage && d.concern) {
        try {
          const res = await deps.submit(
            { ref: d.ref, passage: d.passage, concern: d.concern, evidence: d.evidence ?? null, photoId: d.photoId ?? null },
            locale,
          );
          return {
            turn: reset(next),
            replies: [{ type: 'text', body: t('wa.submitted', { caseRef: res.caseRef, link: res.trackingUrl }) }],
          };
        } catch (err) {
          if (err instanceof AppError && err.code === 'rate_limited') {
            return { turn: reset(next), replies: [{ type: 'text', body: t('wa.complaintLimit') }] };
          }
          throw err;
        }
      }
      return invalidReply(confirmCard(d, t));
    }
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function confirmCard(d: Draft, t: T): OutMessage {
  return {
    type: 'buttons',
    body: t('wa.confirm.body', {
      publisher: d.publisher ?? '',
      // WhatsApp interactive bodies are limited to 1,024 characters.
      passage: clip(d.passage ?? '', 300),
      concern: clip(d.concern ?? '', 400),
      evidence: d.evidence ?? t('wa.none'),
      photo: d.photoId ? t('wa.photo.attached') : t('wa.none'),
    }),
    buttons: [
      { id: 'confirm.submit', title: t('wa.confirm.submit') },
      { id: 'confirm.edit', title: t('wa.confirm.edit') },
      { id: 'confirm.cancel', title: t('wa.confirm.cancel') },
    ],
  };
}
