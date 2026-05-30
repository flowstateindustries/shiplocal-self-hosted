import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  validationError,
  validateJsonContentType,
} from '@/lib/api/responses'
import { markStalePricingJobsInterrupted } from '@/lib/pricing/stale-cleanup'
import { DEFAULT_BASE_TERRITORY } from '@/lib/pricing/constants'
import type { PricingProductType } from '@/lib/pricing/types'
import type { PricingJobInsert } from '@/lib/database/types'
import { insertPricingJob, listPricingJobs } from '@/lib/db/queries'

interface CreatePricingJobRequest {
  appId: string
  appName: string
  appIconUrl?: string | null
  baseTerritory?: string
  extraDiscount?: number
  startDate?: string
  products: Array<{ id: string; type: PricingProductType; name: string }>
}

/**
 * GET /api/pricing-jobs — list pricing jobs (most-recent first).
 */
export async function GET() {
  try {
    markStalePricingJobsInterrupted()
    const jobs = listPricingJobs()
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('Error in GET /api/pricing-jobs:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * POST /api/pricing-jobs — create a pending pricing job. The actual price
 * computation runs in the SSE stream endpoint.
 */
export async function POST(request: NextRequest) {
  const contentTypeError = validateJsonContentType(request)
  if (contentTypeError) return contentTypeError

  try {
    markStalePricingJobsInterrupted()

    const body: CreatePricingJobRequest = await request.json()

    if (!body.appId || !body.appName || !body.products?.length) {
      return validationError(
        'Missing required fields: appId, appName, products'
      )
    }

    const baseTerritory = body.baseTerritory || DEFAULT_BASE_TERRITORY
    const extraDiscount = Math.min(Math.max(body.extraDiscount ?? 0, 0), 0.9)
    const products = body.products.map((p) => ({
      id: p.id,
      type: p.type,
      name: p.name,
    }))

    // Rollout options. ASC requires a *future* start date (and bumps it past
    // weekends/holidays — the push adopts Apple's exact minimum if needed).
    // Default to +2 days; require any provided date to be after today.
    // YYYY-MM-DD strings compare correctly lexicographically.
    const today = new Date().toISOString().slice(0, 10)
    const defaultStart = new Date(Date.now() + 2 * 86400000)
      .toISOString()
      .slice(0, 10)
    const startDate =
      body.startDate && body.startDate > today ? body.startDate : defaultStart

    const config = {
      baseTerritory,
      extraDiscount,
      products,
      startDate,
    }

    const jobInsert: PricingJobInsert = {
      app_id: body.appId,
      app_name: body.appName,
      app_icon_url: body.appIconUrl || null,
      base_territory: baseTerritory,
      product_ids: products.map((p) => p.id),
      strategy: config,
      status: 'pending',
      results: { _config: config, products: [] },
      product_results: Object.fromEntries(
        products.map((p) => [p.id, { status: 'pending' as const }])
      ),
    }

    const job = insertPricingJob(jobInsert)
    return NextResponse.json({ jobId: job.id, message: 'Job created successfully' })
  } catch (error) {
    console.error('Error in POST /api/pricing-jobs:', error)
    return errorResponse('Internal server error', 500)
  }
}
