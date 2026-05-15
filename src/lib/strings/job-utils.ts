import 'server-only'
import { getDb } from '@/lib/db/client'
import { STRINGS_STALE_THRESHOLD_MS } from './constants'

/**
 * Reset strings jobs stuck in 'processing' beyond STRINGS_STALE_THRESHOLD_MS
 * to 'interrupted'. Server-only: imports the SQLite singleton.
 */
export function markStaleStringsJobsInterrupted(): void {
  const cutoff = new Date(Date.now() - STRINGS_STALE_THRESHOLD_MS).toISOString()
  getDb()
    .prepare(
      `UPDATE strings_jobs
         SET status = 'interrupted', updated_at = datetime('now')
       WHERE status = 'processing' AND updated_at < ?`
    )
    .run(cutoff)
}
