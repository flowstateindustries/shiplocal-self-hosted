/**
 * Small helpers for reading numeric env vars with safe defaults.
 *
 * Centralises the parsing so every perf-tuning knob behaves the same way:
 *   - Unset, blank, or NaN → use the default
 *   - Below the minimum → use the default
 *   - Otherwise → the parsed integer
 */

/**
 * Read a positive integer from `process.env[name]`. Returns `fallback`
 * when the value is missing, blank, non-numeric, or below `min`.
 *
 * @param name - Env var name (e.g. "CONCURRENT_LOCALES")
 * @param fallback - Default value when the env var isn't usable
 * @param min - Minimum acceptable value (default: 1)
 */
export function getNumberEnv(name: string, fallback: number, min = 1): number {
  const raw = process.env[name]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback
}
