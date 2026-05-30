"use client"

import { use, useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { useCopyPushStream } from "@/hooks/use-copy-push-stream"
import { APP_STORE_LOCALES } from "@/lib/localization/constants"
import type { CopyJob } from "@/lib/database/types"

export default function CopyPushingPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<CopyJob | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/copy-jobs/${jobId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setJob(d.job)
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load job"))
  }, [jobId])

  const handleComplete = useCallback(
    () => router.push(`/copy/${jobId}/success`),
    [jobId, router]
  )

  const { status, localeStates, completedCount, totalCount, progress, error, connect } =
    useCopyPushStream(jobId, { onComplete: handleComplete })

  // Start stream once job is loaded
  useEffect(() => {
    if (!job || loadError) return
    if (status === "idle") connect()
  }, [job, loadError, status, connect])

  const locales = job?.results?.locales ?? []

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">Copy Error</h1>
        <p className="text-sm text-red-500">{loadError}</p>
        <Button onClick={() => router.push("/copy")}>Start Over</Button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">Copy Error</h1>
        <p className="text-sm text-red-500">{error}</p>
        <div className="flex gap-3">
          <Button onClick={() => router.push(`/copy/${jobId}/preview`)}>Back to Preview</Button>
          <Button variant="ghost" onClick={() => router.push("/copy")}>Start Over</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Copying Metadata
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          {completedCount} of {totalCount || locales.length} locales updated for{" "}
          {job?.app_name ?? "…"}
        </p>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-content)]">
            Overall Progress
          </span>
          <span className="text-sm text-[var(--color-content-secondary)]">{progress}%</span>
        </div>
        <Progress value={progress} />
      </div>

      <div className="space-y-2">
        {locales.map((loc) => {
          const st = localeStates[loc.locale]?.status ?? "pending"
          const err = localeStates[loc.locale]?.error
          return (
            <div
              key={loc.locale}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                st === "complete"
                  ? "border-green-500/50 bg-green-500/5"
                  : st === "pushing"
                    ? "border-amber-500/50 bg-amber-500/5"
                    : st === "failed"
                      ? "border-red-500/50 bg-red-500/5"
                      : "border-[var(--color-border)]"
              }`}
            >
              {st === "pending" && (
                <div className="h-4 w-4 rounded-full border-2 border-[var(--color-border)] shrink-0" />
              )}
              {st === "pushing" && <Spinner className="h-4 w-4 shrink-0" />}
              {st === "complete" && (
                <svg className="h-4 w-4 text-green-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
              {st === "failed" && (
                <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              )}
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--color-content)] truncate block">
                  <span className="font-mono text-xs mr-1.5">{loc.locale}</span>
                  {APP_STORE_LOCALES[loc.locale] ?? ""}
                </span>
                {st === "failed" && err && (
                  <span className="text-xs text-red-500">{err}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" onClick={() => router.push("/copy")}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
