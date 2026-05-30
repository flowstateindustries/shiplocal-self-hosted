/**
 * Typed query helpers around the SQLite singleton.
 * API routes import these instead of writing raw SQL or hand-parsing JSON columns.
 */

import { getDb, newId, parseJsonColumn, stringifyJsonColumn } from './client'
import type {
  LocaleResultStatus,
  LocalizationJob,
  LocalizationJobInsert,
  LocalizationJobUpdate,
  LocalizationResults,
  PricingJob,
  PricingJobConfig,
  PricingJobInsert,
  PricingJobUpdate,
  PricingProductStatus,
  PricingResults,
  SelectedApp,
  SelectedAppInsert,
  StringsJob,
  StringsJobInsert,
  StringsJobUpdate,
  StringsLocaleResult,
  XCStringsFile,
  CopyJob,
  CopyJobInsert,
  CopyJobUpdate,
  CopyResults,
} from '@/lib/database/types'

// =============================================================================
// Row shapes (raw SQLite values, before JSON parsing)
// =============================================================================

interface SelectedAppRow {
  id: string
  app_id: string
  app_name: string
  app_icon_url: string | null
  created_at: string
}

interface LocalizationJobRow {
  id: string
  app_id: string
  app_name: string
  app_icon_url: string | null
  source_locale: string
  target_locales: string
  fields_localized: string
  status: string
  results: string | null
  locale_results: string | null
  error_message: string | null
  pushed_to_asc: number
  pushed_at: string | null
  total_input_tokens: number
  total_output_tokens: number
  total_cost_cents: number
  ai_model: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

interface StringsJobRow {
  id: string
  file_name: string
  source_locale: string
  target_locales: string
  overwrite_existing: number
  source_content: string
  results: string | null
  status: string
  error_message: string | null
  locale_results: string
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

interface PricingJobRow {
  id: string
  app_id: string
  app_name: string
  app_icon_url: string | null
  base_territory: string
  product_ids: string
  strategy: string | null
  status: string
  results: string | null
  product_results: string
  error_message: string | null
  pushed_to_asc: number
  pushed_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

// =============================================================================
// Row → domain mapping
// =============================================================================

function mapSelectedApp(row: SelectedAppRow): SelectedApp {
  return { ...row }
}

function mapLocalizationJob(row: LocalizationJobRow): LocalizationJob {
  return {
    id: row.id,
    app_id: row.app_id,
    app_name: row.app_name,
    app_icon_url: row.app_icon_url,
    source_locale: row.source_locale,
    target_locales: parseJsonColumn<string[]>(row.target_locales, []),
    fields_localized: parseJsonColumn<string[]>(row.fields_localized, []),
    status: row.status as LocalizationJob['status'],
    results: parseJsonColumn<LocalizationResults | null>(row.results, null),
    locale_results: parseJsonColumn<Record<string, LocaleResultStatus> | null>(
      row.locale_results,
      null
    ),
    error_message: row.error_message,
    pushed_to_asc: row.pushed_to_asc === 1,
    pushed_at: row.pushed_at,
    total_input_tokens: row.total_input_tokens,
    total_output_tokens: row.total_output_tokens,
    total_cost_cents: row.total_cost_cents,
    ai_model: row.ai_model,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  }
}

function mapStringsJob(row: StringsJobRow): StringsJob {
  return {
    id: row.id,
    file_name: row.file_name,
    source_locale: row.source_locale,
    target_locales: parseJsonColumn<string[]>(row.target_locales, []),
    overwrite_existing: row.overwrite_existing === 1,
    source_content: parseJsonColumn<XCStringsFile>(row.source_content, {
      sourceLanguage: 'en',
      strings: {},
      version: '1.0',
    }),
    results: parseJsonColumn<XCStringsFile | null>(row.results, null),
    status: row.status as StringsJob['status'],
    error_message: row.error_message,
    locale_results: parseJsonColumn<Record<string, StringsLocaleResult>>(
      row.locale_results,
      {}
    ),
    total_strings: row.total_strings,
    strings_to_translate: row.strings_to_translate,
    total_input_tokens: row.total_input_tokens,
    total_output_tokens: row.total_output_tokens,
    total_cost_cents: row.total_cost_cents,
    ai_model: row.ai_model,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  }
}

function mapPricingJob(row: PricingJobRow): PricingJob {
  return {
    id: row.id,
    app_id: row.app_id,
    app_name: row.app_name,
    app_icon_url: row.app_icon_url,
    base_territory: row.base_territory,
    product_ids: parseJsonColumn<string[]>(row.product_ids, []),
    strategy: parseJsonColumn<PricingJobConfig | null>(row.strategy, null),
    status: row.status as PricingJob['status'],
    results: parseJsonColumn<PricingResults | null>(row.results, null),
    product_results: parseJsonColumn<Record<string, PricingProductStatus>>(
      row.product_results,
      {}
    ),
    error_message: row.error_message,
    pushed_to_asc: row.pushed_to_asc === 1,
    pushed_at: row.pushed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  }
}

// =============================================================================
// Selected Apps
// =============================================================================

export function listSelectedApps(): SelectedApp[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM selected_apps ORDER BY created_at DESC`
    )
    .all() as SelectedAppRow[]
  return rows.map(mapSelectedApp)
}

export function getSelectedAppByAppId(appId: string): SelectedApp | null {
  const row = getDb()
    .prepare(`SELECT * FROM selected_apps WHERE app_id = ?`)
    .get(appId) as SelectedAppRow | undefined
  return row ? mapSelectedApp(row) : null
}

export function insertSelectedApp(input: SelectedAppInsert): SelectedApp {
  const id = newId()
  getDb()
    .prepare(
      `INSERT INTO selected_apps (id, app_id, app_name, app_icon_url)
       VALUES (?, ?, ?, ?)`
    )
    .run(
      id,
      input.app_id,
      input.app_name,
      input.app_icon_url ?? null
    )

  const created = getSelectedAppByAppId(input.app_id)
  if (!created) {
    throw new Error('Failed to insert selected app')
  }
  return created
}

export function deleteSelectedAppByAppId(appId: string): boolean {
  const info = getDb()
    .prepare(`DELETE FROM selected_apps WHERE app_id = ?`)
    .run(appId)
  return info.changes > 0
}

// =============================================================================
// Localization Jobs
// =============================================================================

export function listLocalizationJobs(): LocalizationJob[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM localization_jobs ORDER BY created_at DESC`
    )
    .all() as LocalizationJobRow[]
  return rows.map(mapLocalizationJob)
}

export function getLocalizationJob(id: string): LocalizationJob | null {
  const row = getDb()
    .prepare(`SELECT * FROM localization_jobs WHERE id = ?`)
    .get(id) as LocalizationJobRow | undefined
  return row ? mapLocalizationJob(row) : null
}

export function insertLocalizationJob(
  input: LocalizationJobInsert
): LocalizationJob {
  const id = newId()
  getDb()
    .prepare(
      `INSERT INTO localization_jobs (
         id, app_id, app_name, app_icon_url, source_locale,
         target_locales, fields_localized, status, results, locale_results,
         error_message, pushed_to_asc, pushed_at,
         total_input_tokens, total_output_tokens, total_cost_cents,
         ai_model, completed_at
       ) VALUES (
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?,
         ?, ?, ?,
         ?, ?
       )`
    )
    .run(
      id,
      input.app_id,
      input.app_name,
      input.app_icon_url ?? null,
      input.source_locale,
      stringifyJsonColumn(input.target_locales ?? []),
      stringifyJsonColumn(input.fields_localized ?? []),
      input.status ?? 'pending',
      input.results === undefined ? null : stringifyJsonColumn(input.results),
      input.locale_results === undefined
        ? null
        : stringifyJsonColumn(input.locale_results),
      input.error_message ?? null,
      input.pushed_to_asc ? 1 : 0,
      input.pushed_at ?? null,
      input.total_input_tokens ?? 0,
      input.total_output_tokens ?? 0,
      input.total_cost_cents ?? 0,
      input.ai_model ?? null,
      input.completed_at ?? null
    )

  const created = getLocalizationJob(id)
  if (!created) {
    throw new Error('Failed to insert localization job')
  }
  return created
}

const LOCALIZATION_JSON_FIELDS = new Set([
  'target_locales',
  'fields_localized',
  'results',
  'locale_results',
])
const LOCALIZATION_BOOL_FIELDS = new Set(['pushed_to_asc'])

export function updateLocalizationJob(
  id: string,
  patch: LocalizationJobUpdate
): LocalizationJob | null {
  const fields: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    fields.push(`${key} = ?`)
    if (LOCALIZATION_JSON_FIELDS.has(key)) {
      values.push(value === null ? null : stringifyJsonColumn(value))
    } else if (LOCALIZATION_BOOL_FIELDS.has(key)) {
      values.push(value ? 1 : 0)
    } else {
      values.push(value)
    }
  }

  fields.push(`updated_at = datetime('now')`)

  if (fields.length === 1) {
    // Only updated_at — still bump it.
    getDb()
      .prepare(`UPDATE localization_jobs SET updated_at = datetime('now') WHERE id = ?`)
      .run(id)
    return getLocalizationJob(id)
  }

  values.push(id)
  getDb()
    .prepare(
      `UPDATE localization_jobs SET ${fields.join(', ')} WHERE id = ?`
    )
    .run(...values)
  return getLocalizationJob(id)
}

export function deleteLocalizationJob(id: string): boolean {
  const info = getDb()
    .prepare(`DELETE FROM localization_jobs WHERE id = ?`)
    .run(id)
  return info.changes > 0
}

/**
 * Atomically claim a job for processing. Returns the updated row only if the
 * status transition succeeded (i.e. another worker hadn't already claimed it).
 */
export function claimLocalizationJobForProcessing(
  id: string,
  allowedFromStatuses: ReadonlyArray<LocalizationJob['status']>
): LocalizationJob | null {
  const placeholders = allowedFromStatuses.map(() => '?').join(', ')
  const info = getDb()
    .prepare(
      `UPDATE localization_jobs
         SET status = 'processing', updated_at = datetime('now')
       WHERE id = ? AND status IN (${placeholders})`
    )
    .run(id, ...allowedFromStatuses)
  if (info.changes === 0) return null
  return getLocalizationJob(id)
}

// =============================================================================
// Strings Jobs
// =============================================================================

export function listStringsJobs(): StringsJob[] {
  const rows = getDb()
    .prepare(`SELECT * FROM strings_jobs ORDER BY created_at DESC`)
    .all() as StringsJobRow[]
  return rows.map(mapStringsJob)
}

export function getStringsJob(id: string): StringsJob | null {
  const row = getDb()
    .prepare(`SELECT * FROM strings_jobs WHERE id = ?`)
    .get(id) as StringsJobRow | undefined
  return row ? mapStringsJob(row) : null
}

export function insertStringsJob(input: StringsJobInsert): StringsJob {
  const id = newId()
  getDb()
    .prepare(
      `INSERT INTO strings_jobs (
         id, file_name, source_locale, target_locales, overwrite_existing,
         source_content, results, status, error_message, locale_results,
         total_strings, strings_to_translate,
         total_input_tokens, total_output_tokens, total_cost_cents,
         ai_model, completed_at
       ) VALUES (
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?,
         ?, ?, ?,
         ?, ?
       )`
    )
    .run(
      id,
      input.file_name,
      input.source_locale,
      stringifyJsonColumn(input.target_locales),
      input.overwrite_existing ? 1 : 0,
      stringifyJsonColumn(input.source_content),
      input.results === undefined ? null : stringifyJsonColumn(input.results),
      input.status ?? 'pending',
      input.error_message ?? null,
      stringifyJsonColumn(input.locale_results ?? {}),
      input.total_strings,
      input.strings_to_translate,
      input.total_input_tokens ?? 0,
      input.total_output_tokens ?? 0,
      input.total_cost_cents ?? 0,
      input.ai_model ?? null,
      input.completed_at ?? null
    )

  const created = getStringsJob(id)
  if (!created) {
    throw new Error('Failed to insert strings job')
  }
  return created
}

const STRINGS_JSON_FIELDS = new Set(['results', 'locale_results'])

export function updateStringsJob(
  id: string,
  patch: StringsJobUpdate
): StringsJob | null {
  const fields: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    fields.push(`${key} = ?`)
    if (STRINGS_JSON_FIELDS.has(key)) {
      values.push(value === null ? null : stringifyJsonColumn(value))
    } else {
      values.push(value)
    }
  }

  fields.push(`updated_at = datetime('now')`)

  if (fields.length === 1) {
    getDb()
      .prepare(`UPDATE strings_jobs SET updated_at = datetime('now') WHERE id = ?`)
      .run(id)
    return getStringsJob(id)
  }

  values.push(id)
  getDb()
    .prepare(`UPDATE strings_jobs SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)
  return getStringsJob(id)
}

export function deleteStringsJob(id: string): boolean {
  const info = getDb().prepare(`DELETE FROM strings_jobs WHERE id = ?`).run(id)
  return info.changes > 0
}

export function claimStringsJobForProcessing(
  id: string,
  allowedFromStatuses: ReadonlyArray<StringsJob['status']>
): StringsJob | null {
  const placeholders = allowedFromStatuses.map(() => '?').join(', ')
  const info = getDb()
    .prepare(
      `UPDATE strings_jobs
         SET status = 'processing', updated_at = datetime('now')
       WHERE id = ? AND status IN (${placeholders})`
    )
    .run(id, ...allowedFromStatuses)
  if (info.changes === 0) return null
  return getStringsJob(id)
}

// =============================================================================
// Pricing Jobs
// =============================================================================

export function listPricingJobs(): PricingJob[] {
  const rows = getDb()
    .prepare(`SELECT * FROM pricing_jobs ORDER BY created_at DESC`)
    .all() as PricingJobRow[]
  return rows.map(mapPricingJob)
}

export function getPricingJob(id: string): PricingJob | null {
  const row = getDb()
    .prepare(`SELECT * FROM pricing_jobs WHERE id = ?`)
    .get(id) as PricingJobRow | undefined
  return row ? mapPricingJob(row) : null
}

export function insertPricingJob(input: PricingJobInsert): PricingJob {
  const id = newId()
  getDb()
    .prepare(
      `INSERT INTO pricing_jobs (
         id, app_id, app_name, app_icon_url, base_territory,
         product_ids, strategy, status, results, product_results,
         error_message, pushed_to_asc, pushed_at, completed_at
       ) VALUES (
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?, ?,
         ?, ?, ?, ?
       )`
    )
    .run(
      id,
      input.app_id,
      input.app_name,
      input.app_icon_url ?? null,
      input.base_territory,
      stringifyJsonColumn(input.product_ids ?? []),
      input.strategy === undefined ? null : stringifyJsonColumn(input.strategy),
      input.status ?? 'pending',
      input.results === undefined ? null : stringifyJsonColumn(input.results),
      stringifyJsonColumn(input.product_results ?? {}),
      input.error_message ?? null,
      input.pushed_to_asc ? 1 : 0,
      input.pushed_at ?? null,
      input.completed_at ?? null
    )

  const created = getPricingJob(id)
  if (!created) {
    throw new Error('Failed to insert pricing job')
  }
  return created
}

const PRICING_JSON_FIELDS = new Set(['results', 'product_results'])
const PRICING_BOOL_FIELDS = new Set(['pushed_to_asc'])

export function updatePricingJob(
  id: string,
  patch: PricingJobUpdate
): PricingJob | null {
  const fields: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    fields.push(`${key} = ?`)
    if (PRICING_JSON_FIELDS.has(key)) {
      values.push(value === null ? null : stringifyJsonColumn(value))
    } else if (PRICING_BOOL_FIELDS.has(key)) {
      values.push(value ? 1 : 0)
    } else {
      values.push(value)
    }
  }

  fields.push(`updated_at = datetime('now')`)

  if (fields.length === 1) {
    getDb()
      .prepare(`UPDATE pricing_jobs SET updated_at = datetime('now') WHERE id = ?`)
      .run(id)
    return getPricingJob(id)
  }

  values.push(id)
  getDb()
    .prepare(`UPDATE pricing_jobs SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)
  return getPricingJob(id)
}

export function deletePricingJob(id: string): boolean {
  const info = getDb().prepare(`DELETE FROM pricing_jobs WHERE id = ?`).run(id)
  return info.changes > 0
}

export function claimPricingJobForProcessing(
  id: string,
  allowedFromStatuses: ReadonlyArray<PricingJob['status']>
): PricingJob | null {
  const placeholders = allowedFromStatuses.map(() => '?').join(', ')
  const info = getDb()
    .prepare(
      `UPDATE pricing_jobs
         SET status = 'processing', updated_at = datetime('now')
       WHERE id = ? AND status IN (${placeholders})`
    )
    .run(id, ...allowedFromStatuses)
  if (info.changes === 0) return null
  return getPricingJob(id)
}

// =============================================================================
// Copy Jobs
// =============================================================================

interface CopyJobRow {
  id: string
  app_id: string
  app_name: string
  app_icon_url: string | null
  source_version_id: string
  source_version_string: string
  target_version_id: string
  target_version_string: string
  fields_to_copy: string
  status: string
  results: string | null
  error_message: string | null
  pushed_to_asc: number
  pushed_at: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
}

function mapCopyJob(row: CopyJobRow): CopyJob {
  return {
    id: row.id,
    app_id: row.app_id,
    app_name: row.app_name,
    app_icon_url: row.app_icon_url,
    source_version_id: row.source_version_id,
    source_version_string: row.source_version_string,
    target_version_id: row.target_version_id,
    target_version_string: row.target_version_string,
    fields_to_copy: parseJsonColumn<string[]>(row.fields_to_copy, []),
    status: row.status as CopyJob['status'],
    results: parseJsonColumn<CopyResults | null>(row.results, null),
    error_message: row.error_message,
    pushed_to_asc: row.pushed_to_asc === 1,
    pushed_at: row.pushed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at,
  }
}

export function listCopyJobs(): CopyJob[] {
  const rows = getDb()
    .prepare(`SELECT * FROM copy_jobs ORDER BY created_at DESC`)
    .all() as CopyJobRow[]
  return rows.map(mapCopyJob)
}

export function getCopyJob(id: string): CopyJob | null {
  const row = getDb()
    .prepare(`SELECT * FROM copy_jobs WHERE id = ?`)
    .get(id) as CopyJobRow | undefined
  return row ? mapCopyJob(row) : null
}

export function insertCopyJob(input: CopyJobInsert): CopyJob {
  const id = newId()
  getDb()
    .prepare(
      `INSERT INTO copy_jobs (
         id, app_id, app_name, app_icon_url,
         source_version_id, source_version_string,
         target_version_id, target_version_string,
         fields_to_copy, status, results, error_message,
         pushed_to_asc, pushed_at, completed_at
       ) VALUES (
         ?, ?, ?, ?,
         ?, ?,
         ?, ?,
         ?, ?, ?, ?,
         ?, ?, ?
       )`
    )
    .run(
      id,
      input.app_id,
      input.app_name,
      input.app_icon_url ?? null,
      input.source_version_id,
      input.source_version_string,
      input.target_version_id,
      input.target_version_string,
      stringifyJsonColumn(input.fields_to_copy),
      input.status ?? 'pending',
      input.results === undefined ? null : stringifyJsonColumn(input.results),
      input.error_message ?? null,
      input.pushed_to_asc ? 1 : 0,
      input.pushed_at ?? null,
      input.completed_at ?? null
    )

  const created = getCopyJob(id)
  if (!created) throw new Error('Failed to insert copy job')
  return created
}

const COPY_JSON_FIELDS = new Set(['fields_to_copy', 'results'])
const COPY_BOOL_FIELDS = new Set(['pushed_to_asc'])

export function updateCopyJob(
  id: string,
  patch: CopyJobUpdate
): CopyJob | null {
  const fields: string[] = []
  const values: unknown[] = []

  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue
    fields.push(`${key} = ?`)
    if (COPY_JSON_FIELDS.has(key)) {
      values.push(value === null ? null : stringifyJsonColumn(value))
    } else if (COPY_BOOL_FIELDS.has(key)) {
      values.push(value ? 1 : 0)
    } else {
      values.push(value)
    }
  }

  fields.push(`updated_at = datetime('now')`)

  if (fields.length === 1) {
    getDb()
      .prepare(`UPDATE copy_jobs SET updated_at = datetime('now') WHERE id = ?`)
      .run(id)
    return getCopyJob(id)
  }

  values.push(id)
  getDb()
    .prepare(`UPDATE copy_jobs SET ${fields.join(', ')} WHERE id = ?`)
    .run(...values)
  return getCopyJob(id)
}

export function deleteCopyJob(id: string): boolean {
  const info = getDb().prepare(`DELETE FROM copy_jobs WHERE id = ?`).run(id)
  return info.changes > 0
}

export function claimCopyJobForPushing(
  id: string,
  allowedFromStatuses: ReadonlyArray<CopyJob['status']>
): CopyJob | null {
  const placeholders = allowedFromStatuses.map(() => '?').join(', ')
  const info = getDb()
    .prepare(
      `UPDATE copy_jobs
         SET status = 'processing', updated_at = datetime('now')
       WHERE id = ? AND status IN (${placeholders})`
    )
    .run(id, ...allowedFromStatuses)
  if (info.changes === 0) return null
  return getCopyJob(id)
}
