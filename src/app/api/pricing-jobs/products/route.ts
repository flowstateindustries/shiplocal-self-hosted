import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, validationError } from '@/lib/api/responses'
import { getASCCredentials } from '@/lib/appstore/credentials'
import { listAppPricingProducts } from '@/lib/appstore/pricing'

/**
 * GET /api/pricing-jobs/products?appId=...
 * List an app's subscriptions and in-app purchases for the pricing config UI.
 */
export async function GET(request: NextRequest) {
  const appId = request.nextUrl.searchParams.get('appId')
  if (!appId) {
    return validationError('Missing required query param: appId')
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return errorResponse(
      'No App Store Connect credentials found. Set them in .env.local.',
      400
    )
  }

  try {
    const result = await listAppPricingProducts(credentials, appId)
    if (!result.success) {
      return errorResponse(result.error || 'Failed to list products', 502)
    }
    return NextResponse.json({ products: result.data })
  } catch (error) {
    console.error('Error in GET /api/pricing-jobs/products:', error)
    return errorResponse('Internal server error', 500)
  }
}
