/**
 * App Store Connect API service
 * Core functions for authentication and API calls
 */

import { SignJWT, importPKCS8 } from 'jose'
import type {
  ASCApp,
  ASCVersion,
  ASCLocalization,
  ASCResult,
  ASCCredentials,
} from './types'
import { EDITABLE_STATES } from './types'
import { mapWithConcurrency } from '@/lib/api/concurrent'

const BASE_URL = 'https://api.appstoreconnect.apple.com'

// =============================================================================
// iTunes API Cache
// =============================================================================

interface CacheEntry {
  data: { iconUrl: string | null; storeUrl: string | null }
  expires: number
}

// In-memory cache for iTunes API responses (1-hour TTL)
const itunesCache = new Map<string, CacheEntry>()
const ITUNES_CACHE_TTL = 60 * 60 * 1000 // 1 hour
const ITUNES_CACHE_FAILURE_TTL = 5 * 60 * 1000 // 5 minutes for failures
const ITUNES_CACHE_MAX_SIZE = 500 // Maximum entries before LRU eviction

/**
 * Clean expired entries and evict oldest if over size limit
 */
function cleanItunesCache(): void {
  const now = Date.now()

  // Remove expired entries
  for (const [key, entry] of itunesCache.entries()) {
    if (entry.expires < now) {
      itunesCache.delete(key)
    }
  }

  // LRU eviction if still over limit
  if (itunesCache.size > ITUNES_CACHE_MAX_SIZE) {
    const entries = Array.from(itunesCache.entries())
      .sort((a, b) => a[1].expires - b[1].expires)

    const toRemove = entries.slice(0, itunesCache.size - ITUNES_CACHE_MAX_SIZE)
    for (const [key] of toRemove) {
      itunesCache.delete(key)
    }
  }
}

/**
 * Generate JWT for App Store Connect API authentication
 * @param keyId - The Key ID from App Store Connect
 * @param issuerId - The Issuer ID from App Store Connect
 * @param privateKey - The .p8 private key contents
 * @returns Signed JWT token (valid for 20 minutes)
 */
export async function generateJWT(
  keyId: string,
  issuerId: string,
  privateKey: string
): Promise<string> {
  const key = await importPKCS8(privateKey, 'ES256')
  const now = Math.floor(Date.now() / 1000)

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(issuerId)
    .setIssuedAt(now)
    .setExpirationTime(now + 1200) // 20 minutes
    .setAudience('appstoreconnect-v1')
    .sign(key)

  return jwt
}

/**
 * Get authorization headers for App Store Connect API requests
 */
export async function getAuthHeaders(
  keyId: string,
  issuerId: string,
  privateKey: string
): Promise<Headers> {
  const token = await generateJWT(keyId, issuerId, privateKey)
  const headers = new Headers()
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')
  return headers
}

/**
 * Test App Store Connect credentials by listing apps
 */
export async function testConnection(
  credentials: ASCCredentials
): Promise<ASCResult<{ appCount: number }>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(`${BASE_URL}/v1/apps`, {
      headers,
      signal: AbortSignal.timeout(10000),
    })

    if (response.ok) {
      const data = await response.json()
      const appCount = data.data?.length ?? 0
      return { success: true, data: { appCount } }
    }

    if (response.status === 401) {
      return {
        success: false,
        error: 'Invalid credentials. Please check your Issuer ID, Key ID, and private key.',
      }
    }

    if (response.status === 403) {
      return {
        success: false,
        error: 'Insufficient permissions. Ensure your API key has App Manager or Admin access.',
      }
    }

    return {
      success: false,
      error: `Connection failed with status ${response.status}.`,
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('PKCS8')) {
        return {
          success: false,
          error: 'Invalid private key format. Ensure you uploaded the correct .p8 file.',
        }
      }
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return {
          success: false,
          error: 'Connection timed out. Please try again.',
        }
      }
    }
    return {
      success: false,
      error: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Fetch app icon and App Store URL from iTunes Lookup API
 * Results are cached for 1 hour to reduce API calls
 */
export async function getAppStoreInfo(
  bundleId: string,
  country = 'us'
): Promise<{ iconUrl: string | null; storeUrl: string | null }> {
  const cacheKey = `${bundleId}:${country}`

  // Check cache first
  const cached = itunesCache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?bundleId=${encodeURIComponent(bundleId)}&country=${country}`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (response.ok) {
      const data = await response.json()
      if (data.resultCount > 0) {
        const result = data.results[0]
        const storeInfo = {
          iconUrl: result.artworkUrl512 || result.artworkUrl100 || null,
          storeUrl: result.trackViewUrl || null,
        }

        // Cache the result
        itunesCache.set(cacheKey, {
          data: storeInfo,
          expires: Date.now() + ITUNES_CACHE_TTL
        })

        // Periodic cleanup
        if (itunesCache.size > ITUNES_CACHE_MAX_SIZE) {
          cleanItunesCache()
        }

        return storeInfo
      }
    }
  } catch {
    // Icon fetch is non-critical, silently fail
  }

  // Cache negative result too (but with shorter TTL)
  const emptyResult = { iconUrl: null, storeUrl: null }
  itunesCache.set(cacheKey, {
    data: emptyResult,
    expires: Date.now() + ITUNES_CACHE_FAILURE_TTL
  })

  return emptyResult
}

/**
 * List all apps from App Store Connect with icons
 */
export async function listApps(
  credentials: ASCCredentials
): Promise<ASCResult<ASCApp[]>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(`${BASE_URL}/v1/apps`, {
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: 'Rate limited by App Store Connect. Please try again in a few minutes.',
        }
      }
      return {
        success: false,
        error: `Failed to fetch apps: ${response.status}`,
      }
    }

    const data = await response.json()
    const rawApps = data.data || []

    // Build initial app list
    const apps: ASCApp[] = rawApps.map((app: { id: string; attributes: { name?: string; bundleId?: string; sku?: string } }) => ({
      id: app.id,
      name: app.attributes?.name || 'Unknown',
      bundleId: app.attributes?.bundleId || '',
      sku: app.attributes?.sku || '',
      iconUrl: undefined,
      storeUrl: undefined,
    }))

    // Fetch icons with concurrency limit (max 5 concurrent)
    await mapWithConcurrency(apps, 5, async (app) => {
      if (app.bundleId) {
        const storeInfo = await getAppStoreInfo(app.bundleId)
        app.iconUrl = storeInfo.iconUrl ?? undefined
        app.storeUrl = storeInfo.storeUrl ?? undefined
      }
      return app
    })

    return { success: true, data: apps }
  } catch (error) {
    return {
      success: false,
      error: `Error fetching apps: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get all app store versions for an app
 */
export async function getAppVersions(
  credentials: ASCCredentials,
  appId: string
): Promise<ASCResult<ASCVersion[]>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(`${BASE_URL}/v1/apps/${appId}/appStoreVersions`, {
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'App not found' }
      }
      return {
        success: false,
        error: `Failed to fetch versions: ${response.status}`,
      }
    }

    const data = await response.json()
    const versions: ASCVersion[] = (data.data || []).map(
      (version: { id: string; attributes: { versionString?: string; appStoreState?: string; platform?: string } }) => ({
        id: version.id,
        versionString: version.attributes?.versionString || '',
        appStoreState: version.attributes?.appStoreState || '',
        platform: version.attributes?.platform || '',
      })
    )

    // Sort to put editable versions first
    versions.sort((a, b) => {
      const aEditable = EDITABLE_STATES.includes(a.appStoreState as typeof EDITABLE_STATES[number]) ? 0 : 1
      const bEditable = EDITABLE_STATES.includes(b.appStoreState as typeof EDITABLE_STATES[number]) ? 0 : 1
      return aEditable - bEditable
    })

    return { success: true, data: versions }
  } catch (error) {
    return {
      success: false,
      error: `Error fetching versions: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get the editable (PREPARE_FOR_SUBMISSION) version for an app
 */
export async function getEditableVersion(
  credentials: ASCCredentials,
  appId: string
): Promise<ASCResult<ASCVersion>> {
  const result = await getAppVersions(credentials, appId)

  if (!result.success || !result.data) {
    return { success: false, error: result.error || 'Failed to fetch versions' }
  }

  const editableVersion = result.data.find((version) =>
    EDITABLE_STATES.includes(version.appStoreState as typeof EDITABLE_STATES[number])
  )

  if (!editableVersion) {
    return {
      success: false,
      error: 'No editable version found. Create a new version in App Store Connect first.',
    }
  }

  return { success: true, data: editableVersion }
}

/**
 * Get all localizations for an app store version with their metadata
 */
export async function getVersionLocalizations(
  credentials: ASCCredentials,
  versionId: string
): Promise<ASCResult<ASCLocalization[]>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(
      `${BASE_URL}/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations`,
      {
        headers,
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Version not found' }
      }
      return {
        success: false,
        error: `Failed to fetch localizations: ${response.status}`,
      }
    }

    const data = await response.json()
    const localizations: ASCLocalization[] = (data.data || []).map(
      (loc: { id: string; attributes: { locale?: string; description?: string; keywords?: string; promotionalText?: string; whatsNew?: string; supportUrl?: string; marketingUrl?: string } }) => ({
        id: loc.id,
        locale: loc.attributes?.locale || '',
        description: loc.attributes?.description || '',
        keywords: loc.attributes?.keywords || '',
        promotionalText: loc.attributes?.promotionalText || '',
        whatsNew: loc.attributes?.whatsNew || '',
        supportUrl: loc.attributes?.supportUrl || '',
        marketingUrl: loc.attributes?.marketingUrl || '',
      })
    )

    // Sort by locale for consistent ordering
    localizations.sort((a, b) => a.locale.localeCompare(b.locale))

    return { success: true, data: localizations }
  } catch (error) {
    return {
      success: false,
      error: `Error fetching localizations: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get the appInfo ID for an app (needed for app-level localizations)
 */
export async function getAppInfoId(
  credentials: ASCCredentials,
  appId: string
): Promise<ASCResult<string>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(`${BASE_URL}/v1/apps/${appId}/appInfos`, {
      headers,
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch app info: ${response.status}`,
      }
    }

    const data = await response.json()
    const appInfos = data.data || []

    if (appInfos.length === 0) {
      return { success: false, error: 'No app info found for this app' }
    }

    // States where app info is editable
    const editableStates = new Set([
      'PREPARE_FOR_SUBMISSION',
      'DEVELOPER_ACTION_NEEDED',
      'WAITING_FOR_REVIEW',
      'IN_REVIEW',
      'DEVELOPER_REJECTED',
      'REJECTED',
      'METADATA_REJECTED',
    ])

    // Try to find an editable app info first
    for (const appInfo of appInfos) {
      const state = appInfo.attributes?.appStoreState
      if (editableStates.has(state)) {
        return { success: true, data: appInfo.id }
      }
    }

    // Fallback to first one
    return { success: true, data: appInfos[0].id }
  } catch (error) {
    return {
      success: false,
      error: `Error fetching app info ID: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get app-level localization data (name, subtitle, privacyUrl) for a specific locale
 */
export async function getAppInfoLocalization(
  credentials: ASCCredentials,
  appId: string,
  locale: string
): Promise<ASCResult<{ name?: string; subtitle?: string; privacyUrl?: string }>> {
  try {
    // First get the appInfo ID
    const appInfoResult = await getAppInfoId(credentials, appId)
    if (!appInfoResult.success || !appInfoResult.data) {
      return { success: false, error: appInfoResult.error || 'Failed to get app info' }
    }

    const appInfoId = appInfoResult.data
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(
      `${BASE_URL}/v1/appInfos/${appInfoId}/appInfoLocalizations`,
      {
        headers,
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch app info localizations: ${response.status}`,
      }
    }

    const data = await response.json()
    const locData = (data.data || []).find(
      (loc: { attributes?: { locale?: string } }) => loc.attributes?.locale === locale
    )

    if (!locData) {
      return { success: true, data: {} } // No localization for this locale
    }

    return {
      success: true,
      data: {
        name: locData.attributes?.name || undefined,
        subtitle: locData.attributes?.subtitle || undefined,
        privacyUrl: locData.attributes?.privacyPolicyUrl || undefined,
      },
    }
  } catch (error) {
    return {
      success: false,
      error: `Error fetching app info localization: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get app-level localizations (locale list) for an app
 * These represent locales configured at the app level
 */
export async function getAppInfoLocalizations(
  credentials: ASCCredentials,
  appId: string
): Promise<ASCResult<string[]>> {
  try {
    // First get the appInfo ID
    const appInfoResult = await getAppInfoId(credentials, appId)
    if (!appInfoResult.success || !appInfoResult.data) {
      return { success: false, error: appInfoResult.error || 'Failed to get app info' }
    }

    const appInfoId = appInfoResult.data
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(
      `${BASE_URL}/v1/appInfos/${appInfoId}/appInfoLocalizations`,
      {
        headers,
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch app info localizations: ${response.status}`,
      }
    }

    const data = await response.json()
    const locales: string[] = (data.data || [])
      .map((loc: { attributes?: { locale?: string } }) => loc.attributes?.locale)
      .filter((locale: string | undefined): locale is string => !!locale)
      .sort()

    return { success: true, data: locales }
  } catch (error) {
    return {
      success: false,
      error: `Error fetching app info localizations: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

// =============================================================================
// Push Functions (Write Operations)
// =============================================================================

interface VersionLocalizationData {
  description?: string
  keywords?: string
  promotionalText?: string
  whatsNew?: string
  supportUrl?: string
  marketingUrl?: string
}

interface AppInfoLocalizationData {
  name: string
  subtitle?: string
  privacyPolicyUrl?: string
}

/**
 * Update an existing version-level localization
 * PATCH /v1/appStoreVersionLocalizations/{localizationId}
 */
export async function updateVersionLocalization(
  credentials: ASCCredentials,
  localizationId: string,
  data: VersionLocalizationData
): Promise<ASCResult<void>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const payload = {
      data: {
        type: 'appStoreVersionLocalizations',
        id: localizationId,
        attributes: data,
      },
    }

    const response = await fetch(
      `${BASE_URL}/v1/appStoreVersionLocalizations/${localizationId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      const errorDetail = errorBody?.errors?.[0]?.detail || `Status ${response.status}`

      if (response.status === 401) {
        return { success: false, error: 'Invalid credentials' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Insufficient permissions' }
      }
      if (response.status === 404) {
        return { success: false, error: 'Localization not found' }
      }
      if (response.status === 409) {
        return { success: false, error: 'Version is not editable (may be in review or published)' }
      }
      if (response.status === 429) {
        return { success: false, error: 'Rate limited - please try again later' }
      }

      return { success: false, error: errorDetail }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: `Error updating localization: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Create a new version-level localization for a locale
 * POST /v1/appStoreVersionLocalizations
 */
export async function createVersionLocalization(
  credentials: ASCCredentials,
  versionId: string,
  locale: string,
  data: VersionLocalizationData
): Promise<ASCResult<string>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const payload = {
      data: {
        type: 'appStoreVersionLocalizations',
        attributes: {
          locale,
          ...data,
        },
        relationships: {
          appStoreVersion: {
            data: {
              type: 'appStoreVersions',
              id: versionId,
            },
          },
        },
      },
    }

    const response = await fetch(
      `${BASE_URL}/v1/appStoreVersionLocalizations`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      const errorDetail = errorBody?.errors?.[0]?.detail || `Status ${response.status}`

      if (response.status === 401) {
        return { success: false, error: 'Invalid credentials' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Insufficient permissions' }
      }
      if (response.status === 409) {
        return { success: false, error: 'Locale already exists or version not editable' }
      }
      if (response.status === 429) {
        return { success: false, error: 'Rate limited - please try again later' }
      }

      return { success: false, error: errorDetail }
    }

    const responseData = await response.json()
    return { success: true, data: responseData.data.id }
  } catch (error) {
    return {
      success: false,
      error: `Error creating localization: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Update an existing app-level localization
 * PATCH /v1/appInfoLocalizations/{localizationId}
 */
export async function updateAppInfoLocalization(
  credentials: ASCCredentials,
  localizationId: string,
  data: Partial<AppInfoLocalizationData>
): Promise<ASCResult<void>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const payload = {
      data: {
        type: 'appInfoLocalizations',
        id: localizationId,
        attributes: data,
      },
    }

    const response = await fetch(
      `${BASE_URL}/v1/appInfoLocalizations/${localizationId}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      const errorDetail = errorBody?.errors?.[0]?.detail || `Status ${response.status}`

      if (response.status === 401) {
        return { success: false, error: 'Invalid credentials' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Insufficient permissions' }
      }
      if (response.status === 404) {
        return { success: false, error: 'App info localization not found' }
      }
      if (response.status === 409) {
        return { success: false, error: 'App info is not editable' }
      }
      if (response.status === 429) {
        return { success: false, error: 'Rate limited - please try again later' }
      }

      return { success: false, error: errorDetail }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: `Error updating app info localization: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Create a new app-level localization for a locale
 * POST /v1/appInfoLocalizations
 */
export async function createAppInfoLocalization(
  credentials: ASCCredentials,
  appInfoId: string,
  locale: string,
  data: AppInfoLocalizationData
): Promise<ASCResult<string>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const payload = {
      data: {
        type: 'appInfoLocalizations',
        attributes: {
          locale,
          ...data,
        },
        relationships: {
          appInfo: {
            data: {
              type: 'appInfos',
              id: appInfoId,
            },
          },
        },
      },
    }

    const response = await fetch(
      `${BASE_URL}/v1/appInfoLocalizations`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}))
      const errorDetail = errorBody?.errors?.[0]?.detail || `Status ${response.status}`

      if (response.status === 401) {
        return { success: false, error: 'Invalid credentials' }
      }
      if (response.status === 403) {
        return { success: false, error: 'Insufficient permissions' }
      }
      if (response.status === 409) {
        return { success: false, error: 'Locale already exists' }
      }
      if (response.status === 429) {
        return { success: false, error: 'Rate limited - please try again later' }
      }

      return { success: false, error: errorDetail }
    }

    const responseData = await response.json()
    return { success: true, data: responseData.data.id }
  } catch (error) {
    return {
      success: false,
      error: `Error creating app info localization: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

interface VersionLocalizationInfo {
  id: string
  locale: string
}

/**
 * Get all version localization IDs for batch operations
 */
export async function getVersionLocalizationIds(
  credentials: ASCCredentials,
  versionId: string
): Promise<ASCResult<VersionLocalizationInfo[]>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(
      `${BASE_URL}/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale`,
      {
        headers,
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Version not found' }
      }
      return {
        success: false,
        error: `Failed to fetch version localizations: ${response.status}`,
      }
    }

    const data = await response.json()
    const localizations: VersionLocalizationInfo[] = (data.data || []).map(
      (loc: { id: string; attributes?: { locale?: string } }) => ({
        id: loc.id,
        locale: loc.attributes?.locale || '',
      })
    )

    return { success: true, data: localizations }
  } catch (error) {
    return {
      success: false,
      error: `Error fetching version localizations: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

interface AppInfoLocalizationInfo {
  id: string
  locale: string
}

/**
 * Get all app info localization IDs for batch operations
 */
export async function getAppInfoLocalizationIds(
  credentials: ASCCredentials,
  appInfoId: string
): Promise<ASCResult<AppInfoLocalizationInfo[]>> {
  try {
    const headers = await getAuthHeaders(
      credentials.keyId,
      credentials.issuerId,
      credentials.privateKey
    )

    const response = await fetch(
      `${BASE_URL}/v1/appInfos/${appInfoId}/appInfoLocalizations?fields[appInfoLocalizations]=locale`,
      {
        headers,
        signal: AbortSignal.timeout(15000),
      }
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'App info not found' }
      }
      return {
        success: false,
        error: `Failed to fetch app info localizations: ${response.status}`,
      }
    }

    const data = await response.json()
    const localizations: AppInfoLocalizationInfo[] = (data.data || []).map(
      (loc: { id: string; attributes?: { locale?: string } }) => ({
        id: loc.id,
        locale: loc.attributes?.locale || '',
      })
    )

    return { success: true, data: localizations }
  } catch (error) {
    return {
      success: false,
      error: `Error fetching app info localizations: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}
