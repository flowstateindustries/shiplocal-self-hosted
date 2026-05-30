import 'server-only'
import {
  getBasePricePoint,
  getEqualizedPricePoints,
  getProductPricePoints,
} from '@/lib/appstore/pricing'
import { snapNearest, effectiveFactor } from './calculator'
import { getPricingTerritories } from './ppp-data'
import type { ASCCredentials } from '@/lib/appstore/types'
import type {
  PricePoint,
  ProductPriceProposal,
  PricingProductType,
  TerritoryPriceProposal,
} from './types'

/**
 * Compute the full per-territory price proposal for a single product.
 *
 * This uses Apple's *equalization* endpoint instead of downloading every
 * territory's full price ladder, which collapses ~1,000 ASC requests per
 * product down to a few dozen (one per distinct discount tier):
 *
 *   1. Read the product's current base-territory price + that territory's ladder.
 *   2. Equalize the base price point once → full-price reference per territory.
 *   3. For each territory, snap (basePrice × factor) within the BASE ladder to a
 *      real base price point, and group territories by the point they land on.
 *   4. Equalize each distinct base point once → Apple's equivalent discounted
 *      price in every territory (already a real, valid price point).
 *
 * The result per territory is "Apple's equivalent of the discounted base
 * price" — the same thing you'd get by setting a base price and letting Apple
 * auto-equalize, but applied per affordability tier. All deterministic; no AI.
 */
export async function computeProductProposal(
  credentials: ASCCredentials,
  baseTerritory: string,
  extraDiscount: number,
  product: { id: string; type: PricingProductType; name: string },
  signal?: AbortSignal
): Promise<
  | { success: true; proposal: ProductPriceProposal }
  | { success: false; error: string }
> {
  const tag = `[pricing] ${product.type} ${product.id} (${product.name})`

  // 1a. Current price in the base territory (anchors everything).
  const base = await getBasePricePoint(
    credentials,
    product.type,
    product.id,
    baseTerritory,
    signal
  )
  if (!base.success || !base.data) {
    console.error(`${tag}: base price FAILED: ${base.error}`)
    return { success: false, error: base.error || 'Failed to read base price' }
  }

  // 1b. The base territory's full ladder, to snap discounted base prices into.
  const baseLadderRes = await getProductPricePoints(
    credentials,
    product.type,
    product.id,
    [baseTerritory],
    signal
  )
  if (!baseLadderRes.success || !baseLadderRes.data) {
    console.error(`${tag}: base ladder FAILED: ${baseLadderRes.error}`)
    return {
      success: false,
      error: baseLadderRes.error || 'Failed to read base price points',
    }
  }
  const baseLadder = baseLadderRes.data.ladders.get(baseTerritory) ?? []
  if (baseLadder.length === 0) {
    return {
      success: false,
      error: `No price points found in base territory ${baseTerritory}.`,
    }
  }

  // 2. Full-price reference per territory (one equalization of the base point).
  const refRes = await getEqualizedPricePoints(
    credentials,
    product.type,
    base.data.pricePointId,
    signal
  )
  if (!refRes.success || !refRes.data) {
    console.error(`${tag}: reference equalizations FAILED: ${refRes.error}`)
    return {
      success: false,
      error: refRes.error || 'Failed to read equalized prices',
    }
  }
  const reference = refRes.data

  // 3. Group target territories by the base price point their discount lands on.
  const groups = new Map<string, { point: PricePoint; territories: string[] }>()
  for (const territory of getPricingTerritories()) {
    // Skip territories Apple doesn't offer this product in (not in equalizations).
    if (!reference.has(territory)) continue
    const factor = effectiveFactor(territory, extraDiscount)
    const target = base.data.customerPrice * factor
    const snapped = snapNearest(target, baseLadder)
    if (!snapped) continue
    const group = groups.get(snapped.id) ?? { point: snapped, territories: [] }
    group.territories.push(territory)
    groups.set(snapped.id, group)
  }

  // 4. Equalize each distinct base point once; map to each territory.
  const territories: TerritoryPriceProposal[] = []
  const failed: string[] = []
  for (const [pointId, group] of groups) {
    if (signal?.aborted) break

    // If the discount snaps back to the current base point, the equivalent is
    // the reference itself — no discount, nothing to push for these.
    let equalized = reference
    if (pointId !== base.data.pricePointId) {
      const eqRes = await getEqualizedPricePoints(
        credentials,
        product.type,
        pointId,
        signal
      )
      if (!eqRes.success || !eqRes.data) {
        failed.push(...group.territories)
        continue
      }
      equalized = eqRes.data
    }

    for (const territory of group.territories) {
      const ref = reference.get(territory)
      const proposed = equalized.get(territory)
      if (!ref || !proposed) {
        failed.push(territory)
        continue
      }
      // Skip when the affordable price is the same point as the current one.
      if (proposed.id === ref.id) continue
      const factor = effectiveFactor(territory, extraDiscount)
      territories.push({
        territory,
        currency: proposed.currency,
        referencePrice: ref.customerPrice,
        factor,
        targetPrice: ref.customerPrice * factor,
        pricePointId: proposed.id,
        proposedPrice: proposed.customerPrice,
      })
    }
  }

  territories.sort((a, b) => a.territory.localeCompare(b.territory))
  console.log(
    `${tag}: ${territories.length} territories changed via ${groups.size} tier(s)` +
      (failed.length ? `, ${failed.length} failed` : '')
  )

  return {
    success: true,
    proposal: {
      productId: product.id,
      type: product.type,
      name: product.name,
      basePricePointId: base.data.pricePointId,
      baseTerritory,
      basePrice: base.data.customerPrice,
      territories,
      ...(failed.length > 0 && { missingTerritories: failed }),
    },
  }
}
