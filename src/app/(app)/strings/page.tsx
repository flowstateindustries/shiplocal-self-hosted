"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { FileInfo, FileUpload, type ParsedXCStrings, XCSTRINGS_LOCALES } from "@/components/strings"
import { TargetLocalesGrid } from "@/components/localization/target-locales-grid"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import type { LocaleChoice } from "@/lib/localization/types"

const BASE_TO_PRIMARY_LOCALE: Record<string, string> = {
  'en': 'en-US',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'es': 'es-ES',
  'pt': 'pt-PT',
  'nl': 'nl-NL',
  'zh': 'zh-Hans',
  'ar': 'ar-SA',
}

interface FileState {
  file: File
  content: ParsedXCStrings
}

export default function StringsPage() {
  const router = useRouter()
  const [fileState, setFileState] = useState<FileState | null>(null)
  const [selectedLocales, setSelectedLocales] = useState<string[]>([])
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInfo = useMemo(() => {
    if (!fileState) return null

    const { content, file } = fileState
    const stringCount = Object.keys(content.strings).length
    const sourceLocale = content.sourceLanguage

    const existingLocales = new Set<string>()
    for (const stringData of Object.values(content.strings)) {
      if (stringData.localizations) {
        for (const locale of Object.keys(stringData.localizations)) {
          existingLocales.add(locale)
        }
      }
    }

    return {
      fileName: file.name,
      stringCount,
      sourceLocale,
      existingLocales: Array.from(existingLocales).sort(),
    }
  }, [fileState])

  const localeChoices: LocaleChoice[] = useMemo(() => {
    return Object.entries(XCSTRINGS_LOCALES).map(([code, name]) => ({
      code,
      name,
      isActive: fileInfo?.existingLocales.some(
        existingCode =>
          existingCode === code ||
          BASE_TO_PRIMARY_LOCALE[existingCode] === code
      ) ?? false,
    }))
  }, [fileInfo])

  const handleFileSelect = useCallback((file: File, content: ParsedXCStrings) => {
    setFileState({ file, content })
    setSelectedLocales([])
    setError(null)
  }, [])

  const handleRemoveFile = useCallback(() => {
    setFileState(null)
    setSelectedLocales([])
    setError(null)
  }, [])

  const handleTranslate = async () => {
    if (!fileState || selectedLocales.length === 0) return

    setIsTranslating(true)
    setError(null)

    try {
      const response = await fetch('/api/strings-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: fileState.file.name,
          sourceLocale: fileState.content.sourceLanguage,
          targetLocales: selectedLocales,
          sourceContent: fileState.content,
          overwriteExisting,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create job')
      }

      router.push(`/strings/${data.jobId}/generating`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start translation. Please try again.')
      setIsTranslating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          String Translation
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          Translate your Localizable.xcstrings file to multiple languages
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {!fileState && <FileUpload onFileSelect={handleFileSelect} />}

      {fileState && fileInfo && (
        <>
          <FileInfo
            fileName={fileInfo.fileName}
            stringCount={fileInfo.stringCount}
            sourceLocale={fileInfo.sourceLocale}
            existingLocales={fileInfo.existingLocales}
            onRemove={handleRemoveFile}
          />

          <TargetLocalesGrid
            localeChoices={localeChoices}
            selectedLocales={selectedLocales}
            sourceLocale={fileInfo.sourceLocale}
            onChange={setSelectedLocales}
          />

          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="overwrite-existing" className="text-sm font-medium text-[var(--color-content)] cursor-pointer">
                  Overwrite existing translations
                </Label>
                <p className="text-xs text-[var(--color-content-muted)] mt-1">
                  When off, strings that already have translations will be skipped
                </p>
              </div>
              <Switch
                id="overwrite-existing"
                checked={overwriteExisting}
                onCheckedChange={setOverwriteExisting}
              />
            </div>
          </div>

          <Button
            onClick={handleTranslate}
            disabled={selectedLocales.length === 0 || isTranslating}
            className="w-full h-12"
          >
            {isTranslating ? (
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
                Starting...
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
                Translate {selectedLocales.length > 0 ? `${selectedLocales.length} Language${selectedLocales.length > 1 ? 's' : ''}` : ''}
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
