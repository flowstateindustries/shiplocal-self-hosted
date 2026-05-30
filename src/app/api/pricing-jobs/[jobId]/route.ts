import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  notFoundResponse,
  validateJsonContentType,
} from '@/lib/api/responses'
import type { PricingResults } from '@/lib/pricing/types'
import {
  deletePricingJob,
  getPricingJob,
  updatePricingJob,
} from '@/lib/db/queries'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * GET /api/pricing-jobs/[jobId] — fetch a single pricing job.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params
  const job = getPricingJob(jobId)
  if (!job) return notFoundResponse('Job')
  return NextResponse.json({ job })
}

/**
 * PATCH /api/pricing-jobs/[jobId] — persist edited proposals from the preview
 * (the user can override an individual territory's chosen price point).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const contentTypeError = validateJsonContentType(request)
  if (contentTypeError) return contentTypeError

  const { jobId } = await params
  const job = getPricingJob(jobId)
  if (!job) return notFoundResponse('Job')

  if (job.pushed_to_asc) {
    return errorResponse('Job has already been pushed and cannot be edited', 409)
  }

  try {
    const body: { results?: PricingResults } = await request.json()
    if (!body.results) {
      return errorResponse('Missing results in request body', 400)
    }
    const updated = updatePricingJob(jobId, { results: body.results })
    return NextResponse.json({ job: updated })
  } catch (error) {
    console.error('Error in PATCH /api/pricing-jobs/[jobId]:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * DELETE /api/pricing-jobs/[jobId] — remove a pricing job.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params
  const deleted = deletePricingJob(jobId)
  if (!deleted) return notFoundResponse('Job')
  return NextResponse.json({ success: true })
}
