/**
 * Pricing domain — per-country affordability for subscriptions & IAPs.
 */

export type {
  PricingProduct,
  PricingProductType,
  PricePoint,
  TerritoryPriceProposal,
  ProductPriceProposal,
  PricingProductStatus,
  PricingJobConfig,
  PricingResults,
} from './types'

export {
  PPP_FACTORS,
  getPppFactor,
  getTerritoryName,
  getPricingTerritories,
  MIN_PPP_FACTOR,
} from './ppp-data'
export {
  snapNearest,
  effectiveFactor,
  computeTerritoryProposals,
} from './calculator'
export { CONCURRENT_PRICING_PRODUCTS, DEFAULT_BASE_TERRITORY } from './constants'
export { determineFinalPricingStatus } from './job-utils'
