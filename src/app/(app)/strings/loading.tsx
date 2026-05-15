export default function StringsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-7 w-48 bg-[var(--color-surface-tertiary)] rounded" />
        <div className="h-4 w-80 bg-[var(--color-surface-tertiary)] rounded mt-2" />
      </div>

      {/* Upload zone skeleton */}
      <div className="flex flex-col items-center justify-center w-full px-6 py-12 bg-[var(--color-surface-tertiary)] border-2 border-dashed border-[var(--color-border)] rounded-xl">
        <div className="h-12 w-12 bg-[var(--color-surface-secondary)] rounded-full mb-4" />
        <div className="h-5 w-56 bg-[var(--color-surface-secondary)] rounded" />
        <div className="h-4 w-32 bg-[var(--color-surface-secondary)] rounded mt-2" />
      </div>
    </div>
  );
}
