import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, validationError, validateJsonContentType } from '@/lib/api/responses'
import { hasASCCredentials } from '@/lib/appstore/credentials'
import {
  getSelectedAppByAppId,
  insertSelectedApp,
  listSelectedApps,
} from '@/lib/db/queries'

/**
 * GET /api/selected-apps
 * List the locally-tracked App Store apps.
 */
export async function GET() {
  try {
    const apps = listSelectedApps()
    return NextResponse.json({
      apps,
      ascConnected: hasASCCredentials(),
    })
  } catch (error) {
    console.error('Error in GET /api/selected-apps:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * POST /api/selected-apps
 * Add an app to the local selection.
 */
export async function POST(request: NextRequest) {
  const contentTypeError = validateJsonContentType(request)
  if (contentTypeError) return contentTypeError

  try {
    const body = await request.json()
    const { appId, appName, appIconUrl } = body

    if (!appId || !appName) {
      return validationError('App ID and name are required')
    }

    if (!/^\d+$/.test(String(appId))) {
      return validationError('Invalid app ID format')
    }

    if (appIconUrl) {
      try {
        const url = new URL(appIconUrl)
        if (url.protocol !== 'https:') {
          return validationError('Icon URL must use HTTPS')
        }
      } catch {
        return validationError('Invalid icon URL format')
      }
    }

    if (typeof appName === 'string' && appName.length > 255) {
      return validationError('App name too long')
    }

    if (getSelectedAppByAppId(String(appId))) {
      return validationError('App is already in your selection')
    }

    const app = insertSelectedApp({
      app_id: String(appId),
      app_name: appName,
      app_icon_url: appIconUrl || null,
    })

    return NextResponse.json({ app })
  } catch (error) {
    console.error('Error in POST /api/selected-apps:', error)
    return errorResponse('Internal server error', 500)
  }
}
