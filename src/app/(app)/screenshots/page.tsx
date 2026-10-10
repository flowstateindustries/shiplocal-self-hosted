"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { AppSelector } from "@/components/apps/app-selector"
import { useScreenshotAudit } from "@/hooks/use-screenshot-audit"
import { APP_STORE_LOCALES } from "@/lib/localization/constants"
import { SCREENSHOT_LIMIT } from "@/lib/appstore/screenshots"
import type { AuditVersion, LocaleAudit, ScreenshotSetAudit } from "@/lib/appstore/screenshots"
import type { ASCApp } from "@/lib/appstore"

const STATE_LABELS: Record<string, string> = {
  AWAITING_UPLOAD: "Awaiting upload",
  UPLOAD_COMPLETE: "Processing",
  FAILED: "Failed",
  COMPLETE: "Complete",
}

/** AWAITING_UPLOAD and FAILED are the entries that block a submission invisibly. */
function stateVariant(state: string): "error" | "info" | "warning" | "default" {
  if (state === "AWAITING_UPLOAD" || state === "FAILED") return "error"
  if (state === "UPLOAD_COMPLETE") return "info"
  if (state === "COMPLETE") return "default"
  return "warning"
}

function stateLabel(state: string): string {
  return STATE_LABELS[state] ?? state
}

function formatAppStoreState(state: string): string {
  if (!state) return ""
  return state
    .toLowerCase()
    .split("_")
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ")
}

function isFlagged(audit: LocaleAudit): boolean {
  return !!audit.error || audit.setsOverLimit > 0 || audit.ghosts > 0
}

export default function ScreenshotAuditPage() {
  const [hasCreds, setHasCreds] = useState(true)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [app, setApp] = useState<ASCApp | null>(null)

  const [versions, setVersions] = useState<AuditVersion[]>([])
  const [versionId, setVersionId] = useState<string>("")
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionsError, setVersionsError] = useState<string | null>(null)

  const [onlyProblems, setOnlyProblems] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const { status, localeOrder, results, completed, total, error, rescan } =
    useScreenshotAudit(versionId || null)

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((d) => setHasCreds(!!d.ascConnected))
      .catch(() => setHasCreds(false))
  }, [])

  const loadVersions = useCallback(async (appId: string) => {
    setVersionsLoading(true)
    setVersionsError(null)
    setVersions([])
    setVersionId("")
    try {
      const res = await fetch(
        `/api/screenshot-audit/versions?appId=${encodeURIComponent(appId)}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load versions")
      const loaded: AuditVersion[] = data.versions ?? []
      setVersions(loaded)
      // Default to the version being prepared; fall back to the newest.
      const preferred = loaded.find((v) => v.editable) ?? loaded[0]
      setVersionId(preferred?.id ?? "")
      if (loaded.length === 0) {
        setVersionsError("This app has no App Store versions.")
      }
    } catch (e) {
      setVersionsError(e instanceof Error ? e.message : "Failed to load versions")
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  const handleSelectApp = (picked: ASCApp) => {
    setApp(picked)
    setSelectorOpen(false)
    setExpanded({})
    loadVersions(picked.id)
  }

  const handleVersionChange = (nextId: string) => {
    setVersionId(nextId)
    setExpanded({})
  }

  const selectedVersion = versions.find((v) => v.id === versionId) ?? null
  const platforms = useMemo(
    () => [...new Set(versions.map((v) => v.platform).filter(Boolean))],
    [versions]
  )

  const audits = useMemo(() => {
    const order = localeOrder.length > 0 ? localeOrder : Object.keys(results).sort()
    return order.map((locale) => ({ locale, audit: results[locale] ?? null }))
  }, [localeOrder, results])

  const summary = useMemo(() => {
    const scanned = Object.values(results)
    return {
      screenshots: scanned.reduce((sum, a) => sum + a.total, 0),
      setsOverLimit: scanned.reduce((sum, a) => sum + a.setsOverLimit, 0),
      localesOverLimit: scanned.filter((a) => a.setsOverLimit > 0).length,
      ghosts: scanned.reduce((sum, a) => sum + a.ghosts, 0),
      processing: scanned.reduce(
        (sum, a) => sum + a.sets.reduce((s, set) => s + set.processing, 0),
        0
      ),
      failedLocales: scanned.filter((a) => !!a.error).length,
    }
  }, [results])

  const visible = onlyProblems
    ? audits.filter(({ audit }) => audit && isFlagged(audit))
    : audits

  const scanning = status === "connecting" || status === "scanning"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Screenshot Audit
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          How many screenshots App Store Connect actually holds for each locale
          and display size — including the reservations the web UI hides.
        </p>
      </div>

      {/* App picker + version */}
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

        {app && (
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            {versionsLoading && (
              <p className="text-sm text-[var(--color-content-muted)]">
                Loading versions…
              </p>
            )}
            {versionsError && <p className="text-sm text-red-500">{versionsError}</p>}
            {!versionsLoading && versions.length > 0 && (
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex-1 min-w-[220px]">
                  <label
                    htmlFor="audit-version"
                    className="text-sm font-medium text-[var(--color-content)]"
                  >
                    Version
                  </label>
                  <p className="text-xs text-[var(--color-content-muted)] mt-1 mb-2">
                    Defaults to the version you&apos;re preparing.
                  </p>
                  <select
                    id="audit-version"
                    value={versionId}
                    onChange={(e) => handleVersionChange(e.target.value)}
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] px-3 py-2 text-sm text-[var(--color-content)] focus:outline-none"
                  >
                    {platforms.length > 1
                      ? platforms.map((platform) => (
                          <optgroup key={platform} label={platform}>
                            {versions
                              .filter((v) => v.platform === platform)
                              .map((v) => (
                                <option key={v.id} value={v.id}>
                                  {v.versionString} — {formatAppStoreState(v.appStoreState)}
                                </option>
                              ))}
                          </optgroup>
                        ))
                      : versions.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.versionString} — {formatAppStoreState(v.appStoreState)}
                          </option>
                        ))}
                  </select>
                </div>
                <Button
                  variant="outline"
                  onClick={rescan}
                  disabled={scanning || !versionId}
                >
                  {scanning ? "Scanning…" : "Rescan"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* Progress */}
      {versionId && scanning && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
          <div className="flex items-center justify-between text-sm">
            <p className="text-[var(--color-content)]">
              Reading App Store Connect…
            </p>
            <p className="text-[var(--color-content-muted)]">
              {total > 0 ? `${completed} of ${total} locales` : "Finding locales"}
            </p>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-[var(--color-surface-tertiary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-content)] transition-[width] duration-300"
              style={{ width: total > 0 ? `${(completed / total) * 100}%` : "5%" }}
            />
          </div>
        </div>
      )}

      {/* Summary */}
      {versionId && Object.keys(results).length > 0 && (
        <SummaryBanner
          scanning={scanning}
          version={selectedVersion}
          summary={summary}
        />
      )}

      {/* Locale list */}
      {versionId && audits.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-[var(--color-content)]">
              Locales
            </h2>
            <label className="flex items-center gap-2 text-xs text-[var(--color-content-secondary)] cursor-pointer">
              <Checkbox
                checked={onlyProblems}
                onCheckedChange={(checked) => setOnlyProblems(checked === true)}
                aria-label="Show only locales with problems"
              />
              Only show problems
            </label>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
              <p className="text-sm text-[var(--color-content-muted)]">
                No locales with problems.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map(({ locale, audit }) => (
                <LocaleRow
                  key={locale}
                  locale={locale}
                  audit={audit}
                  expanded={
                    expanded[locale] ?? (audit ? isFlagged(audit) : false)
                  }
                  onToggle={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [locale]: !(
                        prev[locale] ?? (audit ? isFlagged(audit) : false)
                      ),
                    }))
                  }
                />
              ))}
            </div>
          )}
        </div>
      )}

      {versionId && status === "complete" && (
        <p className="text-xs text-[var(--color-content-muted)]">
          Read-only — this page never deletes, changes, or uploads anything.
          Screenshot sets attached to custom product pages or A/B test
          treatments are separate resources and are not counted here.
        </p>
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

interface Summary {
  screenshots: number
  setsOverLimit: number
  localesOverLimit: number
  ghosts: number
  processing: number
  failedLocales: number
}

function SummaryBanner({
  scanning,
  version,
  summary,
}: {
  scanning: boolean
  version: AuditVersion | null
  summary: Summary
}) {
  const over = summary.setsOverLimit > 0
  const ghosts = summary.ghosts > 0

  const tone = over
    ? "border-red-500/50 bg-red-500/10"
    : ghosts
      ? "border-amber-500/50 bg-amber-500/10"
      : "border-green-500/40 bg-green-500/10"

  const headline = over
    ? `${summary.setsOverLimit} ${summary.setsOverLimit === 1 ? "set is" : "sets are"} over the limit of ${SCREENSHOT_LIMIT}`
    : ghosts
      ? `${summary.ghosts} incomplete ${summary.ghosts === 1 ? "screenshot" : "screenshots"} found`
      : "Nothing over the limit"

  const headlineColor = over
    ? "text-red-500"
    : ghosts
      ? "text-amber-500"
      : "text-green-500"

  return (
    <div className={`rounded-xl border p-6 ${scanning ? "border-[var(--color-border)] bg-[var(--color-surface-secondary)]" : tone}`}>
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className={`text-sm font-medium ${scanning ? "text-[var(--color-content)]" : headlineColor}`}>
          {scanning ? "Scanning…" : headline}
        </p>
        {version && (
          <span className="font-mono text-xs text-[var(--color-content-secondary)] bg-[var(--color-surface-tertiary)] px-2 py-0.5 rounded">
            {version.versionString}
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Screenshots" value={summary.screenshots} />
        <Stat
          label="Sets over limit"
          value={summary.setsOverLimit}
          emphasis={summary.setsOverLimit > 0 ? "error" : undefined}
        />
        <Stat
          label="Ghost entries"
          value={summary.ghosts}
          emphasis={summary.ghosts > 0 ? "error" : undefined}
        />
        <Stat label="Still processing" value={summary.processing} />
      </div>

      {!scanning && over && (
        <p className="text-xs text-[var(--color-content-secondary)] mt-4">
          App Store Connect counts every entry below, including ones it won&apos;t
          show you. Any set over {SCREENSHOT_LIMIT} will fail &ldquo;Add for
          Review&rdquo; with &ldquo;You have uploaded too many screenshots.&rdquo;
          Delete the incomplete entries in the locales flagged below.
        </p>
      )}

      {summary.failedLocales > 0 && (
        <p className="text-xs text-amber-500 mt-3">
          {summary.failedLocales}{" "}
          {summary.failedLocales === 1 ? "locale" : "locales"} could not be read
          — counts for those are unknown.
        </p>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string
  value: number
  emphasis?: "error"
}) {
  return (
    <div>
      <p
        className={`text-xl font-semibold ${
          emphasis === "error" ? "text-red-500" : "text-[var(--color-content)]"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-[var(--color-content-muted)]">{label}</p>
    </div>
  )
}

function LocaleRow({
  locale,
  audit,
  expanded,
  onToggle,
}: {
  locale: string
  audit: LocaleAudit | null
  expanded: boolean
  onToggle: () => void
}) {
  const localeName = APP_STORE_LOCALES[locale] || locale
  const pending = !audit

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        disabled={pending}
        aria-expanded={expanded}
        className="w-full flex items-center gap-3 p-4 text-left cursor-pointer disabled:cursor-default hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <svg
          className={`h-4 w-4 shrink-0 text-[var(--color-content-muted)] transition-transform ${expanded ? "rotate-90" : ""} ${pending ? "opacity-0" : ""}`}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
        </svg>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--color-content)] truncate">
            {localeName}
          </p>
          <p className="font-mono text-xs text-[var(--color-content-muted)]">
            {locale}
          </p>
        </div>

        {pending ? (
          <span className="text-xs text-[var(--color-content-muted)]">
            Waiting…
          </span>
        ) : audit.error ? (
          <Badge variant="warning">Could not read</Badge>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            {audit.setsOverLimit > 0 && (
              <Badge variant="error">
                {audit.setsOverLimit} over limit
              </Badge>
            )}
            {audit.ghosts > 0 && (
              <Badge variant="error">
                {audit.ghosts} ghost{audit.ghosts === 1 ? "" : "s"}
              </Badge>
            )}
            <span className="text-xs text-[var(--color-content-secondary)] whitespace-nowrap">
              {audit.total} in {audit.sets.length}{" "}
              {audit.sets.length === 1 ? "set" : "sets"}
            </span>
          </div>
        )}
      </button>

      {expanded && audit && (
        <div className="border-t border-[var(--color-border)] p-4 space-y-3">
          {audit.error && <p className="text-sm text-amber-500">{audit.error}</p>}
          {!audit.error && audit.sets.length === 0 && (
            <p className="text-sm text-[var(--color-content-muted)]">
              No screenshot sets for this locale.
            </p>
          )}
          {audit.sets.map((set) => (
            <SetRow key={set.id} set={set} />
          ))}
        </div>
      )}
    </div>
  )
}

function SetRow({ set }: { set: ScreenshotSetAudit }) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        set.overLimit
          ? "border-red-500/50 bg-red-500/5"
          : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm text-[var(--color-content)]">{set.label}</p>
          <p className="font-mono text-[11px] text-[var(--color-content-muted)]">
            {set.displayType}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {set.awaitingUpload > 0 && (
            <Badge variant="error">{set.awaitingUpload} awaiting upload</Badge>
          )}
          {set.failed > 0 && <Badge variant="error">{set.failed} failed</Badge>}
          {set.processing > 0 && (
            <Badge variant="info">{set.processing} processing</Badge>
          )}
          <span
            className={`font-mono text-sm ${
              set.overLimit
                ? "text-red-500 font-semibold"
                : "text-[var(--color-content-secondary)]"
            }`}
          >
            {set.total} / {SCREENSHOT_LIMIT}
          </span>
        </div>
      </div>

      {set.incomplete.length > 0 && (
        <div className="mt-3 border-t border-[var(--color-border)] pt-3 space-y-2">
          {set.incomplete.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 text-xs">
              <Badge variant={stateVariant(entry.state)}>
                {stateLabel(entry.state)}
              </Badge>
              <div className="min-w-0">
                <p className="font-mono text-[var(--color-content-secondary)] break-all">
                  {entry.fileName}
                </p>
                {entry.errors.map((message, i) => (
                  <p key={i} className="text-red-500 mt-0.5">
                    {message}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
