"use client"

import { useParams, useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { useGenerationStream, LocaleState } from "@/hooks/use-generation-stream"
import { APP_STORE_LOCALES } from "@/lib/localization/constants"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Spinner } from "@/components/ui/spinner"

export default function GeneratingPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const appId = params.appId as string
  const jobId = searchParams.get('jobId')
  const isResume = searchParams.get('resume') === 'true'

  const [targetLocales, setTargetLocales] = useState<string[] | null>(null)
  const [appName, setAppName] = useState<string>('')
  const [isReady, setIsReady] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Fetch job details on mount
  useEffect(() => {
    if (!jobId) {
      toast.error('No job ID provided')
      router.push(`/localization/${appId}`)
      return
    }

    async function fetchJob() {
      try {
        const response = await fetch(`/api/localization-jobs/${jobId}`)
        const data = await response.json()

        // Check for lock error (409 = app claimed by another user)
        if (response.status === 409) {
          toast.error('This app has been claimed by another user.')
          router.push('/dashboard')
          return
        }

        if (!response.ok || !data.job) {
          toast.error('Job not found')
          router.push(`/localization/${appId}`)
          return
        }

        setTargetLocales(data.job.target_locales || [])
        setAppName(data.job.app_name || 'App')
        setIsReady(true)  // Signal that we're ready to start

        // If job is already completed, redirect to preview (unless resume was explicitly requested)
        if (data.job.status === 'completed' && !isResume) {
          router.push(`/localization/${appId}/preview?jobId=${jobId}`)
          return
        }

        // If resuming but job is completed, also redirect to preview
        if (data.job.status === 'completed' && isResume) {
          toast.info('Job is already complete')
          router.push(`/localization/${appId}/preview?jobId=${jobId}`)
          return
        }
      } catch (error) {
        console.error('Error fetching job:', error)
        toast.error('Failed to load job')
        router.push(`/localization/${appId}`)
      }
    }

    fetchJob()
  }, [jobId, appId, router, isResume])

  const {
    status,
    progress,
    totalLocales,
    completedLocales,
    locales,
    error,
    connect,
  } = useGenerationStream(jobId, targetLocales || [], {
    autoStart: false,  // Manual start after job fetch
    useResumeEndpoint: isResume,  // Use resume endpoint when resuming a partial/failed job
    onComplete: () => {
      toast.success(isResume ? 'Localization resumed and completed!' : 'Localization complete!')
      // Redirect to preview after a short delay
      setTimeout(() => {
        router.push(`/localization/${appId}/preview?jobId=${jobId}`)
      }, 1500)
    },
    onError: (err) => {
      toast.error(`Generation failed: ${err}`)
    },
  })

  // Start generation after job is fetched and ready
  // Lock check is already performed by fetchJob (which returns 409 if locked)
  useEffect(() => {
    if (isReady && targetLocales && targetLocales.length > 0 && status === 'idle') {
      connect()
    }
  }, [isReady, targetLocales, status, connect])

  // Refetch job status when page becomes visible (user returns from another tab)
  // This handles cases where SSE disconnected or job state changed while away
  useEffect(() => {
    let abortController: AbortController | null = null

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && jobId && (status === 'generating' || status === 'error')) {
        if (abortController) abortController.abort()
        abortController = new AbortController()

        try {
          const response = await fetch(`/api/localization-jobs/${jobId}`, {
            signal: abortController.signal
          })
          const data = await response.json()

          if (!response.ok || !data.job) return

          // If job completed while away, redirect to preview
          if (data.job.status === 'completed') {
            toast.success('Localization completed!')
            router.push(`/localization/${appId}/preview?jobId=${jobId}`)
            return
          }

          // If job was interrupted or cancelled, show error
          if (data.job.status === 'interrupted' || data.job.status === 'cancelled') {
            toast.info('Job was interrupted. You can resume from the History page.')
          }
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('Error checking job status:', err)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (abortController) abortController.abort()
    }
  }, [jobId, appId, router, status])

  // Sort locales by status for display
  const sortedLocales = Object.values(locales).sort((a, b) => {
    const statusOrder = { processing: 0, complete: 1, error: 2, pending: 3 }
    return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3)
  })

  const getStatusClasses = (localeStatus: LocaleState['status']) => {
    switch (localeStatus) {
      case 'complete':
        return 'border-green-500/50 bg-green-500/5'
      case 'processing':
        return 'border-amber-500/50 bg-amber-500/5'
      case 'error':
        return 'border-red-500/50 bg-red-500/5'
      default:
        return 'border-[var(--color-border)]'
    }
  }

  const getLocaleName = (code: string) => APP_STORE_LOCALES[code] || code

  const handleCancel = () => {
    setIsCancelling(true)
    router.push(`/localization/${appId}`)
  }

  // Loading state
  if (!isReady) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-48 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
          <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded mt-2 animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          {isResume ? 'Resuming Localizations' : 'Generating Localizations'}
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          {completedLocales} of {totalLocales} languages complete for {appName}
        </p>
      </div>

      {/* Progress card */}
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

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Locale grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedLocales.map((locale) => (
          <div
            key={locale.locale}
            className={`
              flex items-center gap-3 p-3 rounded-lg border transition-colors
              ${getStatusClasses(locale.status)}
            `}
          >
            {/* Status icon */}
            {locale.status === 'pending' && (
              <div className="h-4 w-4 rounded-full border-2 border-[var(--color-border)] shrink-0" />
            )}
            {locale.status === 'processing' && (
              <Spinner className="h-4 w-4 shrink-0" />
            )}
            {locale.status === 'complete' && (
              <svg
                className="h-4 w-4 text-green-500 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            )}
            {locale.status === 'error' && (
              <svg
                className="h-4 w-4 text-red-500 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
              </svg>
            )}

            <span className="text-sm text-[var(--color-content)] truncate">
              {getLocaleName(locale.locale)}
            </span>
          </div>
        ))}
      </div>

      {/* Cancel button */}
      <div className="flex justify-center">
        <Button
          variant="ghost"
          onClick={handleCancel}
          disabled={isCancelling}
        >
          {isCancelling ? 'Cancelling...' : 'Cancel'}
        </Button>
      </div>
    </div>
  )
}
