# Vimba: accountability that travels with the story

**Live prototype:** https://vimba-platform.vercel.app · **WhatsApp:** +1 202 443 4476 · Track 7: Digital Media Trust & RegTech, ZMC-NUST Media Innovation Hackathon 2026

> When a Zimbabwean newsroom corrects a story, only the website gets fixed. The chiShona and isiNdebele radio bulletins, the share graphic forwarded on WhatsApp and a partner's republication never hear about it, and readers who spot an error have no private way to challenge it.
>
> Vimba is a public record for news. Every published version gets a signed **Story Passport** and QR code. A reader files a private complaint against the exact sentence. The editor approves **one correction that updates every linked copy, in every language**. The same printed QR code then reads **Superseded** and shows what changed.

Vimba is the product and **Amend** is its correction engine. Everything works in **English, chiShona and isiNdebele**: the website, the newsroom dashboard, the complaints, and the WhatsApp assistant.

## Try it in two minutes (no password)

**On the web**

1. Open [`/p/VMB-5DSN6ZBGGZ`](https://vimba-platform.vercel.app/p/VMB-5DSN6ZBGGZ). The story is **Current**, with a valid signature.
2. Tap **Request a correction**. Paste the sentence `Flooding has closed 12 schools`, say what is wrong. Optionally **record your voice** or **attach a photo** of the article. You get a case number and a private tracking link.
3. Open [`/login`](https://vimba-platform.vercel.app/login) and choose **Editor**. Open **Complaints** and select your case. You can read the sentence, play the recording and see the photo.
4. Tap **New correction**, change `12` to `2` in each copy (English, chiShona, isiNdebele, share graphic) and approve once.
5. Reopen the link from step 1. The same story now reads **Superseded** and explains what changed. Sign in as **Partner editor** to see the partner newsroom receive its own notice.

**On WhatsApp** (to +1 202 443 4476)

- `CHECK VMB-5DSN6ZBGGZ` (or `TARISA` in chiShona, `HLOLA` in isiNdebele) returns the status in that language.
- `HI` opens a menu: check a story, report an error, track a complaint, help, language.
- Report an error step by step: reference, the exact sentence, the concern, an optional evidence link, an optional **photo of the article**, then confirm. You get a case number and a private tracking link.

**Fixed demo references** (so printed graphics always work). Press **Reset demo** at the bottom of the Stories page to restore the starting state.

| Output | Reference |
|---|---|
| English article | `VMB-5DSN6ZBGGZ` |
| chiShona bulletin | `VMB-2N2P3KWETY` |
| isiNdebele bulletin | `VMB-WWYFCTP00H` |
| Share graphic | `VMB-J39WZC0N6Q` |
| Partner copy (another newsroom) | `VMB-X3KXEG4K6Z` |

All demo data is fictional ("Ruvimbo District" does not exist).

## What it does

| Area | What works |
|---|---|
| **Story Passports** | Every published version has a permanent reference, a QR code and an Ed25519-signed receipt over canonical JSON. The public page shows status first (Current, Superseded, Withdrawn, Status unavailable) in words as well as colour. A printable QR graphic is included. |
| **Reader complaints** | Web and WhatsApp intake tied to an exact version and sentence. Optional evidence link, **photo of the article** and **voice recording** (web). A receipt, a private token-protected tracking page, and an export of the reader's own submission. Complaints never change a story's public status. |
| **Amend (corrections)** | Claims, sources and confirmed links between a claim and the passage in each copy. A correction draft shows a before-and-after diff for every copy. **One approval signs new versions of all affected copies atomically.** Two editors on one version get a clear conflict. |
| **Partner relay** | Republishing partners are notified, can acknowledge, decline or complete with their own signed successor. Vimba never edits another newsroom's site. Acknowledged is not the same as corrected. |
| **Corrections desk** | Complaints from the web and WhatsApp appear on one desk, grouped when similar: assign, reply (delivered back on WhatsApp for WhatsApp cases), request information, internal notes, decide, close. Service targets are newsroom-set. |
| **WhatsApp assistant** | Menus, checks, a guided complaint flow with a confirm step, language switching, `STOP`, a 24-hour window, rate limits and a monthly soft cap, in three languages. |
| **Languages** | One Language button switches everything: pages, status labels, errors, system messages and dates (Zimbabwe time, Shona and Ndebele month names). WhatsApp commands exist in all three languages. |

## Honest limits

- **No AI.** Corrections are decided by editors by design. Vimba does not judge whether a story is true.
- **No real newsroom users yet.** Everything you see is demo data and demo accounts. A pilot with one newsroom and one republication partner is the next step.
- **Voice recording is web only.** Voice notes sent on WhatsApp are answered with a polite "please send text or use the buttons".
- **Trust is a demo issuer.** Receipts are signed by an explicit demo issuer. They are not C2PA certification, ZMC accreditation or an external trust-list listing.
- **Demo secrets live in the database** for convenience (see below). A pilot must move them to the hosting provider.
- **WhatsApp runs on a Kapso-managed number** on a free plan. A local +263 number and a `.co.zw` address are planned for the pilot.
- No CMS plug-in yet: passports are issued by Vimba's own publishing screen.

## What we built, and what is ready-made

**Built by the team** (about 8,000 lines of TypeScript and SQL in this repository): the data model and row-level security policies, signing and canonical receipts, the passport and QR pages, claim links and the one-step multi-language correction, complaint intake and desk, partner relay, the WhatsApp conversation state machine and delivery outbox, photo and voice handling, the three-language interface and the 63 automated tests.

**Ready-made, used as services or libraries**

| Part | Provided by |
|---|---|
| Web framework | Next.js 15 and React 19 |
| Hosting and database | Vercel and Neon PostgreSQL |
| WhatsApp access | Meta WhatsApp Cloud API through Kapso |
| QR codes | `qrcode` |
| Input validation | `zod` |
| Database driver and tests | `pg`, `vitest` |
| Browser recording and image shrinking | the browser's own MediaRecorder and canvas |

## Design for Zimbabwe

- **Low cost, low data:** no app to install. Any phone browser or WhatsApp works. Photos are shrunk on the phone before upload (at most 1600 px), and voice is recorded at a low bitrate.
- **Local languages:** every screen and WhatsApp reply in English, chiShona and isiNdebele.
- **Human in the loop and editorial independence:** only editors approve corrections. Partners publish their own fixes. Vimba states what it proves (who published this exact text and when, whether it was corrected) and never claims a story is true.
- **Privacy:** complaints are private to the newsroom concerned. Reader phone numbers are encrypted and never written to logs. Photos have location metadata removed. Audio and photos are checked by their actual bytes and served only to editors of the owning newsroom.
- **Accessibility:** status in words, keyboard and screen-reader friendly forms, a light theme, a mobile-first layout.

## How it is built

- **Stack:** Next.js 15 (App Router), React 19, TypeScript, PostgreSQL via `pg`, deployed on Vercel with Neon.
- **Tenant isolation:** every request runs as a non-owner `vimba_app` role with row-level security forced on every newsroom table. One newsroom cannot read another's sources, drafts, complaints, photos or recordings, even through a bug in application code.
- **Signed receipts:** each version is signed with Ed25519 over canonical JSON. The public passport verifies the signature and that the content still matches.
- **Reliable delivery:** WhatsApp sends go through an outbox with retries, back-off and a dead-letter state. Incoming Kapso webhooks are verified (HMAC-SHA256 over the raw bytes), de-duplicated by idempotency key and checked against the configured phone-number ID. Batched deliveries are handled.
- **Operations:** the **Channel** page in the newsroom dashboard shows WhatsApp usage against the free monthly allowance, the soft cap, and every outbox job with its status and last error.

```
migrations/            SQL schema, row-level security, photo and audio tables
src/services/          publication, passports, claims, corrections, complaints, relay, outbox, permissions
src/channels/whatsapp/ verify, payload, conversation (pure state machine), media, send, handler
src/lib/               crypto, db, i18n (en, sn, nd), photos, audio, qr, rate limiting
src/app/               public pages (/, /p/:ref, /case), newsroom dashboard (/app), API routes (/api)
tests/                 63 tests: unit, acceptance, WhatsApp, photos and recordings
```

## Tests

```bash
TEST_DATABASE_URL=postgres://…/vimba_test npm test
```

63 tests: canonical JSON and signatures, references, i18n completeness, the WhatsApp conversation state machine, and the acceptance checks (QR continuity, signature integrity, tenant isolation through services and row-level security, approval control, stale writes, concurrent and repeated approval, partner independence, case confidentiality, fair intake). The WhatsApp tests cover signature checks, replay, test events, batched deliveries, privacy of the logs, the 24-hour window, outages, photo download and storage, and voice recordings.

## Run locally

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL (Postgres 14+; the owner role needs CREATEROLE once)
npm run keys:generate        # development signing key and secrets into .env.local
npm run db:migrate
npm run db:seed              # demo newsrooms and stories (add -- --reset to start over)
npm run dev                  # http://localhost:3000
npm run worker               # outbox delivery loop (or POST /api/worker/outbox with the worker secret)
```

Open `/login` and pick a role. No password is needed in demo mode (`VIMBA_DEMO_MODE`, on unless set to `false`).

### WhatsApp (Kapso)

Set `KAPSO_API_KEY`, `KAPSO_WEBHOOK_SECRET`, `KAPSO_PHONE_NUMBER_ID` and `WHATSAPP_PUBLIC_NUMBER`. Point a Kapso webhook at `/api/channels/whatsapp` for the `whatsapp.message.received` event. Without these, the WhatsApp channel is off and the dashboard simulator (clearly labelled) shows the same conversation.

### Secrets (demo mode)

If the signing key or app secrets are not set as environment variables, the app generates them on first start and stores them in the `system_secrets` table (`src/lib/secrets.ts`). **This is for the demo only**: anyone with database access could forge receipts. Before a pilot, run `scripts/vercel-secrets.sh` (or set the variables in the hosting dashboard), then delete the `system_secrets` rows. Environment variables always take precedence.

## Decisions preserved

- A partner controls its own publications, and a complainant controls submission of their own case.
- A complaint never changes public status. Only an approved correction does.
- Service targets are newsroom-configured, not statutory deadlines.
- Recheck the free-plan limits and Meta pricing before any pilot.

## Build record

Built during the hackathon: the first commit is 3 November 2026 (23:10 UTC) and the repository history shows every change since, including the WhatsApp fixes, mobile layout, photo and voice features added on 4 November. See the [commit history](https://github.com/harrymakoni-netizen/Vimba-platform-/commits/claude/vimba-mvp-trilingual).
