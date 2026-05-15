/**
 * String Batching
 * Create batches of strings for AI translation calls
 */

import type { XCStringsFile } from '@/lib/database/types'
import type { StringEntry } from './types'
import { STRINGS_BATCH_SIZE, STRINGS_MAX_CHARS_PER_BATCH } from './constants'
import { getSourceValue, hasTranslation } from './parser'

/**
 * Extract strings to translate for a specific locale
 */
export function getStringsToTranslate(
  xcstrings: XCStringsFile,
  targetLocale: string,
  overwrite: boolean
): StringEntry[] {
  const entries: StringEntry[] = []

  for (const [key, entry] of Object.entries(xcstrings.strings)) {
    // Get source value - first from explicit source locale, then fall back to key
    const sourceValue = getSourceValue(xcstrings, key) || key

    // Skip empty values
    if (!sourceValue.trim()) continue

    // Skip if already translated (unless overwrite is true)
    if (!overwrite && hasTranslation(xcstrings, key, targetLocale)) {
      continue
    }

    entries.push({
      key,
      value: sourceValue,
      comment: entry.comment
    })
  }

  return entries
}

/**
 * Create batches of strings for AI translation
 * Respects both count and character limits
 */
export function createBatches(strings: StringEntry[]): StringEntry[][] {
  if (strings.length === 0) return []

  const batches: StringEntry[][] = []
  let currentBatch: StringEntry[] = []
  let currentChars = 0

  for (const str of strings) {
    // Calculate character count for this string
    const strChars = str.key.length + str.value.length + (str.comment?.length || 0)

    // Check if adding this string would exceed limits
    const wouldExceedCount = currentBatch.length >= STRINGS_BATCH_SIZE
    const wouldExceedChars = currentChars + strChars > STRINGS_MAX_CHARS_PER_BATCH

    // Start new batch if limits exceeded
    if (currentBatch.length > 0 && (wouldExceedCount || wouldExceedChars)) {
      batches.push(currentBatch)
      currentBatch = []
      currentChars = 0
    }

    currentBatch.push(str)
    currentChars += strChars
  }

  // Push final batch if not empty
  if (currentBatch.length > 0) {
    batches.push(currentBatch)
  }

  return batches
}

/**
 * Calculate the total number of batches across all locales
 */
export function calculateTotalBatches(
  xcstrings: XCStringsFile,
  targetLocales: string[],
  overwrite: boolean
): { totalBatches: number; batchesByLocale: Record<string, number> } {
  const batchesByLocale: Record<string, number> = {}
  let totalBatches = 0

  for (const locale of targetLocales) {
    const strings = getStringsToTranslate(xcstrings, locale, overwrite)
    const batches = createBatches(strings)
    batchesByLocale[locale] = batches.length
    totalBatches += batches.length
  }

  return { totalBatches, batchesByLocale }
}
