import { NextRequest } from 'next/server'
import { sseErrorResponse, sseNotFoundResponse } from '@/lib/api/responses'
import { SSE_HEADERS } from '@/lib/api/sse'
import { mapWithConcurrency, createMutex } from '@/lib/api/concurrent'
import { localizeForLocale, applyUrlReplacements } from '@/lib/ai'
import { calculateCostCents } from '@/lib/ai/cost'
import { getModel } from '@/lib/ai/providers'
import {
  APP_STORE_LOCALES,
  CONCURRENT_LOCALES,
} from '@/lib/localization/constants'
import {
  determineFinalJobStatus,
  getPendingLocales,
} from '@/lib/localization/job-utils'
import { markStaleJobsInterrupted } from '@/lib/localization/stale-cleanup'
import type { LocaleResult, LocaleResultStatus } from '@/lib/database/types'
import type { StreamEvent, LocalizationOutput } from '@/lib/ai/types'
import type { JobConfig } from '@/lib/localization/types'
import {
  claimLocalizationJobForProcessing,
  getLocalizationJob,
  updateLocalizationJob,
} from '@/lib/db/queries'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

interface LocaleProcessResult {
  locale: string
  success: boolean
  result?: LocaleResult
  error?: string
  inputTokens: number
  outputTokens: number
}

/**
 * GET /api/localization-jobs/[jobId]/resume
 * Resume a failed/interrupted job, processing only pending locales.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params

  const job = getLocalizationJob(jobId)
  if (!job) return sseNotFoundResponse('Job')

  if (job.status === 'completed') {
    return sseErrorResponse('Job already completed', 400)
  }
  if (job.status === 'pending') {
    return sseErrorResponse(
      'Job has not started yet. Use the stream endpoint instead.',
      400
    )
  }
  if (job.status === 'processing') {
    return sseErrorResponse(
      'Job is currently being processed. Please wait for it to complete or fail.',
      400
    )
  }
  if (job.status !== 'failed' && job.status !== 'interrupted') {
    return sseErrorResponse('Job cannot be resumed', 400)
  }

  const config: JobConfig | null = job.results?._config || null
  const configToPreserve = job.results?._config
  const existingLocales = job.results?.locales || []
  if (!config) return sseErrorResponse('Job configuration not found', 400)

  const targetLocales = job.target_locales
  const existingLocaleResults = job.locale_results || {}
  const pendingLocales = getPendingLocales(targetLocales, existingLocaleResults)

  if (pendingLocales.length === 0) {
    return sseErrorResponse(
      'No pending locales to process. Job appears complete.',
      400
    )
  }

  markStaleJobsInterrupted()

  const claimed = claimLocalizationJobForProcessing(jobId, [
    'failed',
    'interrupted',
  ])
  if (!claimed) {
    return sseErrorResponse(
      'Job cannot be resumed - status may have changed',
      400
    )
  }
  updateLocalizationJob(jobId, { error_message: null, ai_model: getModel() })

  const encoder = new TextEncoder()
  const fields = job.fields_localized.filter((f) => f !== 'appName')
  const translateAppName = config.translateAppName

  const stream = new ReadableStream({
    async start(controller) {
      let isControllerOpen = true

      const sendEvent = (event: StreamEvent) => {
        if (!isControllerOpen) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          isControllerOpen = false
        }
      }

      const heartbeatInterval = setInterval(() => {
        if (isControllerOpen) sendEvent({ type: 'heartbeat' })
      }, 15000)

      const dbMutex = createMutex()

      try {
        const alreadyCompleted = targetLocales.length - pendingLocales.length

        sendEvent({
          type: 'starting',
          progress: Math.round(
            (alreadyCompleted / targetLocales.length) * 100
          ),
          totalLocales: targetLocales.length,
          completedLocales: alreadyCompleted,
        })

        for (const locale of targetLocales) {
          const localeStatus = existingLocaleResults[locale]
          if (localeStatus?.status === 'complete') {
            const localeName = APP_STORE_LOCALES[locale] || locale
            const existingResult = existingLocales.find(
              (l) => l.locale === locale
            )
            sendEvent({
              type: 'locale_complete',
              locale,
              localeName,
              data: existingResult
                ? {
                    description: existingResult.description,
                    keywords: existingResult.keywords,
                    promotionalText: existingResult.promotionalText,
                    whatsNew: existingResult.whatsNew,
                  }
                : undefined,
              appInfo: existingResult?.name
                ? {
                    name: existingResult.name,
                    subtitle: existingResult.subtitle ?? '',
                  }
                : undefined,
              progress: Math.round(
                (alreadyCompleted / targetLocales.length) * 100
              ),
              totalLocales: targetLocales.length,
              completedLocales: alreadyCompleted,
            })
          }
        }

        const results: LocaleResult[] = [...existingLocales]
        const localeResults: Record<string, LocaleResultStatus> = {
          ...existingLocaleResults,
        }
        let completedCount = alreadyCompleted
        let totalInputTokens = job.total_input_tokens || 0
        let totalOutputTokens = job.total_output_tokens || 0

        const processLocale = async (
          locale: string
        ): Promise<LocaleProcessResult> => {
          const current = getLocalizationJob(jobId)
          if (current?.status !== 'processing') {
            return {
              locale,
              success: false,
              error: 'Job was cancelled',
              inputTokens: 0,
              outputTokens: 0,
            }
          }

          const localeName = APP_STORE_LOCALES[locale] || locale

          sendEvent({
            type: 'locale_start',
            locale,
            localeName,
            progress: Math.round((completedCount / targetLocales.length) * 100),
            totalLocales: targetLocales.length,
            completedLocales: completedCount,
          })

          try {
            const sourceMetadata = {
              description: config.sourceContent.description || undefined,
              keywords: config.sourceContent.keywords || undefined,
              promotionalText: config.sourceContent.promotionalText || undefined,
              whatsNew: config.sourceContent.whatsNew || undefined,
            }

            const appInfo =
              config.sourceAppInfo && translateAppName
                ? {
                    name: config.sourceAppInfo.name || '',
                    subtitle: config.sourceAppInfo.subtitle,
                  }
                : undefined

            const result = await localizeForLocale(
              job.source_locale,
              locale,
              sourceMetadata,
              fields,
              appInfo,
              translateAppName,
              config.brandName || undefined
            )

            if (!result.success) {
              sendEvent({
                type: 'locale_error',
                locale,
                localeName,
                error: result.error,
                progress: Math.round((completedCount / targetLocales.length) * 100),
                totalLocales: targetLocales.length,
                completedLocales: completedCount,
              })

              await dbMutex.acquire()
              try {
                localeResults[locale] = {
                  status: 'failed',
                  error: result.error || 'Unknown error',
                }
                updateLocalizationJob(jobId, {
                  results: { _config: configToPreserve, locales: results },
                  locale_results: localeResults,
                  total_input_tokens: totalInputTokens,
                  total_output_tokens: totalOutputTokens,
                  total_cost_cents: calculateCostCents(
                    totalInputTokens,
                    totalOutputTokens
                  ),
                })
              } finally {
                dbMutex.release()
              }

              return {
                locale,
                success: false,
                error: result.error,
                inputTokens: 0,
                outputTokens: 0,
              }
            }

            const localeInputTokens = result.usage?.inputTokens || 0
            const localeOutputTokens = result.usage?.outputTokens || 0

            let localizedData = result.data as LocalizationOutput | undefined
            if (localizedData?.description && config.urlReplacements.length > 0) {
              localizedData = {
                ...localizedData,
                description: applyUrlReplacements(
                  localizedData.description,
                  config.urlReplacements
                ),
              }
            }

            const localeResult: LocaleResult = {
              locale,
              description: localizedData?.description,
              keywords: localizedData?.keywords,
              promotionalText: localizedData?.promotionalText,
              whatsNew: localizedData?.whatsNew,
              name: result.appInfo?.name,
              subtitle: result.appInfo?.subtitle,
            }

            await dbMutex.acquire()
            try {
              const existingIndex = results.findIndex(
                (r) => r.locale === locale
              )
              if (existingIndex >= 0) {
                results[existingIndex] = localeResult
              } else {
                results.push(localeResult)
              }
              localeResults[locale] = { status: 'complete', data: localeResult }
              totalInputTokens += localeInputTokens
              totalOutputTokens += localeOutputTokens
              completedCount++

              updateLocalizationJob(jobId, {
                results: { _config: configToPreserve, locales: results },
                locale_results: localeResults,
                total_input_tokens: totalInputTokens,
                total_output_tokens: totalOutputTokens,
                total_cost_cents: calculateCostCents(
                  totalInputTokens,
                  totalOutputTokens
                ),
              })

              sendEvent({
                type: 'locale_complete',
                locale,
                localeName,
                data: localizedData,
                appInfo: result.appInfo,
                progress: Math.round(
                  (completedCount / targetLocales.length) * 100
                ),
                totalLocales: targetLocales.length,
                completedLocales: completedCount,
              })
            } finally {
              dbMutex.release()
            }

            return {
              locale,
              success: true,
              result: localeResult,
              inputTokens: localeInputTokens,
              outputTokens: localeOutputTokens,
            }
          } catch (localeError) {
            console.error(`Error processing locale ${locale}:`, localeError)
            const errorMessage =
              localeError instanceof Error
                ? localeError.message
                : String(localeError)

            sendEvent({
              type: 'locale_error',
              locale,
              localeName,
              error: errorMessage,
              progress: Math.round((completedCount / targetLocales.length) * 100),
              totalLocales: targetLocales.length,
              completedLocales: completedCount,
            })

            await dbMutex.acquire()
            try {
              localeResults[locale] = { status: 'failed', error: errorMessage }
              updateLocalizationJob(jobId, {
                results: { _config: configToPreserve, locales: results },
                locale_results: localeResults,
                total_input_tokens: totalInputTokens,
                total_output_tokens: totalOutputTokens,
                total_cost_cents: calculateCostCents(
                  totalInputTokens,
                  totalOutputTokens
                ),
              })
            } finally {
              dbMutex.release()
            }

            return {
              locale,
              success: false,
              error: errorMessage,
              inputTokens: 0,
              outputTokens: 0,
            }
          }
        }

        await mapWithConcurrency(pendingLocales, CONCURRENT_LOCALES, processLocale)

        if (!isControllerOpen) {
          const current = getLocalizationJob(jobId)
          if (current?.status === 'processing') {
            updateLocalizationJob(jobId, { status: 'interrupted' })
          }
          return
        }

        const totalCostCents = calculateCostCents(
          totalInputTokens,
          totalOutputTokens
        )
        const finalStatus = determineFinalJobStatus(targetLocales, localeResults)

        const current = getLocalizationJob(jobId)
        if (!current) {
          sendEvent({ type: 'error', error: 'Job not found or was deleted' })
          return
        }

        if (current.status !== 'processing') {
          if (current.status === 'completed') {
            sendEvent({
              type: 'complete',
              progress: 100,
              totalLocales: targetLocales.length,
              completedLocales: completedCount,
            })
          } else {
            sendEvent({ type: 'cancelled', message: 'Job was cancelled' })
          }
          return
        }

        updateLocalizationJob(jobId, {
          status: finalStatus,
          results: { _config: configToPreserve, locales: results },
          locale_results: localeResults,
          completed_at:
            finalStatus === 'completed' ? new Date().toISOString() : null,
          total_input_tokens: totalInputTokens,
          total_output_tokens: totalOutputTokens,
          total_cost_cents: totalCostCents,
          ai_model: getModel(),
        })

        sendEvent({
          type: 'complete',
          progress: 100,
          totalLocales: targetLocales.length,
          completedLocales: completedCount,
        })
      } catch (error) {
        console.error('Error in resume stream:', error)
        updateLocalizationJob(jobId, {
          status: 'failed',
          error_message: String(error),
        })
        sendEvent({ type: 'error', error: String(error) })
      } finally {
        clearInterval(heartbeatInterval)
        if (isControllerOpen) {
          try {
            controller.close()
          } catch {
            // already closed
          }
        }
        isControllerOpen = false
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
