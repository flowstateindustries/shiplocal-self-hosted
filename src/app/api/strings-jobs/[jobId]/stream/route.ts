import { NextRequest } from 'next/server'
import { sseErrorResponse, sseNotFoundResponse } from '@/lib/api/responses'
import { SSE_HEADERS } from '@/lib/api/sse'
import { getModel } from '@/lib/ai/providers'
import { calculateCostCents } from '@/lib/ai/cost'
import type {
  StringsLocaleResult,
  XCStringsFile,
} from '@/lib/database/types'
import type { StringsStreamEvent } from '@/lib/strings/types'
import {
  CONCURRENT_LOCALES,
  cloneXCStringsFile,
  createBatches,
  createMutex,
  getStringsToTranslate,
  mapWithConcurrency,
  markStaleStringsJobsInterrupted,
  mergeLocaleTranslations,
  translateBatch,
} from '@/lib/strings'
import { getXCStringsLocaleName } from '@/components/strings/locale-utils'
import {
  claimStringsJobForProcessing,
  getStringsJob,
  updateStringsJob,
} from '@/lib/db/queries'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

interface LocaleProcessResult {
  locale: string
  success: boolean
  translatedCount: number
  inputTokens: number
  outputTokens: number
  translations: Record<string, string>
  error?: string
}

/**
 * GET /api/strings-jobs/[jobId]/stream
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params

  markStaleStringsJobsInterrupted()

  const job = getStringsJob(jobId)
  if (!job) return sseNotFoundResponse('Job')

  if (job.status === 'completed') {
    return sseErrorResponse('Job already completed', 400)
  }
  if (job.status === 'processing') {
    return sseErrorResponse('Job is already being processed', 400)
  }

  const claimed = claimStringsJobForProcessing(jobId, ['pending'])
  if (!claimed) {
    return sseErrorResponse('Job is already being processed or completed', 400)
  }
  updateStringsJob(jobId, { ai_model: getModel() })

  const encoder = new TextEncoder()
  const targetLocales = job.target_locales
  const sourceContent = job.source_content
  const overwriteExisting = job.overwrite_existing

  const stream = new ReadableStream({
    async start(controller) {
      let isControllerOpen = true

      const sendEvent = (event: StringsStreamEvent) => {
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
        let results: XCStringsFile = cloneXCStringsFile(sourceContent)
        let totalInputTokens = job.total_input_tokens || 0
        let totalOutputTokens = job.total_output_tokens || 0
        const localeResults: Record<string, StringsLocaleResult> =
          job.locale_results || {}

        let totalStringsAllLocales = 0
        for (const locale of targetLocales) {
          const strings = getStringsToTranslate(
            sourceContent,
            locale,
            overwriteExisting
          )
          totalStringsAllLocales += strings.length
        }

        sendEvent({
          type: 'starting',
          totalLocales: targetLocales.length,
          totalStrings: totalStringsAllLocales,
        })

        let completedLocalesCount = 0

        const processLocale = async (
          locale: string
        ): Promise<LocaleProcessResult> => {
          const current = getStringsJob(jobId)
          if (current?.status !== 'processing') {
            return {
              locale,
              success: false,
              translatedCount: 0,
              inputTokens: 0,
              outputTokens: 0,
              translations: {},
              error: 'Job was cancelled',
            }
          }

          if (localeResults[locale]?.status === 'completed') {
            const previousCount = localeResults[locale].translated_count || 0
            sendEvent({
              type: 'locale_complete',
              locale,
              progress: 0,
              translatedCount: previousCount,
            })
            return {
              locale,
              success: true,
              translatedCount: previousCount,
              inputTokens: 0,
              outputTokens: 0,
              translations: {},
            }
          }

          const localeName = getXCStringsLocaleName(locale)
          const strings = getStringsToTranslate(
            sourceContent,
            locale,
            overwriteExisting
          )
          const batches = createBatches(strings)

          const localLocaleResult: StringsLocaleResult = {
            status: 'processing',
            batches: {},
            translated_count: 0,
          }

          sendEvent({
            type: 'locale_start',
            locale,
            localeName,
            stringsCount: strings.length,
            batchCount: batches.length,
          })

          const localeTranslations: Record<string, string> = {}
          let localeInputTokens = 0
          let localeOutputTokens = 0
          let localeFailed = false
          let localeError = ''

          for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            if (!isControllerOpen) {
              localeFailed = true
              localeError = 'Client disconnected'
              break
            }

            const batch = batches[batchIndex]
            localLocaleResult.batches[String(batchIndex)] = 'processing'

            sendEvent({
              type: 'batch_start',
              locale,
              batchIndex,
              batchSize: batch.length,
            })

            try {
              const result = await translateBatch(
                job.source_locale,
                locale,
                batch
              )

              if (!result.success) {
                localLocaleResult.batches[String(batchIndex)] = 'failed'
                localeFailed = true
                localeError = result.error || 'Translation failed'
                break
              }

              if (result.translations) {
                for (const t of result.translations) {
                  localeTranslations[t.key] = t.value
                }
              }

              if (result.usage) {
                localeInputTokens += result.usage.inputTokens
                localeOutputTokens += result.usage.outputTokens
              }

              localLocaleResult.batches[String(batchIndex)] = 'completed'

              sendEvent({
                type: 'batch_complete',
                locale,
                batchIndex,
                progress: Math.round(
                  ((batchIndex + 1) / batches.length) * 100
                ),
                translatedCount: Object.keys(localeTranslations).length,
              })

              await dbMutex.acquire()
              try {
                const current = getStringsJob(jobId)
                if (current) {
                  const updatedResults = mergeLocaleTranslations(
                    current.results || results,
                    locale,
                    localeTranslations
                  )
                  const updatedLocaleResults = {
                    ...(current.locale_results || {}),
                    [locale]: {
                      ...localLocaleResult,
                      translated_count: Object.keys(localeTranslations).length,
                    },
                  }
                  const newInputTokens =
                    (current.total_input_tokens || 0) + localeInputTokens
                  const newOutputTokens =
                    (current.total_output_tokens || 0) + localeOutputTokens

                  updateStringsJob(jobId, {
                    results: updatedResults,
                    locale_results: updatedLocaleResults,
                    total_input_tokens: newInputTokens,
                    total_output_tokens: newOutputTokens,
                    total_cost_cents: calculateCostCents(
                      newInputTokens,
                      newOutputTokens
                    ),
                  })

                  localeInputTokens = 0
                  localeOutputTokens = 0
                }
              } finally {
                dbMutex.release()
              }
            } catch (error) {
              console.error(
                `Error translating batch ${batchIndex} for ${locale}:`,
                error
              )
              localLocaleResult.batches[String(batchIndex)] = 'failed'
              localeFailed = true
              localeError =
                error instanceof Error ? error.message : String(error)
              break
            }
          }

          await dbMutex.acquire()
          try {
            const current = getStringsJob(jobId)
            if (current) {
              const updatedResults = mergeLocaleTranslations(
                current.results || results,
                locale,
                localeTranslations
              )

              const finalLocaleResult: StringsLocaleResult = localeFailed
                ? { ...localLocaleResult, status: 'failed', error: localeError }
                : {
                    ...localLocaleResult,
                    status: 'completed',
                    translated_count: Object.keys(localeTranslations).length,
                  }

              const updatedLocaleResults = {
                ...(current.locale_results || {}),
                [locale]: finalLocaleResult,
              }

              const newInputTokens =
                (current.total_input_tokens || 0) + localeInputTokens
              const newOutputTokens =
                (current.total_output_tokens || 0) + localeOutputTokens

              updateStringsJob(jobId, {
                results: updatedResults,
                locale_results: updatedLocaleResults,
                total_input_tokens: newInputTokens,
                total_output_tokens: newOutputTokens,
                total_cost_cents: calculateCostCents(
                  newInputTokens,
                  newOutputTokens
                ),
              })

              results = updatedResults
              localeResults[locale] = finalLocaleResult
              totalInputTokens = newInputTokens
              totalOutputTokens = newOutputTokens
            }

            if (!localeFailed) {
              completedLocalesCount++
              sendEvent({
                type: 'locale_complete',
                locale,
                progress: Math.round(
                  (completedLocalesCount / targetLocales.length) * 100
                ),
                translatedCount: Object.keys(localeTranslations).length,
              })
            } else {
              sendEvent({ type: 'locale_error', locale, error: localeError })
            }
          } finally {
            dbMutex.release()
          }

          return {
            locale,
            success: !localeFailed,
            translatedCount: Object.keys(localeTranslations).length,
            inputTokens: 0,
            outputTokens: 0,
            translations: localeTranslations,
            error: localeFailed ? localeError : undefined,
          }
        }

        await mapWithConcurrency(targetLocales, CONCURRENT_LOCALES, processLocale)

        if (!isControllerOpen) {
          const current = getStringsJob(jobId)
          if (current?.status === 'processing') {
            updateStringsJob(jobId, { status: 'interrupted' })
          }
          return
        }

        const failedLocales = Object.values(localeResults).filter(
          (r) => r.status === 'failed'
        ).length
        const finalStatus: 'completed' | 'failed' =
          failedLocales === targetLocales.length ? 'failed' : 'completed'

        const finalCompletedLocales = Object.values(localeResults).filter(
          (r) => r.status === 'completed'
        ).length
        const finalTranslatedStrings = Object.values(localeResults).reduce(
          (sum, r) => sum + (r.translated_count || 0),
          0
        )

        const current = getStringsJob(jobId)
        if (current?.status === 'processing') {
          updateStringsJob(jobId, {
            status: finalStatus,
            results,
            locale_results: localeResults,
            completed_at:
              finalStatus === 'completed' ? new Date().toISOString() : null,
            total_input_tokens: totalInputTokens,
            total_output_tokens: totalOutputTokens,
            total_cost_cents: calculateCostCents(
              totalInputTokens,
              totalOutputTokens
            ),
            ai_model: getModel(),
          })
        }

        sendEvent({
          type: 'complete',
          completedLocales: finalCompletedLocales,
          totalStrings: finalTranslatedStrings,
        })
      } catch (error) {
        console.error('Error in strings stream:', error)
        updateStringsJob(jobId, {
          status: 'failed',
          error_message: String(error),
        })
        sendEvent({
          type: 'error',
          error: error instanceof Error ? error.message : String(error),
        })
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
