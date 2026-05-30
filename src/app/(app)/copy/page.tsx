"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AppSelector } from "@/components/apps/app-selector"
import type { ASCApp } from "@/lib/appstore"

const VERSION_FIELDS = [
  { id: "description", label: "Description" },
  { id: "keywords", label: "Keywords" },
  { id: "promotionalText", label: "Promotional Text" },
  { id: "whatsNew", label: "What's New" },
]

const APP_INFO_FIELDS = [
  { id: "name", label: "App Name" },
  { id: "subtitle", label: "Subtitle" },
]

interface VersionConfig {
  sourceVersion: { id: string; versionString: string }
  targetVersion: { id: string; versionString: string }
}

export default function CopyPage() {
  const router = useRouter()

  const [hasCreds, setHasCreds] = useState(true)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [app, setApp] = useState<ASCApp | null>(null)

  const [versionConfig, setVersionConfig] = useState<VersionConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(false)
  const [configError, setConfigError] = useState<string | null>(null)

  const [selectedFields, setSelectedFields] = useState<Set<string>>(
    new Set(["description", "keywords", "promotionalText", "whatsNew"])
  )
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((d) => setHasCreds(!!d.ascConnected))
      .catch(() => setHasCreds(false))
  }, [])

  const loadVersionConfig = useCallback(async (appId: string) => {
    setConfigLoading(true)
    setConfigError(null)
    setVersionConfig(null)
    try {
      const res = await fetch(`/api/copy-jobs/config?appId=${encodeURIComponent(appId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load version info")
      setVersionConfig(data)
    } catch (e) {
      setConfigError(e instanceof Error ? e.message : "Failed to load version info")
    } finally {
      setConfigLoading(false)
    }
  }, [])

  const handleSelectApp = (picked: ASCApp) => {
    setApp(picked)
    setSelectorOpen(false)
    setSubmitError(null)
    loadVersionConfig(picked.id)
  }

  const toggleField = (id: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePreview = async () => {
    if (!app || selectedFields.size === 0) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch("/api/copy-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: app.id,
          appName: app.name,
          appIconUrl: app.iconUrl ?? null,
          fieldsToCopy: [...selectedFields],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create copy job")
      router.push(`/copy/${data.jobId}/preview`)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Failed to start. Please try again.")
      setSubmitting(false)
    }
  }

  const canPreview = !!app && !!versionConfig && selectedFields.size > 0 && !configError

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Copy Metadata
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          Copy metadata fields from your previous release into the new version.
        </p>
      </div>

      {submitError && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{submitError}</p>
        </div>
      )}

      {/* App picker */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {app?.iconUrl ? (
              <Image
                src={app.iconUrl}
                alt={app.name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-hover)] shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-content)] truncate">
                {app ? app.name : "No app selected"}
              </p>
              <p className="text-xs text-[var(--color-content-muted)] truncate">
                {app ? app.bundleId : "Pick an app to continue"}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setSelectorOpen(true)}>
            {app ? "Change" : "Select App"}
          </Button>
        </div>

        {/* Version info */}
        {app && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            {configLoading && (
              <p className="text-sm text-[var(--color-content-muted)]">
                Loading version info…
              </p>
            )}
            {configError && (
              <p className="text-sm text-red-500">{configError}</p>
            )}
            {versionConfig && !configLoading && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-[var(--color-content-secondary)] bg-[var(--color-surface-tertiary)] px-2 py-0.5 rounded">
                  {versionConfig.sourceVersion.versionString}
                </span>
                <svg className="h-4 w-4 text-[var(--color-content-muted)]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
                </svg>
                <span className="font-mono text-[var(--color-content)] bg-[var(--color-surface-tertiary)] px-2 py-0.5 rounded">
                  {versionConfig.targetVersion.versionString}
                </span>
                <span className="text-[var(--color-content-muted)] text-xs ml-1">
                  (copy from → copy to)
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Field selection */}
      {app && !configError && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-[var(--color-content)]">
              Fields to copy
            </h2>
            <p className="text-xs text-[var(--color-content-muted)] mt-1">
              {selectedFields.size} selected
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-content-tertiary)] mb-2">
                Version Metadata
              </p>
              <div className="space-y-2">
                {VERSION_FIELDS.map((f) => {
                  const checked = selectedFields.has(f.id)
                  return (
                    <div
                      key={f.id}
                      role="checkbox"
                      tabIndex={0}
                      aria-checked={checked}
                      onClick={() => toggleField(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          toggleField(f.id)
                        }
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        checked
                          ? "border-[var(--color-content)] bg-[var(--color-content)]/5"
                          : "border-[var(--color-border)] hover:border-[var(--color-content-muted)]"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        aria-label={`Select ${f.label}`}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleField(f.id)}
                      />
                      <span className="text-sm text-[var(--color-content)]">{f.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-content-tertiary)] mb-2">
                App Info
              </p>
              <div className="space-y-2">
                {APP_INFO_FIELDS.map((f) => {
                  const checked = selectedFields.has(f.id)
                  return (
                    <div
                      key={f.id}
                      role="checkbox"
                      tabIndex={0}
                      aria-checked={checked}
                      onClick={() => toggleField(f.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          toggleField(f.id)
                        }
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                        checked
                          ? "border-[var(--color-content)] bg-[var(--color-content)]/5"
                          : "border-[var(--color-border)] hover:border-[var(--color-content-muted)]"
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        aria-label={`Select ${f.label}`}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleField(f.id)}
                      />
                      <span className="text-sm text-[var(--color-content)]">{f.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {canPreview && (
        <Button
          onClick={handlePreview}
          disabled={submitting}
          className="w-full h-12"
        >
          {submitting ? "Loading preview…" : "Preview Copy"}
        </Button>
      )}

      <AppSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleSelectApp}
        selectedAppIds={[]}
        hasASCCredentials={hasCreds}
      />
    </div>
  )
}
