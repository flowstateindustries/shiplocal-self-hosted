export default function HistoryLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-7 w-24 bg-[var(--color-surface-tertiary)] rounded" />
        <div className="h-4 w-48 bg-[var(--color-surface-tertiary)] rounded mt-2" />
      </div>

      {/* Job cards skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="p-4 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl"
          >
            <div className="flex items-center gap-4">
              {/* Icon skeleton */}
              <div className="w-10 h-10 bg-[var(--color-surface-secondary)] rounded-lg" />

              {/* Content skeleton */}
              <div className="flex-1 space-y-2">
                <div className="h-5 w-40 bg-[var(--color-surface-secondary)] rounded" />
                <div className="h-4 w-64 bg-[var(--color-surface-secondary)] rounded" />
              </div>

              {/* Status badge skeleton */}
              <div className="h-6 w-20 bg-[var(--color-surface-secondary)] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
