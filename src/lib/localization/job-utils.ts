/**
 * Pure utility functions for resumable localization jobs.
 * Client-safe: no database imports. See `stale-cleanup.ts` for the
 * server-only stale-job sweeper.
 */

import type { LocaleResultStatus } from '@/lib/database/types'

/**
 * Return locales that still need to be processed (no result or status=failed).
 */
export function getPendingLocales(
  targetLocales: string[],
  localeResults: Record<string, LocaleResultStatus> | null
): string[] {
  if (!localeResults) return targetLocales
  return targetLocales.filter((locale) => {
    const result = localeResults[locale]
    return !result || result.status !== 'complete'
  })
}

export function getCompletedLocaleCount(
  localeResults: Record<string, LocaleResultStatus> | null
): number {
  if (!localeResults) return 0
  return Object.values(localeResults).filter((r) => r.status === 'complete').length
}

export function getFailedLocaleCount(
  localeResults: Record<string, LocaleResultStatus> | null
): number {
  if (!localeResults) return 0
  return Object.values(localeResults).filter((r) => r.status === 'failed').length
}

export function canResumeJob(
  status: string,
  targetLocales: string[],
  localeResults: Record<string, LocaleResultStatus> | null
): boolean {
  if (status !== 'failed' && status !== 'interrupted') return false
  return getPendingLocales(targetLocales, localeResults).length > 0
}

export function mergeLocaleResults(
  existing: Record<string, LocaleResultStatus> | null,
  newResults: Record<string, LocaleResultStatus>
): Record<string, LocaleResultStatus> {
  return { ...(existing || {}), ...newResults }
}

export function getJobProgress(
  targetLocales: string[],
  localeResults: Record<string, LocaleResultStatus> | null
): number {
  if (!targetLocales.length) return 0
  const completed = getCompletedLocaleCount(localeResults)
  return Math.round((completed / targetLocales.length) * 100)
}

/**
 * Final job status — 'completed' if any locale succeeded, 'failed' if all failed.
 */
export function determineFinalJobStatus(
  targetLocales: string[],
  localeResults: Record<string, LocaleResultStatus> | null
): 'completed' | 'failed' {
  if (!localeResults) return 'failed'
  const completed = getCompletedLocaleCount(localeResults)
  const failed = getFailedLocaleCount(localeResults)
  if (completed === targetLocales.length) return 'completed'
  if (completed + failed === targetLocales.length) {
    return completed > 0 ? 'completed' : 'failed'
  }
  return 'failed'
}
