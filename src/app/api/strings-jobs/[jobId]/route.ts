import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, notFoundResponse } from '@/lib/api/responses'
import { deleteStringsJob, getStringsJob } from '@/lib/db/queries'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * GET /api/strings-jobs/[jobId]
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params
    const job = getStringsJob(jobId)
    if (!job) return notFoundResponse('Job')
    return NextResponse.json({ job })
  } catch (error) {
    console.error('Error in GET /api/strings-jobs/[jobId]:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * DELETE /api/strings-jobs/[jobId]
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params
    const job = getStringsJob(jobId)
    if (!job) return notFoundResponse('Job')

    if (job.status === 'processing') {
      return errorResponse(
        'Cannot delete a job that is currently processing',
        400
      )
    }

    const removed = deleteStringsJob(jobId)
    if (!removed) return errorResponse('Failed to delete job', 500)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/strings-jobs/[jobId]:', error)
    return errorResponse('Internal server error', 500)
  }
}
