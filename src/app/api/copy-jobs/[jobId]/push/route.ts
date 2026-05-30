import { NextRequest } from 'next/server'
import { sseErrorResponse, sseNotFoundResponse } from '@/lib/api/responses'
import { SSE_HEADERS } from '@/lib/api/sse'
import { getASCCredentials } from '@/lib/appstore/credentials'
import {
  getEditableVersion,
  getAppInfoId,
  getVersionLocalizationIds,
  getAppInfoLocalizationIds,
  updateVersionLocalization,
  createVersionLocalization,
  updateAppInfoLocalization,
  createAppInfoLocalization,
} from '@/lib/appstore/api'
import { APP_STORE_LOCALES } from '@/lib/localization/constants'
import { getCopyJob, updateCopyJob, claimCopyJobForPushing } from '@/lib/db/queries'
import type { CopyLocaleResult } from '@/lib/database/types'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

interface PushEvent {
  type:
    | 'starting'
    | 'preparing'
    | 'locale_start'
    | 'locale_complete'
    | 'locale_error'
    | 'complete'
    | 'error'
  locale?: string
  localeName?: string
  progress?: number
  totalLocales?: number
  completedLocales?: number
  message?: string
  error?: string
  successCount?: number
  failedCount?: number
}

/**
 * GET /api/copy-jobs/[jobId]/push
 * SSE endpoint that pushes copied metadata fields to the editable App Store version.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params

  const job = getCopyJob(jobId)
  if (!job) return sseNotFoundResponse('Job')

  if (job.pushed_to_asc) {
    return sseErrorResponse('This copy job has already been pushed to App Store Connect.', 400)
  }

  if (job.status !== 'completed') {
    return sseErrorResponse('Job is not ready to push.', 400)
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return sseErrorResponse(
      'No App Store Connect credentials found. Set them in .env.local.',
      400
    )
  }

  const claimed = claimCopyJobForPushing(jobId, ['completed'])
  if (!claimed) {
    return sseErrorResponse('Job is already being pushed or is not in a pushable state.', 409)
  }

  const localeResults: CopyLocaleResult[] = job.results?.locales ?? []
  const fieldsToCopy = new Set(job.fields_to_copy)
  const hasVersionFields = ['description', 'keywords', 'promotionalText', 'whatsNew'].some((f) =>
    fieldsToCopy.has(f)
  )
  const hasAppInfoFields = ['name', 'subtitle'].some((f) => fieldsToCopy.has(f))

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let isOpen = true

      const send = (event: PushEvent) => {
        if (!isOpen) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          isOpen = false
        }
      }

      let successCount = 0
      let failedCount = 0

      try {
        send({ type: 'starting', totalLocales: localeResults.length, completedLocales: 0, progress: 0 })
        send({ type: 'preparing', message: 'Fetching version and localization IDs…' })

        const versionResult = await getEditableVersion(credentials, job.app_id)
        if (!versionResult.success || !versionResult.data) {
          send({
            type: 'error',
            error:
              versionResult.error ||
              'No editable version found. Make sure a version is in PREPARE_FOR_SUBMISSION state.',
          })
          controller.close()
          return
        }
        const versionId = versionResult.data.id

        let versionLocMap = new Map<string, string>()
        if (hasVersionFields) {
          const versionLocsResult = await getVersionLocalizationIds(credentials, versionId)
          if (!versionLocsResult.success) {
            send({ type: 'error', error: versionLocsResult.error || 'Failed to fetch version localizations' })
            controller.close()
            return
          }
          versionLocMap = new Map((versionLocsResult.data ?? []).map((l) => [l.locale, l.id]))
        }

        let appInfoId: string | null = null
        let appInfoLocMap = new Map<string, string>()
        if (hasAppInfoFields) {
          const appInfoIdResult = await getAppInfoId(credentials, job.app_id)
          if (appInfoIdResult.success && appInfoIdResult.data) {
            appInfoId = appInfoIdResult.data
            const appInfoLocsResult = await getAppInfoLocalizationIds(credentials, appInfoId)
            if (appInfoLocsResult.success && appInfoLocsResult.data) {
              appInfoLocMap = new Map(appInfoLocsResult.data.map((l) => [l.locale, l.id]))
            }
          }
        }

        const total = localeResults.length
        let completed = 0

        for (const localeResult of localeResults) {
          const locale = localeResult.locale
          const localeName = APP_STORE_LOCALES[locale] ?? locale

          send({
            type: 'locale_start',
            locale,
            localeName,
            progress: Math.round((completed / total) * 100),
            totalLocales: total,
            completedLocales: completed,
          })

          let localeOk = true
          let localeError: string | undefined

          try {
            // App-level fields (name, subtitle)
            if (hasAppInfoFields && appInfoId) {
              const appInfoData: { name?: string; subtitle?: string } = {}
              if (localeResult.name) appInfoData.name = localeResult.name
              if (localeResult.subtitle) appInfoData.subtitle = localeResult.subtitle

              if (appInfoData.name || appInfoData.subtitle) {
                const existingId = appInfoLocMap.get(locale)
                if (existingId) {
                  const r = await updateAppInfoLocalization(credentials, existingId, {
                    name: appInfoData.name ?? '',
                    ...appInfoData,
                  })
                  if (!r.success) localeError = r.error
                } else if (appInfoData.name) {
                  const r = await createAppInfoLocalization(credentials, appInfoId, locale, {
                    name: appInfoData.name,
                    subtitle: appInfoData.subtitle,
                  })
                  if (!r.success) {
                    if (r.error?.includes('already exists')) {
                      const refetch = await getAppInfoLocalizationIds(credentials, appInfoId)
                      const existId = refetch.data?.find((l) => l.locale === locale)?.id
                      if (existId) {
                        await updateAppInfoLocalization(credentials, existId, { name: appInfoData.name!, ...appInfoData })
                      }
                    } else {
                      localeError = r.error
                    }
                  }
                }
              }
            }

            // Version-level fields
            if (hasVersionFields) {
              const versionData: Record<string, string> = {}
              if (localeResult.description) versionData.description = localeResult.description
              if (localeResult.keywords) versionData.keywords = localeResult.keywords
              if (localeResult.promotionalText) versionData.promotionalText = localeResult.promotionalText
              if (localeResult.whatsNew) versionData.whatsNew = localeResult.whatsNew

              if (Object.keys(versionData).length > 0) {
                const existingId = versionLocMap.get(locale)
                if (existingId) {
                  const r = await updateVersionLocalization(credentials, existingId, versionData)
                  if (!r.success) { localeOk = false; localeError = r.error }
                } else {
                  const r = await createVersionLocalization(credentials, versionId, locale, versionData)
                  if (!r.success) {
                    if (r.error?.includes('already exists')) {
                      const refetch = await getVersionLocalizationIds(credentials, versionId)
                      const existId = refetch.data?.find((l) => l.locale === locale)?.id
                      if (existId) {
                        const retry = await updateVersionLocalization(credentials, existId, versionData)
                        if (!retry.success) { localeOk = false; localeError = retry.error }
                      }
                    } else {
                      localeOk = false
                      localeError = r.error
                    }
                  }
                }
              }
            }
          } catch (err) {
            localeOk = false
            localeError = err instanceof Error ? err.message : String(err)
          }

          completed++
          if (localeOk) {
            successCount++
            send({
              type: 'locale_complete',
              locale,
              localeName,
              progress: Math.round((completed / total) * 100),
              totalLocales: total,
              completedLocales: completed,
            })
          } else {
            failedCount++
            send({
              type: 'locale_error',
              locale,
              localeName,
              error: localeError,
              progress: Math.round((completed / total) * 100),
              totalLocales: total,
              completedLocales: completed,
            })
          }
        }

        updateCopyJob(jobId, {
          status: 'completed',
          pushed_to_asc: true,
          pushed_at: new Date().toISOString(),
        })

        send({
          type: 'complete',
          progress: 100,
          totalLocales: total,
          completedLocales: completed,
          successCount,
          failedCount,
        })
      } catch (error) {
        console.error('Copy push stream error:', error)
        send({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        })
        updateCopyJob(jobId, { status: 'failed', error_message: String(error) })
      } finally {
        if (isOpen) {
          try { controller.close() } catch { /* already closed */ }
        }
        isOpen = false
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
