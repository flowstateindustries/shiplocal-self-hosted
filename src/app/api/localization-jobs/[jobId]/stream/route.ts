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
import { determineFinalJobStatus } from '@/lib/localization/job-utils'
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
 * GET /api/localization-jobs/[jobId]/stream
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params

  const job = getLocalizationJob(jobId)
  if (!job) return sseNotFoundResponse('Job')

  if (job.status === 'completed') {
    return sseErrorResponse('Job already completed', 400)
  }
  if (job.status === 'processing') {
    return sseErrorResponse('Job is already being processed', 400)
  }

  markStaleJobsInterrupted()

  const claimed = claimLocalizationJobForProcessing(jobId, ['pending'])
  if (!claimed) {
    return sseErrorResponse('Job is already being processed or completed', 400)
  }
  updateLocalizationJob(jobId, { ai_model: getModel() })

  const config: JobConfig | null = job.results?._config || null
  const configToPreserve = job.results?._config
  if (!config) {
    return sseErrorResponse('Job configuration not found', 400)
  }

  const encoder = new TextEncoder()
  const targetLocales = job.target_locales
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
        sendEvent({
          type: 'starting',
          progress: 0,
          totalLocales: targetLocales.length,
          completedLocales: 0,
        })

        const results: LocaleResult[] = []
        let completedCount = 0
        let totalInputTokens = 0
        let totalOutputTokens = 0
        const localeResults: Record<string, LocaleResultStatus> = {}

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

              const failedLocaleResult: LocaleResult = {
                locale,
                description: undefined,
                keywords: undefined,
                promotionalText: undefined,
                whatsNew: undefined,
              }

              await dbMutex.acquire()
              try {
                results.push(failedLocaleResult)
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
                result: failedLocaleResult,
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
              results.push(localeResult)
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

            const failedLocaleResult: LocaleResult = {
              locale,
              description: undefined,
              keywords: undefined,
              promotionalText: undefined,
              whatsNew: undefined,
            }

            await dbMutex.acquire()
            try {
              results.push(failedLocaleResult)
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
              result: failedLocaleResult,
              error: errorMessage,
              inputTokens: 0,
              outputTokens: 0,
            }
          }
        }

        await mapWithConcurrency(targetLocales, CONCURRENT_LOCALES, processLocale)

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
          type: finalStatus === 'completed' ? 'complete' : 'error',
          progress:
            finalStatus === 'completed'
              ? 100
              : Math.round((completedCount / targetLocales.length) * 100),
          totalLocales: targetLocales.length,
          completedLocales: completedCount,
          ...(finalStatus === 'failed' && {
            error: 'All locales failed to process',
          }),
        })
      } catch (error) {
        console.error('Error in generation stream:', error)
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
