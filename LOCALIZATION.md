# How ShipLocal Works — Developer Reference

This document explains, in detail, how the two App-Store-facing domains of ShipLocal work: **metadata localization** (AI translation of App Store metadata) and **price localization** (purchasing-power price scaling). It is written for developers about to work on this code. The `.xcstrings` strings-translation domain is intentionally out of scope here.

> All file references are relative to the repo root. Line numbers are omitted on purpose — names drift less than positions.

---

## 1. Overview

ShipLocal is a self-hosted, **single-user, single-process** Next.js 16 (App Router, Turbopack) app. It has no auth and no multi-tenancy by design — it is meant to run loopback-only on your machine. All state lives in one local SQLite file (`./data/shiplocal.db`, WAL mode). There are no background workers: work runs inside HTTP request handlers and is streamed back to the browser.

Two domains are covered here, and they share one job machine:

| | Metadata localization | Price localization |
|---|---|---|
| What it does | Translates/adapts App Store metadata into other locales | Scales subscription/IAP prices per country by purchasing power |
| AI involved? | **Yes** (Claude or OpenAI) | **No** — deterministic math |
| Token/cost columns | Yes (`total_input_tokens`, `total_output_tokens`, `total_cost_cents`) | None |
| Table | `localization_jobs` | `pricing_jobs` |
| Data source | App Store Connect metadata | Bundled PPP dataset + Apple's fixed price points |

Both pull source data from App Store Connect (ASC), process it locally, let you review/edit, then push results back to ASC.

---

## 2. The shared job lifecycle (the core pattern)

Understanding this two-phase flow is the prerequisite for everything else. Both domains follow it identically.

### Two phases: create, then stream

1. **POST `/api/{localization,pricing}-jobs`** validates input and inserts a row with `status = 'pending'`. **All run configuration is stashed in a JSON blob on the row** — for localization in `results._config`, for pricing in `strategy`. The POST does **not** start any work.
2. **GET `/api/{...}-jobs/[jobId]/stream`** is where the work actually runs, streamed to the browser as **Server-Sent Events (SSE)**. The client opens this stream (via the `use-*-stream` hooks) both to *trigger* and to *watch* the job.

### Status states

```
pending ──claim──▶ processing ──┬──▶ completed   (all, or at least one, unit succeeded)
                                ├──▶ failed       (every unit failed)
                                └──▶ interrupted  (client disconnected / server restarted mid-run)
```

**Partial success resolves to `completed`.** A job with some failed locales/products still completes; the failures are visible per-unit and can be resumed.

- Localization: `determineFinalJobStatus(targetLocales, localeResults)` in `src/lib/localization/job-utils.ts` — `completed` if any locale succeeded once all are accounted for, else `failed`.
- Pricing: `determineFinalPricingStatus(productIds, productResults)` in `src/lib/pricing/job-utils.ts` — `failed` only if *every* product failed; otherwise `completed`.

### Atomic claim (prevents double-runs)

A double-click or double-opened stream must not run the same job twice. The stream route calls a claim function that flips the row to `processing` only if it is currently in an allowed state — a single conditional `UPDATE`:

```ts
// src/lib/db/queries.ts
export function claimLocalizationJobForProcessing(
  id: string,
  allowedFromStatuses: ReadonlyArray<LocalizationJob['status']>
): LocalizationJob | null {
  const placeholders = allowedFromStatuses.map(() => '?').join(', ')
  const info = getDb().prepare(
    `UPDATE localization_jobs
       SET status = 'processing', updated_at = datetime('now')
     WHERE id = ? AND status IN (${placeholders})`
  ).run(id, ...allowedFromStatuses)
  if (info.changes === 0) return null   // someone else already claimed it
  return getLocalizationJob(id)
}
```

`claimPricingJobForProcessing` is the pricing equivalent. The fresh `/stream` allows claiming from `['pending']`; the `/resume` route allows `['interrupted', 'failed']`.

### Stale recovery

If the server is killed mid-run, a job is stuck in `processing` forever. Every list/create/stream route first calls a stale sweeper that flips `processing` rows older than the threshold to `interrupted`:

- `markStaleJobsInterrupted()` — `src/lib/localization/stale-cleanup.ts`
- `markStalePricingJobsInterrupted()` — `src/lib/pricing/stale-cleanup.ts`

Both use `STALE_THRESHOLD_MS` (env `STALE_JOB_THRESHOLD_MS`, default 5 min) and a single `UPDATE ... WHERE status = 'processing' AND updated_at < ?`.

### Resume

`/resume` claims from `interrupted`/`failed`, then re-runs **only** the units not already marked complete:

- Localization: `getPendingLocales(targetLocales, localeResults)` returns locales with no result or `status !== 'complete'`. The route also re-emits already-completed locales to the client so the UI rebuilds its state.
- Pricing: skips products already `completed`, preserving their proposals.

### Concurrency & safety (single-process assumptions)

- **Worker pool**: `mapWithConcurrency(items, limit, fn)` in `src/lib/api/concurrent.ts` processes a fixed number of units in parallel using a shared index and N workers; returns `PromiseSettledResult[]` (mixed success/failure), preserving input order. Limit is `CONCURRENT_LOCALES` (default 3) / `CONCURRENT_PRICING_PRODUCTS` (default 2).
- **In-process DB mutex**: `createMutex()` (same file) serializes the read-modify-write of accumulated results when several units finish concurrently. It is correct **only** because this is a single Node process — do not assume it generalizes to multiple instances.

### SSE plumbing

`src/lib/api/sse.ts` exports `SSE_HEADERS`; `src/lib/api/responses.ts` has the JSON/SSE error helpers and content-type validation. Stream routes emit a `heartbeat` event every 15s and guard every `controller.enqueue` against a closed controller (client disconnect). On disconnect mid-run, the route marks the job `interrupted`.

---

## 3. Metadata localization

### 3.1 Pulling source metadata from ASC

The ASC client is a thin `fetch` wrapper in `src/lib/appstore/api.ts`; credentials live in `src/lib/appstore/credentials.ts`; the barrel `src/lib/appstore/index.ts` re-exports both metadata and pricing functions.

**Auth** — an ES256 JWT is minted per request from `ASC_*` env vars via `jose`:

- `getASCCredentials()` reads `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY`. The private key is stored with literal `\n` sequences; `normalizePrivateKey()` converts them back to real newlines (`.replace(/\\n/g, '\n').trim()`).
- `generateJWT(keyId, issuerId, privateKey)` signs with header `{ alg: 'ES256', kid: keyId }`, claims `iss`, `iat`, `exp` (now + 20 min), `aud: 'appstoreconnect-v1'`, importing the key via `importPKCS8(privateKey, 'ES256')`.
- `getAuthHeaders(...)` returns a `Headers` with `Authorization: Bearer <jwt>` + `Content-Type: application/json`.

**Two kinds of localization** — ASC splits metadata into two resources with separate get/create/update calls:

| Resource | Fields | Read | Write |
|---|---|---|---|
| **Version** localization (`appStoreVersionLocalizations`) | description, keywords, promotionalText, whatsNew, supportUrl, marketingUrl | `getVersionLocalizations`, `getVersionLocalizationIds` | `createVersionLocalization`, `updateVersionLocalization` |
| **App-info** localization (`appInfoLocalizations`) | name, subtitle, privacyPolicyUrl | `getAppInfoLocalization(s)`, `getAppInfoLocalizationIds` | `createAppInfoLocalization`, `updateAppInfoLocalization` |

Writes target the **editable** version; `EDITABLE_STATES` (`src/lib/appstore/types.ts`) gates which version is writable (`PREPARE_FOR_SUBMISSION`, `DEVELOPER_REJECTED`, `REJECTED`). The set of metadata-translatable locales is `APP_STORE_LOCALES` in `src/lib/localization/constants.ts` (38 locales).

### 3.2 Job creation — `POST /api/localization-jobs`

Validates `appId`, `appName`, `sourceLocale`, non-empty `targetLocales`, and that at least one field or `translateAppName` is selected. It builds a `JobConfig` (`src/lib/localization/types.ts`) and stashes it in `results._config`:

```ts
results = { _config: JobConfig, locales: [] }
```

`JobConfig` carries everything needed to (re)run the job without re-POSTing: `sourceContent`, `translateAppName`, `sourceAppInfo`, `brandName`, and the URL-replacement settings (per-field `*UrlReplacement`, `*UrlAllLocales`, `*UrlQueryEnabled`, `*UrlQueryPattern` for privacy/support/marketing). The row is inserted `pending`.

### 3.3 Running — `GET /api/localization-jobs/[jobId]/stream`

1. Sweep stale jobs, then `claimLocalizationJobForProcessing(jobId, ['pending'])`. Reject if already completed/processing.
2. Read config from `results._config`.
3. Process target locales via `mapWithConcurrency(..., CONCURRENT_LOCALES, ...)`. Per locale: call the orchestrator (§3.4), apply URL replacements (`src/lib/localization/url-utils.ts`), then under the DB mutex push the result into `results.locales` and set `locale_results[locale] = { status: 'complete', data }` (or `failed` + `error`), accumulating token counts and `total_cost_cents`. The `_config` is always re-written alongside `locales` so it survives every update.
4. After all locales: `determineFinalJobStatus(...)` sets the terminal status and `completed_at`.

**SSE events emitted:**

| Event | Meaning |
|---|---|
| `starting` | progress, totalLocales, completedLocales |
| `locale_start` | a locale began processing |
| `locale_complete` | a locale succeeded (carries data + appInfo) |
| `locale_error` | a locale failed (carries error) |
| `heartbeat` | 15s keepalive |
| `complete` / `error` | terminal |
| `cancelled` | job cancelled mid-stream |

### 3.4 AI orchestration — `src/lib/ai/`

> Note the location: the translation engine lives under **`src/lib/ai/`** (`localizer.ts`, `prompts.ts`, `utils.ts`, `cost.ts`), not under `src/lib/localization/`.

**Provider abstraction** (`src/lib/ai/providers/`): the `AIProvider` interface has a single `call(params)` returning `{ text, inputTokens, outputTokens }`. `ClaudeProvider` and `OpenAIProvider` implement it; OpenAI folds the `system` field into a leading system message since its API has no separate system param. Both honor `AI_TIMEOUT_MS`.

**Provider selection is driven entirely by the `AI_MODEL` env var** — there is no per-request choice. `getProvider()` (`providers/index.ts`) caches an instance keyed by model name and picks via `isOpenAIModel` (`gpt-*`/`o1*`/`o3*`/`o4-*` → OpenAI) vs everything else → Claude (unknown models default to Claude). Default model when unset: `gpt-4o-mini`. **When adding a model family, update the name-matching here.**

**Retry**: every AI call goes through `callAIWithRetry(params, maxRetries = 2)` in `localizer.ts` — up to 2 retries with **linear** backoff (500ms, then 1000ms):

```ts
const delay = 500 * (attempt + 1) // 0.5s, 1.0s backoff
```

**Translate vs. adapt**: `isSameLanguageVariant(source, target)` (`src/lib/ai/utils.ts`, backed by `LANGUAGE_VARIANTS` grouping e.g. `en-US`/`en-GB`/`en-AU`/`en-CA`) decides which prompt to use:

- **Translate** (different languages) — full translation; output must be entirely in the target language; URLs preserved verbatim.
- **Adapt** (same-language variants) — regional spelling/terminology/cultural adjustments only (e.g. `color → colour`), not a re-translation.

**JSON extraction is defensive** (`extractJsonFromResponse` + fallbacks in `localizer.ts`): (1) strip markdown code fences and sanitize control chars; (2) regex-match the outermost `{...}`; (3) last resort, pull each field out with a per-field regex and unescape. Keywords are then normalized (split on commas, trim, drop empties, rejoin without spaces).

**Character-limit enforcement** — App Store fields have hard caps (`FIELD_LIMITS` in `src/lib/localization/constants.ts`):

| Field | Limit |
|---|---|
| description | 4000 |
| keywords | 100 |
| promotionalText | 170 |
| whatsNew | 4000 |
| name | 30 |
| subtitle | 30 |

For any over-limit field, a 3-tier fallback runs: (1) **AI condense** — `condenseField()` asks the model to rewrite within the limit (URL-aware: URLs are high priority, other content is trimmed first); (2) **`smartTruncate`** — URL-aware truncation that prefers to keep a trailing URL block, then sentence boundaries (≥60% of limit), then word boundaries (≥80%); (3) hard cut at the exact limit.

**Brand-name preservation** — `translateAppInfo()` keeps your brand intact in the 30-char `name`. `extractBrandAndDescription(appName)` (`src/lib/ai/utils.ts`) splits names like `"Worldly - Country Travel Map"` into brand + descriptive part using heuristics (brand ≤20 chars, capitalized, single word) and separators (`" - "`, `" — "`, `" | "`, `": "`, `" by "`). Only the descriptive part is translated, then the name is reconstructed; the description's available char budget is `30 − brand.length − separator.length`. An explicit `brandName` in the config overrides extraction.

**Cost**: `calculateCostCents(inputTokens, outputTokens)` (`src/lib/ai/cost.ts`) multiplies accumulated tokens by per-model `MODEL_PRICING` ($ per 1M tokens). Condense calls add to the totals.

### 3.5 Review & edit — `PATCH /api/localization-jobs/[jobId]`

The preview page lets you hand-edit any generated field. PATCH validates every field length against `FIELD_LIMITS`, updates only `results.locales`, and preserves `_config`.

### 3.6 Push — `GET /api/localization-jobs/[jobId]/push`

Requires `status = 'completed'` and ASC credentials. Steps:

1. Fetch the editable version id; fetch existing version-localization ids (map locale → id); if app-level fields are in play, fetch the app-info id and its localization ids.
2. Per generated locale: create-or-update the **version** localization, and (if `translateAppName`/privacy URL) create-or-update the **app-info** localization. A "create" that returns *already exists* triggers a refetch-and-update retry (race handling).
3. If `*UrlAllLocales` is set, distribute the URL to all *other* locales too, building per-locale URLs from the configured query pattern.
4. On success, set `pushed_to_asc = true`, `pushed_at = now()`. The terminal event summarizes `success[]`, `failed[]`, `created[]`, `updated[]`, `appLevelCreated[]`, `appLevelUpdated[]`.

### 3.7 UI flow

`config → generating → preview → pushing`, under `src/app/(app)/localization/[appId]/`. The generating and pushing pages are driven by `useGenerationStream` and `usePushStream` (`src/hooks/`), which wrap an `EventSource` and a small per-locale state machine (`pending → processing → complete | error`). Both pages refetch the job when the tab regains focus, to catch a job that finished while backgrounded. The generating page can target `/resume` instead of `/stream` via an `isResume` flag.

---

## 4. Price localization

The pricing domain mirrors the job lifecycle above but has **no AI, no tokens, no cost columns** — it is deterministic math against Apple's fixed price points. Apple won't accept arbitrary prices, so every proposed price snaps to a real Apple price point in that territory's ladder.

### 4.1 The PPP dataset — `src/lib/pricing/ppp-data.ts`

`PPP_FACTORS: Record<string, PppEntry>` maps **175** App Store territories (ISO 3166-1 alpha-3 codes, e.g. `USA`, `IND`, `PAK`) to an affordability `factor` in `[0.25, 1.0]`, where the US is the anchor at `1.0`:

```
factor = round( clamp( GNIpcPPP(country) / GNIpcPPP(USA), 0.20, 1.00 ), 2 )
```

Source: World Bank GNI per capita PPP (NY.GNP.PCAP.PP.CD); USA denominator $83,090 (WDI 2024). Re-derive annually against the July refresh. The `currency` field on each entry is **informational only** — real pushed prices always use the currency ASC returns.

- `MIN_PPP_FACTOR = 0.25` — the live business floor, applied at compute time (raw 0.20–0.24 values are effectively lifted to 0.25).
- `getPppFactor(territory)` — returns the factor; **unknown territories return `1.0`** (no discount).
- `getPricingTerritories()` — territories with factor < 1.0. `getTerritoryName(territory)` — display name.

### 4.2 The calculator — `src/lib/pricing/calculator.ts`

Pure and deterministic. Three functions:

- **`effectiveFactor(territory, extraDiscount)`** — combines PPP with an optional global extra discount and clamps to the floor:
  ```ts
  const ppp = getPppFactor(territory)
  const clampedExtra = Math.min(Math.max(extraDiscount, 0), 0.9)
  return Math.max(ppp * (1 - clampedExtra), MIN_PPP_FACTOR)
  ```
- **`snapNearest(target, ladder)`** — picks the price point whose `customerPrice` is closest to `target`; **ties resolve to the cheaper** price; `null` for an empty ladder.
- **`computeTerritoryProposals(equalized, ladders, extraDiscount)`** — for each territory:
  1. `factor = effectiveFactor(territory, extraDiscount)`
  2. `targetPrice = reference.customerPrice * factor` (reference = Apple's equalized price point for that territory)
  3. `snapped = snapNearest(targetPrice, ladder)`
  4. **Skip if `snapped.id === reference.id`** — no actual change to preview or push.
  5. Emit `{ territory, currency, referencePrice, factor, targetPrice, pricePointId, proposedPrice }`.

  Proposals are sorted by territory code for stable output.

### 4.3 Compute optimization — `src/lib/pricing/compute.ts`

`computeProductProposal(...)` avoids fetching equalizations per-territory (which would be ~1000 ASC requests per product). Instead it: reads the base territory's current price and full ladder, fetches Apple's equalized reference per territory for the base point once, then **groups territories by the distinct base price point each discount tier snaps to**, and **fetches equalizations once per distinct snapped point**. This collapses the work to a few dozen requests per product.

### 4.4 ASC pricing client — `src/lib/appstore/pricing.ts`

This is a **separate** client from the metadata `api.ts` and is the one place that paginates ASC responses, because pricing endpoints return large lists.

- **`ascGetAll(credentials, path, signal)`** follows `links.next` until exhausted, accumulating `data` + `included` across pages. Guardrails: `MAX_PAGES = 60`; transient 429/5xx retried with backoff up to `MAX_RETRIES = 8`; global throttle `MIN_REQUEST_INTERVAL_MS = 150` (~6–7 req/s); a 429 triggers a `RATE_LIMIT_COOLDOWN_MS = 5000` cooldown shared by all workers; an aborted `signal` (client disconnect) stops in-flight work immediately.
- **Discovery**: `listAppPricingProducts` (auto-renewable subscriptions + `inAppPurchasesV2`), `getProductPricePoints` (every available point per territory; fetches territories in parallel when given a list), `getBasePricePoint` (current price in the base territory — IAP reads its price schedule, subscription filters current prices).
- **Equalization**: `getEqualizedPricePoints(credentials, type, basePricePointId, signal)` returns Apple's per-territory equivalent of a base point (`/v1/subscriptionPricePoints/{id}/equalizations` or `/v1/inAppPurchasePricePoints/{id}/equalizations`).
- **Writing — the key subscription vs. IAP distinction**:
  - **Subscriptions** are priced **one territory per POST** — `pushSubscriptionPrice(...)` POSTs to `/v1/subscriptionPrices` (with `preserveCurrentPrice: false`), called per territory (4 concurrent at push time).
  - **IAPs** use a **single price schedule covering all territories** — `pushIapPriceSchedule(...)` POSTs one `/v1/inAppPurchasePriceSchedules`.
  - `startDate` is `YYYY-MM-DD`. ASC may reject a date that's too early; `parseMinStartDate(error)` extracts Apple's minimum from the 409 so the push can adopt it and retry.

> The ASC resource/attribute names here are the least stable part of the codebase. If requests start failing, verify against Apple's current ASC OpenAPI spec.

### 4.5 Job lifecycle

- **`POST /api/pricing-jobs`** validates app + products, clamps `extraDiscount` to `[0, 0.9]`, defaults `startDate` to +2 days (bumped past weekends/holidays), and stashes the `PricingJobConfig` (`baseTerritory`, `extraDiscount`, `products`, `startDate`) in the `strategy` column. Row inserted `pending` with `product_results = { [id]: { status: 'pending' } }`.
- **`GET /api/pricing-jobs/[jobId]/stream`** — sweep stale, `claimPricingJobForProcessing(jobId, ['pending'])`, compute each product via `mapWithConcurrency(..., CONCURRENT_PRICING_PRODUCTS, ...)` under the DB mutex, terminal status via `determineFinalPricingStatus`. SSE events: `starting`, `product_start`, `product_complete` / `product_error`, `complete` / `error`, `heartbeat`.
- **`GET /api/pricing-jobs/[jobId]/resume`** — claims from `['interrupted', 'failed']`, reruns only non-completed products (see `src/lib/pricing/run-compute-stream.ts`).
- **`PATCH /api/pricing-jobs/[jobId]`** — save per-territory price-point overrides from the preview UI; rejected once `pushed_to_asc` is true.
- **`GET /api/pricing-jobs/[jobId]/push`** — requires `completed`. SSE adds a `territory_progress` event (pushedTerritories/failedTerritories/totalTerritories). Subscriptions push per-territory (4 concurrent); IAPs push one schedule. Sets `pushed_to_asc`/`pushed_at`; returns the effective start date Apple actually accepted (in case a 409 forced a bump).
- **Supporting data routes**: `GET /api/pricing-jobs/products?appId=...` and `GET /api/pricing-jobs/price-points?type=...&productId=...` (ladders for the preview overrides).

### 4.6 UI flow

`pricing form → generating → preview → pushing → success`, under `src/app/(app)/pricing/`. Driven by `usePricingCompute` and `usePricingPush` (`src/hooks/use-pricing-stream.ts`). The form offers app/product selection, base-territory dropdown, an extra-discount slider (0–90%), and a start-date picker. Preview shows per-territory `referencePrice / factor / targetPrice / proposedPrice` and allows overriding the chosen price point per territory.

---

## 5. Data model

### Tables (`src/lib/db/schema.ts`)

Applied on first DB access via `CREATE TABLE IF NOT EXISTS` — there is no migrations command. To reset, stop the server and delete `./data/shiplocal.db*`.

**`localization_jobs`**: `id`, `app_id`, `app_name`, `app_icon_url`, `source_locale`, `target_locales` (JSON), `fields_localized` (JSON), `status`, `results` (JSON), `locale_results` (JSON), `error_message`, `pushed_to_asc`, `pushed_at`, `total_input_tokens`, `total_output_tokens`, `total_cost_cents`, `ai_model`, `created_at`, `updated_at`, `completed_at`.

**`pricing_jobs`**: `id`, `app_id`, `app_name`, `app_icon_url`, `base_territory` (default `'USA'`), `product_ids` (JSON), `strategy` (JSON config), `status`, `results` (JSON), `product_results` (JSON, default `'{}'`), `error_message`, `pushed_to_asc`, `pushed_at`, `created_at`, `updated_at`, `completed_at`. **Note: no token/cost columns.**

### Two directories — don't confuse them

- **`src/lib/db/`** is the **real** data layer: `client.ts` (the `better-sqlite3` singleton via `getDb()`, WAL, `parseJsonColumn`/`stringifyJsonColumn` helpers, `newId()`), `schema.ts`, and `queries.ts` (typed CRUD + the atomic claim functions). Use this for any DB work.
- **`src/lib/database/`** only re-exports **types** (`database/types.ts`). Imports like `@/lib/database/types` are intentional and refer to these shared row/insert shapes. Runtime queries always come from `@/lib/db/queries`.

JSON columns (`results`, `locale_results`, `target_locales`, `product_results`, `strategy`, …) are stored as TEXT and parsed/stringified by the `db/client.ts` helpers; rows returned from `queries.ts` already have these fields as parsed TS objects. `updateLocalizationJob`/`updatePricingJob` serialize JSON fields automatically and bump `updated_at` on every call.

### Key shapes (`src/lib/database/types.ts`, `src/lib/{localization,pricing}/types.ts`)

Localization `results` blob:

```jsonc
{
  "_config": { /* JobConfig: sourceContent, translateAppName, brandName, url settings, ... */ },
  "locales": [
    { "locale": "fr-FR", "description": "…", "keywords": "…",
      "promotionalText": "…", "whatsNew": "…", "name": "…", "subtitle": "…" }
  ]
}
```

Localization `locale_results` map:

```jsonc
{
  "fr-FR": { "status": "complete", "data": { "locale": "fr-FR", "description": "…" } },
  "de-DE": { "status": "failed", "error": "…" }
}
```

Pricing `results` blob holds `_config: PricingJobConfig` and `products: ProductPriceProposal[]`, where each `ProductPriceProposal` has `basePricePointId`, `baseTerritory`, `basePrice`, `territories: TerritoryPriceProposal[]`, and optional `missingTerritories[]`. `product_results` maps product id → `{ status, error?, territoryCount? }`.

---

## 6. Configuration / env knobs

Secrets and tuning go in `.env.local` (see `.env.example`). Editing `.env.local` requires a **server restart**. Perf knobs are read through `getNumberEnv` (`src/lib/env.ts`), which falls back to the default on unset/blank/NaN/below-min values — don't read these with raw `parseInt`.

| Var | Purpose | Default |
|---|---|---|
| `AI_MODEL` | Selects provider + pricing; e.g. `claude-sonnet-4-…`, `gpt-4o-mini` | `gpt-4o-mini` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | Provider key (whichever `AI_MODEL` implies) | — |
| `ASC_ISSUER_ID` / `ASC_KEY_ID` / `ASC_PRIVATE_KEY` | ASC JWT credentials (key uses literal `\n`) | — |
| `CONCURRENT_LOCALES` | Locales translated in parallel | 3 |
| `CONCURRENT_PRICING_PRODUCTS` | Products computed/pushed in parallel | 2 |
| `AI_TIMEOUT_MS` | Per-AI-call timeout | 30000 |
| `STALE_JOB_THRESHOLD_MS` | When a `processing` job is treated as stale | 300000 |
| `DATA_DIR` | SQLite directory (`{DATA_DIR}/shiplocal.db`) | `./data` |

---

## 7. End-to-end sequence (text)

**Metadata localization**

1. `POST /api/localization-jobs` → validate → insert `pending` with `JobConfig` in `results._config`.
2. Client opens `GET /api/localization-jobs/[jobId]/stream` → `markStaleJobsInterrupted()` → `claimLocalizationJobForProcessing(id, ['pending'])`.
3. `mapWithConcurrency` over target locales → per locale: translate-or-adapt via `src/lib/ai/localizer.ts` (`callAIWithRetry` → provider) → enforce `FIELD_LIMITS` (condense → `smartTruncate`) → preserve brand in `translateAppInfo` → apply URL replacements → mutex-guarded DB write + cost accumulation. SSE `locale_start`/`locale_complete`/`locale_error`.
4. `determineFinalJobStatus` → set terminal status + `completed_at`. SSE `complete`.
5. Review/edit → `PATCH` (validated against `FIELD_LIMITS`).
6. `GET .../push` → fetch ids → per-locale create/update version + app-info localizations (with already-exists retry) → optional all-locales URL distribution → set `pushed_to_asc`/`pushed_at`.

**Price localization**

1. `POST /api/pricing-jobs` → validate, clamp `extraDiscount`∈[0,0.9], default `startDate` +2d → insert `pending` with `PricingJobConfig` in `strategy`.
2. Client opens `GET /api/pricing-jobs/[jobId]/stream` → `markStalePricingJobsInterrupted()` → `claimPricingJobForProcessing(id, ['pending'])`.
3. `mapWithConcurrency` over products → per product: `getBasePricePoint` + `getProductPricePoints` + `getEqualizedPricePoints`, group by distinct snapped base point, equalize each once → `computeTerritoryProposals` (`effectiveFactor` → `targetPrice` → `snapNearest`, skip no-change) → mutex-guarded DB write. SSE `product_*`.
4. `determineFinalPricingStatus` → terminal status. SSE `complete`.
5. Preview → optional per-territory overrides → `PATCH`.
6. `GET .../push` → subscriptions: `pushSubscriptionPrice` per territory (4 concurrent); IAPs: one `pushIapPriceSchedule`; 409 → adopt Apple's min start date and retry → set `pushed_to_asc`/`pushed_at`, report effective start date.
