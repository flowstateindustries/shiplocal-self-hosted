import { NextRequest, NextResponse } from 'next/server'
import { getCopyJob } from '@/lib/db/queries'

interface RouteParams {
  params: Promise<{ jobId: string }>
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params
  const job = getCopyJob(jobId)
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }
  return NextResponse.json({ job })
}
