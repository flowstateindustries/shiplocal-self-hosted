import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, validationError } from '@/lib/api/responses'
import { getASCCredentials } from '@/lib/appstore/credentials'
import { listAuditVersions } from '@/lib/appstore/screenshots'

/**
 * GET /api/screenshot-audit/versions?appId=...
 * Every App Store version for an app, for the Screenshot Audit version picker.
 * Read-only.
 */
export async function GET(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get('appId')
  if (!appId || !/^\d+$/.test(appId)) {
    return validationError('Invalid app ID')
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return errorResponse(
      'App Store Connect credentials are required for the screenshot audit. Set them in .env.local.',
      400
    )
  }

  try {
    const result = await listAuditVersions(credentials, appId, request.signal)
    if (!result.success || !result.data) {
      return errorResponse(result.error || 'Failed to fetch versions', 502)
    }
    return NextResponse.json({ versions: result.data })
  } catch (error) {
    console.error('Error in GET /api/screenshot-audit/versions:', error)
    return errorResponse('Internal server error', 500)
  }
}
