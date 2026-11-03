# Vimba: accountability that travels with the story

Vimba is the product and **Amend** is its correction engine. Together they connect published versions, reader complaints and editor-approved corrections, so **the same printed QR reveals the newer version** after a correction.

This repository implements the MVP plan (v1.1, 3 Nov 2026) for Track 7 of the ZMC-NUST Media Innovation Hackathon 2026. It includes **English, chiShona and isiNdebele** throughout: interface, outputs, complaints and the WhatsApp assistant.

> Implementation, not a claim of accreditation. Receipts are signed by an explicit demo issuer. They are not C2PA certification, ZMC accreditation or an external trust-list listing. All demo data is fictional ("Ruvimbo District" does not exist).

## What's built

| Gate | Status |
|---|---|
| 0 Foundation | Postgres schema and migrations, two newsrooms, session auth, row level security enforced through a non-owner `vimba_app` role |
| 1 First passport | Story workspace, output release, Ed25519-signed receipts over canonical JSON, public `/p/:ref` passport, QR, printable share graphic |
| 2 Amend core | Claims, sources and confirmed claim links; correction drafts with before/after diff; atomic approval that signs a successor for every affected output |
| 3 Complaints | Public intake tied to an exact version and passage, private token-protected case page, editor desk (assign, reply, request info, internal note, decide, close), complainant export |
| 4 Partner relay | Partner copies with provenance; relay requests via the outbox; acknowledge, decline or complete with the partner's own signed successor |
| 5 WhatsApp | Kapso webhook (HMAC over raw bytes, deduplication, phone-number-ID check, test events ignored), state machine, outbox sender, 24-hour window, rate limits, monthly soft cap, labelled simulator |
| 6 Polish | Language packs with review status. **Not built:** voice transcription, AI suggestions, evidence file uploads (links only) |

## Languages

- `src/lib/i18n/{en,sn,nd}.ts`. The `Dict` type makes every pack carry every key. Tests check placeholders and the WhatsApp title limits (20 characters for buttons, 24 for list rows) in each language.
- Outputs can be `en`, `sn` or `nd`. A correction prepares a change note in each output's own language.
- WhatsApp accepts command words in all three languages: `CHECK`/`TARISA`/`HLOLA`, `MENU`/`MHORO`/`SALIBONANI`, `CANCEL`/`KANZURA`/`YEKELA`, `HELP`/`RUBATSIRO`/`USIZO`, `STOP`/`MIRA`/`YIMA`, `TRACK`/`TEVERA`/`LANDELELA`, and `LANG`/`MUTAURO`/`ULIMI`. Using a Shona or Ndebele command switches the chat to that language.
- **The Shona and Ndebele strings are machine-drafted and marked `draft`.** A fluent reviewer must sign them off before a pilot (see `/app/languages`). After review, set `status: 'reviewed'` in `src/lib/i18n/index.ts`, and set `VIMBA_ALLOW_DRAFT_LOCALES=false` so unreviewed packs stay hidden.

## Run locally

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL (Postgres 14+; owner role needs CREATEROLE once)
npm run keys:generate        # dev signing key and secrets into .env.local
npm run db:migrate
npm run db:seed              # prints demo accounts and published references
npm run dev                  # http://localhost:3000
npm run worker               # outbox delivery loop (or POST /api/worker/outbox with the worker secret)
```

Demo accounts (password `vimba-demo-2026`): `editor@newsroom-a.example`, `reporter@newsroom-a.example` and `editor@partner-b.example`.

## Tests

```bash
TEST_DATABASE_URL=postgres://…/vimba_test npm test
```

There are 49 tests: canonical JSON and signatures, references, i18n completeness, the conversation state machine, and the acceptance checks from the plan (QR continuity, signature integrity, tenant isolation through services and RLS, approval control, stale writes, concurrent and idempotent approval, partner independence, case confidentiality, fair intake). The WhatsApp tests cover signature, replay, test events, parity, privacy, the 24-hour window and outage behaviour.

## Layout

```
migrations/            SQL schema + RLS policies
src/services/          publication, passports, claims, corrections, complaints, relay, outbox, permissions
src/channels/whatsapp/ verify, payload, conversation (pure state machine), send, handler
src/app/               public pages (/, /p/:ref, /case), newsroom dashboard (/app), API routes (/api)
```

## Decisions preserved

- A partner controls its own publications, and a complainant controls submission of their own case.
- A complaint never changes public status. Only an approved correction does.
- Service targets are newsroom-configured, not statutory deadlines.
- WhatsApp runs on a Kapso-managed demo number. Recheck the free-plan limits and Meta pricing before any pilot.
