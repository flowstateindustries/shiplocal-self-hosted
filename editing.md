# editing.md — context for AI coding agents

Read this before editing the codebase. It's written for any AI agent (Claude Code, Cursor, Aider, Copilot, Continue, etc.) helping a user modify ShipLocal.

---

## What this app is

A **single-user, self-hosted** Next.js app that:

1. Pulls existing App Store metadata from App Store Connect via the user's own API key.
2. Asks Claude or OpenAI to translate it into all 39 App Store locales.
3. Pushes the translated metadata back to App Store Connect.
4. Optionally translates `Localizable.xcstrings` files.

Everything runs locally against a SQLite file at `./data/shiplocal.db`. There is **no auth, no multi-tenant data model, no payment system, no telemetry, no external CDN**. The only network calls at runtime are to the user's chosen AI provider and Apple's APIs.

---

## Tech stack

- **Framework:** Next.js 16 (App Router, Turbopack) + React 19
- **Language:** TypeScript strict
- **Database:** SQLite via `better-sqlite3` (synchronous, in-process; WAL mode)
- **Styling:** Tailwind v4 + shadcn/ui (Radix primitives)
- **AI:** Multi-provider (`@anthropic-ai/sdk`, `openai`) — chosen via `AI_MODEL` env var
- **App Store Connect:** ES256 JWT signing with `jose`
- **Notifications:** `sonner`

---

## Code layout

```
src/
├── app/
│   ├── (app)/                     # Dashboard shell (no auth wrapping — single user)
│   │   ├── apps/                  # App management page
│   │   ├── dashboard/             # Home / overview
│   │   ├── history/               # Job history
│   │   ├── localization/[appId]/  # Localization flow (config, generating, preview, pushing, success)
│   │   ├── settings/              # Connections tab (env state)
│   │   └── strings/               # .xcstrings flow
│   ├── api/                       # 16 API routes (see table below)
│   ├── error.tsx                  # Root error boundary
│   ├── globals.css                # Tailwind + theme variables
│   ├── layout.tsx                 # Root layout (theme provider, Toaster)
│   ├── not-found.tsx              # 404 page
│   └── page.tsx                   # Minimal home; "Open Dashboard" button
├── components/
│   ├── ui/                        # shadcn/ui primitives (Button, Card, Dialog, …)
│   ├── apps/                      # AppCard, AppSelector
│   ├── dashboard/                 # Sidebar, MobileHeader, StatCard, ActivityItem, AppsList, …
│   ├── history/                   # JobCard, JobStatusBadge, ResumeButton
│   ├── localization/              # ConfigForm, TargetLocalesGrid, FieldsCheckboxes, UrlOptions, …
│   ├── settings/                  # ConnectionsTab (read-only env-credential status)
│   ├── strings/                   # FileUpload, FileInfo, StringPreviewCard
│   ├── command-menu.tsx           # ⌘K palette
│   └── theme-provider.tsx
├── hooks/                         # use-dashboard, use-mobile, SSE-stream hooks
├── lib/
│   ├── ai/                        # Multi-provider AI client + the localizer
│   ├── api/                       # Response helpers, SSE helpers, in-process mutex + worker pool
│   ├── appstore/                  # ASC API client (JWT, list/get/update endpoints) + env-based credentials
│   ├── database/types.ts          # Shared Row / Insert / Update interfaces
│   ├── db/                        # SQLite singleton (client.ts), schema.ts, typed queries.ts
│   ├── env.ts                     # getNumberEnv() helper for env-var parsing
│   ├── localization/              # Constants, JobConfig types, pure resume helpers, server-only stale cleanup
│   └── strings/                   # .xcstrings parser, batcher, translator, merger
├── proxy.ts                       # Next 16 middleware-equivalent — sets security headers only
└── middleware.ts                  # (not used — see proxy.ts)
```

---

## Database schema (SQLite)

Three tables, **no `user_id` columns** — this is a single-user app. JSON columns are stored as TEXT and parsed/serialized by the helpers in `src/lib/db/queries.ts`.

### `selected_apps`
```
id (TEXT PK, UUID) | app_id (TEXT UNIQUE) | app_name | app_icon_url | created_at
```

### `localization_jobs`
```
id, app_id, app_name, app_icon_url, source_locale,
target_locales (JSON: string[]),
fields_localized (JSON: string[]),
status (pending | processing | completed | failed | interrupted),
results (JSON: { _config?, locales[] }),
locale_results (JSON: Record<locale, { status, data?, error? }>),
error_message, pushed_to_asc (INTEGER 0/1), pushed_at,
total_input_tokens, total_output_tokens, total_cost_cents,
ai_model, created_at, updated_at, completed_at
```

### `strings_jobs`
```
id, file_name, source_locale,
target_locales (JSON),
overwrite_existing (INTEGER 0/1),
source_content (JSON: XCStringsFile),
results (JSON: XCStringsFile | null),
status, error_message,
locale_results (JSON: per-locale, per-batch progress),
total_strings, strings_to_translate,
total_input_tokens, total_output_tokens, total_cost_cents,
ai_model, created_at, updated_at, completed_at
```

Schema lives in `src/lib/db/schema.ts` and is applied on first `getDb()` call. No migration tool — see "Adding a DB column" below.

---

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/apps` | GET | List apps from App Store Connect |
| `/api/credentials` | GET | Env-state for ASC creds |
| `/api/credentials` | POST | Validate creds against ASC; does NOT save (env-only) |
| `/api/credentials` | DELETE | Returns "edit .env.local" message |
| `/api/itunes-lookup/[appId]` | GET | Proxy iTunes lookup |
| `/api/selected-apps` | GET / POST | List / add tracked app |
| `/api/selected-apps/[appId]` | GET / DELETE | Read / remove |
| `/api/localization/[appId]/config` | GET | Build localization config (ASC mode if creds present, else iTunes manual mode) |
| `/api/localization-jobs` | GET / POST | List / create |
| `/api/localization-jobs/[jobId]` | GET / PATCH / DELETE | Read / save edits / cancel-or-delete |
| `/api/localization-jobs/[jobId]/stream` | GET | SSE generation |
| `/api/localization-jobs/[jobId]/resume` | GET | SSE resume failed/interrupted |
| `/api/localization-jobs/[jobId]/push` | GET | SSE push to ASC |
| `/api/strings-jobs` | GET / POST | List / create |
| `/api/strings-jobs/[jobId]` | GET / DELETE | Read / delete |
| `/api/strings-jobs/[jobId]/stream` | GET | SSE generation |
| `/api/strings-jobs/[jobId]/resume` | GET | SSE resume |
| `/api/strings-jobs/[jobId]/download` | GET | Download translated `.xcstrings` |

---

## Patterns to follow

### SQLite — always use the typed helpers

`src/lib/db/queries.ts` wraps `better-sqlite3` with parsed JSON columns and domain types. Don't write raw SQL in API routes.

```ts
import {
  listLocalizationJobs,
  getLocalizationJob,
  insertLocalizationJob,
  updateLocalizationJob,
  claimLocalizationJobForProcessing,
} from '@/lib/db/queries'

const job = getLocalizationJob(jobId)
if (!job) return notFoundResponse('Job')

updateLocalizationJob(jobId, { status: 'completed', results: { /* … */ } })
```

### Atomic job claim — for SSE race-condition safety

Stream and resume routes must claim the job atomically before processing. Returns `null` if it was already claimed:

```ts
const claimed = claimLocalizationJobForProcessing(jobId, ['pending'])
if (!claimed) {
  return sseErrorResponse('Job is already being processed or completed', 400)
}
```

### Concurrency — worker pool + in-process mutex

From `src/lib/api/concurrent.ts`:

```ts
const dbMutex = createMutex()
await mapWithConcurrency(targetLocales, CONCURRENT_LOCALES, async (locale) => {
  // …AI call…
  await dbMutex.acquire()
  try {
    updateLocalizationJob(jobId, { /* intermediate progress */ })
  } finally {
    dbMutex.release()
  }
})
```

`CONCURRENT_LOCALES` comes from `src/lib/localization/constants.ts` and is env-overridable.

### SSE streams

Standard shape — heartbeat every 15 s, atomic claim up front, status guards on the final UPDATE, per-locale cancellation checks:

```ts
import { SSE_HEADERS } from '@/lib/api/sse'

return new Response(
  new ReadableStream({
    async start(controller) {
      const sendEvent = (e: StreamEvent) => {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(e)}\n\n`))
      }
      const heartbeat = setInterval(() => sendEvent({ type: 'heartbeat' }), 15000)
      try {
        // …work…
      } finally {
        clearInterval(heartbeat)
        controller.close()
      }
    },
  }),
  { headers: SSE_HEADERS }
)
```

There is **no `export const maxDuration`** in any route — that's Vercel-only and meaningless here.

### Response helpers

```ts
import {
  errorResponse, validationError, notFoundResponse,
  validateJsonContentType,
  sseErrorResponse, sseNotFoundResponse,
} from '@/lib/api/responses'
```

### Multi-provider AI

`process.env.AI_MODEL` determines the provider:
- `claude-*` → Anthropic SDK
- `gpt-*`, `o1-*`, `o3-*` → OpenAI SDK

Wrappers are in `src/lib/ai/providers/`. Don't import the SDKs directly from app code — go through `src/lib/ai/`.

### ASC credentials

```ts
import { getASCCredentials, hasASCCredentials } from '@/lib/appstore/credentials'

const creds = getASCCredentials()   // { issuerId, keyId, privateKey } | null
if (!creds) return errorResponse('App Store Connect not connected', 400)
```

Credentials live in `.env.local` only; no DB encryption layer.

---

## Adding things

### A new env var

1. Use `getNumberEnv('NAME', default)` for numeric, or `process.env.NAME ?? default` for string.
2. Document in `.env.example` with a brief comment.
3. Mention in `SETUP.md` if it's user-facing.

### A new DB column

1. Add the column to the matching `CREATE TABLE` in `src/lib/db/schema.ts`.
2. Add the field to the `Row` / `Insert` / `Update` interfaces in `src/lib/database/types.ts`.
3. Update the row mapper + the `INSERT` / `UPDATE` builder in `src/lib/db/queries.ts`.
4. **Existing local DBs won't auto-migrate.** Either write an `ALTER TABLE … ADD COLUMN …` guarded by `pragma_table_info(...)` in the schema bootstrap, or tell the user to stop the dev server and `rm ./data/shiplocal.db*` to rebuild (this loses their local job history).

### A new API route

```ts
import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse, validationError, notFoundResponse,
  validateJsonContentType,
} from '@/lib/api/responses'
import { /* typed helpers */ } from '@/lib/db/queries'

export async function POST(request: NextRequest) {
  const contentTypeError = validateJsonContentType(request)
  if (contentTypeError) return contentTypeError
  try {
    const body = await request.json()
    // validate
    // DB call via typed helpers
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error in POST /api/…:', error)
    return errorResponse('Internal server error', 500)
  }
}
```

No auth wrapper. No rate-limit wrapper. Single user.

### A new component

1. Check `src/components/ui/` first — shadcn primitives cover most cases.
2. New shadcn primitive: `npx shadcn@latest add <name>`.
3. Feature components go under `src/components/<feature>/`.
4. Use Tailwind utilities + CSS variables (`var(--color-surface)` etc.), not inline styles.

---

## What NOT to do

This app deliberately *isn't* a lot of things. Don't undo these choices:

- **Don't add authentication.** Single user, loopback-only.
- **Don't add Supabase / Postgres / any network database.** SQLite is the design.
- **Don't add rate limiting.** Single user.
- **Don't add Vercel-specific patterns.** No `export const maxDuration = …`, no `@vercel/analytics`, no Vercel cron, no `runtime = 'edge'`.
- **Don't add external CDN dependencies.** No remote fonts, no analytics scripts, no third-party widgets. The only outbound network is to the user's AI provider and Apple's APIs.
- **Don't add SEO metadata.** No Open Graph, no Twitter cards, no `robots`, no `sitemap.ts`, no JSON-LD. This is a loopback app — no one is crawling it.
- **Don't add multi-tenant fields.** No `user_id`, no `tier`, no `subscription_status`. The schema is single-user.
- **Don't add encryption-at-rest for credentials.** They live in `.env.local`; the env file is the trust boundary.
- **Don't add a distributed mutex / advisory locks.** It's one Node process; in-process `createMutex()` is enough.

If a user asks for any of the above, ask them to confirm — they may be misremembering an older SaaS version of this code.

---

## Style

- **TypeScript strict.** No `any` without a comment explaining why.
- **Naming:** PascalCase components, camelCase fns + vars, SCREAMING_SNAKE_CASE constants, kebab-case files.
- **Boolean props:** `is*` / `has*` / `can*` / `should*`.
- **CSS:** Tailwind utilities, theme via CSS variables in `globals.css`. No inline `style={{…}}` for colors.
- **Dark mode is default; light mode must also work.** Use `var(--color-surface)` etc., not hardcoded hex.
- **`cursor-pointer`** on every clickable element.
- **Comments:** explain WHY, not WHAT. Skip them if the code is self-explanatory.

---

## Commands

- `npm run dev` — Turbopack dev server
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint

No migrations command. SQLite schema applies automatically on first `getDb()` call.

---

## Tip

When in doubt, **mimic an existing implementation**. The codebase has 16 API routes and ~30 feature components that already exercise every convention above. Grep for one that's near the shape of what you're adding, then follow its structure.
