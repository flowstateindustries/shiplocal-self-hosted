"use client"

import { use, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { APP_STORE_LOCALES } from "@/lib/localization/constants"
import type { CopyJob, CopyLocaleResult } from "@/lib/database/types"

const FIELD_LABELS: Record<string, string> = {
  description: "Description",
  keywords: "Keywords",
  promotionalText: "Promotional Text",
  whatsNew: "What's New",
  name: "App Name",
  subtitle: "Subtitle",
}

function truncate(text: string, max = 80) {
  return text.length > max ? text.slice(0, max) + "…" : text
}

export default function CopyPreviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<CopyJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/copy-jobs/${jobId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error)
        setJob(d.job)
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load job"))
      .finally(() => setLoading(false))
  }, [jobId])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-48 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
        <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
      </div>
    )
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">Preview</h1>
        <p className="text-sm text-red-500">{error ?? "Job not found"}</p>
        <Button onClick={() => router.push("/copy")}>Start Over</Button>
      </div>
    )
  }

  const locales: CopyLocaleResult[] = job.results?.locales ?? []
  const fieldsToCopy = job.fields_to_copy.filter((f) => FIELD_LABELS[f])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Preview Copy
        </h1>
        <div className="flex items-center gap-2 mt-1">
          <span className="font-mono text-sm text-[var(--color-content-secondary)] bg-[var(--color-surface-tertiary)] px-2 py-0.5 rounded">
            {job.source_version_string}
          </span>
          <svg className="h-4 w-4 text-[var(--color-content-muted)]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
          </svg>
          <span className="font-mono text-sm text-[var(--color-content)] bg-[var(--color-surface-tertiary)] px-2 py-0.5 rounded">
            {job.target_version_string}
          </span>
        </div>
        <p className="text-xs text-[var(--color-content-muted)] mt-2">
          {locales.length} locale{locales.length !== 1 ? "s" : ""} · {fieldsToCopy.length} field{fieldsToCopy.length !== 1 ? "s" : ""}
        </p>
      </div>

      {job.pushed_to_asc && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            This copy job has already been pushed to App Store Connect.
          </p>
        </div>
      )}

      {/* Locale table */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-4 py-3 font-medium text-[var(--color-content)] whitespace-nowrap">
                  Locale
                </th>
                {fieldsToCopy.map((f) => (
                  <th
                    key={f}
                    className="text-left px-4 py-3 font-medium text-[var(--color-content)] whitespace-nowrap"
                  >
                    {FIELD_LABELS[f]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {locales.map((loc, i) => (
                <tr
                  key={loc.locale}
                  className={`border-b border-[var(--color-border)] last:border-0 ${
                    i % 2 === 0 ? "" : "bg-[var(--color-surface-tertiary)]/30"
                  }`}
                >
                  <td className="px-4 py-3 text-[var(--color-content)] whitespace-nowrap">
                    <span className="font-mono text-xs bg-[var(--color-surface-hover)] px-1.5 py-0.5 rounded">
                      {loc.locale}
                    </span>
                    <span className="ml-2 text-[var(--color-content-muted)]">
                      {APP_STORE_LOCALES[loc.locale] ?? ""}
                    </span>
                  </td>
                  {fieldsToCopy.map((f) => {
                    const val = loc[f as keyof CopyLocaleResult] as string | undefined
                    return (
                      <td
                        key={f}
                        className="px-4 py-3 text-[var(--color-content-secondary)] max-w-[200px]"
                      >
                        {val ? (
                          <span title={val}>{truncate(val)}</span>
                        ) : (
                          <span className="text-[var(--color-content-muted)] italic">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        {!job.pushed_to_asc && (
          <Button
            onClick={() => router.push(`/copy/${jobId}/pushing`)}
            className="flex-1 h-12"
          >
            Copy to App Store Connect
          </Button>
        )}
        <Button
          variant="outline"
          onClick={() => router.push("/copy")}
          className={job.pushed_to_asc ? "flex-1 h-12" : "h-12"}
        >
          {job.pushed_to_asc ? "Copy Again" : "Cancel"}
        </Button>
      </div>
    </div>
  )
}
