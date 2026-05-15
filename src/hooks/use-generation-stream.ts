"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { StreamEvent, LocalizationOutput, AppInfoOutput } from "@/lib/ai/types"

export type GenerationStatus = 'idle' | 'connecting' | 'generating' | 'complete' | 'error'

export interface LocaleState {
  locale: string
  localeName: string
  status: 'pending' | 'processing' | 'complete' | 'error'
  data?: LocalizationOutput
  appInfo?: AppInfoOutput
  error?: string
}

export interface GenerationState {
  status: GenerationStatus
  progress: number
  totalLocales: number
  completedLocales: number
  locales: Record<string, LocaleState>
  error?: string
}

interface UseGenerationStreamOptions {
  onComplete?: () => void
  onError?: (error: string) => void
  autoStart?: boolean
  useResumeEndpoint?: boolean  // Use /resume endpoint instead of /stream for resuming partial jobs
}

/**
 * Hook for connecting to the localization generation SSE stream
 */
export function useGenerationStream(
  jobId: string | null,
  targetLocales: string[] = [],
  options: UseGenerationStreamOptions = {}
) {
  const { onComplete, onError, autoStart = true, useResumeEndpoint = false } = options
  const eventSourceRef = useRef<EventSource | null>(null)
  const hasStartedRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)

  // Use refs for callbacks to avoid effect dependency issues
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  })

  const [state, setState] = useState<GenerationState>(() => ({
    status: 'idle',
    progress: 0,
    totalLocales: targetLocales.length,
    completedLocales: 0,
    locales: Object.fromEntries(
      targetLocales.map(locale => [
        locale,
        { locale, localeName: locale, status: 'pending' as const }
      ])
    ),
  }))

  // Connect to the stream
  const connect = useCallback(() => {
    if (!jobId || eventSourceRef.current) return

    setState(prev => ({ ...prev, status: 'connecting' }))

    // Use resume endpoint if specified (for resuming partial/failed jobs)
    const endpoint = useResumeEndpoint
      ? `/api/localization-jobs/${jobId}/resume`
      : `/api/localization-jobs/${jobId}/stream`
    const eventSource = new EventSource(endpoint)
    eventSourceRef.current = eventSource
    setIsConnected(true)

    eventSource.onopen = () => {
      setState(prev => ({ ...prev, status: 'generating' }))
    }

    eventSource.onmessage = (event) => {
      try {
        const data: StreamEvent = JSON.parse(event.data)

        switch (data.type) {
          case 'starting':
            setState(prev => ({
              ...prev,
              status: 'generating',
              progress: data.progress || 0,
              totalLocales: data.totalLocales || prev.totalLocales,
              completedLocales: data.completedLocales || 0,
            }))
            break

          case 'locale_start':
            if (data.locale) {
              setState(prev => ({
                ...prev,
                progress: data.progress || prev.progress,
                completedLocales: data.completedLocales || prev.completedLocales,
                locales: {
                  ...prev.locales,
                  [data.locale!]: {
                    ...prev.locales[data.locale!],
                    locale: data.locale!,
                    localeName: data.localeName || data.locale!,
                    status: 'processing',
                  },
                },
              }))
            }
            break

          case 'locale_complete':
            if (data.locale) {
              setState(prev => ({
                ...prev,
                progress: data.progress || prev.progress,
                completedLocales: data.completedLocales || prev.completedLocales,
                locales: {
                  ...prev.locales,
                  [data.locale!]: {
                    locale: data.locale!,
                    localeName: data.localeName || data.locale!,
                    status: 'complete',
                    data: data.data,
                    appInfo: data.appInfo,
                  },
                },
              }))
            }
            break

          case 'locale_error':
            if (data.locale) {
              setState(prev => ({
                ...prev,
                progress: data.progress || prev.progress,
                completedLocales: data.completedLocales || prev.completedLocales,
                locales: {
                  ...prev.locales,
                  [data.locale!]: {
                    ...prev.locales[data.locale!],
                    locale: data.locale!,
                    localeName: data.localeName || data.locale!,
                    status: 'error',
                    error: data.error,
                  },
                },
              }))
            }
            break

          case 'complete':
            setState(prev => ({
              ...prev,
              status: 'complete',
              progress: 100,
              completedLocales: data.completedLocales || prev.totalLocales,
            }))
            eventSource.close()
            eventSourceRef.current = null
            setIsConnected(false)
            onCompleteRef.current?.()
            break

          case 'error':
            setState(prev => ({
              ...prev,
              status: 'error',
              error: data.error,
            }))
            eventSource.close()
            eventSourceRef.current = null
            setIsConnected(false)
            onErrorRef.current?.(data.error || 'Unknown error')
            break

          case 'cancelled':
            setState(prev => ({
              ...prev,
              status: 'error',
              error: data.message || 'Job was cancelled',
            }))
            eventSource.close()
            eventSourceRef.current = null
            setIsConnected(false)
            onErrorRef.current?.(data.message || 'Job was cancelled')
            break

          case 'heartbeat':
            // Keepalive ping from server - no state update needed
            break
        }
      } catch (parseError) {
        console.error('Error parsing SSE event:', parseError)
      }
    }

    eventSource.onerror = () => {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: 'Connection to server lost',
      }))
      eventSource.close()
      eventSourceRef.current = null
      setIsConnected(false)
      onErrorRef.current?.('Connection to server lost')
    }
  }, [jobId, useResumeEndpoint])  // Depends on jobId and endpoint type - callbacks accessed via refs

  // Disconnect from the stream
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [])

  // Reset state
  const reset = useCallback(() => {
    disconnect()
    hasStartedRef.current = false
    setState({
      status: 'idle',
      progress: 0,
      totalLocales: targetLocales.length,
      completedLocales: 0,
      locales: Object.fromEntries(
        targetLocales.map(locale => [
          locale,
          { locale, localeName: locale, status: 'pending' as const }
        ])
      ),
    })
  }, [disconnect, targetLocales])

  // Auto-connect on mount if autoStart is true
  useEffect(() => {
    if (autoStart && jobId && !hasStartedRef.current) {
      hasStartedRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- connect() needs to initiate SSE connection on mount
      connect()
    }
  }, [autoStart, jobId, connect])

  // Cleanup only on unmount (separate effect to avoid disconnect on re-renders)
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  // Update locales when targetLocales changes (supports late initialization)
  useEffect(() => {
    if (targetLocales.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync with prop changes for late initialization
      setState(prev => ({
        ...prev,
        totalLocales: targetLocales.length,
        locales: Object.fromEntries(
          targetLocales.map(locale => [
            locale,
            prev.locales[locale] || { locale, localeName: locale, status: 'pending' as const }
          ])
        ),
      }))
    }
  }, [targetLocales])

  return {
    ...state,
    connect,
    disconnect,
    reset,
    isConnected,
  }
}
