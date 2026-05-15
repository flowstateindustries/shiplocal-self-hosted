/**
 * App Store Connect API type definitions
 */

export interface ASCApp {
  id: string
  name: string
  bundleId: string
  sku?: string
  iconUrl?: string
  storeUrl?: string
  country?: string
}

export interface ASCVersion {
  id: string
  versionString: string
  appStoreState: string
  platform: string
}

export interface ASCLocalization {
  id: string
  locale: string
  description: string
  keywords: string
  promotionalText: string
  whatsNew: string
  supportUrl?: string
  marketingUrl?: string
}

export interface ASCAppInfoLocalization {
  id: string
  locale: string
  name: string
  subtitle?: string
  privacyPolicyUrl?: string
  privacyChoicesUrl?: string
}

export interface ASCResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ASCCredentials {
  issuerId: string
  keyId: string
  privateKey: string
}

/**
 * States where an App Store version is editable
 */
export const EDITABLE_STATES = [
  'PREPARE_FOR_SUBMISSION',
  'DEVELOPER_REJECTED',
  'REJECTED'
] as const

/**
 * All supported App Store locales
 */
export const ALL_LOCALES = [
  'ar-SA', 'ca', 'zh-Hans', 'zh-Hant', 'hr', 'cs', 'da', 'nl-NL',
  'en-AU', 'en-CA', 'en-GB', 'en-US', 'fi', 'fr-FR', 'fr-CA', 'de-DE',
  'el', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'ms', 'no', 'pl',
  'pt-BR', 'pt-PT', 'ro', 'ru', 'sk', 'es-MX', 'es-ES', 'sv', 'th',
  'tr', 'uk', 'vi'
] as const

export type AppStoreLocale = typeof ALL_LOCALES[number]
