export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-32 bg-[var(--color-surface-tertiary)] rounded" />
          <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-[var(--color-surface-tertiary)] rounded-xl" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl"
          />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="h-80 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl" />
        <div className="space-y-6">
          <div className="h-32 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl" />
          <div className="h-48 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
