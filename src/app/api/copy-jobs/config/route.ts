import { NextRequest, NextResponse } from 'next/server'
import { getASCCredentials, hasASCCredentials } from '@/lib/appstore/credentials'
import { getAppVersions } from '@/lib/appstore/api'
import { EDITABLE_STATES } from '@/lib/appstore/types'
import { errorResponse, validationError } from '@/lib/api/responses'

/**
 * GET /api/copy-jobs/config?appId=...
 * Returns the source (previous released) and target (editable) versions for a copy job.
 */
export async function GET(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get('appId')

  if (!appId || !/^\d+$/.test(appId)) {
    return validationError('Invalid app ID')
  }

  if (!hasASCCredentials()) {
    return NextResponse.json(
      { error: 'App Store Connect credentials are required to use Copy.' },
      { status: 400 }
    )
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return errorResponse('Could not retrieve App Store credentials', 500)
  }

  try {
    const versionsResult = await getAppVersions(credentials, appId)
    if (!versionsResult.success || !versionsResult.data) {
      return errorResponse(versionsResult.error || 'Failed to fetch versions', 500)
    }

    const versions = versionsResult.data
    const targetVersion = versions.find((v) =>
      EDITABLE_STATES.includes(v.appStoreState as (typeof EDITABLE_STATES)[number])
    )
    const sourceVersion = versions.find(
      (v) => !EDITABLE_STATES.includes(v.appStoreState as (typeof EDITABLE_STATES)[number])
    )

    if (!targetVersion) {
      return NextResponse.json(
        {
          error:
            'No editable version found. Create a new version in App Store Connect first.',
        },
        { status: 400 }
      )
    }

    if (!sourceVersion) {
      return NextResponse.json(
        {
          error:
            'No previous version found to copy from. This app has only one version.',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      sourceVersion: {
        id: sourceVersion.id,
        versionString: sourceVersion.versionString,
        appStoreState: sourceVersion.appStoreState,
      },
      targetVersion: {
        id: targetVersion.id,
        versionString: targetVersion.versionString,
        appStoreState: targetVersion.appStoreState,
      },
    })
  } catch (error) {
    console.error('Copy config error:', error)
    return errorResponse('Failed to fetch version config', 500)
  }
}
