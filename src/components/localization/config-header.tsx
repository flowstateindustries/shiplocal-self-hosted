"use client"

import Image from "next/image"

interface ConfigHeaderProps {
  appName: string
  iconUrl?: string | null
  versionString: string
  appStoreState: string
  isManualMode: boolean
}

export function ConfigHeader({
  appName,
  iconUrl,
  versionString,
  appStoreState,
  isManualMode,
}: ConfigHeaderProps) {
  // Format state for display
  const formatState = (state: string): string => {
    return state
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  // Get state badge variant
  const getStateBadgeVariant = (state: string): "success" | "warning" | "info" => {
    if (state === 'PREPARE_FOR_SUBMISSION' || state === 'MANUAL') {
      return 'success'
    }
    if (state === 'DEVELOPER_REJECTED' || state === 'REJECTED') {
      return 'warning'
    }
    return 'info'
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
      <div className="flex items-center gap-4">
        {/* App icon */}
        {iconUrl ? (
          <Image
            src={iconUrl}
            alt={appName}
            width={64}
            height={64}
            className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center text-2xl font-medium text-[var(--color-content-secondary)] flex-shrink-0">
            {appName[0]?.toUpperCase() || '?'}
          </div>
        )}

        {/* App info */}
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-[var(--color-content)] truncate">
            {appName}
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-surface-hover)] text-[var(--color-content-secondary)]">
              v{versionString}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
              getStateBadgeVariant(appStoreState) === 'success'
                ? 'bg-green-500/10 text-green-500'
                : getStateBadgeVariant(appStoreState) === 'warning'
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-blue-500/10 text-blue-500'
            }`}>
              {isManualMode ? 'Manual Mode' : formatState(appStoreState)}
            </span>
          </div>
        </div>
      </div>

      {isManualMode && (
        <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            <strong>Manual Mode:</strong> No App Store Connect credentials connected.
            Translations will be generated but cannot be pushed directly to App Store Connect.
          </p>
        </div>
      )}
    </div>
  )
}
