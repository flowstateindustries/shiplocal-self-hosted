/**
 * Pure, deterministic price-proposal logic.
 *
 * App Store Connect does not accept arbitrary prices — every price must be one
 * of Apple's fixed price points for that territory. So the affordability target
 * (`referencePrice * factor`) is snapped to the nearest available price point
 * in the territory's ladder. No AI, no network, no floating-point surprises in
 * the comparison.
 */

import { getPppFactor } from './ppp-data'
import { MIN_PPP_FACTOR } from './ppp-data'
import type {
  PricePoint,
  TerritoryPriceProposal,
} from './types'

/**
 * Pick the price point whose customer price is numerically closest to
 * `target`. Ties resolve to the lower price (cheaper is friendlier for an
 * affordability tool). Returns `null` for an empty ladder.
 */
export function snapNearest(
  target: number,
  ladder: PricePoint[]
): PricePoint | null {
  let best: PricePoint | null = null
  let bestDist = Infinity
  for (const pp of ladder) {
    const dist = Math.abs(pp.customerPrice - target)
    if (
      dist < bestDist ||
      (dist === bestDist && best !== null && pp.customerPrice < best.customerPrice)
    ) {
      best = pp
      bestDist = dist
    }
  }
  return best
}

/**
 * Combine the PPP factor for a territory with an optional global extra
 * discount, clamped so prices never collapse below the floor.
 *
 * @param territory ISO 3166-1 alpha-3 territory code
 * @param extraDiscount fraction in [0, 0.9] applied on top of PPP
 */
export function effectiveFactor(territory: string, extraDiscount: number): number {
  const ppp = getPppFactor(territory)
  const clampedExtra = Math.min(Math.max(extraDiscount, 0), 0.9)
  return Math.max(ppp * (1 - clampedExtra), MIN_PPP_FACTOR)
}

/**
 * Build the per-territory proposal for a single product.
 *
 * @param equalized  Apple's equalized reference price point per territory
 *                   (the price equivalent to the base price elsewhere).
 * @param ladders    Every available price point per territory.
 * @param extraDiscount global extra discount on top of PPP, in [0, 0.9].
 */
export function computeTerritoryProposals(
  equalized: Map<string, PricePoint>,
  ladders: Map<string, PricePoint[]>,
  extraDiscount: number
): TerritoryPriceProposal[] {
  const proposals: TerritoryPriceProposal[] = []

  for (const [territory, reference] of equalized) {
    const ladder = ladders.get(territory)
    if (!ladder || ladder.length === 0) continue

    const factor = effectiveFactor(territory, extraDiscount)
    const targetPrice = reference.customerPrice * factor
    const snapped = snapNearest(targetPrice, ladder)
    if (!snapped) continue

    // Skip territories where the affordable price snaps back to Apple's current
    // equalized price point — there's no actual change to preview or push.
    if (snapped.id === reference.id) continue

    proposals.push({
      territory,
      currency: reference.currency,
      referencePrice: reference.customerPrice,
      factor,
      targetPrice,
      pricePointId: snapped.id,
      proposedPrice: snapped.customerPrice,
    })
  }

  // Stable, readable ordering: cheapest-relative-to-reference first.
  proposals.sort((a, b) => a.territory.localeCompare(b.territory))
  return proposals
}
