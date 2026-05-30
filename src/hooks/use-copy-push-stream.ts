'use client'

import { useState, useCallback, useRef } from 'react'

export type LocalePushStatus = 'pending' | 'pushing' | 'complete' | 'failed'

export interface CopyPushState {
  status: 'idle' | 'connecting' | 'pushing' | 'complete' | 'error'
  localeStates: Record<string, { status: LocalePushStatus; error?: string }>
  completedCount: number
  totalCount: number
  progress: number
  successCount: number
  failedCount: number
  error: string | null
}

interface PushEvent {
  type: string
  locale?: string
  localeName?: string
  progress?: number
  totalLocales?: number
  completedLocales?: number
  message?: string
  error?: string
  successCount?: number
  failedCount?: number
}

interface UseCopyPushStreamOptions {
  onComplete?: (successCount: number, failedCount: number) => void
  onError?: (error: string) => void
}

export function useCopyPushStream(
  jobId: string,
  options: UseCopyPushStreamOptions = {}
) {
  const [state, setState] = useState<CopyPushState>({
    status: 'idle',
    localeStates: {},
    completedCount: 0,
    totalCount: 0,
    progress: 0,
    successCount: 0,
    failedCount: 0,
    error: null,
  })

  const esRef = useRef<EventSource | null>(null)
  const { onComplete, onError } = options

  const connect = useCallback(() => {
    if (esRef.current) return

    setState((s) => ({ ...s, status: 'connecting', error: null }))

    const es = new EventSource(`/api/copy-jobs/${jobId}/push`)
    esRef.current = es

    es.onmessage = (e) => {
      try {
        const event: PushEvent = JSON.parse(e.data)

        if (event.type === 'starting') {
          setState((s) => ({
            ...s,
            status: 'pushing',
            totalCount: event.totalLocales ?? 0,
          }))
        } else if (event.type === 'locale_start' && event.locale) {
          setState((s) => ({
            ...s,
            localeStates: {
              ...s.localeStates,
              [event.locale!]: { status: 'pushing' },
            },
          }))
        } else if (event.type === 'locale_complete' && event.locale) {
          setState((s) => ({
            ...s,
            completedCount: event.completedLocales ?? s.completedCount,
            progress: event.progress ?? s.progress,
            localeStates: {
              ...s.localeStates,
              [event.locale!]: { status: 'complete' },
            },
          }))
        } else if (event.type === 'locale_error' && event.locale) {
          setState((s) => ({
            ...s,
            completedCount: event.completedLocales ?? s.completedCount,
            progress: event.progress ?? s.progress,
            localeStates: {
              ...s.localeStates,
              [event.locale!]: { status: 'failed', error: event.error },
            },
          }))
        } else if (event.type === 'complete') {
          const sc = event.successCount ?? 0
          const fc = event.failedCount ?? 0
          setState((s) => ({
            ...s,
            status: 'complete',
            progress: 100,
            successCount: sc,
            failedCount: fc,
          }))
          es.close()
          esRef.current = null
          onComplete?.(sc, fc)
        } else if (event.type === 'error') {
          const msg = event.error ?? 'Unknown error'
          setState((s) => ({ ...s, status: 'error', error: msg }))
          es.close()
          esRef.current = null
          onError?.(msg)
        }
      } catch {
        // ignore parse errors
      }
    }

    es.onerror = () => {
      const msg = 'Connection lost. Please try again.'
      setState((s) => ({ ...s, status: 'error', error: msg }))
      es.close()
      esRef.current = null
      onError?.(msg)
    }
  }, [jobId, onComplete, onError])

  return { ...state, connect }
}
