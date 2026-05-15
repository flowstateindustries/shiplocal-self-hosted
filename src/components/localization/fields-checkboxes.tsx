"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { LOCALIZABLE_FIELDS, FIELD_LIMITS } from "@/lib/localization/constants"

interface FieldsCheckboxesProps {
  selectedFields: string[]
  onChange: (fields: string[]) => void
}

export function FieldsCheckboxes({
  selectedFields,
  onChange,
}: FieldsCheckboxesProps) {
  const handleToggleField = (code: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedFields, code])
    } else {
      onChange(selectedFields.filter(f => f !== code))
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
      <h3 className="text-sm font-medium text-[var(--color-content)] mb-4">
        Fields to Localize
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {LOCALIZABLE_FIELDS.map((field) => (
          <div
            key={field.code}
            role="checkbox"
            tabIndex={0}
            aria-checked={selectedFields.includes(field.code)}
            className={`
              flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
              ${selectedFields.includes(field.code)
                ? 'border-[var(--color-content)] bg-[var(--color-content)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-content-muted)]'
              }
            `}
            onClick={() => handleToggleField(field.code, !selectedFields.includes(field.code))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleToggleField(field.code, !selectedFields.includes(field.code))
              }
            }}
          >
            <Checkbox
              checked={selectedFields.includes(field.code)}
              aria-label={`Select ${field.name}`}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={(checked) => handleToggleField(field.code, !!checked)}
            />
            <div className="flex-1">
              <span className="text-sm text-[var(--color-content)]">
                {field.name}
              </span>
              <p className="text-xs text-[var(--color-content-muted)]">
                Max {FIELD_LIMITS[field.code]} chars
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
