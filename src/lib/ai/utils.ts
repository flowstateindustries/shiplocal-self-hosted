/**
 * AI Localizer Utilities
 * Brand extraction, truncation helpers, JSON parsing
 */

import type { BrandExtraction } from './types'

// Same-language variant groups for adaptation vs translation
const LANGUAGE_VARIANTS: Record<string, string[]> = {
  en: ['en-US', 'en-GB', 'en-AU', 'en-CA'],
  pt: ['pt-BR', 'pt-PT'],
  zh: ['zh-Hans', 'zh-Hant'],
  es: ['es-ES', 'es-MX', 'es-419'],
  fr: ['fr-FR', 'fr-CA'],
}

// Base language names for adaptation prompts
const BASE_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  zh: 'Chinese',
  es: 'Spanish',
  fr: 'French',
}

/**
 * Check if source and target are variants of the same language
 * (e.g., en-US -> en-GB should use adaptation, not full translation)
 */
export function isSameLanguageVariant(sourceLocale: string, targetLocale: string): boolean {
  for (const variants of Object.values(LANGUAGE_VARIANTS)) {
    if (variants.includes(sourceLocale) && variants.includes(targetLocale)) {
      return true
    }
  }
  return false
}

/**
 * Get the base language name for a locale (e.g., "en-US" -> "English")
 * Used in adaptation prompts to clarify that both locales use the same language.
 */
export function getBaseLanguageName(locale: string): string {
  for (const [base, variants] of Object.entries(LANGUAGE_VARIANTS)) {
    if (variants.includes(locale)) {
      return BASE_LANGUAGE_NAMES[base] || base
    }
  }
  return locale
}

/**
 * Extract brand name and descriptive text from an app name.
 *
 * Uses heuristics to identify which part is the "brand" vs "description":
 *
 * **Brand identification rules:**
 * 1. Maximum 20 characters (brands are typically short)
 * 2. Starts with uppercase letter (proper noun style)
 * 3. Single word (no spaces)
 *
 * **Supported separator patterns (checked in order):**
 * - " - " (em dash with spaces, most common)
 * - " — " (en dash with spaces)
 * - " | " (pipe with spaces)
 * - ": " (colon with space)
 * - " by " (attribution pattern)
 *
 * **Examples:**
 * - "Worldly - Country Travel Map" → brand="Worldly", description="Country Travel Map"
 * - "Country Travel Map by Worldly" → brand="Worldly", description="Country Travel Map"
 * - "MyApp" (no separator) → brand=null, description="MyApp"
 *
 * @param appName - The full app name to parse
 * @returns BrandExtraction with brand, separator, description, and brandFirst flag
 */
export function extractBrandAndDescription(appName: string): BrandExtraction {
  // Common separators (check longer ones first)
  const separators = [' - ', ' — ', ' | ', ': ', ' by ']

  for (const sep of separators) {
    if (appName.includes(sep)) {
      const parts = appName.split(sep)
      if (parts.length >= 2) {
        const left = parts[0].trim()
        const right = parts.slice(1).join(sep).trim()

        // Safety check for empty parts
        if (!left || !right) continue

        // Heuristic: Brand names are typically:
        // - Single word or short (<=20 chars)
        // - Capitalized/proper noun style
        // - Not common descriptive phrases
        const leftIsBrand = left.length <= 20 && left[0] === left[0].toUpperCase() && !left.includes(' ')
        const rightIsBrand = right.length <= 20 && right[0] === right[0].toUpperCase() && !right.includes(' ')

        if (leftIsBrand && !rightIsBrand) {
          // Brand first: "Worldly - Country Travel Map"
          return { brand: left, separator: sep, description: right, brandFirst: true }
        } else if (rightIsBrand && !leftIsBrand) {
          // Brand last: "Country Travel Map by Worldly"
          return { brand: right, separator: sep, description: left, brandFirst: false }
        } else if (leftIsBrand) {
          // Both look like brands, prefer left (more common pattern)
          return { brand: left, separator: sep, description: right, brandFirst: true }
        }
      }
    }
  }

  // No separator found - return entire name as description
  return { brand: null, separator: null, description: appName, brandFirst: true }
}

/**
 * Extract brand and description using an explicit brand name.
 * Finds the brand in the app name and splits on the separator between them.
 */
export function extractBrandByName(appName: string, brandName: string): BrandExtraction {
  const separators = [' - ', ' — ', ' | ', ': ', ' by ']

  for (const sep of separators) {
    if (!appName.includes(sep)) continue

    const parts = appName.split(sep)
    if (parts.length < 2) continue

    const left = parts[0].trim()
    const right = parts.slice(1).join(sep).trim()

    if (left === brandName) {
      return { brand: brandName, separator: sep, description: right, brandFirst: true }
    } else if (right === brandName) {
      return { brand: brandName, separator: sep, description: left, brandFirst: false }
    }
  }

  // Brand not found with separator
  if (appName.trim() === brandName) {
    return { brand: brandName, separator: null, description: '', brandFirst: true }
  }

  // Brand provided but not found with a separator - treat as no-separator case
  return { brand: brandName, separator: null, description: appName, brandFirst: true }
}

/**
 * Core truncation logic - truncates at sentence or word boundaries.
 */
function smartTruncateCore(text: string, limit: number): string {
  if (text.length <= limit) return text

  const truncated = text.slice(0, limit)

  // Try to end at last sentence boundary (keep at least 60% of content)
  const sentenceEndings = ['. ', '! ', '? ']
  for (const punct of sentenceEndings) {
    const lastSent = truncated.lastIndexOf(punct)
    if (lastSent > limit * 0.6) {
      return truncated.slice(0, lastSent + 1).trim()
    }
  }

  // Fall back to last word boundary (keep at least 80% of content)
  const lastSpace = truncated.lastIndexOf(' ')
  if (lastSpace > limit * 0.8) {
    return truncated.slice(0, lastSpace).trim()
  }

  // Hard cut as absolute last resort
  return truncated
}

/**
 * Truncate text at the last complete sentence or word boundary, not mid-word.
 * URL-aware: tries to preserve trailing URL sections when possible.
 *
 * Uses a cascading fallback strategy:
 *
 * 1. **URL preservation (if present):**
 *    Detects trailing URL sections (URLs typically at end after blank line).
 *    If URL section fits with at least 30% remaining for text, preserves URLs.
 *
 * 2. **Sentence boundary (60% threshold):**
 *    Looks for ". ", "! ", or "? " endings.
 *    Only uses if the sentence ends at ≥60% of the limit.
 *    Example: At 100 char limit, will use sentence ending at char 65+
 *
 * 3. **Word boundary (80% threshold):**
 *    Falls back to last space character.
 *    Only uses if space is at ≥80% of the limit.
 *    Example: At 100 char limit, will use space at char 82+
 *
 * 4. **Hard cut (no threshold):**
 *    As absolute last resort, cuts at exact limit.
 *    Rare in practice since text usually has spaces.
 *
 * The threshold percentages balance:
 * - Not truncating too aggressively (losing too much content)
 * - Not cutting mid-word or mid-sentence (poor UX)
 *
 * @param text - The text to truncate
 * @param limit - Maximum character count
 * @returns Truncated text ending at a natural boundary when possible
 */
export function smartTruncate(text: string, limit: number): string {
  if (text.length <= limit) return text

  // Check for trailing URL section (URLs typically at end after blank line)
  const urlPattern = /\n\n[^\n]*https?:\/\/[^\s]+[^\n]*$/
  const urlMatch = text.match(urlPattern)

  if (urlMatch && urlMatch.index !== undefined) {
    const urlSection = urlMatch[0]
    const textWithoutUrls = text.slice(0, urlMatch.index)
    const urlSectionLen = urlSection.length

    // If we can fit URLs with at least 30% of remaining space for text
    const availableForText = limit - urlSectionLen
    if (availableForText > limit * 0.3 && availableForText > 0) {
      const truncatedText = smartTruncateCore(textWithoutUrls, availableForText)
      const result = truncatedText + urlSection
      if (result.length <= limit) {
        return result
      }
    }
    // URLs don't fit reasonably - fall through to normal truncation
    console.warn('URL section too large to preserve in smartTruncate')
  }

  return smartTruncateCore(text, limit)
}

/**
 * Sanitize control characters within JSON string values.
 * The AI sometimes returns literal newlines/tabs instead of escaped versions.
 */
export function sanitizeJsonString(text: string): string {
  const result: string[] = []
  let inString = false
  let escapeNext = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (escapeNext) {
      result.push(char)
      escapeNext = false
      continue
    }

    if (char === '\\') {
      result.push(char)
      escapeNext = true
      continue
    }

    if (char === '"') {
      result.push(char)
      inString = !inString
      continue
    }

    if (inString) {
      // Replace control characters with escaped versions
      if (char === '\n') {
        result.push('\\n')
      } else if (char === '\r') {
        result.push('\\r')
      } else if (char === '\t') {
        result.push('\\t')
      } else if (char.charCodeAt(0) < 32) {
        // Other control characters - escape as unicode
        result.push(`\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`)
      } else {
        result.push(char)
      }
    } else {
      result.push(char)
    }
  }

  return result.join('')
}

/**
 * Extract JSON from a response that might be wrapped in markdown code blocks.
 */
export function extractJsonFromResponse(responseText: string): string {
  let text = responseText.trim()

  // Try to extract JSON if wrapped in code blocks
  if (text.startsWith('```')) {
    const lines = text.split('\n')
    const jsonLines: string[] = []
    let inJson = false

    for (const line of lines) {
      if (line.startsWith('```') && !inJson) {
        inJson = true
        continue
      } else if (line.startsWith('```') && inJson) {
        break
      } else if (inJson) {
        jsonLines.push(line)
      }
    }

    text = jsonLines.join('\n')
  }

  return sanitizeJsonString(text)
}

/**
 * Build a formatted content string from metadata for the selected fields.
 */
export function buildContentString(
  metadata: Record<string, string>,
  fields: string[]
): string {
  const fieldLabels: Record<string, string> = {
    description: 'Description',
    keywords: 'Keywords',
    promotionalText: 'Promotional Text',
    whatsNew: "What's New",
  }

  const parts: string[] = []
  for (const field of fields) {
    const value = metadata[field]
    if (value) {
      const label = fieldLabels[field] || field
      parts.push(`${label}:\n${value}`)
    }
  }

  return parts.join('\n\n')
}

/**
 * Escape special regex characters in a string.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Apply URL replacements to content.
 */
export function applyUrlReplacements(
  content: string,
  replacements: Array<{ oldUrl: string; newUrl: string }>
): string {
  let result = content
  for (const { oldUrl, newUrl } of replacements) {
    const pattern = new RegExp(escapeRegex(oldUrl) + '/?', 'gi')
    result = result.replace(pattern, newUrl)
  }
  return result
}
