/**
 * String Translation Prompts
 * System and user prompts for .xcstrings translation
 */

import type { StringEntry } from './types'

/**
 * System prompt for string translation
 */
export const STRINGS_SYSTEM_PROMPT = `You are an iOS app string localizer. You translate UI strings for mobile apps.

Rules:
- This is localization, not literal translation. Use phrasing that sounds natural to native speakers.
- Preserve ALL placeholders exactly: %@, %d, %1$@, %2$d, {name}, \\(variable)
- Preserve escape sequences: \\n, \\t
- Keep HTML tags if present: <b>, </b>, <br/>
- Preserve emoji exactly as they appear.
- Keep URLs unchanged.
- Output valid JSON only. No markdown, no explanation, no backticks.

Your response must be a JSON array of objects with "i" (index) and "t" (translation) fields.`

/**
 * Build the user prompt for translating a batch of strings
 */
export function getStringsTranslationPrompt(
  sourceLocale: string,
  sourceLocaleName: string,
  targetLocale: string,
  targetLocaleName: string,
  strings: StringEntry[]
): string {
  const stringsBlock = strings.map((s, i) => {
    const comment = s.comment ? `\nComment: ${s.comment}` : ''
    return `[${i}] Key: "${s.key}"${comment}\nSource: ${s.value}`
  }).join('\n\n')

  return `Translate from ${sourceLocale} (${sourceLocaleName}) to ${targetLocale} (${targetLocaleName}).

CRITICAL: Preserve ALL placeholders (%@, %d, %1$@, {name}, \\(variable), etc.) exactly as they appear.

<strings>
<<<USER_CONTENT>>>
${stringsBlock}
<<<END_USER_CONTENT>>>
</strings>

Return a JSON array with translations:
[{"i": 0, "t": "translated text"}, {"i": 1, "t": "translated text"}, ...]

The array must have exactly ${strings.length} items, one for each input string.`
}

/**
 * Build user prompt for adapting strings to a regional variant (same language)
 */
export function getStringsAdaptationPrompt(
  sourceLocale: string,
  sourceLocaleName: string,
  targetLocale: string,
  targetLocaleName: string,
  baseLanguageName: string,
  strings: StringEntry[]
): string {
  const stringsBlock = strings.map((s, i) => {
    const comment = s.comment ? `\nComment: ${s.comment}` : ''
    return `[${i}] Key: "${s.key}"${comment}\nSource: ${s.value}`
  }).join('\n\n')

  return `Adapt from ${sourceLocale} (${sourceLocaleName}) to ${targetLocale} (${targetLocaleName}).

This is a regional adaptation, not a translation. Both locales use ${baseLanguageName}. Adjust for:
- Regional spelling (e.g., "color" → "colour", "center" → "centre")
- Local terminology and phrasing preferences
- Cultural references that resonate with ${targetLocaleName} users

CRITICAL: Preserve ALL placeholders (%@, %d, %1$@, {name}, \\(variable), etc.) exactly as they appear.

<strings>
<<<USER_CONTENT>>>
${stringsBlock}
<<<END_USER_CONTENT>>>
</strings>

Return a JSON array with adaptations:
[{"i": 0, "t": "adapted text"}, {"i": 1, "t": "adapted text"}, ...]

The array must have exactly ${strings.length} items, one for each input string.`
}

/**
 * Check if two locales are variants of the same language
 */
export function isSameLanguageVariant(sourceLocale: string, targetLocale: string): boolean {
  // Extract base language code (before hyphen)
  const sourceBase = sourceLocale.split('-')[0].toLowerCase()
  const targetBase = targetLocale.split('-')[0].toLowerCase()
  return sourceBase === targetBase
}

/**
 * Get base language name from locale code
 */
export function getBaseLanguageName(locale: string): string {
  const base = locale.split('-')[0].toLowerCase()
  const names: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    pt: 'Portuguese',
    zh: 'Chinese',
    fr: 'French',
    de: 'German',
    ar: 'Arabic',
  }
  return names[base] || base
}
