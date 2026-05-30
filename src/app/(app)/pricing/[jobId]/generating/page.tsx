"use client"

import { useEffect, useState, use, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { usePricingCompute } from "@/hooks/use-pricing-stream"
import type { PricingJob } from "@/lib/database/types"

export default function PricingGeneratingPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<PricingJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/pricing-jobs/${jobId}`)
      if (!res.ok) throw new Error("Job not found")
      const data = await res.json()
      setJob(data.job)
      setIsLoading(false)
      if (data.job.status === "completed") {
        router.push(`/pricing/${jobId}/preview`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load job")
      setIsLoading(false)
    }
  }, [jobId, router])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  const products = useMemo(
    () => job?.strategy?.products.map((p) => ({ id: p.id, name: p.name })) ?? [],
    [job]
  )

  const handleComplete = useCallback(() => {
    router.push(`/pricing/${jobId}/preview`)
  }, [jobId, router])

  const useResume =
    job?.status === "interrupted" || job?.status === "failed"

  const { status, progress, completedProducts, totalProducts, productStates, error: streamError, connect } =
    usePricingCompute(jobId, products, {
      autoStart: false,
      useResumeEndpoint: useResume,
      onComplete: handleComplete,
      onError: setError,
    })

  // Start once the job is loaded and runnable.
  useEffect(() => {
    if (isLoading || !job) return
    if (status !== "idle") return
    if (error || streamError) return
    if (["pending", "interrupted", "failed"].includes(job.status)) {
      connect()
    }
  }, [isLoading, job, status, error, streamError, connect])

  const displayError = error || streamError

  if (displayError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-content)]">
            Pricing Error
          </h1>
          <p className="text-sm text-red-500 mt-1">{displayError}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => router.push("/pricing")}>Start Over</Button>
        </div>
      </div>
    )
  }

  if (isLoading || !job) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-48 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
        <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
      </div>
    )
  }

  const displayTotal = totalProducts || products.length
  const displayProgress =
    progress || (displayTotal > 0 ? Math.round((completedProducts / displayTotal) * 100) : 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Computing Prices
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          {completedProducts} of {displayTotal} products priced for {job.app_name}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-content)]">
            Overall Progress
          </span>
          <span className="text-sm text-[var(--color-content-secondary)]">
            {displayProgress}%
          </span>
        </div>
        <Progress value={displayProgress} />
      </div>

      <div className="space-y-2">
        {products.map((p) => {
          const st = productStates[p.id]
          const s = st?.status ?? "pending"
          return (
            <div
              key={p.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                s === "completed"
                  ? "border-green-500/50 bg-green-500/5"
                  : s === "processing"
                    ? "border-amber-500/50 bg-amber-500/5"
                    : s === "failed"
                      ? "border-red-500/50 bg-red-500/5"
                      : "border-[var(--color-border)]"
              }`}
            >
              {s === "pending" && (
                <div className="h-4 w-4 rounded-full border-2 border-[var(--color-border)] shrink-0" />
              )}
              {s === "processing" && <Spinner className="h-4 w-4 shrink-0" />}
              {s === "completed" && (
                <svg className="h-4 w-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
              {s === "failed" && (
                <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--color-content)] truncate block">
                  {st?.name || p.name}
                </span>
                <span className="text-xs text-[var(--color-content-muted)]">
                  {s === "completed"
                    ? `${st?.territoryCount ?? 0} territories`
                    : s === "failed"
                      ? st?.error || "Failed"
                      : s === "processing"
                        ? "Pricing…"
                        : "Waiting"}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => router.push("/pricing")}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
