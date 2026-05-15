/**
 * Placeholder Validation
 * Validate that placeholders are preserved during translation
 */

/**
 * Patterns for detecting placeholders in iOS strings
 */
const PLACEHOLDER_PATTERNS = [
  // printf-style: %@, %d, %1$@, %2$d, %.2f, etc.
  /%(?:\d+\$)?[-+0 #]*(?:\d+)?(?:\.\d+)?(?:hh?|ll?|L|q|z|t|j)?[diuoxXeEfFgGaAcCsSpn@%]/g,
  // Named placeholders: {name}, {count}, etc.
  /\{(\w+)\}/g,
  // Swift string interpolation: \(variable)
  /\\\([^)]+\)/g,
]

/**
 * Extract all placeholders from a string
 */
export function extractPlaceholders(text: string): string[] {
  const placeholders: string[] = []

  for (const pattern of PLACEHOLDER_PATTERNS) {
    const matches = text.match(pattern)
    if (matches) {
      placeholders.push(...matches)
    }
  }

  return placeholders
}

/**
 * Validate that all placeholders from source appear in translation
 */
export function validatePlaceholders(source: string, translated: string): {
  valid: boolean
  missingPlaceholders?: string[]
  extraPlaceholders?: string[]
} {
  const sourcePlaceholders = extractPlaceholders(source)
  const translatedPlaceholders = extractPlaceholders(translated)

  // Create sorted copies for comparison
  const sortedSource = [...sourcePlaceholders].sort()
  const sortedTranslated = [...translatedPlaceholders].sort()

  // Check if they match
  if (JSON.stringify(sortedSource) === JSON.stringify(sortedTranslated)) {
    return { valid: true }
  }

  // Find missing and extra placeholders
  const sourceSet = new Set(sourcePlaceholders)
  const translatedSet = new Set(translatedPlaceholders)

  const missingPlaceholders = sourcePlaceholders.filter(p => !translatedSet.has(p))
  const extraPlaceholders = translatedPlaceholders.filter(p => !sourceSet.has(p))

  return {
    valid: false,
    missingPlaceholders: missingPlaceholders.length > 0 ? missingPlaceholders : undefined,
    extraPlaceholders: extraPlaceholders.length > 0 ? extraPlaceholders : undefined
  }
}

/**
 * Check if a string contains placeholders
 */
export function hasPlaceholders(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * Escape special characters in source for inclusion in prompts
 */
export function escapeForPrompt(text: string): string {
  // Escape backslashes and quotes
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}
