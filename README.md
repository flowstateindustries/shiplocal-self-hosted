# ShipLocal

> Translate your App Store metadata into every locale Apple supports — without copy-pasting between spreadsheets, without a SaaS subscription, and without your app data leaving the machine you run it on.

ShipLocal pulls existing metadata from App Store Connect, asks Claude or OpenAI to translate it into all 39 App Store locales (description, keywords, what's new, app name, subtitle, promotional text), and pushes the results back via the ASC API. Jobs and translations live in a single SQLite file on your disk.

---

## Why use this

- 🍎 **Direct App Store Connect integration.** Fetch source metadata from any editable version, push translated metadata back. Zero copy-paste between Excel, Notes, and ASC.
- 🔒 **Self-hosted, single-user.** Your ASC private key and translations never touch a third-party server beyond the AI provider you choose. No accounts, no analytics, no telemetry.
- 💸 **Pay only for AI tokens.** Translating a typical app across all 39 locales costs **~$0.10–$0.20** on `gpt-4o-mini`. The job log shows the exact spend after each run.
- 🌐 **Every App Store locale.** All 39 codes Apple ships, in the exact form ASC expects (`fr-FR`, `pt-BR`, `zh-Hans`, …).
- 🔁 **Resumable.** If a job fails mid-stream, hit **Resume** — it skips locales that already succeeded and re-runs only the failures.
- 📄 **`.xcstrings` translation, too.** Upload a `Localizable.xcstrings`, get a translated one back, download.
- 🧠 **Multi-provider AI.** Switch between Claude and OpenAI by editing one env var.

---

## Quick start

```bash
git clone https://github.com/flowstateindustries/shiplocal-self-hosted.git shiplocal
cd shiplocal
cp .env.example .env.local
npm install
npm run dev
```

Then **edit `.env.local`** and fill in your AI API key (Anthropic or OpenAI) plus your App Store Connect credentials. With the dev server running, open [http://localhost:3000](http://localhost:3000), click **Open Dashboard**, add an app, configure source/target locales, and hit **Localize**.

Full first-run walkthrough (including how to generate the App Store Connect API key) is in **[SETUP.md](SETUP.md)**.

---

## How it works

```
┌──────────────────┐      ┌────────────────┐      ┌─────────────────────┐
│  Your machine    │ ───▶ │   Claude /     │      │  App Store Connect  │
│                  │      │   OpenAI       │      │                     │
│  Next.js dev     │      │  (your key)    │      │  (your API key)     │
│  server          │ ◀─── │                │      │                     │
│        +         │                              │                     │
│  SQLite at       │      ─────────────────────▶  │                     │
│  ./data/         │      ◀─────────────────────  │                     │
│  shiplocal.db    │                              │                     │
└──────────────────┘                              └─────────────────────┘
```

Two outbound network paths per job: one to your chosen AI provider for each locale, one to App Store Connect to read the source metadata and write the translations back. Nothing else. No other servers in the loop.

---

## Cost (approximate)

For one app, one source locale → all 39 target locales, on `gpt-4o-mini`:

| Field | ~Tokens / locale | ~Cost / locale | × 39 locales |
|---|---|---|---|
| Description (4000 chars) | ~2k in + 1.5k out | $0.0012 | ~$0.05 |
| Keywords (100 chars) | ~600 in + 100 out | $0.0001 | ~$0.004 |
| What's new (4000 chars) | ~2k in + 1.5k out | $0.0012 | ~$0.05 |
| Promotional text (170 chars) | ~700 in + 200 out | $0.0002 | ~$0.008 |
| App name + subtitle | ~500 in + 100 out | $0.0002 | ~$0.008 |
| **Total** | | | **~$0.12** |

Claude Haiku is in the same ballpark (slightly more, depending on length). Every job's exact token + dollar spend is logged in the History view.

---

## Features in detail

### Localization
- All 39 App Store locales
- Per-field control — pick description / keywords / what's new / promotional text / app name / subtitle individually
- Brand-name preservation across translations
- URL preservation (`https://…` links stay intact even when surrounding text is rewritten)
- App Store character limits enforced (4000 / 170 / 100 / 30) with AI-powered condensing when the source overshoots the target's limit
- Translate vs Adapt modes — adapt-only for same-language variants (`en-US` → `en-GB`), full translate elsewhere

### `.xcstrings`
- Comment-aware prompts — Apple's developer comments inform the AI's tone
- Per-batch progress tracking; resume picks up at the exact batch where it stopped
- Plural variation preservation
- Skip-or-overwrite toggle for strings that already have a translation

### Workflow
- Server-Sent Events stream locale-by-locale progress live to the UI (no polling)
- Atomic SQLite job-claim prevents duplicate processing if you double-click
- "Partial success" — push the locales that succeeded now, retry the failures later
- Stale-job sweeper auto-recovers if the server restarts mid-run

### Self-hosted niceties
- Single SQLite file at `./data/shiplocal.db` — back up by copying, reset by deleting
- No auth, accounts, payments, or onboarding
- Five env-tunable performance knobs (concurrency, timeouts, batch sizes)
- 0 cron jobs, 0 webhooks, 0 background workers

---

## Configuration

Minimum required (in `.env.local`):

```bash
AI_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...                       # or ANTHROPIC_API_KEY for claude-* models
ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ASC_KEY_ID=XXXXXXXXXX
ASC_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----\n"
```

Optional performance knobs (defaults shown):

| Env var | Default | What it does |
|---|---|---|
| `CONCURRENT_LOCALES` | `3` | Locales processed in parallel per job. Raise for speed, lower for rate-limit-sensitive AI plans. |
| `AI_TIMEOUT_MS` | `30000` | Per-AI-call timeout. Raise for slow models, lower to fail fast. |
| `STRINGS_BATCH_SIZE` | `50` | Strings per AI call for `.xcstrings` jobs. |
| `STRINGS_MAX_CHARS_PER_BATCH` | `8000` | Hard char ceiling per `.xcstrings` batch (prompt-size cap). |
| `STALE_JOB_THRESHOLD_MS` | `300000` | When stale-cleanup flips a stuck `processing` job to `interrupted`. |
| `DATA_DIR` | `./data` | Where the SQLite file lives. |

See **[`.env.example`](.env.example)** for the annotated template.

---

## Tech stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · SQLite via `better-sqlite3` · Tailwind v4 · shadcn/ui · `@anthropic-ai/sdk` + `openai` · `jose` for ES256 JWT.

---

## Project layout

```
src/
├── app/
│   ├── (app)/             # Dashboard pages (apps, history, localization, strings, settings)
│   └── api/               # 16 API routes incl. SSE streams for live progress
├── components/            # UI primitives (shadcn) + feature components
├── hooks/                 # SSE stream hooks, dashboard data hook
└── lib/
    ├── ai/                # Multi-provider AI client + localizer
    ├── appstore/          # ASC API client (JWT, versions, localizations)
    ├── db/                # SQLite singleton, schema, typed queries
    ├── localization/      # Constants, job utilities, stale cleanup
    ├── strings/           # .xcstrings parser, batcher, translator, merger
    └── api/               # SSE helpers, response helpers, in-process mutex
```

---

## Security

This is a **local-only tool**. The dev server has no authentication — anyone with access to the loopback port can use it. Don't expose `npm run dev` to the public internet without putting an auth proxy in front of it.

- Secrets live in `.env.local` (gitignored). Treat the file like any credential.
- ASC credentials are read into the process at request time. They are never written anywhere on disk beyond the env file you control.
- The SQLite database is plain — back it up with the same threat model you'd apply to any local file.
- The dev server sets standard security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) via `src/proxy.ts`.

---

## Documentation

- **[SETUP.md](SETUP.md)** — first-run guide, env-var reference, App Store Connect API-key walkthrough
- **[editing.md](editing.md)** — context briefing for AI coding agents (Claude Code, Cursor, etc.) helping you modify this code

---

## Commands

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint

There is no migrations command — the SQLite schema in `src/lib/db/schema.ts` is applied automatically on first DB access.

---

## Support

None. This is released as-is — no bug fixes, no feature requests, no email support, no roadmap. Fork it, run it, modify it, ship it however you like. If something breaks, the code's right there.

## License

[MIT](LICENSE) — free for any use, including modification, redistribution, and commercial use. Copyright (c) 2026 Flowstate Industries LLC.
