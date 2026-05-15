/**
 * String Translation Constants — perf knobs for .xcstrings translation.
 *
 * Env-overridable via `.env.local`:
 *   STRINGS_BATCH_SIZE, STRINGS_MAX_CHARS_PER_BATCH, CONCURRENT_LOCALES, STALE_JOB_THRESHOLD_MS
 */

import { getNumberEnv } from '@/lib/env'

/** Number of strings per AI call batch. Override via `STRINGS_BATCH_SIZE`. Default: 50. */
export const STRINGS_BATCH_SIZE = getNumberEnv('STRINGS_BATCH_SIZE', 50)

/**
 * Max characters per AI batch (caps the AI context window per request).
 * Override via `STRINGS_MAX_CHARS_PER_BATCH`. Default: 8000.
 */
export const STRINGS_MAX_CHARS_PER_BATCH = getNumberEnv('STRINGS_MAX_CHARS_PER_BATCH', 8000)

/** Re-export the localization layer's stale threshold so both flows share one source of truth. */
export { STALE_THRESHOLD_MS as STRINGS_STALE_THRESHOLD_MS } from '@/lib/localization/constants'

/** Re-export the shared concurrency knob. */
export { CONCURRENT_LOCALES } from '@/lib/localization/constants'
