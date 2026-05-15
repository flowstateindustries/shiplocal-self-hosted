import { NextRequest, NextResponse } from 'next/server'

export function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Validate that the request has a JSON content type.
 * Returns null if valid, or an error response if invalid.
 *
 * @param request - The incoming request
 * @returns null if valid, or a 415 Unsupported Media Type response
 */
export function validateJsonContentType(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get('content-type')

  // Allow requests without content-type (browser preflight, etc.)
  // The actual JSON parsing will fail later if body is invalid
  if (!contentType) {
    return null
  }

  // Check for application/json (possibly with charset)
  if (!contentType.toLowerCase().includes('application/json')) {
    return NextResponse.json(
      { error: 'Content-Type must be application/json' },
      { status: 415 }
    )
  }

  return null
}

/**
 * Response for unsupported media type (415)
 */
export function unsupportedMediaTypeResponse(expected = 'application/json') {
  return NextResponse.json(
    { error: `Content-Type must be ${expected}` },
    { status: 415 }
  )
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
}

export function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export function notFoundResponse(resource = 'Resource') {
  return NextResponse.json({ error: `${resource} not found` }, { status: 404 })
}

export function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

// SSE-compatible versions (plain Response, not NextResponse)
export function sseErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function sseUnauthorizedResponse() {
  return sseErrorResponse('Not authenticated', 401)
}

export function sseNotFoundResponse(resource = 'Resource') {
  return sseErrorResponse(`${resource} not found`, 404)
}

export function sseForbiddenResponse() {
  return sseErrorResponse('Forbidden', 403)
}
