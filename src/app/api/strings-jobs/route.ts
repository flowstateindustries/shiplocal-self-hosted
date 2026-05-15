import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  validationError,
  validateJsonContentType,
} from '@/lib/api/responses'
import type {
  StringsJobInsert,
  StringsLocaleResult,
  XCStringsFile,
} from '@/lib/database/types'
import {
  validateXCStringsFile,
  countStringsToTranslate,
  getTotalStringCount,
  markStaleStringsJobsInterrupted,
} from '@/lib/strings'
import { insertStringsJob, listStringsJobs } from '@/lib/db/queries'

interface CreateStringsJobRequest {
  fileName: string
  sourceLocale: string
  targetLocales: string[]
  sourceContent: XCStringsFile
  overwriteExisting?: boolean
}

/**
 * POST /api/strings-jobs
 * Create a new string translation job.
 */
export async function POST(request: NextRequest) {
  const contentTypeError = validateJsonContentType(request)
  if (contentTypeError) return contentTypeError

  try {
    markStaleStringsJobsInterrupted()

    const body: CreateStringsJobRequest = await request.json()

    if (
      !body.fileName ||
      !body.sourceLocale ||
      !body.targetLocales?.length ||
      !body.sourceContent
    ) {
      return validationError(
        'Missing required fields: fileName, sourceLocale, targetLocales, sourceContent'
      )
    }

    const validation = validateXCStringsFile(body.sourceContent)
    if (!validation.valid) {
      return validationError(validation.error || 'Invalid .xcstrings file')
    }

    const totalStrings = getTotalStringCount(body.sourceContent)
    const sampleStringsToTranslate = countStringsToTranslate(
      body.sourceContent,
      body.targetLocales[0],
      body.overwriteExisting ?? false
    )

    const localeResults: Record<string, StringsLocaleResult> = {}
    for (const locale of body.targetLocales) {
      localeResults[locale] = { status: 'pending', batches: {} }
    }

    const jobInsert: StringsJobInsert = {
      file_name: body.fileName,
      source_locale: body.sourceLocale,
      target_locales: body.targetLocales,
      overwrite_existing: body.overwriteExisting ?? false,
      source_content: body.sourceContent,
      results: null,
      status: 'pending',
      locale_results: localeResults,
      total_strings: totalStrings,
      strings_to_translate: sampleStringsToTranslate,
    }

    const job = insertStringsJob(jobInsert)

    return NextResponse.json({
      jobId: job.id,
      totalStrings,
      stringsToTranslate: sampleStringsToTranslate,
      message: 'Job created successfully',
    })
  } catch (error) {
    console.error('Error in POST /api/strings-jobs:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * GET /api/strings-jobs
 * List strings jobs.
 */
export async function GET() {
  try {
    const jobs = listStringsJobs()
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error in GET /api/strings-jobs:', error)
    return errorResponse('Internal server error', 500)
  }
}
