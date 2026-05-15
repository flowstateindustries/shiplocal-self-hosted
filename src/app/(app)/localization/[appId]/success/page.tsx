"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui"
import Link from "next/link"
import Image from "next/image"
import { CheckCircle2, ExternalLink, History, ArrowRight, Sparkles, AlertCircle } from "lucide-react"
import type { LocalizationJob } from "@/lib/database/types"

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const jobId = searchParams.get('jobId')

  const [job, setJob] = useState<LocalizationJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch job details
  useEffect(() => {
    if (!jobId) {
      toast.error('No job ID provided')
      router.push('/apps')
      return
    }

    async function fetchJob() {
      try {
        const response = await fetch(`/api/localization-jobs/${jobId}`)
        const data = await response.json()

        if (!response.ok || !data.job) {
          toast.error('Job not found')
          router.push('/apps')
          return
        }

        setJob(data.job)
      } catch (error) {
        console.error('Error fetching job:', error)
        toast.error('Failed to load job details')
      } finally {
        setIsLoading(false)
      }
    }

    fetchJob()
  }, [jobId, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse space-y-4 w-full max-w-md">
          <div className="h-16 w-16 bg-[var(--color-surface-tertiary)] rounded-full mx-auto" />
          <div className="h-6 w-48 bg-[var(--color-surface-tertiary)] rounded mx-auto" />
          <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded mx-auto" />
        </div>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-xl font-semibold text-[var(--color-content)]">
            Job Not Found
          </h1>
          <Button onClick={() => router.push('/apps')}>
            Back to Apps
          </Button>
        </div>
      </div>
    )
  }

  const localeCount = job.target_locales?.length || 0
  const pushedDate = job.pushed_at
    ? new Date(job.pushed_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Success Icon and Header */}
      <div className="text-center space-y-4">
        <div className="relative inline-block">
          <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10 text-green-500" />
          </div>
          <div className="absolute -top-1 -right-1">
            <Sparkles className="w-6 h-6 text-yellow-500" />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-[var(--color-content)]">
          Successfully Pushed!
        </h1>
        <p className="text-[var(--color-content-secondary)] text-lg">
          Your localizations are now live in App Store Connect
        </p>
      </div>

      {/* Summary Card */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
        <div className="flex items-center gap-4">
          {job.app_icon_url && (
            <Image
              src={job.app_icon_url}
              alt={job.app_name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-xl"
            />
          )}
          <div>
            <h2 className="text-xl font-semibold text-[var(--color-content)]">
              {job.app_name}
            </h2>
            {pushedDate && (
              <p className="text-sm text-[var(--color-content-secondary)]">
                Pushed on {pushedDate}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--color-border)]">
          <div className="text-center p-4 rounded-lg bg-[var(--color-surface-tertiary)]">
            <div className="text-3xl font-bold text-[var(--color-content)]">
              {localeCount}
            </div>
            <div className="text-sm text-[var(--color-content-secondary)]">
              Locales Pushed
            </div>
          </div>
          <div className="text-center p-4 rounded-lg bg-[var(--color-surface-tertiary)]">
            <div className="text-3xl font-bold text-[var(--color-content)]">
              {job.fields_localized?.length || 0}
            </div>
            <div className="text-sm text-[var(--color-content-secondary)]">
              Fields Localized
            </div>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
        <h3 className="font-semibold text-[var(--color-content)]">
          What&apos;s Next?
        </h3>
        <ul className="space-y-3 text-sm text-[var(--color-content-secondary)]">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>
              Your localizations are now in App Store Connect. Review them in the App Store Connect portal before submitting your app.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>
              Screenshots and preview videos are not included - you&apos;ll need to add those manually for each locale.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
            <span>
              Once you&apos;re satisfied, submit your app for review through App Store Connect.
            </span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        <a
          href="https://appstoreconnect.apple.com"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <Button className="w-full h-12" variant="primary">
            <ExternalLink className="w-4 h-4 mr-2" />
            Open App Store Connect
          </Button>
        </a>

        <div className="grid grid-cols-2 gap-3">
          <Link href="/history" className="w-full">
            <Button variant="outline" className="w-full">
              <History className="w-4 h-4 mr-2" />
              View History
            </Button>
          </Link>
          <Link href="/apps" className="w-full">
            <Button variant="outline" className="w-full">
              Localize Another App
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
