import { NextResponse } from 'next/server'
import { getASCCredentials, listApps } from '@/lib/appstore'
import { errorResponse, validationError } from '@/lib/api/responses'

/**
 * GET /api/apps
 * Fetch all apps from the configured App Store Connect account.
 */
export async function GET() {
  try {
    const credentials = getASCCredentials()
    if (!credentials) {
      return validationError('App Store Connect not connected')
    }

    const result = await listApps(credentials)
    if (!result.success) {
      return errorResponse(result.error || 'Failed to fetch apps', 500)
    }

    return NextResponse.json({ apps: result.data })
  } catch (error) {
    console.error('Error fetching ASC apps:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to fetch apps',
      500
    )
  }
}
