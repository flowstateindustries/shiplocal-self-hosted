/**
 * AI Localizer Types
 */

export interface LocalizationInput {
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
}

export interface LocalizationOutput {
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
}

export interface AppInfoInput {
  name: string
  subtitle?: string
}

export interface AppInfoOutput {
  name: string
  subtitle: string
}

export interface UsageStats {
  inputTokens: number
  outputTokens: number
  model: string
}

export interface LocalizationResult {
  success: boolean
  data?: LocalizationOutput
  appInfo?: AppInfoOutput
  error?: string
  usage?: UsageStats
}

export interface BrandExtraction {
  brand: string | null
  separator: string | null
  description: string
  brandFirst: boolean
}

export type LocaleStatus = 'pending' | 'processing' | 'complete' | 'failed'

export interface LocaleProgress {
  locale: string
  localeName: string
  status: LocaleStatus
  data?: LocalizationOutput
  appInfo?: AppInfoOutput
  error?: string
}

export interface GenerationProgress {
  status: 'starting' | 'processing' | 'complete' | 'error'
  currentLocale?: string
  progress: number
  totalLocales: number
  completedLocales: number
  localeProgress: Record<string, LocaleProgress>
  error?: string
}

export interface StreamEvent {
  type: 'starting' | 'locale_start' | 'locale_complete' | 'locale_error' | 'complete' | 'error' | 'cancelled' | 'heartbeat'
  locale?: string
  localeName?: string
  progress?: number
  totalLocales?: number
  completedLocales?: number
  data?: LocalizationOutput
  appInfo?: AppInfoOutput
  error?: string
  message?: string
}
