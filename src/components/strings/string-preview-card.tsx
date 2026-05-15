"use client"

import { useState, useEffect } from "react"

interface StringPreviewCardProps {
  sourceValue: string
  translatedValue: string
  comment?: string
  onEdit?: (newValue: string) => void
  isEditable?: boolean
}

export function StringPreviewCard({
  sourceValue,
  translatedValue,
  comment,
  onEdit,
  isEditable = true,
}: StringPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(translatedValue)

  // Sync editValue when translatedValue changes (e.g., locale switch)
  useEffect(() => {
    setEditValue(translatedValue)
  }, [translatedValue])

  const handleBlur = () => {
    if (editValue !== translatedValue && onEdit) {
      onEdit(editValue)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(translatedValue)
      setIsEditing(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] p-4">
      {/* Comment (developer context) */}
      {comment && (
        <div className="mb-3">
          <p className="text-xs text-[var(--color-content-muted)] mb-1">Comment</p>
          <p className="text-sm text-[var(--color-content-secondary)]">
            {comment}
          </p>
        </div>
      )}

      {/* Source */}
      <div className="mb-3">
        <p className="text-xs text-[var(--color-content-muted)] mb-1">Source</p>
        <p className="text-sm text-[var(--color-content-secondary)] whitespace-pre-wrap">
          {sourceValue || <span className="italic text-[var(--color-content-muted)]">(empty)</span>}
        </p>
      </div>

      {/* Translation */}
      <div>
        <p className="text-xs text-[var(--color-content-muted)] mb-1">Translation</p>
        {isEditable && onEdit ? (
          isEditing ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-full text-sm text-[var(--color-content)] bg-[var(--color-surface-secondary)] border border-[var(--color-border)] rounded-lg p-2 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-content)]/30"
              rows={Math.max(2, translatedValue.split('\n').length)}
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="w-full text-left text-sm text-[var(--color-content)] hover:bg-[var(--color-surface-hover)] rounded p-2 -m-2 transition-colors cursor-pointer"
            >
              <span className="whitespace-pre-wrap">
                {translatedValue || <span className="italic text-[var(--color-content-muted)]">(empty)</span>}
              </span>
            </button>
          )
        ) : (
          <p className="text-sm text-[var(--color-content)] whitespace-pre-wrap">
            {translatedValue || <span className="italic text-[var(--color-content-muted)]">(empty)</span>}
          </p>
        )}
      </div>
    </div>
  )
}
