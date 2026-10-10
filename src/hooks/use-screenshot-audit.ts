"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LocaleAudit } from "@/lib/appstore/screenshots"
import type { ScreenshotAuditEvent } from "@/app/api/screenshot-audit/stream/route"

export type ScreenshotAuditStatus =
  | "idle"
  | "connecting"
  | "scanning"
  | "complete"
  | "error"

interface AuditState {
  /** `versionId:runId` — identifies the run this state belongs to. */
  key: string
  status: ScreenshotAuditStatus
  /** Locale codes in the order the server discovered them. */
  localeOrder: string[]
  results: Record<string, LocaleAudit>
  completed: number
  total: number
  error: string | null
}

function initialState(key: string, versionId: string | null): AuditState {
  return {
    key,
    status: versionId ? "connecting" : "idle",
    localeOrder: [],
    results: {},
    completed: 0,
    total: 0,
    error: null,
  }
}

/**
 * Connect to the screenshot-audit SSE stream for a version and accumulate
 * per-locale results as they arrive. Purely a live view — nothing is persisted,
 * so leaving the page and coming back re-scans.
 */
export function useScreenshotAudit(versionId: string | null) {
  const [runId, setRunId] = useState(0)
  const key = `${versionId ?? ""}:${runId}`

  const [state, setState] = useState<AuditState>(() =>
    initialState(key, versionId)
  )
  // Reset during render when the version (or the rescan counter) changes, so a
  // new run never shows the previous run's rows.
  if (state.key !== key) setState(initialState(key, versionId))

  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (!versionId) return

    const es = new EventSource(
      `/api/screenshot-audit/stream?versionId=${encodeURIComponent(versionId)}`
    )
    eventSourceRef.current = es
    let finished = false

    es.onmessage = (event) => {
      let data: ScreenshotAuditEvent
      try {
        data = JSON.parse(event.data)
      } catch (e) {
        console.error("Error parsing screenshot audit SSE event:", e)
        return
      }

      switch (data.type) {
        case "starting":
          setState((prev) => ({
            ...prev,
            status: "scanning",
            localeOrder: data.locales ?? [],
            total: data.total ?? 0,
          }))
          break
        case "locale":
          if (!data.locale) break
          setState((prev) => ({
            ...prev,
            status: "scanning",
            results: { ...prev.results, [data.locale!.locale]: data.locale! },
            completed: data.completed ?? prev.completed,
            total: data.total ?? prev.total,
          }))
          break
        case "complete":
          finished = true
          setState((prev) => ({ ...prev, status: "complete" }))
          es.close()
          eventSourceRef.current = null
          break
        case "error":
          finished = true
          setState((prev) => ({
            ...prev,
            status: "error",
            error: data.error ?? "Failed to read screenshots",
          }))
          es.close()
          eventSourceRef.current = null
          break
        case "heartbeat":
          break
      }
    }

    es.onerror = () => {
      if (finished) return
      finished = true
      setState((prev) => ({
        ...prev,
        status: "error",
        error: "Connection to server lost",
      }))
      es.close()
      eventSourceRef.current = null
    }

    return () => {
      finished = true
      es.close()
      eventSourceRef.current = null
    }
  }, [versionId, runId])

  const rescan = useCallback(() => setRunId((n) => n + 1), [])

  return {
    status: state.status,
    localeOrder: state.localeOrder,
    results: state.results,
    completed: state.completed,
    total: state.total,
    error: state.error,
    rescan,
  }
}
