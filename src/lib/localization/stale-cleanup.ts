import 'server-only'
import { getDb } from '@/lib/db/client'
import { STALE_THRESHOLD_MS } from './constants'

/**
 * Reset jobs stuck in 'processing' beyond STALE_THRESHOLD_MS to 'interrupted'.
 * Server-only: imports the SQLite singleton.
 */
export function markStaleJobsInterrupted(): void {
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString()
  getDb()
    .prepare(
      `UPDATE localization_jobs
         SET status = 'interrupted', updated_at = datetime('now')
       WHERE status = 'processing' AND updated_at < ?`
    )
    .run(cutoff)
}
