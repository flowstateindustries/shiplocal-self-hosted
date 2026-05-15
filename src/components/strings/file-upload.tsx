"use client"

import { useRef, useState, useCallback } from "react"
import { Spinner } from "@/components/ui/spinner"

export interface ParsedXCStrings {
  sourceLanguage: string
  strings: Record<string, {
    comment?: string
    extractionState?: string
    localizations?: Record<string, {
      stringUnit?: {
        state: string
        value: string
      }
      variations?: {
        plural?: Record<string, {
          stringUnit: {
            state: string
            value: string
          }
        }>
      }
    }>
  }>
  version: string
}

interface FileUploadProps {
  onFileSelect: (file: File, content: ParsedXCStrings) => void
  isLoading?: boolean
  error?: string | null
}

export function FileUpload({ onFileSelect, isLoading, error }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  const processFile = useCallback(async (file: File) => {
    setParseError(null)

    // Check file size (5MB max, matching server limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      setParseError('File too large. Maximum size is 5MB.')
      return
    }

    // Validate file extension
    if (!file.name.endsWith('.xcstrings')) {
      setParseError('Please select a .xcstrings file')
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as ParsedXCStrings

      // Validate structure
      if (!parsed.sourceLanguage || !parsed.strings || typeof parsed.version !== 'string') {
        setParseError('Invalid .xcstrings file format')
        return
      }

      onFileSelect(file, parsed)
    } catch {
      setParseError('Failed to parse file. Please ensure it\'s a valid .xcstrings file.')
    }
  }, [onFileSelect])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragActive(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      processFile(file)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processFile(file)
    }
    // Reset input value to allow selecting the same file again
    e.target.value = ''
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  const displayError = error || parseError

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        className={`
          relative flex flex-col items-center justify-center w-full px-6 py-12
          bg-[var(--color-surface-tertiary)]
          border-2 border-dashed border-[var(--color-border)]
          rounded-xl cursor-pointer
          hover:border-[var(--color-content-muted)]
          transition-colors
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-content)]/50
          ${isDragActive ? 'border-amber-500 bg-amber-500/5' : ''}
          ${displayError ? 'border-red-500/50' : ''}
          ${isLoading ? 'pointer-events-none opacity-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        {isLoading ? (
          <Spinner className="h-12 w-12 text-[var(--color-content-muted)] mb-4" />
        ) : (
          <svg
            className="h-12 w-12 text-[var(--color-content-muted)] mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
            />
          </svg>
        )}

        <p className="text-base font-medium text-[var(--color-content)]">
          {isLoading ? 'Processing...' : 'Drop your .xcstrings file here'}
        </p>
        <p className="text-sm text-[var(--color-content-muted)] mt-1">
          or click to browse
        </p>

        <input
          ref={inputRef}
          type="file"
          accept=".xcstrings"
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload .xcstrings file"
        />
      </div>

      {displayError && (
        <p className="text-sm text-red-500 text-center">
          {displayError}
        </p>
      )}
    </div>
  )
}
