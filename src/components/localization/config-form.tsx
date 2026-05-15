"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfigHeader } from "./config-header"
import { LocaleSelect } from "./locale-select"
import { TargetLocalesGrid } from "./target-locales-grid"
import { FieldsCheckboxes } from "./fields-checkboxes"
import { AppInfoOptions } from "./app-info-options"
import { UrlOptions } from "./url-options"
import { SourcePreview } from "./source-preview"
import type { LocalizationConfig, LocalizationFormState, SourceContent } from "@/lib/localization/types"

interface ConfigFormProps {
  appId: string
}

export function ConfigForm({ appId }: ConfigFormProps) {
  const router = useRouter()
  const [config, setConfig] = useState<LocalizationConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [formState, setFormState] = useState<LocalizationFormState>({
    sourceLocale: '',
    targetLocales: [],
    fields: [],
    translateAppName: false,
    brandName: '',
    urlReplacements: [],
    privacyUrlReplacement: '',
    privacyUrlAllLocales: true,
    privacyUrlQueryEnabled: false,
    privacyUrlQueryPattern: '',
    supportUrlReplacement: '',
    supportUrlAllLocales: true,
    supportUrlQueryEnabled: false,
    supportUrlQueryPattern: '',
    marketingUrlReplacement: '',
    marketingUrlAllLocales: true,
    marketingUrlQueryEnabled: false,
    marketingUrlQueryPattern: '',
  })

  // Editable source content
  const [sourceContent, setSourceContent] = useState<SourceContent>({
    description: '',
    keywords: '',
    promotionalText: '',
    whatsNew: '',
  })

  // Fetch config on mount
  useEffect(() => {
    const abortController = new AbortController()

    async function fetchConfig() {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/localization/${appId}/config`, {
          signal: abortController.signal
        })
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to fetch configuration')
          return
        }

        setConfig(data)

        // Initialize form state with defaults
        setFormState({
          sourceLocale: data.defaultSource,
          targetLocales: [],
          fields: [],
          translateAppName: false,
          brandName: '',
          urlReplacements: [],
          privacyUrlReplacement: '',
          privacyUrlAllLocales: true,
          privacyUrlQueryEnabled: false,
          privacyUrlQueryPattern: '',
          supportUrlReplacement: '',
          supportUrlAllLocales: true,
          supportUrlQueryEnabled: false,
          supportUrlQueryPattern: '',
          marketingUrlReplacement: '',
          marketingUrlAllLocales: true,
          marketingUrlQueryEnabled: false,
          marketingUrlQueryPattern: '',
        })

        // Initialize editable source content
        setSourceContent(data.sourceContent)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        console.error('Config fetch error:', err)
        setError('Failed to load configuration')
      } finally {
        setIsLoading(false)
      }
    }

    fetchConfig()

    return () => abortController.abort()
  }, [appId])

  // Refetch config when page becomes visible (user returns from settings)
  useEffect(() => {
    let abortController: AbortController | null = null

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && config && !isLoading) {
        // Abort any in-flight requests before starting new ones
        if (abortController) abortController.abort()
        abortController = new AbortController()

        try {
          // Refetch config
          const configResponse = await fetch(`/api/localization/${appId}/config`, {
            signal: abortController.signal
          })
          if (configResponse.ok) {
            const data = await configResponse.json()
            setConfig(data)
            // Update source content if it changed
            if (data.sourceContent) {
              setSourceContent(data.sourceContent)
            }
          }
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return
          }
          console.error('Error refetching data:', error)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (abortController) abortController.abort()
    }
  }, [appId, config, isLoading])

  // Update source content when source locale changes
  const handleSourceLocaleChange = useCallback((locale: string) => {
    setFormState(prev => ({
      ...prev,
      sourceLocale: locale,
      // Remove source locale from targets if selected
      targetLocales: prev.targetLocales.filter(l => l !== locale),
    }))
  }, [])

  // Handle source content edits
  const handleSourceContentChange = useCallback((field: string, value: string) => {
    setSourceContent(prev => ({
      ...prev,
      [field]: value,
    }))
  }, [])


  // Check if form is valid
  const isFormValid = useCallback((): boolean => {
    return (
      formState.sourceLocale !== '' &&
      formState.targetLocales.length > 0 &&
      (formState.fields.length > 0 || formState.translateAppName)
    )
  }, [formState.sourceLocale, formState.targetLocales.length, formState.fields.length, formState.translateAppName])

  // Handle generate button click
  const handleGenerate = async () => {
    if (!isFormValid() || !config) {
      toast.error('Please select at least one target language and one field')
      return
    }

    setIsGenerating(true)

    try {
      // Create the job
      const response = await fetch('/api/localization-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          appName: config.app.name,
          appIconUrl: config.app.iconUrl,
          sourceLocale: formState.sourceLocale,
          targetLocales: formState.targetLocales,
          fields: formState.fields,
          sourceContent,
          translateAppName: formState.translateAppName,
          sourceAppInfo: config.sourceAppInfo,
          brandName: formState.brandName || undefined,
          // URL replacement options
          urlReplacements: formState.urlReplacements.length > 0 ? formState.urlReplacements : undefined,
          privacyUrlReplacement: formState.privacyUrlReplacement || undefined,
          privacyUrlAllLocales: formState.privacyUrlReplacement ? formState.privacyUrlAllLocales : undefined,
          privacyUrlQueryEnabled: formState.privacyUrlReplacement ? formState.privacyUrlQueryEnabled : undefined,
          privacyUrlQueryPattern: formState.privacyUrlQueryEnabled && formState.privacyUrlQueryPattern ? formState.privacyUrlQueryPattern : undefined,
          supportUrlReplacement: formState.supportUrlReplacement || undefined,
          supportUrlAllLocales: formState.supportUrlReplacement ? formState.supportUrlAllLocales : undefined,
          supportUrlQueryEnabled: formState.supportUrlReplacement ? formState.supportUrlQueryEnabled : undefined,
          supportUrlQueryPattern: formState.supportUrlQueryEnabled && formState.supportUrlQueryPattern ? formState.supportUrlQueryPattern : undefined,
          marketingUrlReplacement: formState.marketingUrlReplacement || undefined,
          marketingUrlAllLocales: formState.marketingUrlReplacement ? formState.marketingUrlAllLocales : undefined,
          marketingUrlQueryEnabled: formState.marketingUrlReplacement ? formState.marketingUrlQueryEnabled : undefined,
          marketingUrlQueryPattern: formState.marketingUrlQueryEnabled && formState.marketingUrlQueryPattern ? formState.marketingUrlQueryPattern : undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check for specific lock error (409 = app claimed by another user)
        if (response.status === 409 && data.error?.includes('registered to another account')) {
          toast.error('This app has been claimed by another user and cannot be localized.')
          setIsGenerating(false)
          return
        }

        throw new Error(data.error || 'Failed to create job')
      }

      // Redirect to generating page
      toast.success('Starting localization...')
      router.push(`/localization/${appId}/generating?jobId=${data.jobId}`)
    } catch (err) {
      console.error('Error creating job:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to start generation')
      setIsGenerating(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
          <Skeleton className="h-5 w-40" />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="10" strokeWidth={1.5} />
            <path strokeLinecap="round" strokeWidth={1.5} d="M12 8v4m0 4h.01" />
          </svg>
          <div>
            <h3 className="font-medium text-red-500">Error Loading Configuration</h3>
            <p className="text-sm text-[var(--color-content-secondary)] mt-1">
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => router.push('/apps')}
            >
              Back to Apps
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-content)]">
            Localize App
          </h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-1">
            Configure your localization settings
          </p>
        </div>
      </div>

      {/* App header */}
      <ConfigHeader
        appName={config.app.name}
        iconUrl={config.app.iconUrl}
        versionString={config.version.versionString}
        appStoreState={config.version.appStoreState}
        isManualMode={config.isManualMode}
      />

      {/* Source locale selector */}
      <LocaleSelect
        value={formState.sourceLocale}
        onChange={handleSourceLocaleChange}
        options={config.sourceChoices}
      />

      {/* Target locales grid */}
      <TargetLocalesGrid
        localeChoices={config.localeChoices}
        selectedLocales={formState.targetLocales}
        sourceLocale={formState.sourceLocale}
        onChange={(locales) => setFormState(prev => ({ ...prev, targetLocales: locales }))}
      />

      {/* Fields checkboxes */}
      <FieldsCheckboxes
        selectedFields={formState.fields}
        onChange={(fields) => setFormState(prev => ({ ...prev, fields }))}
      />

      {/* App info options */}
      <AppInfoOptions
        translateAppName={formState.translateAppName}
        brandName={formState.brandName}
        onToggleTranslate={(enabled) => setFormState(prev => ({ ...prev, translateAppName: enabled }))}
        onBrandNameChange={(name) => setFormState(prev => ({ ...prev, brandName: name }))}
      />

      {/* URL options */}
      <UrlOptions
        privacyUrlReplacement={formState.privacyUrlReplacement}
        privacyUrlAllLocales={formState.privacyUrlAllLocales}
        privacyUrlQueryEnabled={formState.privacyUrlQueryEnabled}
        privacyUrlQueryPattern={formState.privacyUrlQueryPattern}
        onPrivacyUrlChange={(url) => setFormState(prev => ({ ...prev, privacyUrlReplacement: url }))}
        onPrivacyUrlAllLocalesChange={(enabled) => setFormState(prev => ({ ...prev, privacyUrlAllLocales: enabled }))}
        onPrivacyUrlQueryEnabledChange={(enabled) => setFormState(prev => ({ ...prev, privacyUrlQueryEnabled: enabled }))}
        onPrivacyUrlQueryPatternChange={(pattern) => setFormState(prev => ({ ...prev, privacyUrlQueryPattern: pattern }))}
        existingPrivacyUrl={config.sourceAppInfo?.privacyUrl}
        supportUrlReplacement={formState.supportUrlReplacement}
        supportUrlAllLocales={formState.supportUrlAllLocales}
        supportUrlQueryEnabled={formState.supportUrlQueryEnabled}
        supportUrlQueryPattern={formState.supportUrlQueryPattern}
        onSupportUrlChange={(url) => setFormState(prev => ({ ...prev, supportUrlReplacement: url }))}
        onSupportUrlAllLocalesChange={(enabled) => setFormState(prev => ({ ...prev, supportUrlAllLocales: enabled }))}
        onSupportUrlQueryEnabledChange={(enabled) => setFormState(prev => ({ ...prev, supportUrlQueryEnabled: enabled }))}
        onSupportUrlQueryPatternChange={(pattern) => setFormState(prev => ({ ...prev, supportUrlQueryPattern: pattern }))}
        existingSupportUrl={sourceContent.supportUrl}
        marketingUrlReplacement={formState.marketingUrlReplacement}
        marketingUrlAllLocales={formState.marketingUrlAllLocales}
        marketingUrlQueryEnabled={formState.marketingUrlQueryEnabled}
        marketingUrlQueryPattern={formState.marketingUrlQueryPattern}
        onMarketingUrlChange={(url) => setFormState(prev => ({ ...prev, marketingUrlReplacement: url }))}
        onMarketingUrlAllLocalesChange={(enabled) => setFormState(prev => ({ ...prev, marketingUrlAllLocales: enabled }))}
        onMarketingUrlQueryEnabledChange={(enabled) => setFormState(prev => ({ ...prev, marketingUrlQueryEnabled: enabled }))}
        onMarketingUrlQueryPatternChange={(pattern) => setFormState(prev => ({ ...prev, marketingUrlQueryPattern: pattern }))}
        existingMarketingUrl={sourceContent.marketingUrl}
        descriptionContent={sourceContent.description}
        isDescriptionSelected={formState.fields.includes('description')}
        urlReplacements={formState.urlReplacements}
        onUrlReplacementsChange={(replacements) => setFormState(prev => ({ ...prev, urlReplacements: replacements }))}
      />

      {/* Source content editor */}
      <SourcePreview
        sourceContent={sourceContent}
        selectedFields={formState.fields}
        onContentChange={handleSourceContentChange}
      />

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!isFormValid() || isGenerating}
        className="w-full h-12"
        aria-label={
          !isFormValid()
            ? 'Cannot start job: select at least one target language and one field'
            : 'Start localization job'
        }
      >
        {isGenerating ? (
          <>
            <svg
              className="w-4 h-4 mr-2 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle cx="12" cy="12" r="10" strokeWidth={2} opacity={0.25} />
              <path
                strokeLinecap="round"
                strokeWidth={2}
                d="M12 2a10 10 0 0 1 10 10"
              />
            </svg>
            Creating Job...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Generate
          </>
        )}
      </Button>
    </div>
  )
}
