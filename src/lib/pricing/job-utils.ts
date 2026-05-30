import type { JobStatus, PricingProductStatus } from '@/lib/database/types'

/**
 * Decide a pricing job's terminal status from its per-product results.
 * Mirrors the localization rule: all-failed is `failed`, anything else is
 * `completed` (partial success still completes; failures are visible per
 * product in the preview).
 */
export function determineFinalPricingStatus(
  productIds: string[],
  productResults: Record<string, PricingProductStatus>
): JobStatus {
  if (productIds.length === 0) return 'completed'
  const allFailed = productIds.every(
    (id) => productResults[id]?.status === 'failed'
  )
  return allFailed ? 'failed' : 'completed'
}
