import { NextRequest } from 'next/server'
import { markStalePricingJobsInterrupted } from '@/lib/pricing/stale-cleanup'
import { runPricingComputeStream } from '@/lib/pricing/run-compute-stream'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * GET /api/pricing-jobs/[jobId]/resume
 * Re-run computation for an interrupted/failed job, skipping products that
 * already succeeded.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params
  markStalePricingJobsInterrupted()
  return runPricingComputeStream(jobId, ['interrupted', 'failed'], request.signal)
}
