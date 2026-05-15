/**
 * URL Utilities for Locale-Specific Query Parameters
 * Handles building URLs with locale-specific query parameters for App Store Connect
 */

/**
 * Extract language code from App Store locale
 * Examples:
 * - "en-US" → "en"
 * - "zh-Hans" → "zh"
 * - "pt-BR" → "pt"
 * - "es-ES" → "es"
 */
export function extractLanguageCode(locale: string): string {
  // Handle script variants like "zh-Hans" or "zh-Hant"
  const parts = locale.split('-')
  return parts[0].toLowerCase()
}

/**
 * Build locale-specific URL by appending query pattern
 * Handles {language} and {locale} placeholders
 * Smart handling: Converts ? to & if URL already has query params
 *
 * @param baseUrl - The base URL to modify (e.g., "https://example.com/privacy")
 * @param queryPattern - The pattern to append (e.g., "?lang={language}")
 * @param locale - The App Store locale (e.g., "es-ES")
 * @returns The URL with locale-specific query parameters
 *
 * @example
 * buildLocaleUrl("https://example.com/privacy", "?lang={language}", "es-ES")
 * // Returns: "https://example.com/privacy?lang=es"
 *
 * @example
 * buildLocaleUrl("https://example.com/privacy?ref=app", "?lang={locale}", "es-ES")
 * // Returns: "https://example.com/privacy?ref=app&lang=es-ES"
 */
export function buildLocaleUrl(
  baseUrl: string,
  queryPattern: string,
  locale: string
): string {
  // Return base URL unchanged if pattern is empty
  if (!queryPattern || !queryPattern.trim()) {
    return baseUrl
  }

  // Extract language code for {language} placeholder
  const languageCode = extractLanguageCode(locale)

  // Replace placeholders
  let processedPattern = queryPattern
    .replace(/\{language\}/g, languageCode)
    .replace(/\{locale\}/g, locale)

  // Smart query string handling
  // If base URL already has query params and pattern starts with ?, change it to &
  const baseHasQuery = baseUrl.includes('?')
  if (baseHasQuery && processedPattern.startsWith('?')) {
    processedPattern = '&' + processedPattern.slice(1)
  }

  return baseUrl + processedPattern
}
