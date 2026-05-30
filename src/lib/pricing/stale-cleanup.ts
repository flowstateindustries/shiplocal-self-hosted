import 'server-only'
import { getDb } from '@/lib/db/client'
import { STALE_THRESHOLD_MS } from '@/lib/localization/constants'

/**
 * Reset pricing jobs stuck in 'processing' beyond STALE_THRESHOLD_MS to
 * 'interrupted'. Recovers jobs orphaned by a dev-server restart mid-run.
 */
export function markStalePricingJobsInterrupted(): void {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()
  getDb()
    .prepare(
      `UPDATE pricing_jobs
         SET status = 'interrupted', updated_at = datetime('now')
       WHERE status = 'processing' AND updated_at < ?`
    )
    .run(cutoff)
}
