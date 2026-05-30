import { NextRequest, NextResponse } from 'next/server'
import { getASCCredentials, hasASCCredentials } from '@/lib/appstore/credentials'
import {
  getAppVersions,
  getVersionLocalizations,
  getReleasedAppInfoId,
  getAppInfoLocalizationsData,
} from '@/lib/appstore/api'
import { EDITABLE_STATES } from '@/lib/appstore/types'
import { insertCopyJob } from '@/lib/db/queries'
import { validationError, errorResponse } from '@/lib/api/responses'
import type { CopyLocaleResult, CopyResults } from '@/lib/database/types'

const VERSION_FIELDS = new Set([
  'description',
  'keywords',
  'promotionalText',
  'whatsNew',
])
const APP_INFO_FIELDS = new Set(['name', 'subtitle'])

/**
 * POST /api/copy-jobs
 * Fetches source version localizations and creates a copy job ready for preview.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { appId, appName, appIconUrl, fieldsToCopy } = body

    if (!appId || typeof appId !== 'string') {
      return validationError('appId is required')
    }
    if (!appName || typeof appName !== 'string') {
      return validationError('appName is required')
    }
    if (
      !Array.isArray(fieldsToCopy) ||
      fieldsToCopy.length === 0 ||
      fieldsToCopy.some((f) => typeof f !== 'string')
    ) {
      return validationError('fieldsToCopy must be a non-empty array of strings')
    }

    if (!hasASCCredentials()) {
      return errorResponse('App Store Connect credentials are required', 400)
    }
    const credentials = getASCCredentials()
    if (!credentials) {
      return errorResponse('Could not retrieve App Store credentials', 500)
    }

    // Identify source (previous) and target (editable) versions
    const versionsResult = await getAppVersions(credentials, appId)
    if (!versionsResult.success || !versionsResult.data) {
      return errorResponse(versionsResult.error || 'Failed to fetch versions', 500)
    }

    const versions = versionsResult.data
    const targetVersion = versions.find((v) =>
      EDITABLE_STATES.includes(v.appStoreState as (typeof EDITABLE_STATES)[number])
    )
    const sourceVersion = versions.find(
      (v) => !EDITABLE_STATES.includes(v.appStoreState as (typeof EDITABLE_STATES)[number])
    )

    if (!targetVersion) {
      return NextResponse.json(
        {
          error:
            'No editable version found. Create a new version in App Store Connect first.',
        },
        { status: 400 }
      )
    }
    if (!sourceVersion) {
      return NextResponse.json(
        {
          error:
            'No previous version found. This app has only one version.',
        },
        { status: 400 }
      )
    }

    // Build per-locale results
    const localeMap = new Map<string, CopyLocaleResult>()

    const wantsVersionFields = fieldsToCopy.some((f) => VERSION_FIELDS.has(f))
    const wantsAppInfoFields = fieldsToCopy.some((f) => APP_INFO_FIELDS.has(f))

    // Fetch version-level fields from source version
    if (wantsVersionFields) {
      const locsResult = await getVersionLocalizations(credentials, sourceVersion.id)
      if (locsResult.success && locsResult.data) {
        for (const loc of locsResult.data) {
          const entry: CopyLocaleResult = { locale: loc.locale }
          if (fieldsToCopy.includes('description') && loc.description)
            entry.description = loc.description
          if (fieldsToCopy.includes('keywords') && loc.keywords)
            entry.keywords = loc.keywords
          if (fieldsToCopy.includes('promotionalText') && loc.promotionalText)
            entry.promotionalText = loc.promotionalText
          if (fieldsToCopy.includes('whatsNew') && loc.whatsNew)
            entry.whatsNew = loc.whatsNew
          localeMap.set(loc.locale, entry)
        }
      }
    }

    // Fetch app-level fields (name, subtitle) from released app info
    if (wantsAppInfoFields) {
      const releasedInfoIdResult = await getReleasedAppInfoId(credentials, appId)
      if (releasedInfoIdResult.success && releasedInfoIdResult.data) {
        const appInfoLocsResult = await getAppInfoLocalizationsData(
          credentials,
          releasedInfoIdResult.data
        )
        if (appInfoLocsResult.success && appInfoLocsResult.data) {
          for (const loc of appInfoLocsResult.data) {
            const existing = localeMap.get(loc.locale) ?? { locale: loc.locale }
            if (fieldsToCopy.includes('name') && loc.name)
              existing.name = loc.name
            if (fieldsToCopy.includes('subtitle') && loc.subtitle)
              existing.subtitle = loc.subtitle
            localeMap.set(loc.locale, existing)
          }
        }
      }
    }

    // Filter out empty entries (locales with no data for selected fields)
    const locales: CopyLocaleResult[] = [...localeMap.values()].filter(
      (entry) =>
        entry.description ||
        entry.keywords ||
        entry.promotionalText ||
        entry.whatsNew ||
        entry.name ||
        entry.subtitle
    )

    if (locales.length === 0) {
      return NextResponse.json(
        { error: 'No data found for the selected fields in the previous version.' },
        { status: 400 }
      )
    }

    const results: CopyResults = { locales }
    const job = insertCopyJob({
      app_id: appId,
      app_name: appName,
      app_icon_url: appIconUrl ?? null,
      source_version_id: sourceVersion.id,
      source_version_string: sourceVersion.versionString,
      target_version_id: targetVersion.id,
      target_version_string: targetVersion.versionString,
      fields_to_copy: fieldsToCopy,
      status: 'completed',
      results,
      completed_at: new Date().toISOString(),
    })

    return NextResponse.json({ jobId: job.id }, { status: 201 })
  } catch (error) {
    console.error('Copy job create error:', error)
    return errorResponse('Failed to create copy job', 500)
  }
}
