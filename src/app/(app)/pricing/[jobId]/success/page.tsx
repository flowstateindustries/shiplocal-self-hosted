"use client"

import { useEffect, useState, use } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  CheckCircle2,
  Sparkles,
  ExternalLink,
  ArrowRight,
} from "lucide-react"
import { Button } from "@/components/ui"
import { getTerritoryName } from "@/lib/pricing/ppp-data"
import type { PricingJob } from "@/lib/database/types"

export default function PricingSuccessPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = use(params)
  const [job, setJob] = useState<PricingJob | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/pricing-jobs/${jobId}`)
      .then((r) => r.json())
      .then((data) => setJob(data.job ?? null))
      .catch(() => setJob(null))
      .finally(() => setIsLoading(false))
  }, [jobId])

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

  const productCount = job?.results?.products.length ?? 0
  const territoryCount =
    job?.results?.products.reduce((s, p) => s + p.territories.length, 0) ?? 0

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      {/* Header */}
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
          Prices Pushed!
        </h1>
        <p className="text-[var(--color-content-secondary)] text-lg">
          Your affordability pricing is now live in App Store Connect
        </p>
      </div>

      {/* Summary */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
        <div className="flex items-center gap-4">
          {job?.app_icon_url ? (
            <Image
              src={job.app_icon_url}
              alt={job.app_name}
              width={64}
              height={64}
              className="w-16 h-16 rounded-xl"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-[var(--color-surface-hover)]" />
          )}
          <div className="min-w-0">
            <h2 className="text-xl font-semibold text-[var(--color-content)] truncate">
              {job?.app_name ?? "App"}
            </h2>
            {job && (
              <p className="text-sm text-[var(--color-content-secondary)]">
                Base territory {getTerritoryName(job.base_territory)}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[var(--color-border)]">
          <div className="text-center p-4 rounded-lg bg-[var(--color-surface-tertiary)]">
            <div className="text-3xl font-bold text-[var(--color-content)]">
              {productCount}
            </div>
            <div className="text-sm text-[var(--color-content-secondary)]">
              Product{productCount === 1 ? "" : "s"} updated
            </div>
          </div>
          <div className="text-center p-4 rounded-lg bg-[var(--color-surface-tertiary)]">
            <div className="text-3xl font-bold text-[var(--color-content)]">
              {territoryCount}
            </div>
            <div className="text-sm text-[var(--color-content-secondary)]">
              Territory prices changed
            </div>
          </div>
        </div>

        <p className="text-xs text-[var(--color-content-muted)]">
          Changes may take a few minutes to appear in App Store Connect.
          Developed markets and unlisted territories keep their standard price.
        </p>
      </div>

      {/* Actions */}
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
          <Link href="/pricing" className="w-full">
            <Button variant="outline" className="w-full">
              Price Another App
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link href={`/pricing/${jobId}/preview`} className="w-full">
            <Button variant="outline" className="w-full">
              View Prices
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
