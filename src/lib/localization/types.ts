/**
 * Localization Types
 * Type definitions for localization configuration and form state
 */

export interface LocaleChoice {
  code: string
  name: string
  isActive: boolean // Locale already exists for this app
}

export interface SourceContent {
  description: string
  keywords: string
  promotionalText: string
  whatsNew: string
  supportUrl?: string
  marketingUrl?: string
}

export interface SourceAppInfo {
  name?: string
  subtitle?: string
  privacyUrl?: string
}

export interface LocalizationConfig {
  app: {
    id: string
    name: string
    iconUrl?: string | null
  }
  version: {
    id: string
    versionString: string
    appStoreState: string
  }
  sourceContent: SourceContent
  sourceAppInfo: SourceAppInfo | null
  defaultSource: string
  localeChoices: LocaleChoice[]
  sourceChoices: { code: string; name: string }[]
  isManualMode: boolean
}

export interface UrlReplacement {
  oldUrl: string
  newUrl: string
}

export interface LocalizationFormState {
  sourceLocale: string
  targetLocales: string[]
  fields: string[]
  translateAppName: boolean
  brandName: string
  urlReplacements: UrlReplacement[]
  privacyUrlReplacement: string
  privacyUrlAllLocales: boolean
  privacyUrlQueryEnabled: boolean
  privacyUrlQueryPattern: string
  supportUrlReplacement: string
  supportUrlAllLocales: boolean
  supportUrlQueryEnabled: boolean
  supportUrlQueryPattern: string
  marketingUrlReplacement: string
  marketingUrlAllLocales: boolean
  marketingUrlQueryEnabled: boolean
  marketingUrlQueryPattern: string
}

/**
 * Job configuration stored in results._config
 * Contains all data needed to (re)process a localization job
 */
export interface JobConfig {
  sourceContent: SourceContent
  translateAppName: boolean
  sourceAppInfo: SourceAppInfo | null
  brandName: string | null
  urlReplacements: UrlReplacement[]
  privacyUrlReplacement: string | null
  privacyUrlAllLocales: boolean
  privacyUrlQueryEnabled: boolean
  privacyUrlQueryPattern: string | null
  supportUrlReplacement: string | null
  supportUrlAllLocales: boolean
  supportUrlQueryEnabled: boolean
  supportUrlQueryPattern: string | null
  marketingUrlReplacement: string | null
  marketingUrlAllLocales: boolean
  marketingUrlQueryEnabled: boolean
  marketingUrlQueryPattern: string | null
}
