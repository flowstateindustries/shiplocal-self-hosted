/**
 * SQLite schema for ShipLocal self-hosted.
 * Run on first init by the db client.
 */

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS selected_apps (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL UNIQUE,
  app_name TEXT NOT NULL,
  app_icon_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS localization_jobs (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  app_name TEXT NOT NULL,
  app_icon_url TEXT,
  source_locale TEXT NOT NULL,
  target_locales TEXT NOT NULL DEFAULT '[]',
  fields_localized TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending',
  results TEXT,
  locale_results TEXT,
  error_message TEXT,
  pushed_to_asc INTEGER NOT NULL DEFAULT 0,
  pushed_at TEXT,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  ai_model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_localization_jobs_created_at
  ON localization_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_localization_jobs_app_id
  ON localization_jobs(app_id);

CREATE TABLE IF NOT EXISTS strings_jobs (
  id TEXT PRIMARY KEY,
  file_name TEXT NOT NULL,
  source_locale TEXT NOT NULL,
  target_locales TEXT NOT NULL DEFAULT '[]',
  overwrite_existing INTEGER NOT NULL DEFAULT 0,
  source_content TEXT NOT NULL,
  results TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  locale_results TEXT NOT NULL DEFAULT '{}',
  total_strings INTEGER NOT NULL DEFAULT 0,
  strings_to_translate INTEGER NOT NULL DEFAULT 0,
  total_input_tokens INTEGER NOT NULL DEFAULT 0,
  total_output_tokens INTEGER NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  ai_model TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_strings_jobs_created_at
  ON strings_jobs(created_at DESC);
`
