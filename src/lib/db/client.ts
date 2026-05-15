import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { SCHEMA_SQL } from './schema'

let _db: Database.Database | null = null

function resolveDbPath(): string {
  const dataDir = process.env.DATA_DIR ?? './data'
  const resolved = isAbsolute(dataDir) ? dataDir : join(process.cwd(), dataDir)
  return join(resolved, 'shiplocal.db')
}

export function getDb(): Database.Database {
  if (_db) return _db

  const dbPath = resolveDbPath()
  mkdirSync(dirname(dbPath), { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)

  _db = db
  return db
}

export type DbClient = ReturnType<typeof getDb>

/**
 * Generate a UUID v4 for primary keys.
 * Uses Node's crypto.randomUUID (available in Node 16+).
 */
export function newId(): string {
  return crypto.randomUUID()
}

/**
 * Helper: parse a JSON column, returning a fallback when null/undefined/invalid.
 */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback
  if (typeof value !== 'string') return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

/**
 * Helper: stringify a value for storage in a JSON column.
 */
export function stringifyJsonColumn(value: unknown): string {
  return JSON.stringify(value ?? null)
}
