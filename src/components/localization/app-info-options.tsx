"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

interface AppInfoOptionsProps {
  translateAppName: boolean
  brandName: string
  onToggleTranslate: (enabled: boolean) => void
  onBrandNameChange: (name: string) => void
}

export function AppInfoOptions({
  translateAppName,
  brandName,
  onToggleTranslate,
  onBrandNameChange,
}: AppInfoOptionsProps) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
      <h3 className="text-sm font-medium text-[var(--color-content)] mb-4">
        App Info Options
      </h3>

      {/* Translate app name checkbox */}
      <div
        role="checkbox"
        tabIndex={0}
        aria-checked={translateAppName}
        className={`
          flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
          ${translateAppName
            ? 'border-[var(--color-content)] bg-[var(--color-content)]/5'
            : 'border-[var(--color-border)] hover:border-[var(--color-content-muted)]'
          }
        `}
        onClick={() => onToggleTranslate(!translateAppName)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggleTranslate(!translateAppName)
          }
        }}
      >
        <Checkbox
          checked={translateAppName}
          aria-label="Translate app name and subtitle"
          onClick={(e) => e.stopPropagation()}
          onCheckedChange={(checked) => onToggleTranslate(!!checked)}
        />
        <div className="flex-1">
          <span className="text-sm text-[var(--color-content)]">
            Translate app name & subtitle
          </span>
          <p className="text-xs text-[var(--color-content-muted)] mt-1">
            Translate the descriptive part of your app name (costs 1 additional credit)
          </p>
        </div>
      </div>

      {/* Brand name input (shown when translate is enabled) */}
      {translateAppName && (
        <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
          <label htmlFor="brand-name" className="text-sm text-[var(--color-content)]">
            Brand name to preserve
          </label>
          <p className="text-xs text-[var(--color-content-muted)] mt-1 mb-2">
            This part of your app name will be kept as-is in all translations
          </p>
          <Input
            id="brand-name"
            value={brandName}
            onChange={(e) => onBrandNameChange(e.target.value)}
            placeholder="e.g., MyApp, Acme"
            className="w-full md:w-64"
          />
          <p className="text-xs text-[var(--color-content-muted)] mt-2">
            Example: &quot;MyApp - Task Manager&quot; becomes &quot;MyApp - Administrador de tareas&quot; in Spanish
          </p>
        </div>
      )}
    </div>
  )
}
