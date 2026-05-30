import { NextRequest } from 'next/server'
import { sseErrorResponse } from '@/lib/api/responses'
import { markStalePricingJobsInterrupted } from '@/lib/pricing/stale-cleanup'
import { runPricingComputeStream } from '@/lib/pricing/run-compute-stream'
import { getPricingJob } from '@/lib/db/queries'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * GET /api/pricing-jobs/[jobId]/stream
 * Compute price proposals for a fresh (pending) job, streamed as SSE.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params

  const job = getPricingJob(jobId)
  if (job?.status === 'completed') {
    return sseErrorResponse('Job already completed', 400)
  }

  markStalePricingJobsInterrupted()
  return runPricingComputeStream(jobId, ['pending'], request.signal)
}
