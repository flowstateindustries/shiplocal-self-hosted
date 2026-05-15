"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getXCStringsLocaleName } from "./locale-utils"

interface FileInfoProps {
  fileName: string
  stringCount: number
  sourceLocale: string
  existingLocales: string[]
  onRemove: () => void
}

export function FileInfo({
  fileName,
  stringCount,
  sourceLocale,
  existingLocales,
  onRemove,
}: FileInfoProps) {
  const getLocaleName = getXCStringsLocaleName

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          {/* File icon */}
          <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <svg
              className="h-6 w-6 text-amber-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
            </svg>
          </div>

          <div>
            <h3 className="text-lg font-medium text-[var(--color-content)]">
              {fileName}
            </h3>
            <div className="flex items-center gap-2">
              <p className="text-sm text-[var(--color-content-secondary)]">
                {stringCount.toLocaleString()} strings
              </p>
              <Badge variant="default" className="text-xs">
                {getLocaleName(sourceLocale)}
              </Badge>
            </div>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      {/* Existing locales badges */}
      {existingLocales.length > 0 && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-content-muted)] mb-2">
            Existing translations ({existingLocales.length}):
          </p>
          <div className="flex flex-wrap gap-2">
            {existingLocales.map(locale => (
              <Badge key={locale} variant="default">
                {getLocaleName(locale)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
