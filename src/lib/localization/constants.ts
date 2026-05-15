/**
 * Localization Constants
 * App Store locales, localizable fields, character limits, and processing config.
 *
 * Perf knobs are env-overridable via `.env.local`:
 *   CONCURRENT_LOCALES, STALE_JOB_THRESHOLD_MS, AI_TIMEOUT_MS
 */

import { getNumberEnv } from '@/lib/env'

// =============================================================================
// Processing Configuration
// =============================================================================

/**
 * Threshold in milliseconds for treating a `processing` job as interrupted/stale.
 * Override via `STALE_JOB_THRESHOLD_MS` in `.env.local`. Default: 300000 (5 min).
 */
export const STALE_THRESHOLD_MS = getNumberEnv('STALE_JOB_THRESHOLD_MS', 5 * 60 * 1000)

/**
 * Number of locales to process in parallel for both localization and strings jobs.
 * Override via `CONCURRENT_LOCALES` in `.env.local`. Default: 3.
 */
export const CONCURRENT_LOCALES = getNumberEnv('CONCURRENT_LOCALES', 3)

/**
 * Per-AI-call timeout in milliseconds. Used by every provider in `src/lib/ai/providers/`.
 * Override via `AI_TIMEOUT_MS` in `.env.local`. Default: 30000 (30 s).
 */
export const AI_TIMEOUT_MS = getNumberEnv('AI_TIMEOUT_MS', 30 * 1000)

// =============================================================================
// App Store Locales
// =============================================================================

export const APP_STORE_LOCALES: Record<string, string> = {
  'ar-SA': 'Arabic',
  'ca': 'Catalan',
  'zh-Hans': 'Chinese (Simplified)',
  'zh-Hant': 'Chinese (Traditional)',
  'hr': 'Croatian',
  'cs': 'Czech',
  'da': 'Danish',
  'nl-NL': 'Dutch',
  'en-AU': 'English (Australia)',
  'en-CA': 'English (Canada)',
  'en-GB': 'English (UK)',
  'en-US': 'English (US)',
  'fi': 'Finnish',
  'fr-CA': 'French (Canada)',
  'fr-FR': 'French (France)',
  'de-DE': 'German',
  'el': 'Greek',
  'he': 'Hebrew',
  'hi': 'Hindi',
  'hu': 'Hungarian',
  'id': 'Indonesian',
  'it': 'Italian',
  'ja': 'Japanese',
  'ko': 'Korean',
  'ms': 'Malay',
  'no': 'Norwegian',
  'pl': 'Polish',
  'pt-BR': 'Portuguese (Brazil)',
  'pt-PT': 'Portuguese (Portugal)',
  'ro': 'Romanian',
  'ru': 'Russian',
  'sk': 'Slovak',
  'es-MX': 'Spanish (Mexico)',
  'es-ES': 'Spanish (Spain)',
  'sv': 'Swedish',
  'th': 'Thai',
  'tr': 'Turkish',
  'uk': 'Ukrainian',
  'vi': 'Vietnamese',
}

export const LOCALIZABLE_FIELDS = [
  { code: 'description', name: 'Description' },
  { code: 'keywords', name: 'Keywords' },
  { code: 'promotionalText', name: 'Promotional Text' },
  { code: 'whatsNew', name: "What's New" },
] as const

export const FIELD_LIMITS: Record<string, number> = {
  description: 4000,
  keywords: 100,
  promotionalText: 170,
  whatsNew: 4000,
  name: 30,
  subtitle: 30,
}

/**
 * Get locale name from code
 */
export function getLocaleName(code: string): string {
  return APP_STORE_LOCALES[code] || code
}
