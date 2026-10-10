/**
 * App Store Connect — screenshot audit (strictly read-only).
 *
 * ASC allows 10 screenshots per display size per locale, but the web UI renders
 * at most 10, so a reservation left behind by an interrupted upload
 * (`AWAITING_UPLOAD`, or `FAILED`) is invisible there while still counting
 * toward the limit. That is what makes "Add for Review" fail with "You have
 * uploaded too many screenshots. The maximum is 10." on a version that looks
 * fine. These helpers read the real server-side counts so the extra entries,
 * and the locale/display size they sit in, are visible.
 *
 * Every request in this module is a GET. Nothing here deletes, patches,
 * uploads, or reorders.
 *
 * Shares the JWT/header pattern with `./api` and the pagination/retry pattern
 * with `./pricing` (the two throttles are independent — a pricing run and a
 * screenshot scan at the same time are not coordinated, which is acceptable
 * for a single-user tool).
 */

import { getAuthHeaders } from './api'
import { mapWithConcurrency } from '@/lib/api/concurrent'
import { getNumberEnv } from '@/lib/env'
import { displayTypeLabel } from './screenshot-display-types'
import type { ASCCredentials, ASCResult } from './types'
import { EDITABLE_STATES } from './types'

const BASE_URL = 'https://api.appstoreconnect.apple.com'
const TIMEOUT_MS = 20000
// Some ASC collections cap `limit` at 50, so 50 is the safe page size for every
// resource read here. Pagination covers anything larger.
const PAGE_LIMIT = 50
// Ceiling so a looping `links.next` can never hang a scan.
const MAX_PAGES = 40
const MAX_RETRIES = 6
const MIN_REQUEST_INTERVAL_MS = 150
const RATE_LIMIT_COOLDOWN_MS = 5000

/** Apple's cap: 10 screenshots per display type per locale. */
export const SCREENSHOT_LIMIT = 10

const STATE_COMPLETE = 'COMPLETE'
const STATE_PROCESSING = 'UPLOAD_COMPLETE'
const STATE_AWAITING_UPLOAD = 'AWAITING_UPLOAD'
const STATE_FAILED = 'FAILED'

/** Locales scanned in parallel. Each locale is 1–11 ASC requests. */
const DEFAULT_CONCURRENCY = 5

let nextRequestAt = 0

/** Block until this request's turn in the module-wide rate schedule. */
async function throttle(): Promise<void> {
  const now = Date.now()
  const slot = Math.max(now, nextRequestAt)
  nextRequestAt = slot + MIN_REQUEST_INTERVAL_MS
  const wait = slot - now
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

function applyRateLimitCooldown(): void {
  nextRequestAt = Math.max(nextRequestAt, Date.now()) + RATE_LIMIT_COOLDOWN_MS
}

// =============================================================================
// Public shapes
// =============================================================================

/** A single screenshot as the server holds it — including entries the web UI hides. */
export interface ScreenshotEntry {
  id: string
  fileName: string
  /** `assetDeliveryState.state`: COMPLETE | AWAITING_UPLOAD | UPLOAD_COMPLETE | FAILED | … */
  state: string
  /** `assetDeliveryState.errors` descriptions, when the asset is FAILED. */
  errors: string[]
}

/** One display size within one locale. */
export interface ScreenshotSetAudit {
  id: string
  displayType: string
  label: string
  total: number
  complete: number
  /** UPLOAD_COMPLETE — uploaded, still being processed by Apple. Not an error. */
  processing: number
  /** AWAITING_UPLOAD — reserved but never committed. The ghost. */
  awaitingUpload: number
  failed: number
  /** Anything that is not COMPLETE, in server order. */
  incomplete: ScreenshotEntry[]
  overLimit: boolean
}

export interface LocaleAudit {
  localizationId: string
  locale: string
  sets: ScreenshotSetAudit[]
  total: number
  setsOverLimit: number
  /** AWAITING_UPLOAD + FAILED across the locale. */
  ghosts: number
  /** Set when this locale could not be read; its counts are then unknown. */
  error?: string
}

export interface AuditVersion {
  id: string
  versionString: string
  appStoreState: string
  platform: string
  createdDate: string | null
  editable: boolean
}

// =============================================================================
// JSON:API plumbing
// =============================================================================

interface JsonApiResource {
  id: string
  type: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, { data?: unknown }>
}

interface JsonApiPage {
  data?: JsonApiResource[]
  included?: JsonApiResource[]
  links?: { next?: string }
}

interface GetAllResult {
  data: JsonApiResource[]
  included: JsonApiResource[]
}

/** fetch with retry on 429/5xx, honoring `Retry-After`. */
async function ascFetch(
  url: string,
  headers: Headers,
  externalSignal?: AbortSignal
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }
    await throttle()
    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS)
    const signal = externalSignal
      ? AbortSignal.any([timeoutSignal, externalSignal])
      : timeoutSignal
    const response = await fetch(url, { headers, signal })
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt >= MAX_RETRIES) return response

    if (response.status === 429) applyRateLimitCooldown()
    const retryAfter = Number(response.headers.get('retry-after'))
    const delayMs =
      Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 60000)
        : Math.min(1000 * 2 ** attempt, 30000)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
}

function mapAscError(status: number, fallback: string): string {
  switch (status) {
    case 401:
      return 'Invalid App Store Connect credentials'
    case 403:
      return 'Insufficient permissions. Reading screenshots requires an Admin or App Manager API key.'
    case 404:
      return 'Resource not found'
    case 429:
      return 'Rate limited by App Store Connect. Please try again shortly.'
    default:
      return fallback
  }
}

interface ScanContext {
  headers: Headers
  signal?: AbortSignal
  /**
   * The `include=appScreenshots` fast path turns 1 + N requests per locale into
   * 1. Flipped off for the rest of the scan the first time ASC rejects it, so
   * an unsupported query param degrades to the explicit per-set reads instead
   * of failing the scan.
   */
  includeSupported: boolean
}

/** Follow `links.next` until exhausted, accumulating `data` and `included`. */
async function ascGetAll(
  ctx: ScanContext,
  path: string
): Promise<ASCResult<GetAllResult> & { status?: number }> {
  try {
    const data: JsonApiResource[] = []
    const included: JsonApiResource[] = []
    let next: string | null = path.startsWith('http') ? path : `${BASE_URL}${path}`
    let pages = 0

    while (next && pages < MAX_PAGES) {
      if (ctx.signal?.aborted) return { success: false, error: 'Request aborted' }
      pages++
      const response = await ascFetch(next, ctx.headers, ctx.signal)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        const detail =
          body?.errors?.[0]?.detail ||
          mapAscError(response.status, `Request failed: ${response.status}`)
        console.error(`[screenshots] GET ${path} -> ${response.status}: ${detail}`)
        return { success: false, error: detail, status: response.status }
      }
      const page = (await response.json()) as JsonApiPage
      if (page.data) data.push(...page.data)
      if (page.included) included.push(...page.included)
      next = page.links?.next ?? null
    }

    return { success: true, data: { data, included } }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Request aborted' }
    }
    console.error(`[screenshots] GET ${path} threw:`, error)
    return {
      success: false,
      error: `Error fetching from App Store Connect: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    }
  }
}

function relatedIds(resource: JsonApiResource, name: string): string[] | null {
  const data = resource.relationships?.[name]?.data
  if (!Array.isArray(data)) return null
  return data
    .map((entry) => (entry as { id?: string } | null)?.id)
    .filter((id): id is string => typeof id === 'string')
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toEntry(resource: JsonApiResource): ScreenshotEntry {
  const attrs = resource.attributes ?? {}
  const delivery = attrs.assetDeliveryState as
    | { state?: string; errors?: Array<{ code?: string; description?: string }> }
    | undefined
  return {
    id: resource.id,
    fileName: str(attrs.fileName) || '(no file name)',
    state: str(delivery?.state) || 'UNKNOWN',
    errors: (delivery?.errors ?? [])
      .map((e) => e.description || e.code || '')
      .filter((e): e is string => !!e),
  }
}

function summarizeSet(
  setId: string,
  displayType: string,
  entries: ScreenshotEntry[]
): ScreenshotSetAudit {
  let complete = 0
  let processing = 0
  let awaitingUpload = 0
  let failed = 0

  for (const entry of entries) {
    switch (entry.state) {
      case STATE_COMPLETE:
        complete++
        break
      case STATE_PROCESSING:
        processing++
        break
      case STATE_AWAITING_UPLOAD:
        awaitingUpload++
        break
      case STATE_FAILED:
        failed++
        break
      default:
        // An unrecognized state is surfaced rather than silently counted as
        // healthy: it shows up in `incomplete` below.
        break
    }
  }

  return {
    id: setId,
    displayType,
    label: displayTypeLabel(displayType),
    total: entries.length,
    complete,
    processing,
    awaitingUpload,
    failed,
    incomplete: entries.filter((entry) => entry.state !== STATE_COMPLETE),
    overLimit: entries.length > SCREENSHOT_LIMIT,
  }
}

// =============================================================================
// Reads
// =============================================================================

/**
 * Every App Store version for an app, editable ones first, then newest first.
 * Paginated — an app with a long release history has more than one page.
 */
export async function listAuditVersions(
  credentials: ASCCredentials,
  appId: string,
  signal?: AbortSignal
): Promise<ASCResult<AuditVersion[]>> {
  const headers = await getAuthHeaders(
    credentials.keyId,
    credentials.issuerId,
    credentials.privateKey
  )
  const ctx: ScanContext = { headers, signal, includeSupported: true }

  const result = await ascGetAll(
    ctx,
    `/v1/apps/${appId}/appStoreVersions?limit=${PAGE_LIMIT}`
  )
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Failed to fetch versions' }
  }

  const versions: AuditVersion[] = result.data.data.map((resource) => {
    const attrs = resource.attributes ?? {}
    const appStoreState = str(attrs.appStoreState)
    return {
      id: resource.id,
      versionString: str(attrs.versionString),
      appStoreState,
      platform: str(attrs.platform),
      createdDate: str(attrs.createdDate) || null,
      editable: EDITABLE_STATES.includes(
        appStoreState as (typeof EDITABLE_STATES)[number]
      ),
    }
  })

  versions.sort((a, b) => {
    if (a.editable !== b.editable) return a.editable ? -1 : 1
    const aTime = a.createdDate ? Date.parse(a.createdDate) : NaN
    const bTime = b.createdDate ? Date.parse(b.createdDate) : NaN
    if (Number.isFinite(aTime) && Number.isFinite(bTime) && aTime !== bTime) {
      return bTime - aTime
    }
    return b.versionString.localeCompare(a.versionString, undefined, {
      numeric: true,
    })
  })

  return { success: true, data: versions }
}

/** Authoritative per-set read: follows `links.next` over every screenshot ASC holds. */
async function fetchSetScreenshots(
  ctx: ScanContext,
  setId: string
): Promise<ASCResult<ScreenshotEntry[]>> {
  const result = await ascGetAll(
    ctx,
    `/v1/appScreenshotSets/${setId}/appScreenshots?limit=${PAGE_LIMIT}`
  )
  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Failed to fetch screenshots' }
  }
  return { success: true, data: result.data.data.map(toEntry) }
}

async function auditLocale(
  ctx: ScanContext,
  localizationId: string,
  locale: string
): Promise<LocaleAudit> {
  const base = `/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?limit=${PAGE_LIMIT}`

  let page: GetAllResult | null = null
  let usedInclude = false

  if (ctx.includeSupported) {
    const withInclude = await ascGetAll(
      ctx,
      `${base}&include=appScreenshots&limit[appScreenshots]=${PAGE_LIMIT}`
    )
    if (withInclude.success && withInclude.data) {
      page = withInclude.data
      usedInclude = true
    } else if (
      withInclude.status &&
      withInclude.status >= 400 &&
      withInclude.status < 500 &&
      withInclude.status !== 429
    ) {
      // ASC rejected the include/limit params — stop trying for this scan.
      ctx.includeSupported = false
    } else {
      return {
        localizationId,
        locale,
        sets: [],
        total: 0,
        setsOverLimit: 0,
        ghosts: 0,
        error: withInclude.error || 'Failed to read screenshot sets',
      }
    }
  }

  if (!page) {
    const plain = await ascGetAll(ctx, base)
    if (!plain.success || !plain.data) {
      return {
        localizationId,
        locale,
        sets: [],
        total: 0,
        setsOverLimit: 0,
        ghosts: 0,
        error: plain.error || 'Failed to read screenshot sets',
      }
    }
    page = plain.data
  }

  const includedById = new Map(
    page.included
      .filter((resource) => resource.type === 'appScreenshots')
      .map((resource) => [resource.id, toEntry(resource)])
  )

  const sets: ScreenshotSetAudit[] = []
  let localeError: string | undefined

  for (const setResource of page.data) {
    const displayType = str(setResource.attributes?.screenshotDisplayType)
    let entries: ScreenshotEntry[] | null = null

    if (usedInclude) {
      const ids = relatedIds(setResource, 'appScreenshots')
      // Only trust the include when the relationship is present AND short of
      // the page limit. A full page may be truncated, and a truncated count is
      // exactly the undercount this page exists to expose.
      if (ids && ids.length < PAGE_LIMIT) {
        const resolved = ids
          .map((id) => includedById.get(id))
          .filter((entry): entry is ScreenshotEntry => !!entry)
        if (resolved.length === ids.length) entries = resolved
      }
    }

    if (!entries) {
      const explicit = await fetchSetScreenshots(ctx, setResource.id)
      if (!explicit.success || !explicit.data) {
        localeError = explicit.error || 'Failed to read screenshots'
        continue
      }
      entries = explicit.data
    }

    sets.push(summarizeSet(setResource.id, displayType, entries))
  }

  sets.sort((a, b) => a.label.localeCompare(b.label))

  return {
    localizationId,
    locale,
    sets,
    total: sets.reduce((sum, set) => sum + set.total, 0),
    setsOverLimit: sets.filter((set) => set.overLimit).length,
    ghosts: sets.reduce((sum, set) => sum + set.awaitingUpload + set.failed, 0),
    error: localeError,
  }
}

/**
 * Walk every locale of a version and report what ASC actually holds per display
 * size. `onLocalesDiscovered` fires once the locale list is known;
 * `onLocale` fires as each locale finishes so a caller can stream progress.
 */
export async function auditVersionScreenshots(
  credentials: ASCCredentials,
  versionId: string,
  options: {
    signal?: AbortSignal
    onLocalesDiscovered?: (locales: Array<{ localizationId: string; locale: string }>) => void
    onLocale?: (audit: LocaleAudit) => void
  } = {}
): Promise<ASCResult<LocaleAudit[]>> {
  const { signal, onLocalesDiscovered, onLocale } = options

  const headers = await getAuthHeaders(
    credentials.keyId,
    credentials.issuerId,
    credentials.privateKey
  )
  const ctx: ScanContext = { headers, signal, includeSupported: true }

  const localizations = await ascGetAll(
    ctx,
    `/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=${PAGE_LIMIT}`
  )
  if (!localizations.success || !localizations.data) {
    return {
      success: false,
      error: localizations.error || 'Failed to fetch localizations',
    }
  }

  const entries = localizations.data.data
    .map((resource) => ({
      localizationId: resource.id,
      locale: str(resource.attributes?.locale),
    }))
    .sort((a, b) => a.locale.localeCompare(b.locale))

  onLocalesDiscovered?.(entries)

  const concurrency = getNumberEnv(
    'SCREENSHOT_AUDIT_CONCURRENCY',
    DEFAULT_CONCURRENCY
  )

  const settled = await mapWithConcurrency(entries, concurrency, async (entry) => {
    if (signal?.aborted) {
      return {
        localizationId: entry.localizationId,
        locale: entry.locale,
        sets: [],
        total: 0,
        setsOverLimit: 0,
        ghosts: 0,
        error: 'Scan cancelled',
      } satisfies LocaleAudit
    }
    const audit = await auditLocale(ctx, entry.localizationId, entry.locale)
    onLocale?.(audit)
    return audit
  })

  // A thrown locale is reported as a failed row rather than failing the scan —
  // the rest of the locales are still worth seeing.
  const results: LocaleAudit[] = settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value
    const entry = entries[index]
    const failed: LocaleAudit = {
      localizationId: entry.localizationId,
      locale: entry.locale,
      sets: [],
      total: 0,
      setsOverLimit: 0,
      ghosts: 0,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : 'Failed to read this locale',
    }
    onLocale?.(failed)
    return failed
  })

  return { success: true, data: results }
}
