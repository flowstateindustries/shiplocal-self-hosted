import { Skeleton } from "@/components/ui/skeleton"

export default function LocalizationConfigLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* App info header card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      </div>

      {/* Source locale */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-64" />
      </div>

      {/* Target locales */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>

      {/* Fields */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      </div>

      {/* Generate button */}
      <Skeleton className="h-12 w-full" />
    </div>
  )
}
