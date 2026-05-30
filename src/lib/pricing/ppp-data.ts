/**
 * Bundled purchasing-power-parity (PPP) affordability dataset.
 *
 * Each App Store territory maps to an affordability `factor` in the range
 * [0.25, 1.0]. The factor expresses how much a price should be scaled relative
 * to the United States baseline so the result is roughly as affordable locally
 * as the US price is to a US customer. The US is the anchor at `1.0`.
 *
 *   factor = round( clamp( GNIpcPPP(country) / GNIpcPPP(USA), 0.20, 1.00 ), 2 )
 *
 * NOTE: the raw values below were derived with a 0.20 floor, but the live
 * business floor is `MIN_PPP_FACTOR` (0.25), applied at compute time — so any
 * territory showing a raw 0.20–0.24 is effectively priced at 0.25.
 *
 * Source: World Bank, GNI per capita PPP (NY.GNP.PCAP.PP.CD), latest available
 * (2024 where present, else 2023). USA denominator = $83,090 (WDI 2024).
 * Covers all 175 App Store storefronts. Re-derive against the World Bank July
 * refresh annually.
 *
 * Territory codes are ISO 3166-1 alpha-3, matching App Store Connect territory
 * IDs (e.g. `USA`, `IND`, `PAK`). The `currency` field is informational ONLY —
 * actual pushed prices always snap to Apple price points and use the billing
 * currency Apple returns at runtime, so the `currency` values here (some of
 * which are best-effort, flagged ⚠) never affect a pushed price.
 */

export interface PppEntry {
  /** Territory display name. */
  name: string
  /** ISO 4217 billing currency — informational only (real currency comes from ASC). */
  currency: string
  /** Affordability multiplier relative to the US (1.0 = no discount). */
  factor: number
}

/**
 * Keyed by ISO 3166-1 alpha-3 territory code. Territories not present here are
 * treated as `factor = 1.0` (no affordability discount) by {@link getPppFactor}.
 */
export const PPP_FACTORS: Record<string, PppEntry> = {
  AFG: { name: 'Afghanistan', currency: 'USD', factor: 0.20 },
  AGO: { name: 'Angola', currency: 'USD', factor: 0.20 },
  AIA: { name: 'Anguilla', currency: 'USD', factor: 0.40 },
  ALB: { name: 'Albania', currency: 'ALL', factor: 0.23 },
  AND: { name: 'Andorra', currency: 'EUR', factor: 0.78 },
  ARE: { name: 'United Arab Emirates', currency: 'AED', factor: 1.00 },
  ARG: { name: 'Argentina', currency: 'USD', factor: 0.33 }, // Apple bills in USD
  ARM: { name: 'Armenia', currency: 'AMD', factor: 0.25 },
  ATG: { name: 'Antigua and Barbuda', currency: 'USD', factor: 0.32 },
  AUS: { name: 'Australia', currency: 'AUD', factor: 1.00 }, // developed market — full price
  AUT: { name: 'Austria', currency: 'EUR', factor: 1.00 }, // developed market — full price
  AZE: { name: 'Azerbaijan', currency: 'AZN', factor: 0.25 },
  BDI: { name: 'Burundi', currency: 'USD', factor: 0.20 },
  BEL: { name: 'Belgium', currency: 'EUR', factor: 1.00 }, // developed market — full price
  BEN: { name: 'Benin', currency: 'XOF', factor: 0.20 },
  BFA: { name: 'Burkina Faso', currency: 'XOF', factor: 0.20 },
  BGD: { name: 'Bangladesh', currency: 'USD', factor: 0.20 },
  BGR: { name: 'Bulgaria', currency: 'EUR', factor: 0.43 }, // BGN→EUR Jan 2026
  BHR: { name: 'Bahrain', currency: 'USD', factor: 1.00 }, // high-income Gulf — full price
  BHS: { name: 'Bahamas', currency: 'USD', factor: 0.55 },
  BIH: { name: 'Bosnia and Herzegovina', currency: 'USD', factor: 0.27 }, // ⚠ currency
  BLR: { name: 'Belarus', currency: 'USD', factor: 0.30 }, // Apple bills in USD
  BLZ: { name: 'Belize', currency: 'USD', factor: 0.20 },
  BMU: { name: 'Bermuda', currency: 'USD', factor: 1.00 },
  BOL: { name: 'Bolivia', currency: 'USD', factor: 0.20 }, // Apple bills in USD
  BRA: { name: 'Brazil', currency: 'BRL', factor: 0.23 },
  BRB: { name: 'Barbados', currency: 'USD', factor: 0.26 },
  BRN: { name: 'Brunei Darussalam', currency: 'USD', factor: 0.91 }, // ⚠ currency
  BTN: { name: 'Bhutan', currency: 'USD', factor: 0.20 },
  BWA: { name: 'Botswana', currency: 'USD', factor: 0.22 },
  CAN: { name: 'Canada', currency: 'CAD', factor: 1.00 }, // developed market — full price
  CHE: { name: 'Switzerland', currency: 'CHF', factor: 1.00 },
  CHL: { name: 'Chile', currency: 'CLP', factor: 0.39 },
  CHN: { name: 'China mainland', currency: 'CNY', factor: 0.28 },
  CIV: { name: "Côte d'Ivoire", currency: 'XOF', factor: 0.20 },
  CMR: { name: 'Cameroon', currency: 'XAF', factor: 0.20 },
  COD: { name: 'Congo (DRC)', currency: 'USD', factor: 0.20 },
  COG: { name: 'Congo (Republic)', currency: 'XAF', factor: 0.20 },
  COL: { name: 'Colombia', currency: 'COP', factor: 0.25 },
  CPV: { name: 'Cape Verde', currency: 'USD', factor: 0.21 },
  CRI: { name: 'Costa Rica', currency: 'USD', factor: 0.34 }, // ⚠ currency
  CYP: { name: 'Cyprus', currency: 'EUR', factor: 0.69 },
  CZE: { name: 'Czechia', currency: 'CZK', factor: 0.62 },
  DEU: { name: 'Germany', currency: 'EUR', factor: 1.00 }, // developed market — full price
  DMA: { name: 'Dominica', currency: 'USD', factor: 0.21 },
  DNK: { name: 'Denmark', currency: 'DKK', factor: 1.00 }, // developed market — full price
  DOM: { name: 'Dominican Republic', currency: 'USD', factor: 0.30 }, // ⚠ currency
  DZA: { name: 'Algeria', currency: 'USD', factor: 0.20 }, // ⚠ currency
  ECU: { name: 'Ecuador', currency: 'USD', factor: 0.20 },
  EGY: { name: 'Egypt', currency: 'EGP', factor: 0.20 },
  ESP: { name: 'Spain', currency: 'EUR', factor: 1.00 }, // developed market — full price
  EST: { name: 'Estonia', currency: 'EUR', factor: 0.57 },
  FIN: { name: 'Finland', currency: 'EUR', factor: 1.00 }, // developed market — full price
  FJI: { name: 'Fiji', currency: 'USD', factor: 0.20 },
  FRA: { name: 'France', currency: 'EUR', factor: 1.00 }, // developed market — full price
  FSM: { name: 'Micronesia', currency: 'USD', factor: 0.20 },
  GAB: { name: 'Gabon', currency: 'XAF', factor: 0.22 },
  GBR: { name: 'United Kingdom', currency: 'GBP', factor: 1.00 }, // developed market — full price
  GEO: { name: 'Georgia', currency: 'USD', factor: 0.27 }, // ⚠ currency
  GHA: { name: 'Ghana', currency: 'USD', factor: 0.20 }, // ⚠ currency
  GIN: { name: 'Guinea', currency: 'USD', factor: 0.20 },
  GMB: { name: 'Gambia', currency: 'USD', factor: 0.20 },
  GNB: { name: 'Guinea-Bissau', currency: 'XOF', factor: 0.20 },
  GRC: { name: 'Greece', currency: 'EUR', factor: 0.52 },
  GRD: { name: 'Grenada', currency: 'USD', factor: 0.21 },
  GTM: { name: 'Guatemala', currency: 'USD', factor: 0.22 }, // ⚠ currency
  GUY: { name: 'Guyana', currency: 'USD', factor: 0.55 },
  HKG: { name: 'Hong Kong', currency: 'HKD', factor: 1.00 }, // developed market — full price
  HND: { name: 'Honduras', currency: 'USD', factor: 0.20 }, // ⚠ currency
  HRV: { name: 'Croatia', currency: 'EUR', factor: 0.55 }, // EUR Jan 2023
  HUN: { name: 'Hungary', currency: 'HUF', factor: 0.51 },
  IDN: { name: 'Indonesia', currency: 'IDR', factor: 0.20 },
  IND: { name: 'India', currency: 'INR', factor: 0.20 },
  IRL: { name: 'Ireland', currency: 'EUR', factor: 1.00 },
  IRQ: { name: 'Iraq', currency: 'USD', factor: 0.20 },
  ISL: { name: 'Iceland', currency: 'USD', factor: 1.00 }, // developed market — full price
  ISR: { name: 'Israel', currency: 'ILS', factor: 1.00 }, // developed market — full price
  ITA: { name: 'Italy', currency: 'EUR', factor: 1.00 }, // developed market — full price
  JAM: { name: 'Jamaica', currency: 'USD', factor: 0.21 }, // ⚠ currency
  JOR: { name: 'Jordan', currency: 'USD', factor: 0.20 }, // ⚠ currency
  JPN: { name: 'Japan', currency: 'JPY', factor: 1.00 }, // developed market — full price
  KAZ: { name: 'Kazakhstan', currency: 'KZT', factor: 0.34 },
  KEN: { name: 'Kenya', currency: 'USD', factor: 0.20 }, // Apple bills in USD
  KGZ: { name: 'Kyrgyzstan', currency: 'USD', factor: 0.20 }, // ⚠ currency
  KHM: { name: 'Cambodia', currency: 'USD', factor: 0.20 }, // ⚠ currency
  KNA: { name: 'St. Kitts and Nevis', currency: 'USD', factor: 0.45 },
  KOR: { name: 'South Korea', currency: 'KRW', factor: 1.00 }, // developed market — full price
  KOS: { name: 'Kosovo', currency: 'EUR', factor: 0.20 }, // ⚠ territory code may differ in ASC
  KWT: { name: 'Kuwait', currency: 'USD', factor: 1.00 }, // high-income Gulf — full price
  LAO: { name: 'Laos', currency: 'USD', factor: 0.20 },
  LBN: { name: 'Lebanon', currency: 'USD', factor: 0.20 }, // Apple bills in USD
  LBR: { name: 'Liberia', currency: 'USD', factor: 0.20 },
  LBY: { name: 'Libya', currency: 'USD', factor: 0.27 },
  LCA: { name: 'St. Lucia', currency: 'USD', factor: 0.24 },
  LKA: { name: 'Sri Lanka', currency: 'USD', factor: 0.20 }, // Apple bills in USD
  LTU: { name: 'Lithuania', currency: 'EUR', factor: 0.61 },
  LUX: { name: 'Luxembourg', currency: 'EUR', factor: 1.00 },
  LVA: { name: 'Latvia', currency: 'EUR', factor: 0.49 },
  MAC: { name: 'Macao', currency: 'USD', factor: 1.00 }, // ⚠ currency (MOP unsupported)
  MAR: { name: 'Morocco', currency: 'USD', factor: 0.20 },
  MDA: { name: 'Moldova', currency: 'USD', factor: 0.22 }, // ⚠ currency
  MDG: { name: 'Madagascar', currency: 'USD', factor: 0.20 },
  MDV: { name: 'Maldives', currency: 'USD', factor: 0.32 },
  MEX: { name: 'Mexico', currency: 'MXN', factor: 0.29 },
  MHL: { name: 'Marshall Islands', currency: 'USD', factor: 0.20 },
  MKD: { name: 'North Macedonia', currency: 'USD', factor: 0.25 }, // ⚠ currency
  MLI: { name: 'Mali', currency: 'XOF', factor: 0.20 },
  MLT: { name: 'Malta', currency: 'EUR', factor: 0.71 },
  MMR: { name: 'Myanmar', currency: 'USD', factor: 0.20 }, // Apple bills in USD
  MNE: { name: 'Montenegro', currency: 'EUR', factor: 0.34 },
  MNG: { name: 'Mongolia', currency: 'USD', factor: 0.20 },
  MOZ: { name: 'Mozambique', currency: 'USD', factor: 0.20 },
  MRT: { name: 'Mauritania', currency: 'USD', factor: 0.20 },
  MSR: { name: 'Montserrat', currency: 'USD', factor: 0.40 },
  MUS: { name: 'Mauritius', currency: 'USD', factor: 0.34 }, // ⚠ currency
  MWI: { name: 'Malawi', currency: 'USD', factor: 0.20 },
  MYS: { name: 'Malaysia', currency: 'MYR', factor: 0.40 },
  NAM: { name: 'Namibia', currency: 'USD', factor: 0.22 },
  NER: { name: 'Niger', currency: 'XOF', factor: 0.20 },
  NGA: { name: 'Nigeria', currency: 'NGN', factor: 0.20 },
  NIC: { name: 'Nicaragua', currency: 'USD', factor: 0.20 },
  NLD: { name: 'Netherlands', currency: 'EUR', factor: 1.00 }, // developed market — full price
  NOR: { name: 'Norway', currency: 'NOK', factor: 1.00 },
  NPL: { name: 'Nepal', currency: 'USD', factor: 0.20 },
  NRU: { name: 'Nauru', currency: 'USD', factor: 0.25 },
  NZL: { name: 'New Zealand', currency: 'NZD', factor: 1.00 }, // developed market — full price
  OMN: { name: 'Oman', currency: 'USD', factor: 0.50 }, // ⚠ currency
  PAK: { name: 'Pakistan', currency: 'PKR', factor: 0.20 },
  PAN: { name: 'Panama', currency: 'USD', factor: 0.46 },
  PER: { name: 'Peru', currency: 'PEN', factor: 0.20 },
  PHL: { name: 'Philippines', currency: 'PHP', factor: 0.20 },
  PLW: { name: 'Palau', currency: 'USD', factor: 0.27 },
  PNG: { name: 'Papua New Guinea', currency: 'USD', factor: 0.20 },
  POL: { name: 'Poland', currency: 'PLN', factor: 0.55 },
  PRT: { name: 'Portugal', currency: 'EUR', factor: 1.00 }, // developed market — full price
  PRY: { name: 'Paraguay', currency: 'USD', factor: 0.21 }, // ⚠ currency
  QAT: { name: 'Qatar', currency: 'QAR', factor: 1.00 },
  ROU: { name: 'Romania', currency: 'RON', factor: 0.55 },
  RUS: { name: 'Russia', currency: 'RUB', factor: 0.49 }, // availability restricted
  RWA: { name: 'Rwanda', currency: 'USD', factor: 0.20 },
  SAU: { name: 'Saudi Arabia', currency: 'SAR', factor: 1.00 }, // high-income Gulf — full price
  SEN: { name: 'Senegal', currency: 'XOF', factor: 0.20 },
  SGP: { name: 'Singapore', currency: 'SGD', factor: 1.00 },
  SLB: { name: 'Solomon Islands', currency: 'USD', factor: 0.20 },
  SLE: { name: 'Sierra Leone', currency: 'USD', factor: 0.20 },
  SLV: { name: 'El Salvador', currency: 'USD', factor: 0.22 },
  SRB: { name: 'Serbia', currency: 'USD', factor: 0.32 }, // ⚠ currency
  STP: { name: 'São Tomé & Príncipe', currency: 'USD', factor: 0.20 },
  SUR: { name: 'Suriname', currency: 'USD', factor: 0.23 },
  SVK: { name: 'Slovakia', currency: 'EUR', factor: 0.53 },
  SVN: { name: 'Slovenia', currency: 'EUR', factor: 0.65 },
  SWE: { name: 'Sweden', currency: 'SEK', factor: 1.00 }, // developed market — full price
  SWZ: { name: 'Eswatini', currency: 'USD', factor: 0.22 },
  SYC: { name: 'Seychelles', currency: 'USD', factor: 0.50 }, // ⚠ currency
  TCA: { name: 'Turks and Caicos', currency: 'USD', factor: 0.50 },
  TCD: { name: 'Chad', currency: 'XAF', factor: 0.20 },
  THA: { name: 'Thailand', currency: 'THB', factor: 0.27 },
  TJK: { name: 'Tajikistan', currency: 'USD', factor: 0.20 },
  TKM: { name: 'Turkmenistan', currency: 'USD', factor: 0.27 }, // ⚠ currency
  TON: { name: 'Tonga', currency: 'USD', factor: 0.20 },
  TTO: { name: 'Trinidad and Tobago', currency: 'USD', factor: 0.40 }, // ⚠ currency
  TUN: { name: 'Tunisia', currency: 'USD', factor: 0.20 }, // ⚠ currency
  TUR: { name: 'Türkiye', currency: 'TRY', factor: 0.45 },
  TWN: { name: 'Taiwan', currency: 'TWD', factor: 0.92 }, // ⚠ PPP proxy (IMF)
  TZA: { name: 'Tanzania', currency: 'TZS', factor: 0.20 },
  UGA: { name: 'Uganda', currency: 'USD', factor: 0.20 },
  UKR: { name: 'Ukraine', currency: 'USD', factor: 0.20 }, // Apple bills in USD
  URY: { name: 'Uruguay', currency: 'USD', factor: 0.38 }, // ⚠ currency
  USA: { name: 'United States', currency: 'USD', factor: 1.00 },
  UZB: { name: 'Uzbekistan', currency: 'USD', factor: 0.20 }, // ⚠ currency
  VCT: { name: 'St. Vincent & Grenadines', currency: 'USD', factor: 0.23 },
  VEN: { name: 'Venezuela', currency: 'USD', factor: 0.20 }, // ⚠ proxy; Apple bills in USD
  VGB: { name: 'British Virgin Islands', currency: 'USD', factor: 0.60 },
  VNM: { name: 'Vietnam', currency: 'VND', factor: 0.20 },
  VUT: { name: 'Vanuatu', currency: 'USD', factor: 0.20 },
  WSM: { name: 'Samoa', currency: 'USD', factor: 0.20 },
  YEM: { name: 'Yemen', currency: 'USD', factor: 0.20 },
  ZAF: { name: 'South Africa', currency: 'ZAR', factor: 0.20 },
  ZMB: { name: 'Zambia', currency: 'USD', factor: 0.20 },
  ZWE: { name: 'Zimbabwe', currency: 'USD', factor: 0.20 }, // Apple bills in USD
}

/**
 * Lowest factor we will ever apply, so prices never collapse toward zero.
 * This is the business floor (separate from the raw PPP values below, which
 * stay as the economic "truth"): any territory whose raw factor is under this
 * is lifted up to it at compute time by `effectiveFactor()`.
 */
export const MIN_PPP_FACTOR = 0.25

/**
 * Affordability factor for a territory. Unknown territories return `1.0`
 * (Apple's equalized price is kept as-is).
 */
export function getPppFactor(territory: string): number {
  return PPP_FACTORS[territory]?.factor ?? 1.0
}

/**
 * The territories we actually fetch ladders for and re-price — those in the
 * dataset with a real discount (`factor < 1.0`). Anchor territories at 1.0
 * (US, Switzerland, Singapore, etc.) and anything not listed keep Apple's
 * current price, so we never waste a request on them.
 */
export function getPricingTerritories(): string[] {
  return Object.entries(PPP_FACTORS)
    .filter(([, entry]) => entry.factor < 1.0)
    .map(([code]) => code)
}

/** Human-readable territory name, falling back to the raw code. */
export function getTerritoryName(territory: string): string {
  return PPP_FACTORS[territory]?.name ?? territory
}
