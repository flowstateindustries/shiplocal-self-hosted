/**
 * Next.js instrumentation hook — runs once per server start (dev and prod).
 *
 * Used to refresh the cached App Store icons for tracked apps, so a restart
 * is all it takes to pick up new artwork. The refresh is fire-and-forget:
 * it must never delay the server coming up, and a failure is never fatal.
 */

export async function register(): Promise<void> {
  // Only the Node runtime has SQLite; skip the edge runtime and `next build`.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return

  if (process.env.REFRESH_APP_ICONS_ON_START === 'false') {
    return
  }

  const { refreshSelectedAppIcons } = await import('@/lib/appstore/app-icons')

  void refreshSelectedAppIcons()
    .then(({ checked, updated, failed }) => {
      if (checked === 0) return
      console.log(
        `[app-icons] Refreshed ${checked} app icon(s): ${updated} updated, ${failed} lookup failure(s)`
      )
    })
    .catch((error) => {
      console.error('[app-icons] Icon refresh failed:', error)
    })
}
