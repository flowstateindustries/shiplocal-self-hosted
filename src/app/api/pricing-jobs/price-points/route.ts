import { NextRequest, NextResponse } from 'next/server'
import { errorResponse, validationError } from '@/lib/api/responses'
import { getASCCredentials } from '@/lib/appstore/credentials'
import { getProductPricePoints } from '@/lib/appstore/pricing'
import { getPricingTerritories } from '@/lib/pricing/ppp-data'
import type { PricingProductType } from '@/lib/pricing/types'

/**
 * GET /api/pricing-jobs/price-points?type=subscription|iap&productId=...
 * Returns every available price point for a product, grouped by territory.
 * Used by the preview UI to populate the per-territory price-point dropdowns
 * when the user overrides a proposed price.
 */
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') as PricingProductType | null
  const productId = request.nextUrl.searchParams.get('productId')

  if (!productId || (type !== 'subscription' && type !== 'iap')) {
    return validationError('Missing or invalid query params: type, productId')
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return errorResponse(
      'No App Store Connect credentials found. Set them in .env.local.',
      400
    )
  }

  try {
    const result = await getProductPricePoints(
      credentials,
      type,
      productId,
      getPricingTerritories()
    )
    if (!result.success || !result.data) {
      return errorResponse(result.error || 'Failed to load price points', 502)
    }
    // Serialize the Map as a plain object keyed by territory.
    const ladders: Record<string, unknown> = {}
    for (const [territory, points] of result.data.ladders) {
      ladders[territory] = points
    }
    return NextResponse.json({ ladders })
  } catch (error) {
    console.error('Error in GET /api/pricing-jobs/price-points:', error)
    return errorResponse('Internal server error', 500)
  }
}
