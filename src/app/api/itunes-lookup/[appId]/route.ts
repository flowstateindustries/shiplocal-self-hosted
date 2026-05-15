import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/itunes-lookup/[appId]
 * Proxy iTunes API to get app info by App Store ID.
 *
 * Query params:
 * - country: 2-letter country code (default: 'us')
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params

  if (!/^\d+$/.test(appId)) {
    return NextResponse.json(
      { success: false, error: 'Invalid app ID' },
      { status: 400 }
    )
  }

  const { searchParams } = new URL(_request.url)
  let country = searchParams.get('country') || 'us'
  if (!/^[a-zA-Z]{2}$/.test(country)) country = 'us'
  country = country.toLowerCase()

  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${appId}&country=${country}`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'iTunes API error' },
        { status: 502 }
      )
    }

    const data = await response.json()

    if (data.results && data.results.length > 0) {
      const result = data.results[0]
      return NextResponse.json({
        success: true,
        data: {
          trackId: result.trackId,
          trackName: result.trackName,
          sellerName: result.sellerName,
          artworkUrl512: result.artworkUrl512 || result.artworkUrl100,
          bundleId: result.bundleId,
          trackViewUrl: result.trackViewUrl,
        },
      })
    }

    return NextResponse.json(
      { success: false, error: 'App not found' },
      { status: 404 }
    )
  } catch (error) {
    console.error('iTunes lookup error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to lookup app' },
      { status: 500 }
    )
  }
}
