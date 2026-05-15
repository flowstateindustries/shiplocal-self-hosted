/**
 * XCStrings Merger
 * Merge translations back into .xcstrings file structure
 */

import type { XCStringsFile } from '@/lib/database/types'

/**
 * Deep clone an xcstrings file
 */
export function cloneXCStringsFile(file: XCStringsFile): XCStringsFile {
  return JSON.parse(JSON.stringify(file))
}

/**
 * Merge translations for a single locale into an xcstrings file
 */
export function mergeLocaleTranslations(
  xcstrings: XCStringsFile,
  locale: string,
  translations: Record<string, string>
): XCStringsFile {
  // Clone to avoid mutating original
  const result = cloneXCStringsFile(xcstrings)

  for (const [key, translatedValue] of Object.entries(translations)) {
    // Get or create string entry
    if (!result.strings[key]) {
      result.strings[key] = {}
    }

    const entry = result.strings[key]

    // Ensure localizations object exists
    if (!entry.localizations) {
      entry.localizations = {}
    }

    // Add or update the translation
    entry.localizations[locale] = {
      stringUnit: {
        state: 'translated',
        value: translatedValue
      }
    }
  }

  return result
}

/**
 * Merge translations for multiple locales
 */
export function mergeAllTranslations(
  xcstrings: XCStringsFile,
  translationsByLocale: Record<string, Record<string, string>>
): XCStringsFile {
  let result = cloneXCStringsFile(xcstrings)

  for (const [locale, translations] of Object.entries(translationsByLocale)) {
    result = mergeLocaleTranslations(result, locale, translations)
  }

  return result
}

/**
 * Extract translations for a specific locale from an xcstrings file
 */
export function extractLocaleTranslations(
  xcstrings: XCStringsFile,
  locale: string
): Record<string, string> {
  const translations: Record<string, string> = {}

  for (const [key, entry] of Object.entries(xcstrings.strings)) {
    const localization = entry.localizations?.[locale]
    if (localization?.stringUnit?.value) {
      translations[key] = localization.stringUnit.value
    }
  }

  return translations
}

/**
 * Count translations for each locale
 */
export function countTranslationsByLocale(
  xcstrings: XCStringsFile
): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const entry of Object.values(xcstrings.strings)) {
    if (entry.localizations) {
      for (const locale of Object.keys(entry.localizations)) {
        counts[locale] = (counts[locale] || 0) + 1
      }
    }
  }

  return counts
}

/**
 * Get all locales present in an xcstrings file
 */
export function getAllLocales(xcstrings: XCStringsFile): string[] {
  const locales = new Set<string>()

  for (const entry of Object.values(xcstrings.strings)) {
    if (entry.localizations) {
      for (const locale of Object.keys(entry.localizations)) {
        locales.add(locale)
      }
    }
  }

  return Array.from(locales).sort()
}

/**
 * Format xcstrings file as pretty-printed JSON
 */
export function formatXCStringsFile(xcstrings: XCStringsFile): string {
  return JSON.stringify(xcstrings, null, 2)
}
