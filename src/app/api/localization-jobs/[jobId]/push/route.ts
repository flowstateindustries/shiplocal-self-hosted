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
import { buildLocaleUrl } from '@/lib/localization/url-utils'
import type { LocaleResult } from '@/lib/database/types'
import type { JobConfig } from '@/lib/localization/types'
import { getLocalizationJob, updateLocalizationJob } from '@/lib/db/queries'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

interface PushStreamEvent {
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
  results?: PushResults
  error?: string
}

interface PushResults {
  success: string[]
  failed: Array<{ locale: string; error: string }>
  created: string[]
  updated: string[]
  appLevelCreated: string[]
  appLevelUpdated: string[]
}

/**
 * GET /api/localization-jobs/[jobId]/push
 * Server-Sent Events endpoint for pushing localizations to App Store Connect.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params

  const job = getLocalizationJob(jobId)
  if (!job) return sseNotFoundResponse('Job')

  if (job.status !== 'completed') {
    return sseErrorResponse('Job is not completed yet', 400)
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return sseErrorResponse(
      'No App Store Connect credentials found. Set them in .env.local.',
      400
    )
  }

  const localeResults: LocaleResult[] = job.results?.locales || []
  const config: JobConfig | undefined = job.results?._config

  if (localeResults.length === 0) {
    return sseErrorResponse('No localization results to push', 400)
  }

  const encoder = new TextEncoder()
  const appId = job.app_id
  const hasAppInfoFields =
    config?.translateAppName === true || !!config?.privacyUrlReplacement

  const stream = new ReadableStream({
    async start(controller) {
      let isControllerOpen = true

      const sendEvent = (event: PushStreamEvent) => {
        if (!isControllerOpen) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          isControllerOpen = false
        }
      }

      const results: PushResults = {
        success: [],
        failed: [],
        created: [],
        updated: [],
        appLevelCreated: [],
        appLevelUpdated: [],
      }

      try {
        sendEvent({
          type: 'starting',
          progress: 0,
          totalLocales: localeResults.length,
          completedLocales: 0,
        })

        sendEvent({
          type: 'preparing',
          message: 'Fetching version and localization IDs...',
        })

        const versionResult = await getEditableVersion(credentials, appId)
        if (!versionResult.success || !versionResult.data) {
          sendEvent({
            type: 'error',
            error:
              versionResult.error ||
              'No editable version found. Make sure you have a version in PREPARE_FOR_SUBMISSION state.',
          })
          controller.close()
          return
        }
        const versionId = versionResult.data.id

        const versionLocsResult = await getVersionLocalizationIds(
          credentials,
          versionId
        )
        if (!versionLocsResult.success) {
          sendEvent({
            type: 'error',
            error:
              versionLocsResult.error ||
              'Failed to fetch version localizations',
          })
          controller.close()
          return
        }

        const versionLocMap = new Map(
          (versionLocsResult.data || []).map((l) => [l.locale, l.id])
        )

        let appInfoId: string | null = null
        let appInfoLocMap = new Map<string, string>()

        if (hasAppInfoFields) {
          const appInfoIdResult = await getAppInfoId(credentials, appId)
          if (appInfoIdResult.success && appInfoIdResult.data) {
            appInfoId = appInfoIdResult.data
            const appInfoLocsResult = await getAppInfoLocalizationIds(
              credentials,
              appInfoId
            )
            if (appInfoLocsResult.success && appInfoLocsResult.data) {
              appInfoLocMap = new Map(
                appInfoLocsResult.data.map((l) => [l.locale, l.id])
              )
            }
          }
        }

        let completedCount = 0
        const totalLocales = localeResults.length

        for (const localeResult of localeResults) {
          const locale = localeResult.locale
          const localeName = APP_STORE_LOCALES[locale] || locale

          sendEvent({
            type: 'locale_start',
            locale,
            localeName,
            progress: Math.round((completedCount / totalLocales) * 100),
            totalLocales,
            completedLocales: completedCount,
          })

          try {
            let localeSuccess = true
            let localeError: string | undefined

            const hasNameOrSubtitle = localeResult.name || localeResult.subtitle
            const hasPrivacyUrl = !!config?.privacyUrlReplacement
            if (
              hasAppInfoFields &&
              appInfoId &&
              (hasNameOrSubtitle || hasPrivacyUrl)
            ) {
              const appInfoLocId = appInfoLocMap.get(locale)
              const appInfoData: {
                name?: string
                subtitle?: string
                privacyPolicyUrl?: string
              } = {}
              if (localeResult.name) appInfoData.name = localeResult.name
              if (localeResult.subtitle)
                appInfoData.subtitle = localeResult.subtitle
              if (config?.privacyUrlReplacement) {
                appInfoData.privacyPolicyUrl =
                  config.privacyUrlQueryEnabled && config.privacyUrlQueryPattern
                    ? buildLocaleUrl(
                        config.privacyUrlReplacement,
                        config.privacyUrlQueryPattern,
                        locale
                      )
                    : config.privacyUrlReplacement
              }

              if (appInfoLocId) {
                const updateResult = await updateAppInfoLocalization(
                  credentials,
                  appInfoLocId,
                  appInfoData
                )
                if (updateResult.success) {
                  results.appLevelUpdated.push(locale)
                } else {
                  console.error(
                    `App info update failed for ${locale}:`,
                    updateResult.error
                  )
                }
              } else if (appInfoData.name) {
                const createResult = await createAppInfoLocalization(
                  credentials,
                  appInfoId,
                  locale,
                  {
                    name: appInfoData.name,
                    subtitle: appInfoData.subtitle,
                    privacyPolicyUrl: appInfoData.privacyPolicyUrl,
                  }
                )
                if (createResult.success) {
                  results.appLevelCreated.push(locale)
                } else if (createResult.error?.includes('already exists')) {
                  const refetchResult = await getAppInfoLocalizationIds(
                    credentials,
                    appInfoId
                  )
                  if (refetchResult.success) {
                    const existingId = refetchResult.data?.find(
                      (l) => l.locale === locale
                    )?.id
                    if (existingId) {
                      const retryUpdate = await updateAppInfoLocalization(
                        credentials,
                        existingId,
                        appInfoData
                      )
                      if (retryUpdate.success) {
                        results.appLevelUpdated.push(locale)
                      }
                    }
                  }
                } else {
                  console.error(
                    `App info create failed for ${locale}:`,
                    createResult.error
                  )
                }
              }
            }

            const hasVersionData =
              localeResult.description ||
              localeResult.keywords ||
              localeResult.promotionalText ||
              localeResult.whatsNew ||
              config?.supportUrlReplacement ||
              config?.marketingUrlReplacement

            if (hasVersionData) {
              const supportUrl = config?.supportUrlReplacement
                ? config.supportUrlQueryEnabled && config.supportUrlQueryPattern
                  ? buildLocaleUrl(
                      config.supportUrlReplacement,
                      config.supportUrlQueryPattern,
                      locale
                    )
                  : config.supportUrlReplacement
                : undefined

              const marketingUrl = config?.marketingUrlReplacement
                ? config.marketingUrlQueryEnabled &&
                  config.marketingUrlQueryPattern
                  ? buildLocaleUrl(
                      config.marketingUrlReplacement,
                      config.marketingUrlQueryPattern,
                      locale
                    )
                  : config.marketingUrlReplacement
                : undefined

              const versionData = {
                description: localeResult.description,
                keywords: localeResult.keywords,
                promotionalText: localeResult.promotionalText,
                whatsNew: localeResult.whatsNew,
                ...(supportUrl && { supportUrl }),
                ...(marketingUrl && { marketingUrl }),
              }

              const cleanVersionData = Object.fromEntries(
                Object.entries(versionData).filter(([, v]) => v !== undefined)
              )

              const versionLocId = versionLocMap.get(locale)
              if (versionLocId) {
                const updateResult = await updateVersionLocalization(
                  credentials,
                  versionLocId,
                  cleanVersionData
                )
                if (!updateResult.success) {
                  localeSuccess = false
                  localeError = updateResult.error
                }
              } else {
                const createResult = await createVersionLocalization(
                  credentials,
                  versionId,
                  locale,
                  cleanVersionData
                )
                if (createResult.success) {
                  results.created.push(locale)
                } else if (createResult.error?.includes('already exists')) {
                  const refetchResult = await getVersionLocalizationIds(
                    credentials,
                    versionId
                  )
                  if (refetchResult.success) {
                    const existingId = refetchResult.data?.find(
                      (l) => l.locale === locale
                    )?.id
                    if (existingId) {
                      const retryUpdate = await updateVersionLocalization(
                        credentials,
                        existingId,
                        cleanVersionData
                      )
                      if (retryUpdate.success) {
                        results.updated.push(locale)
                      } else {
                        localeSuccess = false
                        localeError = retryUpdate.error
                      }
                    } else {
                      localeSuccess = false
                      localeError = createResult.error
                    }
                  } else {
                    localeSuccess = false
                    localeError = createResult.error
                  }
                } else {
                  localeSuccess = false
                  localeError = createResult.error
                }
              }
            }

            completedCount++
            if (localeSuccess) {
              results.success.push(locale)
              sendEvent({
                type: 'locale_complete',
                locale,
                localeName,
                progress: Math.round((completedCount / totalLocales) * 100),
                totalLocales,
                completedLocales: completedCount,
              })
            } else {
              results.failed.push({
                locale,
                error: localeError || 'Unknown error',
              })
              sendEvent({
                type: 'locale_error',
                locale,
                localeName,
                error: localeError,
                progress: Math.round((completedCount / totalLocales) * 100),
                totalLocales,
                completedLocales: completedCount,
              })
            }
          } catch (localeError) {
            completedCount++
            const errorMessage =
              localeError instanceof Error
                ? localeError.message
                : String(localeError)
            results.failed.push({ locale, error: errorMessage })

            sendEvent({
              type: 'locale_error',
              locale,
              localeName,
              error: errorMessage,
              progress: Math.round((completedCount / totalLocales) * 100),
              totalLocales,
              completedLocales: completedCount,
            })
          }
        }

        const targetLocaleSet = new Set(localeResults.map((lr) => lr.locale))
        const nonTargetVersionLocales = [...versionLocMap.entries()].filter(
          ([locale]) => !targetLocaleSet.has(locale)
        )
        const nonTargetAppInfoLocales = [...appInfoLocMap.entries()].filter(
          ([locale]) => !targetLocaleSet.has(locale)
        )

        const hasPrivacyUrlAllLocales =
          config?.privacyUrlAllLocales && config?.privacyUrlReplacement && appInfoId
        const hasSupportUrlAllLocales =
          config?.supportUrlAllLocales && config?.supportUrlReplacement
        const hasMarketingUrlAllLocales =
          config?.marketingUrlAllLocales && config?.marketingUrlReplacement

        const totalUrlUpdates =
          (hasPrivacyUrlAllLocales ? nonTargetAppInfoLocales.length : 0) +
          (hasSupportUrlAllLocales ? nonTargetVersionLocales.length : 0) +
          (hasMarketingUrlAllLocales ? nonTargetVersionLocales.length : 0)

        let urlUpdateCount = 0

        if (totalUrlUpdates > 0) {
          sendEvent({
            type: 'preparing',
            message: `Applying URLs to ${Math.max(
              nonTargetVersionLocales.length,
              nonTargetAppInfoLocales.length
            )} other locales...`,
          })
        }

        if (hasPrivacyUrlAllLocales) {
          for (const [locale, locId] of nonTargetAppInfoLocales) {
            try {
              const privacyUrl =
                config.privacyUrlQueryEnabled && config.privacyUrlQueryPattern
                  ? buildLocaleUrl(
                      config.privacyUrlReplacement!,
                      config.privacyUrlQueryPattern,
                      locale
                    )
                  : config.privacyUrlReplacement!

              const updateResult = await updateAppInfoLocalization(
                credentials,
                locId,
                { privacyPolicyUrl: privacyUrl }
              )
              if (updateResult.success) {
                results.appLevelUpdated.push(locale)
              }
            } catch (err) {
              console.error(`Privacy URL update error for ${locale}:`, err)
            }

            urlUpdateCount++
            sendEvent({
              type: 'preparing',
              message: `Updating URLs (${urlUpdateCount}/${totalUrlUpdates})...`,
            })
          }
        }

        if (hasSupportUrlAllLocales) {
          for (const [locale, locId] of nonTargetVersionLocales) {
            try {
              const supportUrl =
                config.supportUrlQueryEnabled && config.supportUrlQueryPattern
                  ? buildLocaleUrl(
                      config.supportUrlReplacement!,
                      config.supportUrlQueryPattern,
                      locale
                    )
                  : config.supportUrlReplacement!

              const updateResult = await updateVersionLocalization(
                credentials,
                locId,
                { supportUrl }
              )
              if (updateResult.success) {
                results.updated.push(locale)
              }
            } catch (err) {
              console.error(`Support URL update error for ${locale}:`, err)
            }

            urlUpdateCount++
            sendEvent({
              type: 'preparing',
              message: `Updating URLs (${urlUpdateCount}/${totalUrlUpdates})...`,
            })
          }
        }

        if (hasMarketingUrlAllLocales) {
          for (const [locale, locId] of nonTargetVersionLocales) {
            try {
              const marketingUrl =
                config.marketingUrlQueryEnabled &&
                config.marketingUrlQueryPattern
                  ? buildLocaleUrl(
                      config.marketingUrlReplacement!,
                      config.marketingUrlQueryPattern,
                      locale
                    )
                  : config.marketingUrlReplacement!

              const updateResult = await updateVersionLocalization(
                credentials,
                locId,
                { marketingUrl }
              )
              if (updateResult.success) {
                results.updated.push(locale)
              }
            } catch (err) {
              console.error(`Marketing URL update error for ${locale}:`, err)
            }

            urlUpdateCount++
            sendEvent({
              type: 'preparing',
              message: `Updating URLs (${urlUpdateCount}/${totalUrlUpdates})...`,
            })
          }
        }

        const current = getLocalizationJob(jobId)
        if (current?.status === 'completed') {
          updateLocalizationJob(jobId, {
            pushed_to_asc: true,
            pushed_at: new Date().toISOString(),
          })
        } else {
          console.warn(
            `Job ${jobId} status changed during push — pushed_to_asc not updated`
          )
        }

        sendEvent({
          type: 'complete',
          progress: 100,
          totalLocales,
          completedLocales: completedCount,
          results,
        })
      } catch (error) {
        console.error('Error in push stream:', error)
        sendEvent({
          type: 'error',
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
        })
      } finally {
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
