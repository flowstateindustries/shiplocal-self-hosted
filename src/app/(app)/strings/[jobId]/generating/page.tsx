"use client"

import { useEffect, useState, use, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"
import { getXCStringsLocaleName } from "@/components/strings"
import { useStringsStream } from "@/hooks/use-strings-stream"
import type { StringsJob } from "@/lib/database/types"

export default function GeneratingPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<StringsJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch job data
  const fetchJob = useCallback(async () => {
    try {
      const response = await fetch(`/api/strings-jobs/${jobId}`)
      if (!response.ok) {
        throw new Error('Job not found')
      }
      const data = await response.json()
      setJob(data.job)
      setIsLoading(false)

      // If job is already completed, redirect to preview
      if (data.job.status === 'completed') {
        router.push(`/strings/${jobId}/preview`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load job')
      setIsLoading(false)
    }
  }, [jobId, router])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  const handleComplete = useCallback(() => {
    router.push(`/strings/${jobId}/preview`)
  }, [jobId, router])

  const handleError = useCallback((err: string) => {
    setError(err)
  }, [])

  const {
    start,
    resume,
    cancel,
    isConnecting,
    isRunning,
    localeProgress,
    overallProgress,
    completedLocales,
    totalLocales,
    error: streamError,
  } = useStringsStream({
    jobId,
    onComplete: handleComplete,
    onError: handleError,
  })

  // Start stream when job is loaded
  useEffect(() => {
    if (isLoading || !job) return  // Wait for job to fully load
    if (!isRunning && !isConnecting && !error && !streamError) {
      if (job.status === 'pending') {
        start()
      } else if (job.status === 'interrupted' || job.status === 'failed') {
        resume()
      }
    }
  }, [job, isLoading, isRunning, isConnecting, error, streamError, start, resume])

  // Handle cancel
  const handleCancel = () => {
    cancel()
    router.push('/strings')
  }

  // Get locale status for display
  const getLocaleStatus = (locale: string): 'pending' | 'processing' | 'completed' | 'failed' => {
    const progress = localeProgress[locale]
    if (progress) {
      return progress.status
    }
    // Check if already in job's locale_results
    const jobLocaleResult = job?.locale_results?.[locale]
    if (jobLocaleResult?.status === 'completed') {
      return 'completed'
    }
    if (jobLocaleResult?.status === 'failed') {
      return 'failed'
    }
    if (jobLocaleResult?.status === 'processing') {
      return 'processing'
    }
    return 'pending'
  }

  const getStatusClasses = (status: 'pending' | 'processing' | 'completed' | 'failed') => {
    switch (status) {
      case 'completed':
        return 'border-green-500/50 bg-green-500/5'
      case 'processing':
        return 'border-amber-500/50 bg-amber-500/5'
      case 'failed':
        return 'border-red-500/50 bg-red-500/5'
      default:
        return 'border-[var(--color-border)]'
    }
  }

  const displayError = error || streamError

  if (displayError) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-content)]">
            Translation Error
          </h1>
          <p className="text-sm text-red-500 mt-1">{displayError}</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => router.push('/strings')}>
            Start Over
          </Button>
          {job && (job.status === 'interrupted' || job.status === 'failed') && (
            <Button variant="outline" onClick={resume}>
              Retry
            </Button>
          )}
        </div>
      </div>
    )
  }

  if (isLoading || !job) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-48 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
          <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded mt-2 animate-pulse" />
        </div>
      </div>
    )
  }

  const targetLocales = job.target_locales
  // Count from job.locale_results as fallback (for resumed jobs before stream starts)
  const jobCompletedCount = job?.locale_results
    ? Object.values(job.locale_results).filter(r => r.status === 'completed').length
    : 0
  const displayCompletedLocales = completedLocales || Object.values(localeProgress).filter(p => p.status === 'completed').length || jobCompletedCount
  const displayTotalLocales = totalLocales || targetLocales.length
  // Calculate initial progress from job data when stream hasn't started
  const displayProgress = overallProgress || (displayTotalLocales > 0
    ? Math.round((displayCompletedLocales / displayTotalLocales) * 100)
    : 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Translating Strings
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          {displayCompletedLocales} of {displayTotalLocales} languages complete
        </p>
      </div>

      {/* Overall progress bar */}
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

      {/* Per-locale status grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {targetLocales.map(locale => {
          const status = getLocaleStatus(locale)
          const progress = localeProgress[locale]

          return (
            <div
              key={locale}
              className={`
                flex items-center gap-3 p-3 rounded-lg border transition-colors
                ${getStatusClasses(status)}
              `}
            >
              {/* Status icon */}
              {status === 'pending' && (
                <div className="h-4 w-4 rounded-full border-2 border-[var(--color-border)] shrink-0" />
              )}
              {status === 'processing' && (
                <Spinner className="h-4 w-4 shrink-0" />
              )}
              {status === 'completed' && (
                <svg
                  className="h-4 w-4 text-green-500 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
              )}
              {status === 'failed' && (
                <svg
                  className="h-4 w-4 text-red-500 shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
              )}

              <div className="flex-1 min-w-0">
                <span className="text-sm text-[var(--color-content)] truncate block">
                  {getXCStringsLocaleName(locale)}
                </span>
                <span className="text-xs text-[var(--color-content-muted)]">
                  {status === 'completed'
                    ? '100%'
                    : status === 'pending'
                      ? '0%'
                      : `${progress?.batchProgress ?? 0}%`
                  }
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cancel button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={handleCancel}
          disabled={isConnecting}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
