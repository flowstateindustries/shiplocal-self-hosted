"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { APP_STORE_LOCALES, FIELD_LIMITS, LOCALIZABLE_FIELDS } from "@/lib/localization/constants"
import type { LocalizationJob, LocaleResult, LocalizationResults } from "@/lib/database/types"
import type { SourceContent, JobConfig } from "@/lib/localization/types"
import {
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  Loader2,
} from "lucide-react"

interface EditableResults {
  [locale: string]: LocaleResult
}

export default function PreviewPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const appId = params.appId as string
  const jobId = searchParams.get('jobId')

  const [job, setJob] = useState<LocalizationJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editedResults, setEditedResults] = useState<EditableResults>({})
  const [expandedLocales, setExpandedLocales] = useState<Set<string>>(new Set())
  const [sourceConfig, setSourceConfig] = useState<JobConfig | null>(null)
  const [sourceExpanded, setSourceExpanded] = useState(true)
  const [hasASCCredentials, setHasASCCredentials] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isManualMode, setIsManualMode] = useState(false)

  // Fetch job details
  // ASC status is determined from the job's selected_app, not a separate config call
  useEffect(() => {
    if (!jobId) {
      toast.error('No job ID provided')
      router.push(`/localization/${appId}`)
      return
    }

    async function fetchData() {
      try {
        setIsLoading(true)

        // Fetch job details only - config is stored in job.results._config
        const jobResponse = await fetch(`/api/localization-jobs/${jobId}`)
        const jobData = await jobResponse.json()

        if (!jobResponse.ok || !jobData.job) {
          setError('Job not found')
          return
        }

        setJob(jobData.job)

        // Initialize edited results from job results
        const results = jobData.job.results as LocalizationResults | null

        // Extract source config (stored during job creation)
        if (results?._config) {
          setSourceConfig(results._config)
        }

        try {
          const selectedAppResponse = await fetch(`/api/selected-apps/${appId}`)
          if (selectedAppResponse.ok) {
            const selectedAppData = await selectedAppResponse.json()
            setHasASCCredentials(selectedAppData.ascConnected === true)
            setIsManualMode(!selectedAppData.ascConnected)
          } else {
            // Fallback to assuming manual mode if we can't fetch app data
            setHasASCCredentials(false)
            setIsManualMode(true)
          }
        } catch {
          // On error, default to manual mode (safer)
          setHasASCCredentials(false)
          setIsManualMode(true)
        }

        if (results?.locales) {
          const initialEdited: EditableResults = {}
          for (const locale of results.locales) {
            initialEdited[locale.locale] = { ...locale }
          }
          setEditedResults(initialEdited)
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load job')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [jobId, appId, router])

  // Refetch ASC status when page becomes visible (user returns from settings)
  useEffect(() => {
    let abortController: AbortController | null = null

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && job && !isLoading) {
        // Cancel any in-flight request
        if (abortController) {
          abortController.abort()
        }
        abortController = new AbortController()

        try {
          const selectedAppResponse = await fetch(`/api/selected-apps/${appId}`, {
            signal: abortController.signal
          })
          if (selectedAppResponse.ok) {
            const selectedAppData = await selectedAppResponse.json()
            setHasASCCredentials(selectedAppData.ascConnected === true)
            setIsManualMode(!selectedAppData.ascConnected)
          }
        } catch (error) {
          if (error instanceof Error && error.name !== 'AbortError') {
            console.error('Error refetching ASC status:', error)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (abortController) {
        abortController.abort()
      }
    }
  }, [appId, job, isLoading])

  // Toggle locale expansion
  const toggleLocale = useCallback((locale: string) => {
    setExpandedLocales(prev => {
      const next = new Set(prev)
      if (next.has(locale)) {
        next.delete(locale)
      } else {
        next.add(locale)
      }
      return next
    })
  }, [])

  // Expand all locales
  const expandAll = useCallback(() => {
    setExpandedLocales(new Set(Object.keys(editedResults)))
  }, [editedResults])

  // Collapse all locales
  const collapseAll = useCallback(() => {
    setExpandedLocales(new Set())
  }, [])

  // Update field value
  const updateField = useCallback((locale: string, field: keyof LocaleResult, value: string) => {
    setEditedResults(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        [field]: value,
      },
    }))
  }, [])

  // Copy field value to clipboard
  const copyToClipboard = useCallback(async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${fieldName} copied to clipboard`)
    } catch {
      toast.error('Failed to copy to clipboard')
    }
  }, [])

  // Handle push to App Store Connect
  const handlePush = useCallback(async () => {
    if (!jobId || !hasASCCredentials || isManualMode) return

    setIsPushing(true)

    try {
      // Save edited results first
      const locales = Object.values(editedResults)
      const saveResponse = await fetch(`/api/localization-jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locales }),
      })

      if (!saveResponse.ok) {
        toast.error('Failed to save edited results')
        setIsPushing(false)
        return
      }

      // Navigate to pushing page
      router.push(`/localization/${appId}/pushing?jobId=${jobId}`)
    } catch (err) {
      console.error('Error starting push:', err)
      toast.error('Failed to start push')
      setIsPushing(false)
    }
  }, [jobId, hasASCCredentials, isManualMode, editedResults, appId, router])

  // Determine push button state and tooltip
  const getPushButtonState = useCallback(() => {
    if (isManualMode) {
      return {
        disabled: true,
        tooltip: 'This app was added manually. Connect App Store Connect in Settings to push directly.',
      }
    }
    if (!hasASCCredentials) {
      return {
        disabled: true,
        tooltip: 'Connect App Store Connect in Settings to push localizations.',
      }
    }
    if (job?.pushed_to_asc) {
      return { hidden: true }
    }
    return {
      disabled: false,
      tooltip: null,
      label: 'Push to App Store Connect',
    }
  }, [isManualMode, hasASCCredentials, job?.pushed_to_asc])

  const pushButtonState = getPushButtonState()

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[var(--color-surface-tertiary)] rounded" />
          <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded" />
          <div className="h-64 bg-[var(--color-surface-tertiary)] rounded-xl" />
        </div>
      </div>
    )
  }

  // Error state
  if (error || !job) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-medium text-red-500">Error Loading Results</h3>
              <p className="text-sm text-[var(--color-content-secondary)] mt-1">
                {error || 'Job not found'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => router.push(`/localization/${appId}`)}
              >
                Back to Configuration
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const localeResults = Object.values(editedResults)
  const hasAppInfoFields = job.fields_localized?.includes('appName')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-content)]">
            Preview Localizations
          </h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-1">
            {job.app_name} • {localeResults.length} locales generated
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Source Content Section */}
      {sourceConfig && (
        <SourceContentSection
          sourceConfig={sourceConfig}
          sourceLocale={job.source_locale}
          fieldsLocalized={job.fields_localized || []}
          isExpanded={sourceExpanded}
          onToggle={() => setSourceExpanded(!sourceExpanded)}
        />
      )}

      {/* Locale cards */}
      <div className="space-y-4">
        {localeResults.map((localeResult) => (
          <LocaleCard
            key={localeResult.locale}
            localeResult={localeResult}
            isExpanded={expandedLocales.has(localeResult.locale)}
            onToggle={() => toggleLocale(localeResult.locale)}
            onUpdateField={(field, value) => updateField(localeResult.locale, field, value)}
            onCopy={copyToClipboard}
            fieldsLocalized={job.fields_localized || []}
            hasAppInfoFields={hasAppInfoFields}
          />
        ))}
      </div>

      {/* Push button */}
      {!pushButtonState.hidden && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button
                  onClick={handlePush}
                  disabled={pushButtonState.disabled || isPushing}
                  className="w-full h-12"
                >
                  {isPushing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {pushButtonState.label || 'Push to App Store Connect'}
                    </>
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            {pushButtonState.tooltip && (
              <TooltipContent side="top" className="max-w-xs">
                <p>{pushButtonState.tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}

// Locale card component
interface LocaleCardProps {
  localeResult: LocaleResult
  isExpanded: boolean
  onToggle: () => void
  onUpdateField: (field: keyof LocaleResult, value: string) => void
  onCopy: (text: string, fieldName: string) => void
  fieldsLocalized: string[]
  hasAppInfoFields: boolean
}

function LocaleCard({
  localeResult,
  isExpanded,
  onToggle,
  onUpdateField,
  onCopy,
  fieldsLocalized,
  hasAppInfoFields,
}: LocaleCardProps) {
  const localeName = APP_STORE_LOCALES[localeResult.locale] || localeResult.locale

  // Check if any fields have data
  const hasData = localeResult.description ||
    localeResult.keywords ||
    localeResult.promotionalText ||
    localeResult.whatsNew ||
    localeResult.name ||
    localeResult.subtitle

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors">
          <div className="flex items-center gap-3">
            {hasData ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500" />
            )}
            <span className="font-medium text-[var(--color-content)]">
              {localeName}
            </span>
            <span className="text-sm text-[var(--color-content-muted)]">
              ({localeResult.locale})
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-content-secondary)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-content-secondary)]" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            {/* App-level fields */}
            {hasAppInfoFields && (
              <div className="space-y-4 pb-4 border-b border-[var(--color-border)]">
                <h4 className="text-sm font-medium text-[var(--color-content-secondary)]">
                  App Info
                </h4>
                <EditableField
                  label="App Name"
                  value={localeResult.name || ''}
                  limit={FIELD_LIMITS.name}
                  onChange={(value) => onUpdateField('name', value)}
                  onCopy={(text) => onCopy(text, 'App Name')}
                  fieldCode="name"
                />
                <EditableField
                  label="Subtitle"
                  value={localeResult.subtitle || ''}
                  limit={FIELD_LIMITS.subtitle}
                  onChange={(value) => onUpdateField('subtitle', value)}
                  onCopy={(text) => onCopy(text, 'Subtitle')}
                  fieldCode="subtitle"
                />
              </div>
            )}

            {/* Version-level fields */}
            {LOCALIZABLE_FIELDS.map(({ code, name }) => {
              // Skip if this field wasn't localized
              if (!fieldsLocalized.includes(code)) return null

              const value = localeResult[code as keyof LocaleResult] as string | undefined
              const limit = FIELD_LIMITS[code]

              return (
                <EditableField
                  key={code}
                  label={name}
                  value={value || ''}
                  limit={limit}
                  onChange={(newValue) => onUpdateField(code as keyof LocaleResult, newValue)}
                  onCopy={(text) => onCopy(text, name)}
                  fieldCode={code}
                />
              )
            })}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// Editable field component
interface EditableFieldProps {
  label: string
  value: string
  limit: number
  onChange: (value: string) => void
  onCopy: (text: string) => void
  fieldCode?: string
}

// Get appropriate row count based on field type (matches config page)
function getRowCount(code?: string): number {
  if (code === 'keywords') return 1
  if (code === 'promotionalText') return 3
  if (code === 'name' || code === 'subtitle') return 1
  return 8
}

function EditableField({
  label,
  value,
  limit,
  onChange,
  onCopy,
  fieldCode,
}: EditableFieldProps) {
  const charCount = value.length
  const isOverLimit = charCount > limit
  const rows = getRowCount(fieldCode)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--color-content)]">
          {label}
        </label>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${
            isOverLimit ? 'text-red-500 font-medium' : 'text-[var(--color-content-secondary)]'
          }`}>
            {charCount} / {limit}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onCopy(value)}
            disabled={!value}
          >
            <Copy className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`w-full p-3 rounded-lg border ${
          isOverLimit
            ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
            : 'border-[var(--color-border)] focus:border-[var(--color-content)] focus:ring-[var(--color-content)]/20'
        } bg-[var(--color-surface-tertiary)] text-[var(--color-content)] text-sm resize-none focus:outline-none focus:ring-2`}
      />

      {isOverLimit && (
        <p className="text-xs text-red-500">
          {charCount - limit} characters over limit
        </p>
      )}
    </div>
  )
}

// Source Content Section - collapsible section showing original source content
interface SourceContentSectionProps {
  sourceConfig: JobConfig
  sourceLocale: string
  fieldsLocalized: string[]
  isExpanded: boolean
  onToggle: () => void
}

function SourceContentSection({
  sourceConfig,
  sourceLocale,
  fieldsLocalized,
  isExpanded,
  onToggle,
}: SourceContentSectionProps) {
  const localeName = APP_STORE_LOCALES[sourceLocale] || sourceLocale
  const {
    sourceContent,
    sourceAppInfo,
    translateAppName,
    privacyUrlReplacement,
    privacyUrlAllLocales,
    privacyUrlQueryEnabled,
    privacyUrlQueryPattern,
    supportUrlReplacement,
    supportUrlAllLocales,
    supportUrlQueryEnabled,
    supportUrlQueryPattern,
    marketingUrlReplacement,
    marketingUrlAllLocales,
    marketingUrlQueryEnabled,
    marketingUrlQueryPattern,
  } = sourceConfig

  const hasUrlSettings = privacyUrlReplacement || supportUrlReplacement || marketingUrlReplacement

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] overflow-hidden">
        <CollapsibleTrigger className="w-full p-4 flex items-center justify-between hover:bg-[var(--color-surface-hover)] transition-colors">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-[var(--color-content-secondary)]" />
            <span className="font-medium text-[var(--color-content)]">
              Source Content
            </span>
            <span className="text-sm text-[var(--color-content-muted)]">
              ({localeName})
            </span>
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-[var(--color-content-secondary)]" />
          ) : (
            <ChevronDown className="w-5 h-5 text-[var(--color-content-secondary)]" />
          )}
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            {/* App-level fields */}
            {translateAppName && sourceAppInfo && (
              <div className="space-y-4 pb-4 border-b border-[var(--color-border)]">
                <h4 className="text-sm font-medium text-[var(--color-content-secondary)]">
                  App Info
                </h4>
                {sourceAppInfo.name && (
                  <ReadOnlyField
                    label="App Name"
                    value={sourceAppInfo.name}
                    limit={FIELD_LIMITS.name}
                  />
                )}
                {sourceAppInfo.subtitle && (
                  <ReadOnlyField
                    label="Subtitle"
                    value={sourceAppInfo.subtitle}
                    limit={FIELD_LIMITS.subtitle}
                  />
                )}
              </div>
            )}

            {/* Version-level fields */}
            {LOCALIZABLE_FIELDS.map(({ code, name }) => {
              // Skip if this field wasn't localized
              if (!fieldsLocalized.includes(code)) return null

              const value = sourceContent[code as keyof SourceContent] || ''
              const limit = FIELD_LIMITS[code]

              // Skip empty fields
              if (!value) return null

              return (
                <ReadOnlyField
                  key={code}
                  label={name}
                  value={value}
                  limit={limit}
                />
              )
            })}

            {/* URL Settings */}
            {hasUrlSettings && (
              <div className="space-y-4 pt-4 border-t border-[var(--color-border)]">
                <h4 className="text-sm font-medium text-[var(--color-content-secondary)]">
                  URL Settings
                </h4>

                {privacyUrlReplacement && (
                  <UrlField
                    label="Privacy Policy URL"
                    url={privacyUrlReplacement}
                    allLocales={privacyUrlAllLocales}
                    queryEnabled={privacyUrlQueryEnabled}
                    queryPattern={privacyUrlQueryPattern}
                  />
                )}

                {supportUrlReplacement && (
                  <UrlField
                    label="Support URL"
                    url={supportUrlReplacement}
                    allLocales={supportUrlAllLocales}
                    queryEnabled={supportUrlQueryEnabled}
                    queryPattern={supportUrlQueryPattern}
                  />
                )}

                {marketingUrlReplacement && (
                  <UrlField
                    label="Marketing URL"
                    url={marketingUrlReplacement}
                    allLocales={marketingUrlAllLocales}
                    queryEnabled={marketingUrlQueryEnabled}
                    queryPattern={marketingUrlQueryPattern}
                  />
                )}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

// Read-only field component with auto-sizing textarea
interface ReadOnlyFieldProps {
  label: string
  value: string
  limit: number
}

function ReadOnlyField({ label, value, limit }: ReadOnlyFieldProps) {
  // Calculate rows to fit content (approx 70 chars per row for the textarea width)
  const lineBreaks = (value.match(/\n/g) || []).length
  const estimatedRows = Math.ceil(value.length / 70)
  const rows = Math.max(1, Math.min(lineBreaks + estimatedRows, 12))

  const charCount = value.length
  const isOverLimit = charCount > limit

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-[var(--color-content)]">
          {label}
        </label>
        <span className={`text-xs ${
          isOverLimit ? 'text-red-500 font-medium' : 'text-[var(--color-content-secondary)]'
        }`}>
          {charCount} / {limit}
        </span>
      </div>

      <textarea
        value={value}
        readOnly
        rows={rows}
        className="w-full p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] text-[var(--color-content)] text-sm resize-none cursor-default opacity-75"
      />
    </div>
  )
}

// URL field component for displaying URL configuration
interface UrlFieldProps {
  label: string
  url: string
  allLocales: boolean
  queryEnabled: boolean
  queryPattern: string | null
}

function UrlField({ label, url, allLocales, queryEnabled, queryPattern }: UrlFieldProps) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-[var(--color-content)]">
        {label}
      </label>
      <div className="p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)]">
        <p className="text-sm text-[var(--color-content)] font-mono break-all">
          {url}
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {allLocales && (
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-content-secondary)]">
              All locales
            </span>
          )}
          {queryEnabled && queryPattern && (
            <span className="text-xs px-2 py-0.5 rounded bg-[var(--color-surface)] text-[var(--color-content-secondary)] font-mono">
              {queryPattern}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
