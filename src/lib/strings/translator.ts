/**
 * String Translation Service
 * AI-powered translation for .xcstrings strings
 */

import { getProvider, getModel } from '@/lib/ai/providers'
import { calculateCostCents } from '@/lib/ai/cost'
import type { UsageStats } from '@/lib/ai/types'
import type { StringEntry, BatchTranslationResult, LocaleTranslationResult } from './types'
import {
  STRINGS_SYSTEM_PROMPT,
  getStringsTranslationPrompt,
  getStringsAdaptationPrompt,
  isSameLanguageVariant,
  getBaseLanguageName
} from './prompts'
import { validatePlaceholders } from './placeholders'

/**
 * Get locale display name
 */
function getLocaleName(code: string): string {
  // Common locale names
  const names: Record<string, string> = {
    'en': 'English',
    'en-US': 'English (US)',
    'en-GB': 'English (UK)',
    'en-AU': 'English (Australia)',
    'es': 'Spanish',
    'es-ES': 'Spanish (Spain)',
    'es-MX': 'Spanish (Mexico)',
    'fr': 'French',
    'fr-FR': 'French (France)',
    'fr-CA': 'French (Canada)',
    'de': 'German',
    'de-DE': 'German',
    'it': 'Italian',
    'pt': 'Portuguese',
    'pt-BR': 'Portuguese (Brazil)',
    'pt-PT': 'Portuguese (Portugal)',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh-Hans': 'Chinese (Simplified)',
    'zh-Hant': 'Chinese (Traditional)',
    'ar': 'Arabic',
    'ru': 'Russian',
    'nl': 'Dutch',
    'pl': 'Polish',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
    'th': 'Thai',
    'id': 'Indonesian',
    'ms': 'Malay',
    'hi': 'Hindi',
    'he': 'Hebrew',
    'uk': 'Ukrainian',
    'cs': 'Czech',
    'el': 'Greek',
    'ro': 'Romanian',
    'hu': 'Hungarian',
    'sk': 'Slovak',
    'da': 'Danish',
    'fi': 'Finnish',
    'no': 'Norwegian',
    'sv': 'Swedish',
    'ca': 'Catalan',
    'hr': 'Croatian',
  }
  return names[code] || code
}

/**
 * Call AI provider with retry logic for transient failures
 */
async function callAIWithRetry(
  params: {
    model: string
    maxTokens: number
    system: string
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  },
  maxRetries = 2
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const provider = getProvider()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await provider.call(params)
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = 500 * (attempt + 1)
        console.warn(`AI API call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      } else {
        throw error
      }
    }
  }
  throw new Error('AI API call failed after retries')
}

/**
 * Parse AI response for translated strings
 */
function parseTranslationResponse(
  responseText: string,
  expectedCount: number
): Array<{ index: number; translation: string }> | null {
  // Try to extract JSON array from response
  let jsonText = responseText.trim()

  // Remove markdown code blocks if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7)
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3)
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3)
  }
  jsonText = jsonText.trim()

  try {
    const parsed = JSON.parse(jsonText)

    if (!Array.isArray(parsed)) {
      console.error('AI response is not an array')
      return null
    }

    const results: Array<{ index: number; translation: string }> = []

    for (const item of parsed) {
      if (typeof item.i === 'number' && typeof item.t === 'string') {
        results.push({ index: item.i, translation: item.t })
      }
    }

    if (results.length !== expectedCount) {
      console.warn(`Expected ${expectedCount} translations, got ${results.length}`)
    }

    return results
  } catch (e) {
    console.error('Failed to parse AI response:', e)
    return null
  }
}

/**
 * Translate a batch of strings to a target locale
 */
export async function translateBatch(
  sourceLocale: string,
  targetLocale: string,
  strings: StringEntry[]
): Promise<BatchTranslationResult> {
  if (strings.length === 0) {
    return { success: true, translations: [] }
  }

  const sourceLocaleName = getLocaleName(sourceLocale)
  const targetLocaleName = getLocaleName(targetLocale)

  // Choose adaptation vs translation prompt
  const userPrompt = isSameLanguageVariant(sourceLocale, targetLocale)
    ? getStringsAdaptationPrompt(
        sourceLocale,
        sourceLocaleName,
        targetLocale,
        targetLocaleName,
        getBaseLanguageName(sourceLocale),
        strings
      )
    : getStringsTranslationPrompt(
        sourceLocale,
        sourceLocaleName,
        targetLocale,
        targetLocaleName,
        strings
      )

  try {
    // Call AI provider
    const response = await callAIWithRetry({
      model: getModel(),
      maxTokens: 4096,
      system: STRINGS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const usage: UsageStats = {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      model: getModel(),
    }

    // Parse response
    const parsed = parseTranslationResponse(response.text, strings.length)
    if (!parsed) {
      return {
        success: false,
        error: 'Failed to parse AI response',
        usage
      }
    }

    // Build translations with validation
    const translations: Array<{ key: string; value: string }> = []
    const errors: string[] = []

    for (const result of parsed) {
      if (result.index < 0 || result.index >= strings.length) {
        errors.push(`Invalid index ${result.index}`)
        continue
      }

      const sourceString = strings[result.index]

      // Validate placeholders
      const placeholderValidation = validatePlaceholders(sourceString.value, result.translation)
      if (!placeholderValidation.valid) {
        console.warn(
          `Placeholder mismatch for "${sourceString.key}":`,
          placeholderValidation
        )
        // Still include the translation, but log the warning
        // The AI usually gets it right, and we don't want to fail the whole batch
      }

      translations.push({
        key: sourceString.key,
        value: result.translation
      })
    }

    return {
      success: true,
      translations,
      usage
    }
  } catch (error) {
    console.error('Translation error:', error)
    return {
      success: false,
      error: `Translation error: ${error instanceof Error ? error.message : String(error)}`
    }
  }
}

/**
 * Translate all batches for a locale
 */
export async function translateLocale(
  sourceLocale: string,
  targetLocale: string,
  batches: StringEntry[][],
  onBatchComplete?: (batchIndex: number, translatedCount: number) => void
): Promise<LocaleTranslationResult> {
  const allTranslations: Record<string, string> = {}
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]
    const result = await translateBatch(sourceLocale, targetLocale, batch)

    if (!result.success) {
      return {
        success: false,
        error: result.error || `Batch ${i} failed`,
        translations: allTranslations,
        translatedCount: Object.keys(allTranslations).length,
        usage: {
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          model: getModel()
        }
      }
    }

    // Merge translations
    if (result.translations) {
      for (const t of result.translations) {
        allTranslations[t.key] = t.value
      }
    }

    // Accumulate usage
    if (result.usage) {
      totalInputTokens += result.usage.inputTokens
      totalOutputTokens += result.usage.outputTokens
    }

    // Callback for progress tracking
    if (onBatchComplete) {
      onBatchComplete(i, Object.keys(allTranslations).length)
    }
  }

  return {
    success: true,
    translations: allTranslations,
    totalStrings: batches.reduce((sum, b) => sum + b.length, 0),
    translatedCount: Object.keys(allTranslations).length,
    usage: {
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      model: getModel()
    }
  }
}

/**
 * Calculate cost from usage stats
 */
export function calculateTranslationCost(inputTokens: number, outputTokens: number): number {
  return calculateCostCents(inputTokens, outputTokens)
}
