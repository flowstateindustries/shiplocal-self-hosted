import { NextRequest, NextResponse } from 'next/server'
import {
  errorResponse,
  validationError,
  validateJsonContentType,
} from '@/lib/api/responses'
import { testConnection } from '@/lib/appstore/api'
import { getASCCredentials, hasASCCredentials } from '@/lib/appstore/credentials'

/**
 * GET /api/credentials
 * Report whether ASC credentials are configured via environment variables.
 */
export async function GET() {
  const credentials = getASCCredentials()
  return NextResponse.json({
    ascConnected: hasASCCredentials(),
    ascIssuerId: credentials?.issuerId ?? null,
    ascKeyId: credentials?.keyId ?? null,
  })
}

/**
 * POST /api/credentials
 * Validate the provided credentials against the App Store Connect API
 * but do NOT persist them — self-hosted reads credentials from env vars only.
 */
export async function POST(request: NextRequest) {
  const contentTypeError = validateJsonContentType(request)
  if (contentTypeError) return contentTypeError

  try {
    const body = await request.json()
    const { issuerId, keyId, privateKey } = body

    if (!issuerId?.trim() || !keyId?.trim() || !privateKey?.trim()) {
      return validationError('All fields are required')
    }

    const testResult = await testConnection({
      issuerId: issuerId.trim(),
      keyId: keyId.trim(),
      privateKey: privateKey.trim(),
    })

    if (!testResult.success) {
      return validationError(
        testResult.error || 'Failed to connect to App Store Connect'
      )
    }

    return NextResponse.json({
      success: true,
      validated: true,
      message:
        'Credentials are valid. Add them to .env.local to make them active, then restart the dev server.',
      appCount: testResult.data?.appCount ?? 0,
    })
  } catch (error) {
    console.error('Error validating ASC credentials:', error)
    return errorResponse(
      error instanceof Error ? error.message : 'Failed to validate credentials',
      500
    )
  }
}

/**
 * DELETE /api/credentials
 * In self-hosted mode credentials live in .env.local — instruct the user
 * to remove them there instead of mutating server state.
 */
export async function DELETE() {
  return NextResponse.json({
    success: false,
    message:
      'Credentials are loaded from .env.local. Remove ASC_ISSUER_ID, ASC_KEY_ID, and ASC_PRIVATE_KEY there and restart the dev server to disconnect.',
  })
}
