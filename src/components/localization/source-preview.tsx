"use client"

import { LOCALIZABLE_FIELDS, FIELD_LIMITS } from "@/lib/localization/constants"
import type { SourceContent } from "@/lib/localization/types"

interface SourcePreviewProps {
  sourceContent: SourceContent
  selectedFields: string[]
  onContentChange: (field: string, value: string) => void
}

export function SourcePreview({
  sourceContent,
  selectedFields,
  onContentChange,
}: SourcePreviewProps) {
  if (selectedFields.length === 0) {
    return null
  }

  // Get field content
  const getFieldContent = (code: string): string => {
    switch (code) {
      case 'description':
        return sourceContent.description
      case 'keywords':
        return sourceContent.keywords
      case 'promotionalText':
        return sourceContent.promotionalText
      case 'whatsNew':
        return sourceContent.whatsNew
      default:
        return ''
    }
  }

  // Get field name
  const getFieldName = (code: string): string => {
    return LOCALIZABLE_FIELDS.find(f => f.code === code)?.name || code
  }

  // Calculate character count status
  const getCharStatus = (content: string, limit: number) => {
    const count = content.length
    const percent = (count / limit) * 100

    if (percent > 100) return 'text-red-500'
    if (percent > 90) return 'text-amber-500'
    return 'text-[var(--color-content-muted)]'
  }

  // Get appropriate row count based on field type
  const getRowCount = (code: string): number => {
    if (code === 'keywords') return 1
    if (code === 'promotionalText') return 3
    return 8
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
      <h3 className="text-sm font-medium text-[var(--color-content)] mb-4">
        Source Content
      </h3>

      <div className="space-y-4">
        {selectedFields.map((code) => {
          const content = getFieldContent(code)
          const limit = FIELD_LIMITS[code] || 4000

          return (
            <div key={code} className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--color-content)]">
                  {getFieldName(code)}
                </h4>
                <span className={`text-xs ${getCharStatus(content, limit)}`}>
                  {content.length} / {limit} characters
                </span>
              </div>

              <textarea
                value={content}
                onChange={(e) => onContentChange(code, e.target.value)}
                rows={getRowCount(code)}
                maxLength={limit}
                placeholder={`Enter ${getFieldName(code).toLowerCase()}...`}
                className="w-full p-3 rounded-lg bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] text-sm text-[var(--color-content)] placeholder:text-[var(--color-content-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-content)]/20 focus:border-[var(--color-content)]"
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
