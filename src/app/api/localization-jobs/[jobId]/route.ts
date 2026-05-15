import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  notFoundResponse,
  validationError,
  validateJsonContentType,
} from '@/lib/api/responses'
import { APP_STORE_LOCALES, FIELD_LIMITS } from '@/lib/localization/constants'
import type { LocaleResult, LocalizationResults } from '@/lib/database/types'
import {
  deleteLocalizationJob,
  getLocalizationJob,
  updateLocalizationJob,
} from '@/lib/db/queries'

const VALID_LOCALES = new Set(Object.keys(APP_STORE_LOCALES))

interface RouteParams {
  params: Promise<{ jobId: string }>
}

interface JobResultsUpdate {
  locales: LocaleResult[]
}

/**
 * GET /api/localization-jobs/[jobId]
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params
    const job = getLocalizationJob(jobId)
    if (!job) return notFoundResponse('Job')
    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error in GET /api/localization-jobs/[jobId]:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * PATCH /api/localization-jobs/[jobId]
 * Save edited localization results.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const contentTypeError = validateJsonContentType(request)
  if (contentTypeError) return contentTypeError

  try {
    const { jobId } = await params
    const body: JobResultsUpdate = await request.json()

    if (!body.locales || !Array.isArray(body.locales)) {
      return validationError('Invalid request body - locales array required')
    }

    for (const localeData of body.locales) {
      if (!localeData.locale || !VALID_LOCALES.has(localeData.locale)) {
        return validationError(`Invalid locale code: ${localeData.locale}`)
      }

      const fieldsToCheck: Array<{
        key: keyof typeof FIELD_LIMITS
        value: unknown
      }> = [
        { key: 'description', value: localeData.description },
        { key: 'keywords', value: localeData.keywords },
        { key: 'promotionalText', value: localeData.promotionalText },
        { key: 'whatsNew', value: localeData.whatsNew },
        { key: 'name', value: localeData.name },
        { key: 'subtitle', value: localeData.subtitle },
      ]

      for (const { key, value } of fieldsToCheck) {
        if (typeof value === 'string' && value.length > FIELD_LIMITS[key]) {
          return validationError(
            `${key} exceeds ${FIELD_LIMITS[key]} character limit for ${localeData.locale}`
          )
        }
      }
    }

    const existingJob = getLocalizationJob(jobId)
    if (!existingJob) return notFoundResponse('Job')

    const updatedResults: LocalizationResults = {
      _config: existingJob.results?._config,
      locales: body.locales,
    }

    updateLocalizationJob(jobId, { results: updatedResults })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/localization-jobs/[jobId]:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * DELETE /api/localization-jobs/[jobId]
 * Cancel an active job (sets status to 'failed' with a cancellation message).
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params
    const job = getLocalizationJob(jobId)
    if (!job) return notFoundResponse('Job')

    if (
      job.status !== 'pending' &&
      job.status !== 'processing' &&
      job.status !== 'interrupted'
    ) {
      // For completed/failed jobs, the user can fully delete the row.
      const removed = deleteLocalizationJob(jobId)
      if (!removed) return errorResponse('Failed to delete job', 500)
      return NextResponse.json({ success: true })
    }

    updateLocalizationJob(jobId, {
      status: 'failed',
      error_message: 'Cancelled by user',
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/localization-jobs/[jobId]:', error)
    return errorResponse('Internal server error', 500)
  }
}
