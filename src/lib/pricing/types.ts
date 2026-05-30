/**
 * Pricing domain types shared between the ASC client, the calculator, the
 * API routes, and the UI.
 */

/** A subscription or in-app purchase we can re-price. */
export type PricingProductType = 'subscription' | 'iap'

/** A product the user can select for re-pricing. */
export interface PricingProduct {
  /** ASC resource id (subscription id or inAppPurchase id). */
  id: string
  type: PricingProductType
  /** Reference name / product id shown in the UI. */
  name: string
  /** Apple product identifier (e.g. com.app.pro.yearly), when available. */
  productId?: string
}

/** A single Apple price point in one territory's ladder. */
export interface PricePoint {
  /** ASC price-point resource id. */
  id: string
  territory: string
  /** Customer-facing price as a decimal number in the territory currency. */
  customerPrice: number
  currency: string
}

/** Computed proposal for one territory of one product. */
export interface TerritoryPriceProposal {
  territory: string
  currency: string
  /** Apple's equalized reference price (the "before"). */
  referencePrice: number
  /** Affordability factor applied (1.0 = unchanged). */
  factor: number
  /** referencePrice * factor, before snapping to a real price point. */
  targetPrice: number
  /** Chosen price point id to push. */
  pricePointId: string
  /** Customer price of the chosen price point. */
  proposedPrice: number
}

/** Computed proposal for one product across all its territories. */
export interface ProductPriceProposal {
  productId: string
  type: PricingProductType
  name: string
  /** Price point id used as the base/reference in the base territory. */
  basePricePointId: string
  baseTerritory: string
  basePrice: number
  territories: TerritoryPriceProposal[]
  /**
   * Territories we wanted to discount but couldn't fetch (e.g. ASC rate limits
   * that survived all retries). They keep their current price; surfaced so the
   * user can re-run rather than silently shipping them at full price.
   */
  missingTerritories?: string[]
}

/** Per-product status tracked on the job (mirrors locale_results elsewhere). */
export interface PricingProductStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
  territoryCount?: number
}

/** Config captured at job creation, persisted under results._config. */
export interface PricingJobConfig {
  baseTerritory: string
  /**
   * Extra global discount applied on top of the PPP factor, as a fraction in
   * [0, 0.9]. 0 means "PPP only". Applied as `factor * (1 - extraDiscount)`.
   */
  extraDiscount: number
  products: Array<{ id: string; type: PricingProductType; name: string }>
  /**
   * Date the new prices take effect (`YYYY-MM-DD`). Subscriptions require a
   * date (a `null`/initial price is rejected once approved); IAP schedule
   * entries use it too. Defaults to today.
   */
  startDate?: string
}

/** Shape stored in the pricing_jobs.results JSON column. */
export interface PricingResults {
  _config?: PricingJobConfig
  products: ProductPriceProposal[]
}
