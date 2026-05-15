/**
 * String Translation Types
 * Types for .xcstrings translation operations
 */

import type { UsageStats } from '@/lib/ai/types'

/**
 * A single string entry extracted for translation
 */
export interface StringEntry {
  key: string
  value: string
  comment?: string
}

/**
 * Result of translating a batch of strings
 */
export interface BatchTranslationResult {
  success: boolean
  translations?: Array<{
    key: string
    value: string
  }>
  error?: string
  usage?: UsageStats
}

/**
 * Result of translating all strings for a locale
 */
export interface LocaleTranslationResult {
  success: boolean
  translations?: Record<string, string>
  totalStrings?: number
  translatedCount?: number
  error?: string
  usage?: UsageStats
}

/**
 * SSE event types for strings translation stream
 */
export type StringsStreamEvent =
  | { type: 'starting'; totalLocales: number; totalStrings: number; completedLocales?: number; progress?: number }
  | { type: 'locale_start'; locale: string; localeName: string; stringsCount: number; batchCount: number }
  | { type: 'batch_start'; locale: string; batchIndex: number; batchSize: number }
  | { type: 'batch_complete'; locale: string; batchIndex: number; progress: number; translatedCount: number }
  | { type: 'locale_complete'; locale: string; progress: number; translatedCount: number }
  | { type: 'locale_error'; locale: string; error: string }
  | { type: 'complete'; completedLocales: number; totalStrings: number }
  | { type: 'error'; error: string }
  | { type: 'heartbeat' }

/**
 * Validation result for xcstrings file
 */
export interface XCStringsValidationResult {
  valid: boolean
  error?: string
  totalStrings?: number
  sourceLocale?: string
  existingLocales?: string[]
}
