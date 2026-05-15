"use client"

import { useState, useMemo, useCallback, use, useEffect } from "react"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { StringPreviewCard, getXCStringsLocaleName } from "@/components/strings"
import type { StringsJob, XCStringsFile } from "@/lib/database/types"

export default function PreviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<StringsJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLocale, setSelectedLocale] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState("")
  const [editedTranslations, setEditedTranslations] = useState<Record<string, Record<string, string>>>({})
  const [isDownloading, setIsDownloading] = useState(false)

  // Fetch job data
  useEffect(() => {
    async function fetchJob() {
      try {
        const response = await fetch(`/api/strings-jobs/${jobId}`)
        if (!response.ok) {
          throw new Error('Job not found')
        }
        const data = await response.json()
        setJob(data.job)

        // Set initial selected locale
        if (data.job.target_locales?.length > 0) {
          setSelectedLocale(data.job.target_locales[0])
        }

        // Initialize edited translations from results
        if (data.job.results) {
          const initialEdits: Record<string, Record<string, string>> = {}
          for (const locale of data.job.target_locales) {
            initialEdits[locale] = {}
            for (const [key, entry] of Object.entries(data.job.results.strings)) {
              const localization = (entry as { localizations?: Record<string, { stringUnit?: { value: string } }> }).localizations?.[locale]
              if (localization?.stringUnit?.value) {
                initialEdits[locale][key] = localization.stringUnit.value
              }
            }
          }
          setEditedTranslations(initialEdits)
        }

        setIsLoading(false)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load job')
        setIsLoading(false)
      }
    }
    fetchJob()
  }, [jobId])

  // Get all string keys from the source content
  const stringKeys = useMemo(() => {
    if (!job?.source_content) return []
    return Object.keys(job.source_content.strings)
  }, [job])

  // Get source value for a key
  const getSourceValue = useCallback((key: string): string => {
    if (!job?.source_content) return ''
    const entry = job.source_content.strings[key]
    // First try to get from source locale localizations
    const sourceLocalization = entry?.localizations?.[job.source_locale]
    if (sourceLocalization?.stringUnit?.value) {
      return sourceLocalization.stringUnit.value
    }
    // Fall back to key as value (common pattern)
    return key
  }, [job])

  // Filter strings by search query
  const filteredKeys = useMemo(() => {
    if (!searchQuery.trim()) return stringKeys
    const query = searchQuery.toLowerCase()
    return stringKeys.filter(key => {
      // Search in key name
      if (key.toLowerCase().includes(query)) return true
      // Search in source value
      const sourceValue = getSourceValue(key)
      if (sourceValue.toLowerCase().includes(query)) return true
      return false
    })
  }, [stringKeys, searchQuery, getSourceValue])

  // Get comment for a key
  const getComment = useCallback((key: string): string | undefined => {
    if (!job?.source_content) return undefined
    return job.source_content.strings[key]?.comment
  }, [job])

  // Handle edit for a specific locale and key
  const handleEdit = useCallback((locale: string, key: string, newValue: string) => {
    setEditedTranslations(prev => ({
      ...prev,
      [locale]: {
        ...prev[locale],
        [key]: newValue,
      },
    }))
  }, [])

  // Check if any locale has edits (compared to original results)
  const hasEdits = useMemo(() => {
    if (!job?.results) return {}
    const result: Record<string, boolean> = {}
    for (const locale of job.target_locales) {
      const edited = editedTranslations[locale] || {}
      result[locale] = Object.keys(edited).some(key => {
        const originalValue = (job.results as XCStringsFile).strings[key]?.localizations?.[locale]?.stringUnit?.value || ''
        return edited[key] !== originalValue
      })
    }
    return result
  }, [job, editedTranslations])

  // Check if all locales are fully completed
  const hasIncompleteLocales = useMemo(() => {
    if (!job?.locale_results) return false
    return job.target_locales.some(locale => {
      const result = job.locale_results[locale]
      return !result || result.status !== 'completed'
    })
  }, [job])

  // Download the translated file
  const handleDownload = useCallback(async () => {
    if (!job) return

    setIsDownloading(true)
    try {
      // Build the output file with any edits
      const output: XCStringsFile = JSON.parse(JSON.stringify(job.results || job.source_content))

      // Apply edits
      for (const locale of job.target_locales) {
        const translations = editedTranslations[locale] || {}
        for (const [key, value] of Object.entries(translations)) {
          if (!output.strings[key]) continue
          if (!output.strings[key].localizations) {
            output.strings[key].localizations = {}
          }
          output.strings[key].localizations![locale] = {
            stringUnit: {
              state: 'translated',
              value,
            },
          }
        }
      }

      // Download
      const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = job.file_name.replace('.xcstrings', '-translated.xcstrings')
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download error:', e)
    } finally {
      setIsDownloading(false)
    }
  }, [job, editedTranslations])

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-content)]">
            Error
          </h1>
          <p className="text-sm text-red-500 mt-1">{error}</p>
        </div>
        <Button onClick={() => router.push('/strings')}>
          Start Over
        </Button>
      </div>
    )
  }

  if (isLoading || !job) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-48 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
          <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded mt-2 animate-pulse" />
        </div>
      </div>
    )
  }

  const translatedCount = stringKeys.filter(key => {
    return editedTranslations[selectedLocale]?.[key]
  }).length

  return (
    <div className="space-y-6">
      {/* Header with download button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-content)]">
            Review & Edit Translations
          </h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-1">
            {translatedCount} of {stringKeys.length} strings translated to {job.target_locales.length} language{job.target_locales.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex gap-3">
          {hasIncompleteLocales && (
            <Button
              variant="outline"
              onClick={() => router.push(`/strings/${jobId}/generating`)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Resume Translation
            </Button>
          )}
          <Button onClick={handleDownload} disabled={isDownloading}>
            {isDownloading ? (
              <>
                <svg
                  className="h-4 w-4 mr-2 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="10" opacity={0.25} />
                  <path strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                Downloading...
              </>
            ) : (
              <>
                <svg
                  className="h-4 w-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download .xcstrings
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Language selector */}
      <Select value={selectedLocale} onValueChange={setSelectedLocale}>
        <SelectTrigger className="w-full !h-[46px] px-4 !rounded-lg !bg-[var(--color-surface-tertiary)] !border !border-[var(--color-border)] text-base text-[var(--color-content)] shadow-none focus:!border-[var(--color-content-muted)] focus:!ring-0 [&>span]:!text-base">
          <SelectValue placeholder="Select language" />
        </SelectTrigger>
        <SelectContent className="!rounded-xl !border-[var(--color-border)] !bg-[var(--color-surface-secondary)] p-1">
          {job.target_locales.map(locale => (
            <SelectItem
              key={locale}
              value={locale}
              className="!rounded-lg !py-2.5 !px-3 !text-sm cursor-pointer data-[highlighted]:!bg-[var(--color-surface-tertiary)]"
            >
              <span className="flex items-center gap-2">
                {getXCStringsLocaleName(locale)}
                {hasEdits[locale] && (
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <Input
        placeholder="Search strings..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      {/* String cards */}
      <div className="space-y-3">
        {filteredKeys.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-content-muted)]">
            No strings found matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          filteredKeys.map(key => (
            <StringPreviewCard
              key={key}
              sourceValue={getSourceValue(key)}
              translatedValue={editedTranslations[selectedLocale]?.[key] || ''}
              comment={getComment(key)}
              onEdit={(newValue) => handleEdit(selectedLocale, key, newValue)}
              isEditable={true}
            />
          ))
        )}
      </div>
    </div>
  )
}
