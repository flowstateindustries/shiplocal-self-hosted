/**
 * App icon refresh
 *
 * Tracked apps (`selected_apps`) cache the App Store artwork URL that was
 * current when the app was added. Apple rotates those CDN URLs whenever the
 * icon changes, so the cached value goes stale (or 404s) over time. This
 * module re-reads the artwork URL from the iTunes Lookup API and writes it
 * back to the DB.
 */

import { getNumberEnv } from '@/lib/env'
import { mapWithConcurrency } from '@/lib/api/concurrent'
import { listSelectedApps, updateSelectedAppIcon } from '@/lib/db/queries'
import { getAppStoreInfoByAppId } from './api'

/** Apps looked up in parallel. iTunes is unauthenticated, so stay polite. */
const ICON_REFRESH_CONCURRENCY = () =>
  getNumberEnv('APP_ICON_REFRESH_CONCURRENCY', 4)

export interface IconRefreshSummary {
  checked: number
  updated: number
  failed: number
}

/**
 * Re-fetch the App Store icon for every tracked app and persist any change.
 *
 * A lookup that returns nothing (app not found, network error, rate limit)
 * leaves the existing icon in place — a stale icon beats a blank one.
 */
export async function refreshSelectedAppIcons(): Promise<IconRefreshSummary> {
  const apps = listSelectedApps()
  const summary: IconRefreshSummary = {
    checked: apps.length,
    updated: 0,
    failed: 0,
  }

  if (apps.length === 0) return summary

  await mapWithConcurrency(apps, ICON_REFRESH_CONCURRENCY(), async (app) => {
    const { iconUrl } = await getAppStoreInfoByAppId(app.app_id)

    if (!iconUrl) {
      summary.failed++
      return
    }

    if (iconUrl !== app.app_icon_url) {
      updateSelectedAppIcon(app.app_id, iconUrl)
      summary.updated++
    }
  })

  return summary
}
