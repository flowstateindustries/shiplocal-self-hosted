/**
 * AI Localizer Module
 * Exports for Claude AI-powered localization
 */

// Types
export type {
  LocalizationInput,
  LocalizationOutput,
  AppInfoInput,
  AppInfoOutput,
  UsageStats,
  LocalizationResult,
  BrandExtraction,
  LocaleStatus,
  LocaleProgress,
  GenerationProgress,
  StreamEvent,
} from './types'

// Utilities
export {
  isSameLanguageVariant,
  extractBrandAndDescription,
  extractBrandByName,
  smartTruncate,
  sanitizeJsonString,
  extractJsonFromResponse,
  buildContentString,
  escapeRegex,
  applyUrlReplacements,
} from './utils'

// Main localizer functions
export {
  localizeMetadata,
  translateAppInfo,
  localizeForLocale,
} from './localizer'

// Cost calculation
export {
  calculateCostCents,
  formatCostCents,
  getInputCostPerMillion,
  getOutputCostPerMillion,
} from './cost'
