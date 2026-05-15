import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, notFoundResponse } from '@/lib/api/responses'
import { hasASCCredentials } from '@/lib/appstore/credentials'
import {
  deleteSelectedAppByAppId,
  getSelectedAppByAppId,
} from '@/lib/db/queries'

/**
 * GET /api/selected-apps/[appId]
 * Fetch a single tracked app.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params
    const app = getSelectedAppByAppId(appId)
    if (!app) return notFoundResponse('App')
    return NextResponse.json({ app, ascConnected: hasASCCredentials() })
  } catch (error) {
    console.error('Error in GET /api/selected-apps/[appId]:', error)
    return errorResponse('Internal server error', 500)
  }
}

/**
 * DELETE /api/selected-apps/[appId]
 * Remove a tracked app from the local selection.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params
    if (!getSelectedAppByAppId(appId)) {
      return notFoundResponse('App')
    }
    const removed = deleteSelectedAppByAppId(appId)
    if (!removed) {
      return errorResponse('Failed to remove app', 500)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/selected-apps/[appId]:', error)
    return errorResponse('Internal server error', 500)
  }
}
