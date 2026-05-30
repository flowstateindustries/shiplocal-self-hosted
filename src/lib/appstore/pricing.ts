/**
 * App Store Connect — pricing (subscriptions & in-app purchases).
 *
 * Apple does not accept arbitrary prices: every price is one of Apple's fixed
 * price points for a territory. These helpers read the available price points,
 * the per-territory "equalized" reference price for a base price point, and
 * write new prices back. They reuse the JWT/header pattern from `./api`.
 *
 * NOTE: the ASC pricing resources/attributes are the least stable part of the
 * API. The shapes below follow Apple's documented JSON:API structure; verify
 * against the current ASC OpenAPI spec if a request starts failing.
 */

import { getAuthHeaders } from './api'
import { mapWithConcurrency } from '@/lib/api/concurrent'
import type { ASCCredentials, ASCResult } from './types'
import type {
  PricePoint,
  PricingProduct,
  PricingProductType,
} from '@/lib/pricing/types'

const BASE_URL = 'https://api.appstoreconnect.apple.com'
const TIMEOUT_MS = 20000
const PAGE_LIMIT = 200
// Hard ceiling on pagination so a misbehaving/looping `links.next` can never
// hang a request indefinitely.
const MAX_PAGES = 60
// Territory ladders are fetched one territory at a time, in parallel. Kept low
// because each subscription territory is several pages of price points and ASC
// rate-limits aggressively. The global throttle below is the real limiter.
const TERRITORY_FETCH_CONCURRENCY = 3
// Retries for transient 429 / 5xx responses before giving up.
const MAX_RETRIES = 8
// Minimum spacing between *every* ASC request, enforced globally across all
// concurrent workers (~6–7 req/s steady state). Proactively staying under
// Apple's burst limit prevents the 429 storms that otherwise drop territories.
const MIN_REQUEST_INTERVAL_MS = 150
// Extra global pause applied after a 429 — slows the whole pipeline, not just
// the one request, so we back off instead of hammering.
const RATE_LIMIT_COOLDOWN_MS = 5000

// Shared schedule timestamp: the earliest time the next request may start.
let nextRequestAt = 0

/** Block until this request's turn in the global rate schedule. */
async function throttle(): Promise<void> {
  const now = Date.now()
  const slot = Math.max(now, nextRequestAt)
  nextRequestAt = slot + MIN_REQUEST_INTERVAL_MS
  const wait = slot - now
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

/** After a 429, push the shared schedule out so all workers slow down. */
function applyRateLimitCooldown(): void {
  nextRequestAt = Math.max(nextRequestAt, Date.now()) + RATE_LIMIT_COOLDOWN_MS
}

interface JsonApiResource {
  id: string
  type: string
  attributes?: Record<string, unknown>
  relationships?: Record<string, { data?: { id: string; type: string } | null }>
}

interface JsonApiPage {
  data?: JsonApiResource[]
  included?: JsonApiResource[]
  links?: { next?: string }
}

/**
 * fetch wrapper that retries transient failures (429 rate limits and 5xx) with
 * exponential backoff, honoring a `Retry-After` header when present. ASC
 * rate-limits pricing reads/writes hard, so without this whole territories get
 * dropped mid-run.
 */
async function ascFetch(
  url: string,
  init: RequestInit,
  externalSignal?: AbortSignal
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError')
    }
    await throttle()
    // Combine our per-request timeout with the caller's cancellation signal so
    // a client disconnect aborts the in-flight request immediately.
    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS)
    const signal = externalSignal
      ? AbortSignal.any([timeoutSignal, externalSignal])
      : timeoutSignal
    const response = await fetch(url, { ...init, signal })
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

/**
 * ASC rejects price start dates that aren't far enough in the future — it
 * accounts for weekends/holidays and states the earliest valid date in the 409
 * (e.g. "…must be on or after 2026-05-26"). Extract that date so the caller can
 * retry with Apple's own minimum rather than guessing the calendar.
 */
export function parseMinStartDate(error: string | undefined): string | null {
  if (!error) return null
  const m = error.match(/on or after (\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function mapAscError(status: number, fallback: string): string {
  switch (status) {
    case 401:
      return 'Invalid App Store Connect credentials'
    case 403:
      return 'Insufficient permissions. Pricing requires an Admin or App Manager API key.'
    case 404:
      return 'Resource not found'
    case 409:
      return 'Conflict — the product may not be in an editable state'
    case 429:
      return 'Rate limited by App Store Connect. Please try again shortly.'
    default:
      return fallback
  }
}

/**
 * Follow JSON:API `links.next` until exhausted, accumulating `data` and
 * `included` across every page. The existing client never paginated; price
 * ladders span ~175 territories so this is required here.
 */
async function ascGetAll(
  credentials: ASCCredentials,
  path: string,
  signal?: AbortSignal
): Promise<ASCResult<{ data: JsonApiResource[]; included: JsonApiResource[] }>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const data: JsonApiResource[] = []
    const included: JsonApiResource[] = []
    let next: string | null = path.startsWith('http')
      ? path
      : `${BASE_URL}${path}`

    let pages = 0
    while (next && pages < MAX_PAGES) {
      if (signal?.aborted) return { success: false, error: 'Request aborted' }
      pages++
      const response = await ascFetch(next, { headers }, signal)
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}))
        const detail =
          errorBody?.errors?.[0]?.detail ||
          mapAscError(response.status, `Request failed: ${response.status}`)
        console.error(`[pricing] GET ${path} -> ${response.status}: ${detail}`)
        return { success: false, error: detail }
      }
      const page = (await response.json()) as JsonApiPage
      if (page.data) data.push(...page.data)
      if (page.included) included.push(...page.included)
      next = page.links?.next ?? null
    }

    return { success: true, data: { data, included } }
  } catch (error) {
    console.error(`[pricing] GET ${path} threw:`, error)
    return {
      success: false,
      error: `Error fetching from App Store Connect: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    }
  }
}

async function ascPost(
  credentials: ASCCredentials,
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<ASCResult<{ id: string }>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )
    const response = await ascFetch(
      `${BASE_URL}${path}`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
      signal
    )
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      const detail =
        errorBody?.errors?.[0]?.detail ||
        mapAscError(response.status, `Status ${response.status}`)
      console.error(`[pricing] POST ${path} -> ${response.status}: ${detail}`)
      return { success: false, error: detail }
    }
    const json = await response.json().catch(() => ({}))
    return { success: true, data: { id: json?.data?.id ?? '' } }
  } catch (error) {
    return {
      success: false,
      error: `Error writing to App Store Connect: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    }
  }
}

/**
 * Single-page GET for to-one relationships (e.g. an IAP's price schedule),
 * where `data` is an object rather than an array — `ascGetAll` would try to
 * spread it and fail.
 */
async function ascGet(
  credentials: ASCCredentials,
  path: string,
  signal?: AbortSignal
): Promise<
  ASCResult<{ data: JsonApiResource | null; included: JsonApiResource[] }>
> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )
    const response = await ascFetch(`${BASE_URL}${path}`, { headers }, signal)
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      const detail =
        errorBody?.errors?.[0]?.detail ||
        mapAscError(response.status, `Request failed: ${response.status}`)
      console.error(`[pricing] GET(one) ${path} -> ${response.status}: ${detail}`)
      return { success: false, error: detail }
    }
    const page = (await response.json()) as {
      data?: JsonApiResource
      included?: JsonApiResource[]
    }
    return {
      success: true,
      data: { data: page.data ?? null, included: page.included ?? [] },
    }
  } catch (error) {
    console.error(`[pricing] GET(one) ${path} threw:`, error)
    return {
      success: false,
      error: `Error fetching from App Store Connect: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    }
  }
}

/**
 * From a set of current price resources (subscriptionPrices / inAppPurchasePrices)
 * plus their included price points, pick the one for `baseTerritory`. Matches on
 * the price's `territory` relationship, falling back to a price point's own
 * territory relationship, and finally (when the caller pre-filtered by territory)
 * to the first included price point.
 */
function pickBasePoint(
  prices: JsonApiResource[],
  included: JsonApiResource[],
  pointRelationship: string,
  baseTerritory: string,
  allowFirstFallback: boolean
): ASCResult<{ pricePointId: string; customerPrice: number }> {
  const pointById = new Map(
    included
      .filter((i) => i.type.endsWith('PricePoints'))
      .map((p) => [p.id, p] as const)
  )

  let chosenId: string | undefined
  for (const price of prices) {
    const territory = price.relationships?.territory?.data?.id
    const pointId = price.relationships?.[pointRelationship]?.data?.id
    if (territory === baseTerritory && pointId) {
      chosenId = pointId
      break
    }
  }
  if (!chosenId) {
    for (const pt of pointById.values()) {
      if (pt.relationships?.territory?.data?.id === baseTerritory) {
        chosenId = pt.id
        break
      }
    }
  }
  if (!chosenId && allowFirstFallback) {
    chosenId = pointById.keys().next().value
  }
  if (!chosenId) {
    return {
      success: false,
      error: `No current price set in base territory ${baseTerritory}. Set a price there first, or pick a different base territory.`,
    }
  }
  const point = pointById.get(chosenId)
  if (!point) {
    return { success: false, error: `Base price point not found in response.` }
  }
  return {
    success: true,
    data: {
      pricePointId: chosenId,
      customerPrice: parsePrice(point.attributes?.customerPrice),
    },
  }
}

/** Build territoryId → ISO currency from an `included` array of territories. */
function territoryCurrencyMap(included: JsonApiResource[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const inc of included) {
    if (inc.type === 'territories') {
      const currency = (inc.attributes?.currency as string) || ''
      map.set(inc.id, currency)
    }
  }
  return map
}

function parsePrice(value: unknown): number {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value)
  return Number.isFinite(n) ? n : NaN
}

/**
 * List a single app's auto-renewable subscriptions and in-app purchases so the
 * user can choose which products to re-price.
 */
export async function listAppPricingProducts(
  credentials: ASCCredentials,
  appId: string
): Promise<ASCResult<PricingProduct[]>> {
  const products: PricingProduct[] = []

  // Subscriptions live inside subscription groups. Fetch the groups, then each
  // group's subscriptions as a top-level (paginated) call — ASC caps the nested
  // `limit[subscriptions]` relationship limit at 50, so `include=subscriptions`
  // with a higher limit is rejected with a 400.
  const groups = await ascGetAll(
    credentials,
    `/v1/apps/${appId}/subscriptionGroups?limit=200`
  )
  if (!groups.success) return { success: false, error: groups.error }

  for (const group of groups.data!.data) {
    const subs = await ascGetAll(
      credentials,
      `/v1/subscriptionGroups/${group.id}/subscriptions?limit=200`
    )
    if (!subs.success) return { success: false, error: subs.error }
    for (const sub of subs.data!.data) {
      products.push({
        id: sub.id,
        type: 'subscription',
        name:
          (sub.attributes?.name as string) ||
          (sub.attributes?.productId as string) ||
          sub.id,
        productId: sub.attributes?.productId as string | undefined,
      })
    }
  }

  // In-app purchases (v2).
  const iaps = await ascGetAll(
    credentials,
    `/v1/apps/${appId}/inAppPurchasesV2?limit=200`
  )
  if (!iaps.success) return { success: false, error: iaps.error }
  for (const res of iaps.data!.data) {
    products.push({
      id: res.id,
      type: 'iap',
      name: (res.attributes?.name as string) || (res.attributes?.productId as string) || res.id,
      productId: res.attributes?.productId as string | undefined,
    })
  }

  products.sort((a, b) => a.name.localeCompare(b.name))
  return { success: true, data: products }
}

function pricePointsBase(type: PricingProductType, productId: string): string {
  return type === 'subscription'
    ? `/v1/subscriptions/${productId}/pricePoints`
    : `/v2/inAppPurchases/${productId}/pricePoints`
}

/** Parse one page of price-point resources into a per-territory ladder map. */
function ingestPricePoints(
  page: { data: JsonApiResource[]; included: JsonApiResource[] },
  ladders: Map<string, PricePoint[]>
): void {
  const currencyByTerritory = territoryCurrencyMap(page.included)
  for (const pp of page.data) {
    const territory = pp.relationships?.territory?.data?.id
    const customerPrice = parsePrice(pp.attributes?.customerPrice)
    if (!territory || !Number.isFinite(customerPrice)) continue
    const point: PricePoint = {
      id: pp.id,
      territory,
      customerPrice,
      currency: currencyByTerritory.get(territory) || '',
    }
    const ladder = ladders.get(territory)
    if (ladder) ladder.push(point)
    else ladders.set(territory, [point])
  }
}

/**
 * Every available price point for a product, grouped by territory — the
 * candidate ladders the affordability target snaps into.
 *
 * When `territories` is given (the affordability dataset), each territory's
 * ladder is fetched as its own single-territory request, in parallel. A single
 * territory's ladder fits in one page, so this avoids paginating across all
 * ~175 App Store territories (which is slow and was prone to hanging). Without
 * `territories`, falls back to the full paginated fetch (page-capped).
 */
export async function getProductPricePoints(
  credentials: ASCCredentials,
  type: PricingProductType,
  productId: string,
  territories?: string[],
  signal?: AbortSignal
): Promise<ASCResult<{ ladders: Map<string, PricePoint[]>; failed: string[] }>> {
  const ladders = new Map<string, PricePoint[]>()
  const failed: string[] = []
  const base = pricePointsBase(type, productId)

  if (territories && territories.length > 0) {
    let firstError: string | undefined
    await mapWithConcurrency(
      territories,
      TERRITORY_FETCH_CONCURRENCY,
      async (territory) => {
        // Stop launching new territory fetches once the client has gone away.
        if (signal?.aborted) return
        const res = await ascGetAll(
          credentials,
          `${base}?include=territory&limit=${PAGE_LIMIT}&filter[territory]=${territory}`,
          signal
        )
        if (signal?.aborted) return
        if (!res.success) {
          // Track which territories we couldn't price so the caller can surface
          // them instead of silently leaving them at their current price.
          failed.push(territory)
          if (!firstError) firstError = res.error
          return
        }
        ingestPricePoints(res.data!, ladders)
      }
    )
    // Only hard-fail if *every* territory failed; otherwise proceed with what we
    // have and report the gaps via `failed`.
    if (ladders.size === 0 && firstError) {
      return { success: false, error: firstError }
    }
  } else {
    const res = await ascGetAll(
      credentials,
      `${base}?include=territory&limit=${PAGE_LIMIT}`,
      signal
    )
    if (!res.success) return { success: false, error: res.error }
    ingestPricePoints(res.data!, ladders)
  }

  for (const ladder of ladders.values()) {
    ladder.sort((a, b) => a.customerPrice - b.customerPrice)
  }
  return { success: true, data: { ladders, failed } }
}

/**
 * Find the product's currently-configured price point in the base territory.
 * This anchors the equalization lookup (the per-territory reference prices).
 */
export async function getBasePricePoint(
  credentials: ASCCredentials,
  type: PricingProductType,
  productId: string,
  baseTerritory: string,
  signal?: AbortSignal
): Promise<ASCResult<{ pricePointId: string; customerPrice: number }>> {
  if (type === 'iap') {
    // The price schedule is a to-one relationship; its id is needed to read
    // the configured manual prices. (ASC rejects a two-hop relationship URL.)
    const sched = await ascGet(
      credentials,
      `/v2/inAppPurchases/${productId}/iapPriceSchedule`,
      signal
    )
    if (!sched.success) return { success: false, error: sched.error }
    const scheduleId = sched.data!.data?.id
    if (!scheduleId) {
      return {
        success: false,
        error: 'No price schedule found for this in-app purchase.',
      }
    }
    const mp = await ascGetAll(
      credentials,
      `/v1/inAppPurchasePriceSchedules/${scheduleId}/manualPrices?include=inAppPurchasePricePoint,territory&limit=${PAGE_LIMIT}`,
      signal
    )
    if (!mp.success) return { success: false, error: mp.error }
    return pickBasePoint(
      mp.data!.data,
      mp.data!.included,
      'inAppPurchasePricePoint',
      baseTerritory,
      false
    )
  }

  // Subscriptions expose current prices directly; filter to the base territory.
  const sp = await ascGetAll(
    credentials,
    `/v1/subscriptions/${productId}/prices?include=subscriptionPricePoint,territory&filter[territory]=${baseTerritory}&limit=${PAGE_LIMIT}`,
    signal
  )
  if (!sp.success) return { success: false, error: sp.error }
  return pickBasePoint(
    sp.data!.data,
    sp.data!.included,
    'subscriptionPricePoint',
    baseTerritory,
    true
  )
}

/**
 * Apple's "equalized" reference price point for a base price point, per
 * territory — the price Apple considers equivalent to the base elsewhere.
 * This is the affordability baseline we then scale by the PPP factor.
 */
export async function getEqualizedPricePoints(
  credentials: ASCCredentials,
  type: PricingProductType,
  basePricePointId: string,
  signal?: AbortSignal
): Promise<ASCResult<Map<string, PricePoint>>> {
  const path =
    type === 'subscription'
      ? `/v1/subscriptionPricePoints/${basePricePointId}/equalizations?include=territory&limit=${PAGE_LIMIT}`
      : `/v1/inAppPurchasePricePoints/${basePricePointId}/equalizations?include=territory&limit=${PAGE_LIMIT}`

  const res = await ascGetAll(credentials, path, signal)
  if (!res.success) return { success: false, error: res.error }

  const currencyByTerritory = territoryCurrencyMap(res.data!.included)
  const equalized = new Map<string, PricePoint>()
  for (const pp of res.data!.data) {
    const territory = pp.relationships?.territory?.data?.id
    const customerPrice = parsePrice(pp.attributes?.customerPrice)
    if (!territory || !Number.isFinite(customerPrice)) continue
    equalized.set(territory, {
      id: pp.id,
      territory,
      customerPrice,
      currency: currencyByTerritory.get(territory) || '',
    })
  }
  return { success: true, data: equalized }
}

/**
 * Set a subscription's price in one territory (POST /v1/subscriptionPrices).
 * Subscriptions are priced one territory at a time.
 *
 * `startDate` must be a real date (`YYYY-MM-DD`), not null: a null/initial
 * price is rejected once the subscription is approved ("Initial price cannot be
 * created again"), so a dated change is what works for live subscriptions.
 *
 * `preserveCurrentPrice` only affects price *increases*; Apple always applies
 * *decreases* to existing subscribers regardless. This tool only ever lowers
 * prices, so we send `false` ("applies to everyone") — which is what happens
 * anyway.
 */
export async function pushSubscriptionPrice(
  credentials: ASCCredentials,
  subscriptionId: string,
  pricePointId: string,
  startDate: string,
  signal?: AbortSignal
): Promise<ASCResult<{ id: string }>> {
  return ascPost(
    credentials,
    '/v1/subscriptionPrices',
    {
      data: {
        type: 'subscriptionPrices',
        attributes: {
          startDate,
          preserveCurrentPrice: false,
        },
        relationships: {
          subscription: { data: { type: 'subscriptions', id: subscriptionId } },
          subscriptionPricePoint: {
            data: { type: 'subscriptionPricePoints', id: pricePointId },
          },
        },
      },
    },
    signal
  )
}

/**
 * Set an IAP's prices for many territories at once by creating a new price
 * schedule (POST /v1/inAppPurchasePriceSchedules). A new schedule replaces the
 * product's existing manual prices.
 */
export async function pushIapPriceSchedule(
  credentials: ASCCredentials,
  inAppPurchaseId: string,
  baseTerritory: string,
  prices: Array<{ territory: string; pricePointId: string; startDate?: string | null }>,
  startDate: string,
  signal?: AbortSignal
): Promise<ASCResult<{ id: string }>> {
  const included = prices.map((p) => ({
    type: 'inAppPurchasePrices',
    id: `\${price-${p.territory}}`,
    // null = omit startDate entirely (Apple interprets that as "initial / from the beginning")
    attributes: p.startDate === null ? {} : { startDate: p.startDate ?? startDate },
    relationships: {
      inAppPurchasePricePoint: {
        data: { type: 'inAppPurchasePricePoints', id: p.pricePointId },
      },
      territory: { data: { type: 'territories', id: p.territory } },
    },
  }))

  return ascPost(
    credentials,
    '/v1/inAppPurchasePriceSchedules',
    {
      data: {
        type: 'inAppPurchasePriceSchedules',
        relationships: {
          inAppPurchase: {
            data: { type: 'inAppPurchases', id: inAppPurchaseId },
          },
          baseTerritory: {
            data: { type: 'territories', id: baseTerritory },
          },
          manualPrices: {
            data: included.map((i) => ({ type: i.type, id: i.id })),
          },
        },
      },
      included,
    },
    signal
  )
}
