'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Loader2 } from 'lucide-react'
import type { LocaleResultStatus } from '@/lib/database/types'
import { getPendingLocales } from '@/lib/localization/job-utils'

interface ResumeButtonProps {
  jobId: string
  appId: string
  targetLocales: string[]
  localeResults: Record<string, LocaleResultStatus> | null
  status: string
}

/**
 * Button to resume a failed/interrupted localization job
 * Shows "Resume (N remaining)" for jobs with pending locales
 * Only shows for failed or interrupted jobs
 */
export function ResumeButton({
  jobId,
  appId,
  targetLocales,
  localeResults,
  status,
}: ResumeButtonProps) {
  const router = useRouter()
  const [isNavigating, setIsNavigating] = useState(false)

  // Only show for failed or interrupted jobs
  if (status !== 'failed' && status !== 'interrupted') {
    return null
  }

  const pendingLocales = getPendingLocales(targetLocales, localeResults)
  const remainingCount = pendingLocales.length

  // Don't show if no locales need processing
  if (remainingCount === 0) {
    return null
  }

  const handleResume = () => {
    setIsNavigating(true)
    // Navigate to generating page with resume flag
    router.push(`/localization/${appId}/generating?jobId=${jobId}&resume=true`)
  }

  return (
    <button
      onClick={handleResume}
      disabled={isNavigating}
      className="w-full h-12 inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-medium text-black bg-white hover:bg-gray-100 active:bg-gray-200 active:scale-[0.98] rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {isNavigating ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Resuming...
        </>
      ) : (
        <>
          <RefreshCw className="w-4 h-4" />
          {status === 'failed' ? 'Retry' : 'Resume'} ({remainingCount} remaining)
        </>
      )}
    </button>
  )
}
