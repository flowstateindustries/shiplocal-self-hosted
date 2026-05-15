import { NextRequest, NextResponse } from 'next/server'
import { getASCCredentials, hasASCCredentials } from '@/lib/appstore/credentials'
import {
  getEditableVersion,
  getVersionLocalizations,
  getAppInfoLocalization,
} from '@/lib/appstore/api'
import { APP_STORE_LOCALES, getLocaleName } from '@/lib/localization/constants'
import { validationError, notFoundResponse, errorResponse } from '@/lib/api/responses'
import type { LocalizationConfig, LocaleChoice } from '@/lib/localization/types'
import { getSelectedAppByAppId } from '@/lib/db/queries'

/**
 * GET /api/localization/[appId]/config
 * Fetch localization configuration for an app.
 * - ASC Mode: Pulls from App Store Connect when credentials are present.
 * - Manual Mode: Pulls source content from iTunes for URL-added apps.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  try {
    const { appId } = await params

    if (!/^\d+$/.test(appId)) {
      return validationError('Invalid app ID format')
    }

    const selectedApp = getSelectedAppByAppId(appId)
    if (!selectedApp) return notFoundResponse('App')

    if (hasASCCredentials()) {
      return await handleASCMode(appId, selectedApp)
    }
    return await handleManualMode(appId, selectedApp)
  } catch (error) {
    console.error('Localization config error:', error)
    return errorResponse('Failed to fetch localization config', 500)
  }
}

async function handleASCMode(
  appId: string,
  selectedApp: { app_name: string; app_icon_url: string | null }
): Promise<NextResponse> {
  const credentials = getASCCredentials()
  if (!credentials) {
    return errorResponse('Could not retrieve App Store credentials', 500)
  }

  const versionResult = await getEditableVersion(credentials, appId)
  if (!versionResult.success || !versionResult.data) {
    return validationError(versionResult.error || 'No editable version found')
  }
  const version = versionResult.data

  const localizationsResult = await getVersionLocalizations(credentials, version.id)
  if (!localizationsResult.success || !localizationsResult.data) {
    return errorResponse(localizationsResult.error || 'Failed to fetch localizations', 500)
  }
  const localizations = localizationsResult.data

  const sourceChoices = localizations.map((loc) => ({
    code: loc.locale,
    name: getLocaleName(loc.locale),
  }))

  const defaultSource =
    localizations.find((l) => l.locale === 'en-US')?.locale ||
    localizations[0]?.locale ||
    'en-US'

  const sourceLocalization = localizations.find((l) => l.locale === defaultSource)
  const sourceContent = {
    description: sourceLocalization?.description || '',
    keywords: sourceLocalization?.keywords || '',
    promotionalText: sourceLocalization?.promotionalText || '',
    whatsNew: sourceLocalization?.whatsNew || '',
    supportUrl: sourceLocalization?.supportUrl || '',
    marketingUrl: sourceLocalization?.marketingUrl || '',
  }

  let sourceAppInfo: { name?: string; subtitle?: string } | null = null
  const appInfoResult = await getAppInfoLocalization(credentials, appId, defaultSource)
  if (appInfoResult.success && appInfoResult.data) {
    const { name, subtitle } = appInfoResult.data
    if (name || subtitle) sourceAppInfo = { name, subtitle }
  }
  if (!sourceAppInfo) {
    sourceAppInfo = { name: selectedApp.app_name, subtitle: undefined }
  }

  const activeLocales = new Set(localizations.map((l) => l.locale))
  const localeChoices: LocaleChoice[] = Object.entries(APP_STORE_LOCALES).map(
    ([code, name]) => ({ code, name, isActive: activeLocales.has(code) })
  )

  const config: LocalizationConfig = {
    app: { id: appId, name: selectedApp.app_name, iconUrl: selectedApp.app_icon_url },
    version: {
      id: version.id,
      versionString: version.versionString,
      appStoreState: version.appStoreState,
    },
    sourceContent,
    sourceAppInfo,
    defaultSource,
    localeChoices,
    sourceChoices,
    isManualMode: false,
  }

  return NextResponse.json(config)
}

async function handleManualMode(
  appId: string,
  selectedApp: { app_name: string; app_icon_url: string | null }
): Promise<NextResponse> {
  let sourceContent = {
    description: '',
    keywords: '',
    promotionalText: '',
    whatsNew: '',
    supportUrl: '',
    marketingUrl: '',
  }

  try {
    const response = await fetch(
      `https://itunes.apple.com/lookup?id=${appId}&country=us`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (response.ok) {
      const data = await response.json()
      if (data.resultCount > 0) {
        const result = data.results[0]
        sourceContent = {
          description: result.description || '',
          keywords: '',
          promotionalText: '',
          whatsNew: result.releaseNotes || '',
          supportUrl: '',
          marketingUrl: '',
        }
      }
    }
  } catch (error) {
    console.error('iTunes API error:', error)
  }

  const defaultSource = 'en-US'
  const localeChoices: LocaleChoice[] = Object.entries(APP_STORE_LOCALES).map(
    ([code, name]) => ({ code, name, isActive: code === defaultSource })
  )

  const config: LocalizationConfig = {
    app: { id: appId, name: selectedApp.app_name, iconUrl: selectedApp.app_icon_url },
    version: { id: 'manual', versionString: 'Manual Mode', appStoreState: 'MANUAL' },
    sourceContent,
    sourceAppInfo: { name: selectedApp.app_name, subtitle: undefined },
    defaultSource,
    localeChoices,
    sourceChoices: [{ code: defaultSource, name: getLocaleName(defaultSource) }],
    isManualMode: true,
  }

  return NextResponse.json(config)
}
