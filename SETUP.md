# ShipLocal — Self-Hosted Setup

ShipLocal localizes App Store metadata and `.xcstrings` files locally.
No accounts, no payments, no cloud database — everything runs against a
SQLite file under `./data/` and an AI API key.

## Prerequisites

- Node.js 20+
- An AI provider API key (Anthropic or OpenAI)
- App Store Connect API access (Issuer ID, Key ID, and a `.p8` private key)

> **Existing ShipLocal SaaS users:** this is a fresh local install. Your previous translation history is **not** migrated — you'll start with an empty database. You'll also need your own Anthropic or OpenAI API key (previously bundled in your subscription).

## Steps

1. **Clone & install**

   ```bash
   git clone https://github.com/flowstateindustries/shiplocal-self-hosted.git shiplocal
   cd shiplocal
   npm install
   ```

2. **Configure `.env.local`**

   Copy the example file and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   The required variables:

   - `AI_MODEL` — e.g. `gpt-4o-mini` or `claude-3-haiku-20240307`
   - `ANTHROPIC_API_KEY` *or* `OPENAI_API_KEY` (matching the model)
   - `ASC_ISSUER_ID`, `ASC_KEY_ID`, `ASC_PRIVATE_KEY`

   Optional knobs:

   - `DATA_DIR` — override the SQLite data directory (defaults to `./data`)
   - `CONCURRENT_LOCALES` — locales to process in parallel per job (default `3`)
   - `AI_TIMEOUT_MS` — per-AI-call timeout in ms (default `30000`)
   - `STRINGS_BATCH_SIZE` — `.xcstrings`: strings per AI batch (default `50`)
   - `STRINGS_MAX_CHARS_PER_BATCH` — `.xcstrings`: char ceiling per AI batch (default `8000`)
   - `STALE_JOB_THRESHOLD_MS` — ms before a stuck `processing` job is marked `interrupted` (default `300000`)

   The private key has real newlines. Replace each newline with the literal
   two-character sequence `\n` and wrap the value in double quotes so it
   stays on a single line in the env file.

3. **Run it**

   ```bash
   npm run dev
   ```

   The SQLite database is created automatically at `./data/shiplocal.db` on
   first run. Open <http://localhost:3000> and click **Open Dashboard**.

## Getting App Store Connect credentials

1. Sign in to [App Store Connect](https://appstoreconnect.apple.com/access/integrations/api).
2. Open **Users and Access → Integrations → App Store Connect API**.
3. Click the **+** button to create a new key with **App Manager** access.
4. Download the `.p8` private key file (it is only offered once).
5. Copy:
   - the **Issuer ID** shown at the top of the page → `ASC_ISSUER_ID`
   - the **Key ID** for the row you just created → `ASC_KEY_ID`
   - the contents of the `.p8` file (with `\n` replacing real newlines) → `ASC_PRIVATE_KEY`

Restart `npm run dev` after editing `.env.local`.

## Where data lives

- SQLite database: `./data/shiplocal.db` (jobs, selected apps, results)
- Override the directory with `DATA_DIR=/some/path` in `.env.local`
- Back up the file directly to preserve job history

### Upgrading from an earlier build

If you ran an older version of this app, the existing SQLite file may have
columns (`bundle_id`, `sku`) that were removed in a later cleanup. The new
schema simply doesn't reference them, so they're harmless — but if you want
a clean slate, stop the dev server and delete `./data/shiplocal.db*`. The
schema is rebuilt automatically on next run; you'll lose local job history.

## Modifying ShipLocal

If you point an AI coding agent (Claude Code, Cursor, Aider, etc.) at this repo to add features or fix bugs, have it read **[editing.md](editing.md)** first. It documents the codebase layout, database schema, conventions, and the design choices an agent shouldn't accidentally undo (no auth, no Supabase, no Vercel-specific patterns, etc.).

## Useful commands

- `npm run dev` — run the dev server (Turbopack)
- `npm run build` — production build
- `npm run start` — serve the production build
- `npm run lint` — ESLint
