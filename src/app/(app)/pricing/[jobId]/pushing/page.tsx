"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { usePricingPush } from "@/hooks/use-pricing-stream"
import type { PricingJob } from "@/lib/database/types"

export default function PricingPushingPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<PricingJob | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch(`/api/pricing-jobs/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.job) {
          toast.error("Job not found")
          router.push("/pricing")
          return
        }
        if (data.job.status !== "completed") {
          toast.error("Job must be completed before pushing")
          router.push(`/pricing/${jobId}/preview`)
          return
        }
        setJob(data.job)
        setReady(true)
      })
      .catch(() => {
        toast.error("Failed to load job")
        router.push("/pricing")
      })
  }, [jobId, router])

  const { status, progress, productStates, error, effectiveStartDate, connect } =
    usePricingPush(jobId, {
      autoStart: false,
      onError: (err) => toast.error(`Push failed: ${err}`),
    })

  useEffect(() => {
    if (ready && status === "idle") connect()
  }, [ready, status, connect])

  if (!ready || !job) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-48 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
        <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
      </div>
    )
  }

  const states = Object.values(productStates)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Pushing Prices to App Store
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          {status === "complete" ? "Push complete!" : `Updating prices for ${job.app_name}`}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-content)]">
            Overall Progress
          </span>
          <span className="text-sm text-[var(--color-content-secondary)]">
            {Math.round(progress)}%
          </span>
        </div>
        <Progress value={progress} />
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {states.map((p) => (
          <div
            key={p.productId}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              p.status === "complete"
                ? "border-green-500/50 bg-green-500/5"
                : p.status === "pushing"
                  ? "border-amber-500/50 bg-amber-500/5"
                  : p.status === "error"
                    ? "border-red-500/50 bg-red-500/5"
                    : "border-[var(--color-border)]"
            }`}
          >
            {p.status === "pushing" && <Spinner className="h-4 w-4 shrink-0" />}
            {p.status === "complete" && (
              <svg className="h-4 w-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            )}
            {p.status === "error" && (
              <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-sm text-[var(--color-content)] truncate block">
                {p.name}
              </span>
              <span className="text-xs text-[var(--color-content-muted)]">
                {p.pushedTerritories ?? 0}/{p.totalTerritories ?? 0} territories
                {p.failedTerritories ? ` · ${p.failedTerritories} failed` : ""}
                {p.error ? ` · ${p.error}` : ""}
              </span>
            </div>
          </div>
        ))}
      </div>

      {status === "complete" && (
        <div className="space-y-4">
          {effectiveStartDate && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-4 text-center">
              <p className="text-sm text-[var(--color-content-secondary)]">
                Prices effective{" "}
                <span className="font-medium text-[var(--color-content)]">
                  {effectiveStartDate}
                </span>
                .
              </p>
            </div>
          )}
          <div className="flex justify-center gap-3">
            <Button onClick={() => router.push(`/pricing/${jobId}/success`)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
