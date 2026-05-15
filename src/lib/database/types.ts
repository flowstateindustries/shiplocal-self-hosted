/**
 * Database Types for ShipLocal (self-hosted, SQLite).
 *
 * No multi-tenant fields, no subscription/tier types.
 * JSON columns are stored as TEXT in SQLite; rows returned by
 * the typed helpers in `src/lib/db/*` have these columns already
 * parsed into their TS shapes.
 */

import type { JobConfig } from '@/lib/localization/types'

// Re-export JobConfig for backward compatibility
export type { JobConfig } from '@/lib/localization/types'

export type JobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'interrupted'

// =============================================================================
// Selected Apps
// =============================================================================

export interface SelectedApp {
  id: string
  app_id: string
  app_name: string
  app_icon_url: string | null
  created_at: string
}

export interface SelectedAppInsert {
  app_id: string
  app_name: string
  app_icon_url?: string | null
}

// =============================================================================
// Localization Jobs
// =============================================================================

export interface LocaleResult {
  locale: string
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
  name?: string
  subtitle?: string
}

export interface LocaleResultStatus {
  status: 'complete' | 'failed'
  data?: LocaleResult
  error?: string
}

export interface LocalizationResults {
  _config?: JobConfig
  locales: LocaleResult[]
}

export interface LocalizationJob {
  id: string
  app_id: string
  app_name: string
  app_icon_url: string | null
  source_locale: string
  target_locales: string[]
  fields_localized: string[]
  status: JobStatus
  results: LocalizationResults | null
  locale_results: Record<string, LocaleResultStatus> | null
  error_message: string | null
  pushed_to_asc: boolean
  pushed_at: string | null
  total_input_tokens: number
  total_output_tokens: number
  total_cost_cents: number
  ai_model: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface LocalizationJobInsert {
  app_id: string
  app_name: string
  app_icon_url?: string | null
  source_locale: string
  target_locales?: string[]
  fields_localized?: string[]
  status?: JobStatus
  results?: LocalizationResults | null
  locale_results?: Record<string, LocaleResultStatus> | null
  error_message?: string | null
  pushed_to_asc?: boolean
  pushed_at?: string | null
  total_input_tokens?: number
  total_output_tokens?: number
  total_cost_cents?: number
  ai_model?: string | null
  completed_at?: string | null
}

export interface LocalizationJobUpdate {
  app_name?: string
  source_locale?: string
  target_locales?: string[]
  fields_localized?: string[]
  status?: JobStatus
  results?: LocalizationResults | null
  locale_results?: Record<string, LocaleResultStatus> | null
  error_message?: string | null
  pushed_to_asc?: boolean
  pushed_at?: string | null
  total_input_tokens?: number
  total_output_tokens?: number
  total_cost_cents?: number
  ai_model?: string | null
  completed_at?: string | null
}

// =============================================================================
// Strings Jobs (.xcstrings translation)
// =============================================================================

export interface StringsLocaleResult {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  batches: Record<string, 'pending' | 'processing' | 'completed' | 'failed'>
  error?: string
  translated_count?: number
}

export interface XCStringsFile {
  sourceLanguage: string
  strings: Record<string, XCStringEntry>
  version: string
}

export interface XCStringEntry {
  comment?: string
  extractionState?: string
  localizations?: Record<string, XCStringLocalization>
}

export interface XCStringLocalization {
  stringUnit?: {
    state: string
    value: string
  }
  variations?: {
    plural?: Record<string, { stringUnit: { state: string; value: string } }>
  }
}

export interface StringsJob {
  id: string
  file_name: string
  source_locale: string
  target_locales: string[]
  overwrite_existing: boolean
  source_content: XCStringsFile
  results: XCStringsFile | null
  status: JobStatus
  error_message: string | null
  locale_results: Record<string, StringsLocaleResult>
  total_strings: number
  strings_to_translate: number
  total_input_tokens: number
  total_output_tokens: number
  total_cost_cents: number
  ai_model: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface StringsJobInsert {
  file_name: string
  source_locale: string
  target_locales: string[]
  overwrite_existing?: boolean
  source_content: XCStringsFile
  results?: XCStringsFile | null
  status?: JobStatus
  error_message?: string | null
  locale_results?: Record<string, StringsLocaleResult>
  total_strings: number
  strings_to_translate: number
  total_input_tokens?: number
  total_output_tokens?: number
  total_cost_cents?: number
  ai_model?: string | null
  completed_at?: string | null
}

export interface StringsJobUpdate {
  status?: JobStatus
  results?: XCStringsFile | null
  error_message?: string | null
  locale_results?: Record<string, StringsLocaleResult>
  total_input_tokens?: number
  total_output_tokens?: number
  total_cost_cents?: number
  ai_model?: string | null
  completed_at?: string | null
}
