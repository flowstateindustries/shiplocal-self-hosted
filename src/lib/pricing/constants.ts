/**
 * Pricing domain constants and env-tunable knobs.
 *
 * Perf knobs are env-overridable via `.env.local`:
 *   CONCURRENT_PRICING_PRODUCTS, STALE_JOB_THRESHOLD_MS
 */

import { getNumberEnv } from '@/lib/env'

/**
 * Number of products (subscriptions / IAPs) whose prices are computed or
 * pushed in parallel. Each product fans out across many territories, so keep
 * this modest to stay under App Store Connect rate limits.
 * Override via `CONCURRENT_PRICING_PRODUCTS`. Default: 2.
 */
export const CONCURRENT_PRICING_PRODUCTS = getNumberEnv(
  'CONCURRENT_PRICING_PRODUCTS',
  2
)

/** Default base/reference territory for affordability calculations. */
export const DEFAULT_BASE_TERRITORY = 'USA'
