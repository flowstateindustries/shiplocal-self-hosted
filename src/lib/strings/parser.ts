/**
 * XCStrings File Parser
 * Validate and parse .xcstrings file structure
 */

import type { XCStringsFile } from '@/lib/database/types'
import type { XCStringsValidationResult } from './types'

/**
 * Validate xcstrings file structure
 */
export function validateXCStringsFile(content: unknown): XCStringsValidationResult {
  // Check if content is an object
  if (!content || typeof content !== 'object') {
    return { valid: false, error: 'Invalid file structure: expected JSON object' }
  }

  const file = content as Partial<XCStringsFile>

  // Check required fields
  if (!file.sourceLanguage || typeof file.sourceLanguage !== 'string') {
    return { valid: false, error: 'Missing or invalid sourceLanguage' }
  }

  if (!file.strings || typeof file.strings !== 'object') {
    return { valid: false, error: 'Missing or invalid strings object' }
  }

  if (!file.version || typeof file.version !== 'string') {
    return { valid: false, error: 'Missing or invalid version' }
  }

  // Count strings
  const totalStrings = Object.keys(file.strings).length

  if (totalStrings === 0) {
    return { valid: false, error: 'File contains no strings' }
  }

  // Get existing locales
  const existingLocales = new Set<string>()
  for (const entry of Object.values(file.strings)) {
    if (entry?.localizations) {
      for (const locale of Object.keys(entry.localizations)) {
        existingLocales.add(locale)
      }
    }
  }

  return {
    valid: true,
    totalStrings,
    sourceLocale: file.sourceLanguage,
    existingLocales: Array.from(existingLocales)
  }
}

/**
 * Parse xcstrings file content from JSON string
 */
export function parseXCStringsContent(jsonString: string): { file?: XCStringsFile; error?: string } {
  try {
    const parsed = JSON.parse(jsonString)
    const validation = validateXCStringsFile(parsed)

    if (!validation.valid) {
      return { error: validation.error }
    }

    return { file: parsed as XCStringsFile }
  } catch (e) {
    return { error: `Invalid JSON: ${e instanceof Error ? e.message : 'Parse error'}` }
  }
}

/**
 * Get source value for a string key
 */
export function getSourceValue(
  xcstrings: XCStringsFile,
  key: string
): string | undefined {
  const entry = xcstrings.strings[key]
  if (!entry) return undefined

  // First try to get from source locale localizations
  const sourceLocalization = entry.localizations?.[xcstrings.sourceLanguage]
  if (sourceLocalization?.stringUnit?.value) {
    return sourceLocalization.stringUnit.value
  }

  // If no explicit source localization, the key might be the source value
  // (common pattern in xcstrings where key = English value)
  return undefined
}

/**
 * Check if a string already has a translation for a locale
 */
export function hasTranslation(
  xcstrings: XCStringsFile,
  key: string,
  locale: string
): boolean {
  const entry = xcstrings.strings[key]
  if (!entry?.localizations) return false

  const localization = entry.localizations[locale]
  if (!localization?.stringUnit?.value) return false

  // Check if the value is non-empty
  return localization.stringUnit.value.trim().length > 0
}

/**
 * Count strings that need translation for a locale
 */
export function countStringsToTranslate(
  xcstrings: XCStringsFile,
  targetLocale: string,
  overwrite: boolean
): number {
  let count = 0

  for (const key of Object.keys(xcstrings.strings)) {
    // Get source value
    const sourceValue = getSourceValue(xcstrings, key)

    // If we can't get source value, try using the key as the value
    // (common pattern where the key is the English string)
    const effectiveValue = sourceValue || key
    if (!effectiveValue || !effectiveValue.trim()) continue

    // Skip if already translated (unless overwrite is true)
    if (!overwrite && hasTranslation(xcstrings, key, targetLocale)) {
      continue
    }

    count++
  }

  return count
}

/**
 * Get the total count of unique translateable strings
 */
export function getTotalStringCount(xcstrings: XCStringsFile): number {
  let count = 0

  for (const key of Object.keys(xcstrings.strings)) {
    const sourceValue = getSourceValue(xcstrings, key)
    const effectiveValue = sourceValue || key
    if (effectiveValue && effectiveValue.trim()) {
      count++
    }
  }

  return count
}
