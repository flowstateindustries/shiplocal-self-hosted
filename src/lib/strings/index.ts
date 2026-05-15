/**
 * String Translation Library
 * Core utilities for .xcstrings file translation
 */

// Constants
export {
  STRINGS_BATCH_SIZE,
  STRINGS_MAX_CHARS_PER_BATCH,
  STRINGS_STALE_THRESHOLD_MS,
  CONCURRENT_LOCALES,
} from './constants'

// Concurrent processing utilities (re-exported from the shared API layer)
export { mapWithConcurrency, createMutex } from '@/lib/api/concurrent'
export type { Mutex } from '@/lib/api/concurrent'

// Types
export type {
  StringEntry,
  BatchTranslationResult,
  LocaleTranslationResult,
  StringsStreamEvent,
  XCStringsValidationResult,
} from './types'

// Parser
export {
  validateXCStringsFile,
  parseXCStringsContent,
  getSourceValue,
  hasTranslation,
  countStringsToTranslate,
  getTotalStringCount,
} from './parser'

// Batcher
export {
  getStringsToTranslate,
  createBatches,
  calculateTotalBatches,
} from './batcher'

// Placeholders
export {
  extractPlaceholders,
  validatePlaceholders,
  hasPlaceholders,
  escapeForPrompt,
} from './placeholders'

// Prompts
export {
  STRINGS_SYSTEM_PROMPT,
  getStringsTranslationPrompt,
  getStringsAdaptationPrompt,
  isSameLanguageVariant,
  getBaseLanguageName,
} from './prompts'

// Translator
export {
  translateBatch,
  translateLocale,
  calculateTranslationCost,
} from './translator'

// Merger
export {
  cloneXCStringsFile,
  mergeLocaleTranslations,
  mergeAllTranslations,
  extractLocaleTranslations,
  countTranslationsByLocale,
  getAllLocales,
  formatXCStringsFile,
} from './merger'

// Job utilities
export { markStaleStringsJobsInterrupted } from './job-utils'
