"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import type { CopyJob } from "@/lib/database/types"

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  keywords: "Keywords",
  promotionalText: "Promotional Text",
  whatsNew: "What's New",
  name: "App Name",
  subtitle: "Subtitle",
}

export default function CopySuccessPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<CopyJob | null>(null)

  useEffect(() => {
    fetch(`/api/copy-jobs/${jobId}`)
      .then((r) => r.json())
      .then((d) => setJob(d.job ?? null))
      .catch(() => null)
  }, [jobId])

  const localeCount = job?.results?.locales.length ?? 0
  const fieldCount = job?.fields_to_copy.filter((f) => FIELD_LABELS[f]).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
          <svg className="h-6 w-6 text-green-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-content)]">
            Copy Complete
          </h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-0.5">
            {job?.app_name ?? "Your app"} has been updated in App Store Connect.
          </p>
        </div>
      </div>

      {job && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-[var(--color-content-secondary)] bg-[var(--color-surface-tertiary)] px-2 py-0.5 rounded">
              {job.source_version_string}
            </span>
            <svg className="h-4 w-4 text-[var(--color-content-muted)]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
            </svg>
            <span className="font-mono text-[var(--color-content)] bg-[var(--color-surface-tertiary)] px-2 py-0.5 rounded">
              {job.target_version_string}
            </span>
          </div>

          <div className="flex gap-6 text-sm text-[var(--color-content-secondary)]">
            <div>
              <span className="text-2xl font-semibold text-[var(--color-content)]">{localeCount}</span>
              <span className="ml-1.5">locale{localeCount !== 1 ? "s" : ""} updated</span>
            </div>
            <div>
              <span className="text-2xl font-semibold text-[var(--color-content)]">{fieldCount}</span>
              <span className="ml-1.5">field{fieldCount !== 1 ? "s" : ""} copied</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {job.fields_to_copy.filter((f) => FIELD_LABELS[f]).map((f) => (
              <span
                key={f}
                className="text-xs bg-[var(--color-surface-hover)] text-[var(--color-content-secondary)] px-2 py-0.5 rounded"
              >
                {FIELD_LABELS[f]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={() => router.push("/copy")} className="flex-1 h-12">
          Copy Again
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard")}
          className="h-12"
        >
          Dashboard
        </Button>
      </div>
    </div>
  )
}
