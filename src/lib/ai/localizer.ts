/**
 * AI Localizer Service
 * Multi-provider AI integration for App Store metadata localization
 */

import { APP_STORE_LOCALES, FIELD_LIMITS } from '@/lib/localization/constants'
import type {
  LocalizationInput,
  LocalizationOutput,
  LocalizationResult,
  UsageStats,
  BrandExtraction,
} from './types'
import {
  isSameLanguageVariant,
  getBaseLanguageName,
  extractBrandAndDescription,
  extractBrandByName,
  smartTruncate,
  extractJsonFromResponse,
  buildContentString,
} from './utils'
import {
  LOCALIZATION_SYSTEM,
  APP_INFO_SYSTEM,
  BRAND_AWARE_SYSTEM,
  getTranslationUserPrompt,
  getAdaptationUserPrompt,
  getAppInfoTranslationPrompt,
  getAppInfoAdaptationPrompt,
  getBrandAwareTranslationPrompt,
  getBrandAwareAdaptationPrompt,
  getCondenseSystemPrompt,
  getCondenseUserPrompt,
} from './prompts'
import { getProvider, getModel, type AIRequestParams } from './providers'

/**
 * Call AI provider with retry logic for transient failures.
 */
async function callAIWithRetry(
  params: AIRequestParams,
  maxRetries = 2
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const provider = getProvider()

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await provider.call(params)
    } catch (error) {
      if (attempt < maxRetries) {
        const delay = 500 * (attempt + 1) // 0.5s, 1.0s backoff
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
 * Ask AI to rewrite content to fit within character limit.
 */
async function condenseField(
  fieldName: string,
  content: string,
  limit: number
): Promise<{ success: boolean; content: string; usage?: UsageStats }> {
  try {
    const currentLen = content.length

    const response = await callAIWithRetry({
      model: getModel(),
      maxTokens: Math.min(limit + 100, 4096),
      system: getCondenseSystemPrompt(limit),
      messages: [{ role: 'user', content: getCondenseUserPrompt(fieldName, content, currentLen, limit) }],
    })

    const usage: UsageStats = {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      model: getModel(),
    }

    let condensed = response.text.trim()

    // Remove any quotes the AI might have added
    if (condensed.startsWith('"') && condensed.endsWith('"')) {
      condensed = condensed.slice(1, -1)
    }
    if (condensed.startsWith("'") && condensed.endsWith("'")) {
      condensed = condensed.slice(1, -1)
    }

    return { success: true, content: condensed, usage }
  } catch (error) {
    console.error(`Error condensing ${fieldName}:`, error)
    return { success: false, content }
  }
}

/**
 * Generate localized metadata using Claude AI.
 */
export async function localizeMetadata(
  sourceLocale: string,
  targetLocale: string,
  metadata: LocalizationInput,
  fields: string[]
): Promise<LocalizationResult> {
  try {
    // Build the content string
    const content = buildContentString(metadata as Record<string, string>, fields)
    if (!content) {
      return { success: false, error: 'No content to localize' }
    }

    // Get locale names for better context
    const sourceName = APP_STORE_LOCALES[sourceLocale] || sourceLocale
    const targetName = APP_STORE_LOCALES[targetLocale] || targetLocale

    // Build dynamic fields list for JSON output
    const fieldsList = fields.map(f => `"${f}"`).join(', ')

    // Choose adaptation vs translation prompt
    const userPrompt = isSameLanguageVariant(sourceLocale, targetLocale)
      ? getAdaptationUserPrompt(sourceLocale, sourceName, targetLocale, targetName, getBaseLanguageName(sourceLocale), content, fieldsList)
      : getTranslationUserPrompt(sourceLocale, sourceName, targetLocale, targetName, content, fieldsList)

    // Call AI provider
    const response = await callAIWithRetry({
      model: getModel(),
      maxTokens: 4096,
      system: LOCALIZATION_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Capture usage for cost tracking
    const usage: UsageStats = {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      model: getModel(),
    }

    // Parse the response
    const responseText = response.text
    const jsonText = extractJsonFromResponse(responseText)

    let localizedData: LocalizationOutput
    try {
      localizedData = JSON.parse(jsonText)
    } catch (parseError) {
      // Fallback: try to extract JSON object using regex
      console.warn('Initial JSON parse failed, attempting regex extraction')
      // Use [\s\S] instead of . with 's' flag for cross-line matching
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          localizedData = JSON.parse(jsonMatch[0])
        } catch {
          // Last resort: try to manually extract field values
          localizedData = {} as LocalizationOutput
          for (const field of ['description', 'keywords', 'promotionalText', 'whatsNew']) {
            // Use [\s\S] for cross-line matching instead of 's' flag
            const pattern = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"`)
            const match = jsonText.match(pattern)
            if (match) {
              let value = match[1]
              // Unescape the value
              value = value.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"')
              ;(localizedData as Record<string, string>)[field] = value
            }
          }

          if (Object.keys(localizedData).length === 0) {
            return { success: false, error: 'Could not parse AI response as JSON' }
          }
        }
      } else {
        return { success: false, error: `Failed to parse AI response: ${parseError}` }
      }
    }

    // Normalize keywords format: remove spaces after commas, trim each keyword
    if (localizedData.keywords) {
      localizedData.keywords = localizedData.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .join(',')
    }

    // Check and rewrite any over-limit fields using AI
    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      const fieldValue = (localizedData as Record<string, string>)[field]
      if (fieldValue && fieldValue.length > limit) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`${field} exceeds limit (${fieldValue.length}/${limit}), asking AI to condense`)
        }

        const condenseResult = await condenseField(field, fieldValue, limit)

        if (condenseResult.success && condenseResult.content.length <= limit) {
          ;(localizedData as Record<string, string>)[field] = condenseResult.content
          if (process.env.NODE_ENV === 'development') {
            console.log(`${field} condensed successfully (${condenseResult.content.length}/${limit})`)
          }
          // Add condense usage to total
          if (condenseResult.usage) {
            usage.inputTokens += condenseResult.usage.inputTokens
            usage.outputTokens += condenseResult.usage.outputTokens
          }
        } else {
          // Last resort: smart truncate at sentence/word boundary
          console.warn(`${field} AI condense failed or still over limit, using smart truncate`)
          ;(localizedData as Record<string, string>)[field] = smartTruncate(fieldValue, limit)
        }
      }
    }

    return { success: true, data: localizedData, usage }
  } catch (error) {
    console.error('AI localization error:', error)
    return { success: false, error: `AI localization error: ${error}` }
  }
}

/**
 * Translate app name and subtitle using Claude AI.
 * Brand names are automatically preserved by extracting them before translation.
 */
export async function translateAppInfo(
  sourceLocale: string,
  targetLocale: string,
  name: string,
  subtitle?: string,
  brandName?: string
): Promise<LocalizationResult> {
  try {
    // Extract brand and description
    let extraction: BrandExtraction
    if (brandName) {
      extraction = extractBrandByName(name, brandName)
    } else {
      extraction = extractBrandAndDescription(name)
    }

    const { brand, separator, description, brandFirst } = extraction

    const sourceName = APP_STORE_LOCALES[sourceLocale] || sourceLocale
    const targetName = APP_STORE_LOCALES[targetLocale] || targetLocale

    let userPrompt: string
    let fieldsList: string

    // Build prompt based on whether we have a brand
    if (brand) {
      // Calculate available space for description part
      const descCharLimit = separator ? 30 - brand.length - separator.length : 30 - brand.length

      const charLimitInstruction =
        descCharLimit > 0 ? `\nCRITICAL: The translated description MUST be ${descCharLimit} characters or fewer. Be concise.` : ''

      fieldsList = subtitle ? '"description", "subtitle"' : '"description"'

      userPrompt = isSameLanguageVariant(sourceLocale, targetLocale)
        ? getBrandAwareAdaptationPrompt(sourceLocale, sourceName, targetLocale, targetName, description, subtitle, charLimitInstruction, fieldsList)
        : getBrandAwareTranslationPrompt(sourceLocale, sourceName, targetLocale, targetName, description, subtitle, charLimitInstruction, fieldsList)
    } else {
      // No brand detected - translate entire name with existing prompts
      fieldsList = subtitle ? '"name", "subtitle"' : '"name"'

      userPrompt = isSameLanguageVariant(sourceLocale, targetLocale)
        ? getAppInfoAdaptationPrompt(sourceLocale, sourceName, targetLocale, targetName, name, subtitle, fieldsList)
        : getAppInfoTranslationPrompt(sourceLocale, sourceName, targetLocale, targetName, name, subtitle, fieldsList)
    }

    // Call AI provider - use BRAND_AWARE_SYSTEM when brand is extracted
    const response = await callAIWithRetry({
      model: getModel(),
      maxTokens: 500,
      system: brand ? BRAND_AWARE_SYSTEM : APP_INFO_SYSTEM,
      messages: [{ role: 'user', content: userPrompt }],
    })

    // Capture usage for cost tracking
    const usage: UsageStats = {
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      model: getModel(),
    }

    const responseText = response.text
    const jsonText = extractJsonFromResponse(responseText)

    let translatedData: Record<string, string>
    try {
      translatedData = JSON.parse(jsonText)
    } catch (error) {
      return { success: false, error: `Failed to parse AI response: ${error}` }
    }

    // Reconstruct name if we extracted a brand
    if (brand) {
      const translatedDescription = translatedData.description || description
      delete translatedData.description

      const descCharLimit = separator ? 30 - brand.length - separator.length : 30 - brand.length

      if (descCharLimit <= 0) {
        translatedData.name = brand.slice(0, 30)
        console.warn(`Brand "${brand}" fills entire 30-char name limit, using brand only`)
      } else {
        // Reconstruct with brand
        if (brandFirst) {
          translatedData.name = separator ? `${brand}${separator}${translatedDescription}` : brand
        } else {
          translatedData.name = separator ? `${translatedDescription}${separator}${brand}` : brand
        }

        // Brand-aware condensing: only condense the description part
        if (translatedData.name.length > 30) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`Name "${translatedData.name}" (${translatedData.name.length} chars) exceeds 30, condensing description part`)
          }

          const condenseResult = await condenseField('app name description', translatedDescription, descCharLimit)

          if (condenseResult.success && condenseResult.content.length <= descCharLimit) {
            // Reconstruct with condensed description
            if (brandFirst) {
              translatedData.name = `${brand}${separator}${condenseResult.content}`
            } else {
              translatedData.name = `${condenseResult.content}${separator}${brand}`
            }
            if (process.env.NODE_ENV === 'development') {
              console.log(`Description condensed successfully, name now ${translatedData.name.length} chars`)
            }
            if (condenseResult.usage) {
              usage.inputTokens += condenseResult.usage.inputTokens
              usage.outputTokens += condenseResult.usage.outputTokens
            }
          } else {
            // Last resort: smart_truncate the description only, then reconstruct
            console.warn('AI condense failed for description, using smart truncate')
            const truncatedDesc = smartTruncate(translatedDescription, descCharLimit)
            if (brandFirst) {
              translatedData.name = `${brand}${separator}${truncatedDesc}`
            } else {
              translatedData.name = `${truncatedDesc}${separator}${brand}`
            }
          }
        }
      }
    }

    // Ensure subtitle is present
    if (!translatedData.subtitle) {
      translatedData.subtitle = subtitle || ''
    }

    // Handle subtitle length limit
    if (translatedData.subtitle && translatedData.subtitle.length > 30) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Subtitle exceeds limit (${translatedData.subtitle.length}/30), condensing`)
      }
      const condenseResult = await condenseField('subtitle', translatedData.subtitle, 30)

      if (condenseResult.success && condenseResult.content.length <= 30) {
        translatedData.subtitle = condenseResult.content
        if (condenseResult.usage) {
          usage.inputTokens += condenseResult.usage.inputTokens
          usage.outputTokens += condenseResult.usage.outputTokens
        }
      } else {
        translatedData.subtitle = smartTruncate(translatedData.subtitle, 30)
      }
    }

    // Handle name length limit for non-brand names
    if (!brand && translatedData.name && translatedData.name.length > 30) {
      if (process.env.NODE_ENV === 'development') {
        console.log(`Name exceeds limit (${translatedData.name.length}/30), condensing`)
      }
      const condenseResult = await condenseField('app name', translatedData.name, 30)

      if (condenseResult.success && condenseResult.content.length <= 30) {
        translatedData.name = condenseResult.content
        if (condenseResult.usage) {
          usage.inputTokens += condenseResult.usage.inputTokens
          usage.outputTokens += condenseResult.usage.outputTokens
        }
      } else {
        translatedData.name = smartTruncate(translatedData.name, 30)
      }
    }

    return {
      success: true,
      appInfo: {
        name: translatedData.name,
        subtitle: translatedData.subtitle,
      },
      usage,
    }
  } catch (error) {
    console.error('Error in translateAppInfo:', error)
    return { success: false, error: `Translation error: ${error}` }
  }
}

/**
 * Full localization for a single target locale.
 * Handles both metadata and app info translation.
 */
export async function localizeForLocale(
  sourceLocale: string,
  targetLocale: string,
  metadata: LocalizationInput,
  fields: string[],
  appInfo?: { name: string; subtitle?: string },
  translateAppName = false,
  brandName?: string
): Promise<LocalizationResult> {
  const result: LocalizationResult = { success: true }
  let totalUsage: UsageStats | undefined

  // Localize metadata fields
  if (fields.length > 0) {
    const metadataResult = await localizeMetadata(sourceLocale, targetLocale, metadata, fields)
    if (!metadataResult.success) {
      return metadataResult
    }
    result.data = metadataResult.data
    if (metadataResult.usage) {
      totalUsage = metadataResult.usage
    }
  }

  // Translate app info if requested
  if (translateAppName && appInfo) {
    const appInfoResult = await translateAppInfo(
      sourceLocale,
      targetLocale,
      appInfo.name,
      appInfo.subtitle,
      brandName
    )
    if (!appInfoResult.success) {
      return appInfoResult
    }
    result.appInfo = appInfoResult.appInfo
    if (appInfoResult.usage) {
      if (totalUsage) {
        totalUsage.inputTokens += appInfoResult.usage.inputTokens
        totalUsage.outputTokens += appInfoResult.usage.outputTokens
      } else {
        totalUsage = appInfoResult.usage
      }
    }
  }

  result.usage = totalUsage
  return result
}
