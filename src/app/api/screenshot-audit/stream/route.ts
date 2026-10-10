import { NextRequest } from 'next/server'
import { sseErrorResponse } from '@/lib/api/responses'
import { createSSEStream } from '@/lib/api/sse'
import { getASCCredentials } from '@/lib/appstore/credentials'
import { auditVersionScreenshots } from '@/lib/appstore/screenshots'
import type { LocaleAudit } from '@/lib/appstore/screenshots'

export interface ScreenshotAuditEvent {
  type: 'starting' | 'locale' | 'complete' | 'error' | 'heartbeat'
  /** Locale codes discovered for the version, so the UI can show pending rows. */
  locales?: string[]
  locale?: LocaleAudit
  completed?: number
  total?: number
  error?: string
}

/**
 * GET /api/screenshot-audit/stream?versionId=...
 *
 * Streams the real per-locale, per-display-size screenshot counts App Store
 * Connect holds for a version. A full scan is one request per locale (plus a
 * fallback read for any set the batched read can't be trusted for), so results
 * are streamed as each locale lands rather than withheld for a minute.
 *
 * Read-only: GET is the only method this route exports, and every ASC call
 * underneath it is a GET.
 */
export async function GET(request: NextRequest) {
  const versionId = request.nextUrl.searchParams.get('versionId')
  if (!versionId || !/^[A-Za-z0-9_-]{1,64}$/.test(versionId)) {
    return sseErrorResponse('Invalid version ID', 400)
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return sseErrorResponse(
      'App Store Connect credentials are required for the screenshot audit. Set them in .env.local.',
      400
    )
  }

  return createSSEStream<ScreenshotAuditEvent>(async (controller) => {
    const heartbeat = setInterval(() => {
      controller.send({ type: 'heartbeat' })
    }, 15000)

    try {
      let total = 0
      let completed = 0

      const result = await auditVersionScreenshots(credentials, versionId, {
        signal: request.signal,
        onLocalesDiscovered: (locales) => {
          total = locales.length
          controller.send({
            type: 'starting',
            locales: locales.map((entry) => entry.locale),
            total,
            completed: 0,
          })
        },
        onLocale: (locale) => {
          completed++
          controller.send({ type: 'locale', locale, completed, total })
        },
      })

      if (!result.success) {
        controller.send({
          type: 'error',
          error: result.error || 'Failed to read screenshots',
        })
        return
      }

      controller.send({ type: 'complete', completed, total })
    } catch (error) {
      if (request.signal.aborted) return
      console.error('Error in GET /api/screenshot-audit/stream:', error)
      controller.send({
        type: 'error',
        error:
          error instanceof Error ? error.message : 'Failed to read screenshots',
      })
    } finally {
      clearInterval(heartbeat)
    }
  })
}
