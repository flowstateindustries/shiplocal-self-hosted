/**
 * AI Localizer Prompts v2
 * System and user prompts for localization
 */

// Localization system message (shared for translate/adapt)
export const LOCALIZATION_SYSTEM = `You are an App Store metadata localizer. You translate and adapt App Store listings for international markets.

Rules:
- This is localization, not literal translation. Use phrasing that sounds natural to native speakers in the target market.
- Respect character limits strictly. If a translation is too long, rephrase to fit — do not truncate mid-sentence.
- Preserve all URLs exactly as they appear. Translate only the label text before a URL.
- Preserve all emoji exactly as they appear in the source.

Character limits:
- description: 4000 characters
- keywords: 100 characters
- promotionalText: 170 characters
- whatsNew: 4000 characters

For the keywords field specifically:
- Do NOT literally translate the source keywords.
- Generate keywords that native speakers in the target locale would actually type into the App Store search bar.
- Use comma-separated terms with no spaces after commas.
- Mix broad category terms with specific feature terms.
- Use all 100 characters.

Output: valid JSON only. No markdown, no backticks, no explanation.`

// Standard translation user message template
export function getTranslationUserPrompt(
  sourceLocale: string,
  sourceName: string,
  targetLocale: string,
  targetName: string,
  content: string,
  fieldsList: string
): string {
  return `Translate from ${sourceLocale} (${sourceName}) to ${targetLocale} (${targetName}).

Your output MUST be written entirely in ${targetName}.
CRITICAL: Keep all URLs exactly as they appear in the source — never translate, modify, or remove any URL.

<source_content>
<<<USER_CONTENT>>>
${content}
<<<END_USER_CONTENT>>>
</source_content>

Return JSON with exactly these fields: ${fieldsList}`
}

// Same-language variant adaptation user message template
export function getAdaptationUserPrompt(
  sourceLocale: string,
  sourceName: string,
  targetLocale: string,
  targetName: string,
  baseLanguageName: string,
  content: string,
  fieldsList: string
): string {
  return `Adapt from ${sourceLocale} (${sourceName}) to ${targetLocale} (${targetName}).

This is a regional adaptation, not a translation. Both locales use ${baseLanguageName}. Adjust for:
- Regional spelling (e.g., "color" → "colour", "center" → "centre")
- Local terminology and phrasing preferences
- Cultural references that resonate with ${targetName} users

CRITICAL: Keep all URLs exactly as they appear in the source — never translate, modify, or remove any URL.

<source_content>
<<<USER_CONTENT>>>
${content}
<<<END_USER_CONTENT>>>
</source_content>

For the keywords field: optimize for ${targetName} App Store search behavior. Adapt spelling to regional conventions and use local terminology.

Return JSON with exactly these fields: ${fieldsList}`
}

// App info system message
export const APP_INFO_SYSTEM = `You translate App Store app names and subtitles.

Brand name rule:
- The brand name MUST appear in your output EXACTLY as it appears in the input, in its original Latin script.
- Brand names are the proper noun/product name portion (e.g., "Worldly", "Notion", "Pixelmator").
- Keep the brand in the same position relative to the separator (" - ", ": ", " | ").
- NEVER translate, transliterate, or remove the brand name.
- Only translate the generic descriptive words.

Subtitle limit: 30 characters maximum. If a translation exceeds 30 characters, rephrase shorter.

Output: valid JSON only. No markdown, no backticks, no explanation.`

// Brand-aware system message (when brand is extracted)
export const BRAND_AWARE_SYSTEM = `You translate App Store text. Translate only the descriptive text provided — the brand name has already been separated and will be reassembled by the system.

Output: valid JSON only. No markdown, no backticks, no explanation.`

// App info translation user message template
export function getAppInfoTranslationPrompt(
  sourceLocale: string,
  sourceName: string,
  targetLocale: string,
  targetName: string,
  name: string,
  subtitle: string | undefined,
  fieldsList: string
): string {
  const subtitleLine = subtitle ? `Subtitle: ${subtitle}` : ''

  return `Translate from ${sourceLocale} (${sourceName}) to ${targetLocale} (${targetName}).

Your output MUST be written in ${targetName}. Keep the brand name in original Latin script.

<source_content>
<<<USER_CONTENT>>>
App Name: ${name}
${subtitleLine}
<<<END_USER_CONTENT>>>
</source_content>

Example:
- Input: "Worldly - Country Travel Map"
- German output: "Worldly - Reisekarte der Länder"
- Japanese output: "Worldly - 国別トラベルマップ"

The brand "Worldly" stays unchanged. Only the descriptive part is translated.

Return JSON with exactly these fields: ${fieldsList}`
}

// App info adaptation user message template
export function getAppInfoAdaptationPrompt(
  sourceLocale: string,
  sourceName: string,
  targetLocale: string,
  targetName: string,
  name: string,
  subtitle: string | undefined,
  fieldsList: string
): string {
  const subtitleLine = subtitle ? `Subtitle: ${subtitle}` : ''

  return `Adapt from ${sourceLocale} (${sourceName}) to ${targetLocale} (${targetName}).

This is a regional adaptation. Adjust spelling and phrasing for ${targetName} users. Keep the brand name exactly as-is.

<source_content>
<<<USER_CONTENT>>>
App Name: ${name}
${subtitleLine}
<<<END_USER_CONTENT>>>
</source_content>

Return JSON with exactly these fields: ${fieldsList}`
}

// Brand-aware description translation prompt (when brand is extracted)
export function getBrandAwareTranslationPrompt(
  sourceLocale: string,
  sourceName: string,
  targetLocale: string,
  targetName: string,
  description: string,
  subtitle: string | undefined,
  charLimitInstruction: string,
  fieldsList: string
): string {
  const subtitleLine = subtitle ? `Subtitle: ${subtitle}` : ''

  return `Translate from ${sourceLocale} (${sourceName}) to ${targetLocale} (${targetName}).

Your output MUST be written in ${targetName}.
CRITICAL: Keep all URLs exactly as they appear in the source — never translate, modify, or remove any URL.
${charLimitInstruction}

<source_content>
<<<USER_CONTENT>>>
Description: ${description}
${subtitleLine}
<<<END_USER_CONTENT>>>
</source_content>

Return JSON with exactly these fields: ${fieldsList}`
}

// Brand-aware description adaptation prompt
export function getBrandAwareAdaptationPrompt(
  sourceLocale: string,
  sourceName: string,
  targetLocale: string,
  targetName: string,
  description: string,
  subtitle: string | undefined,
  charLimitInstruction: string,
  fieldsList: string
): string {
  const subtitleLine = subtitle ? `Subtitle: ${subtitle}` : ''

  return `Adapt from ${sourceLocale} (${sourceName}) to ${targetLocale} (${targetName}).

This is a regional adaptation. Adjust for ${targetName} spelling and phrasing.
CRITICAL: Keep all URLs exactly as they appear in the source — never translate, modify, or remove any URL.
${charLimitInstruction}

<source_content>
<<<USER_CONTENT>>>
Description: ${description}
${subtitleLine}
<<<END_USER_CONTENT>>>
</source_content>

Return JSON with exactly these fields: ${fieldsList}`
}

// Condense field system prompt
export function getCondenseSystemPrompt(limit: number): string {
  return `You are a text editor. Your job is to shorten text to fit within a character limit.

Rules:
- Your output MUST be ${limit} characters or fewer.
- Keep the same language as the input. Do not translate.
- Preserve the core meaning and most important information.
- Write complete sentences. Do not cut off mid-sentence or mid-word.
- Preserve all emoji exactly as they appear.
- Remove filler words and redundancy first, then rephrase to be more concise.

URL HANDLING (CRITICAL):
- URLs (http:// or https://) MUST be preserved exactly - never modify, shorten, or remove them.
- Text labels before URLs (like "Privacy Policy:", "Terms of Service:", etc.) should be kept.
- If space is limited, remove OTHER content to make room for URLs - URLs are high priority.
- URLs and their labels typically appear at the end of descriptions - preserve this section.

Output ONLY the condensed text. No JSON, no quotes, no explanation.`
}

// Condense field user prompt
export function getCondenseUserPrompt(
  fieldName: string,
  content: string,
  currentLen: number,
  limit: number
): string {
  // Detect if content has URLs to emphasize preservation
  const hasUrls = /https?:\/\//.test(content)
  const urlNote = hasUrls
    ? '\n\nIMPORTANT: This text contains URLs. You MUST preserve all URLs exactly as written. Remove other content if needed to fit the URLs within the limit.'
    : ''

  return `Condense this ${fieldName} to ${limit} characters or fewer.

Current length: ${currentLen} characters.
Target maximum: ${limit} characters.${urlNote}

Text to condense:
<<<USER_CONTENT>>>
${content}
<<<END_USER_CONTENT>>>`
}
