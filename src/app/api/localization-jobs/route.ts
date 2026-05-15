import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  validationError,
  validateJsonContentType,
} from '@/lib/api/responses'
import type { LocalizationJobInsert } from '@/lib/database/types'
import type { SourceContent, SourceAppInfo } from '@/lib/localization/types'
import { markStaleJobsInterrupted } from '@/lib/localization/stale-cleanup'
import {
  insertLocalizationJob,
  listLocalizationJobs,
  updateLocalizationJob,
} from '@/lib/db/queries'

/**
 * Request body for creating a new localization job
 */
interface CreateJobRequest {
  appId: string
  appName: string
  appIconUrl?: string | null
  sourceLocale: string
  targetLocales: string[]
  fields: string[]
  sourceContent: SourceContent
  translateAppName?: boolean
  sourceAppInfo?: SourceAppInfo | null
  brandName?: string
  urlReplacements?: Array<{ oldUrl: string; newUrl: string }>
  privacyUrlReplacement?: string
  privacyUrlAllLocales?: boolean
  privacyUrlQueryEnabled?: boolean
  privacyUrlQueryPattern?: string
  supportUrlReplacement?: string
  supportUrlAllLocales?: boolean
  supportUrlQueryEnabled?: boolean
  supportUrlQueryPattern?: string
  marketingUrlReplacement?: string
  marketingUrlAllLocales?: boolean
  marketingUrlQueryEnabled?: boolean
  marketingUrlQueryPattern?: string
}

/**
 * GET /api/localization-jobs
 * Fetch localization jobs (most-recent first).
 */
export async function GET() {
  try {
    markStaleJobsInterrupted()
    const jobs = listLocalizationJobs()
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error in GET /api/localization-jobs:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * POST /api/localization-jobs
 * Create a new localization job. The actual generation runs in the
 * SSE streaming endpoint.
 */
export async function POST(request: NextRequest) {
  const contentTypeError = validateJsonContentType(request)
  if (contentTypeError) return contentTypeError

  try {
    markStaleJobsInterrupted()

    const body: CreateJobRequest = await request.json()

    if (
      !body.appId ||
      !body.appName ||
      !body.sourceLocale ||
      !body.targetLocales?.length
    ) {
      return validationError(
        'Missing required fields: appId, appName, sourceLocale, targetLocales'
      )
    }

    if (!body.fields?.length && !body.translateAppName) {
      return validationError(
        'At least one field or translateAppName must be selected'
      )
    }

    const fieldsLocalized = [...(body.fields || [])]
    if (body.translateAppName) fieldsLocalized.push('appName')

    const configData = {
      sourceContent: body.sourceContent,
      translateAppName: body.translateAppName || false,
      sourceAppInfo: body.sourceAppInfo || null,
      brandName: body.brandName || null,
      urlReplacements: body.urlReplacements || [],
      privacyUrlReplacement: body.privacyUrlReplacement || null,
      privacyUrlAllLocales: body.privacyUrlAllLocales || false,
      privacyUrlQueryEnabled: body.privacyUrlQueryEnabled || false,
      privacyUrlQueryPattern: body.privacyUrlQueryPattern || null,
      supportUrlReplacement: body.supportUrlReplacement || null,
      supportUrlAllLocales: body.supportUrlAllLocales || false,
      supportUrlQueryEnabled: body.supportUrlQueryEnabled || false,
      supportUrlQueryPattern: body.supportUrlQueryPattern || null,
      marketingUrlReplacement: body.marketingUrlReplacement || null,
      marketingUrlAllLocales: body.marketingUrlAllLocales || false,
      marketingUrlQueryEnabled: body.marketingUrlQueryEnabled || false,
      marketingUrlQueryPattern: body.marketingUrlQueryPattern || null,
    }

    const jobInsert: LocalizationJobInsert = {
      app_id: body.appId,
      app_name: body.appName,
      app_icon_url: body.appIconUrl || null,
      source_locale: body.sourceLocale,
      target_locales: body.targetLocales,
      fields_localized: fieldsLocalized,
      status: 'pending',
      results: { _config: configData, locales: [] },
      pushed_to_asc: false,
    }

    const job = insertLocalizationJob(jobInsert)
    // Ensure config is persisted (insert path may not include _config).
    updateLocalizationJob(job.id, {
      results: { _config: configData, locales: [] },
    })

    return NextResponse.json({ jobId: job.id, message: 'Job created successfully' })
  } catch (error) {
    console.error('Error in POST /api/localization-jobs:', error)
    return errorResponse('Internal server error', 500)
  }
}
