"use client"

import { Checkbox } from "@/components/ui/checkbox"
import type { LocaleChoice } from "@/lib/localization/types"

interface TargetLocalesGridProps {
  localeChoices: LocaleChoice[]
  selectedLocales: string[]
  sourceLocale: string
  onChange: (locales: string[]) => void
}

export function TargetLocalesGrid({
  localeChoices,
  selectedLocales,
  sourceLocale,
  onChange,
}: TargetLocalesGridProps) {
  // Filter out source locale from choices
  const availableLocales = localeChoices.filter(l => l.code !== sourceLocale)

  // Check if all available locales are selected
  const allSelected = availableLocales.length > 0 &&
    availableLocales.every(l => selectedLocales.includes(l.code))

  const handleToggleAll = () => {
    if (allSelected) {
      onChange([])
    } else {
      onChange(availableLocales.map(l => l.code))
    }
  }

  const handleToggleLocale = (code: string, checked: boolean) => {
    if (checked) {
      onChange([...selectedLocales, code])
    } else {
      onChange(selectedLocales.filter(l => l !== code))
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--color-content)]">
          Target Languages
        </h3>
        <button
          type="button"
          onClick={handleToggleAll}
          className="text-xs text-[var(--color-content-secondary)] hover:text-[var(--color-content)] transition-colors"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {availableLocales.map((locale) => (
          <div
            key={locale.code}
            role="checkbox"
            tabIndex={0}
            aria-checked={selectedLocales.includes(locale.code)}
            className={`
              flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
              ${selectedLocales.includes(locale.code)
                ? 'border-[var(--color-content)] bg-[var(--color-content)]/5'
                : 'border-[var(--color-border)] hover:border-[var(--color-content-muted)]'
              }
            `}
            onClick={() => handleToggleLocale(locale.code, !selectedLocales.includes(locale.code))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleToggleLocale(locale.code, !selectedLocales.includes(locale.code))
              }
            }}
          >
            <Checkbox
              checked={selectedLocales.includes(locale.code)}
              aria-label={`Select ${locale.name}`}
              onClick={(e) => e.stopPropagation()}
              onCheckedChange={(checked) => handleToggleLocale(locale.code, !!checked)}
            />
            <span className="flex-1 text-sm">
              <span className="text-[var(--color-content)]">{locale.name}</span>
              {locale.isActive && (
                <span className="ml-1 text-[var(--color-content-muted)] text-xs">
                  (active)
                </span>
              )}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-[var(--color-content-muted)] mt-4">
        {selectedLocales.length} of {availableLocales.length} languages selected
      </p>
    </div>
  )
}
