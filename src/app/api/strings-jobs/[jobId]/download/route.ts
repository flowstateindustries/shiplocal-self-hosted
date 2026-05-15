import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, notFoundResponse } from '@/lib/api/responses'
import { formatXCStringsFile } from '@/lib/strings'
import { getStringsJob } from '@/lib/db/queries'

function sanitizeFilename(filename: string): string {
  const basename = filename.split(/[/\\]/).pop() || filename
  return basename
    .replace(/[^\w\s.-]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 100)
}

interface RouteParams {
  params: Promise<{ jobId: string }>
}

/**
 * GET /api/strings-jobs/[jobId]/download
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { jobId } = await params
    const job = getStringsJob(jobId)
    if (!job) return notFoundResponse('Job')

    if (!job.results) {
      return errorResponse('No results available for download', 400)
    }

    const fileContent = formatXCStringsFile(job.results)
    const safeFilename = sanitizeFilename(job.file_name)

    return new NextResponse(fileContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
      },
    })
  } catch (error) {
    console.error('Error in GET /api/strings-jobs/[jobId]/download:', error)
    return errorResponse('Internal server error', 500)
  }
}
