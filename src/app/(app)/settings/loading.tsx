export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header with tabs skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-7 w-24 bg-[var(--color-surface-tertiary)] rounded" />
          <div className="h-4 w-56 bg-[var(--color-surface-tertiary)] rounded mt-2" />
        </div>

        {/* Tab navigation skeleton */}
        <div className="flex items-center gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-9 w-24 bg-[var(--color-surface-tertiary)] rounded-lg"
            />
          ))}
        </div>
      </div>

      {/* Card skeletons */}
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-6 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl"
          >
            {/* Card header skeleton */}
            <div className="mb-4">
              <div className="h-5 w-32 bg-[var(--color-surface-secondary)] rounded" />
              <div className="h-4 w-56 bg-[var(--color-surface-secondary)] rounded mt-2" />
            </div>

            {/* Card content skeleton */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="h-10 bg-[var(--color-surface-secondary)] rounded-lg" />
                <div className="h-10 bg-[var(--color-surface-secondary)] rounded-lg" />
              </div>
              <div className="h-10 bg-[var(--color-surface-secondary)] rounded-lg" />
              <div className="h-10 w-28 bg-[var(--color-surface-secondary)] rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
