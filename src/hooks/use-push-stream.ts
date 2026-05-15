"use client"

import { useState, useEffect, useCallback, useRef } from "react"

export type PushStatus = 'idle' | 'connecting' | 'preparing' | 'pushing' | 'complete' | 'error'

export interface PushLocaleState {
  locale: string
  localeName: string
  status: 'pending' | 'pushing' | 'complete' | 'error'
  error?: string
}

export interface PushResults {
  success: string[]
  failed: Array<{ locale: string; error: string }>
  created: string[]
  updated: string[]
  appLevelCreated: string[]
  appLevelUpdated: string[]
}

export interface PushState {
  status: PushStatus
  progress: number
  totalLocales: number
  completedLocales: number
  locales: Record<string, PushLocaleState>
  results: PushResults
  preparingMessage?: string
  error?: string
}

interface PushStreamEvent {
  type: 'starting' | 'preparing' | 'locale_start' | 'locale_complete' | 'locale_error' | 'complete' | 'error'
  locale?: string
  localeName?: string
  progress?: number
  totalLocales?: number
  completedLocales?: number
  message?: string
  results?: PushResults
  error?: string
}

interface UsePushStreamOptions {
  onComplete?: (results: PushResults) => void
  onError?: (error: string) => void
  autoStart?: boolean
}

/**
 * Hook for connecting to the localization push SSE stream
 */
export function usePushStream(
  jobId: string | null,
  targetLocales: string[] = [],
  options: UsePushStreamOptions = {}
) {
  const { onComplete, onError, autoStart = true } = options
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

  const [state, setState] = useState<PushState>(() => ({
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
    results: {
      success: [],
      failed: [],
      created: [],
      updated: [],
      appLevelCreated: [],
      appLevelUpdated: [],
    },
  }))

  // Connect to the stream
  const connect = useCallback(() => {
    if (!jobId || eventSourceRef.current) return

    setState(prev => ({ ...prev, status: 'connecting' }))

    const eventSource = new EventSource(`/api/localization-jobs/${jobId}/push`)
    eventSourceRef.current = eventSource
    setIsConnected(true)

    eventSource.onopen = () => {
      setState(prev => ({ ...prev, status: 'preparing' }))
    }

    eventSource.onmessage = (event) => {
      try {
        const data: PushStreamEvent = JSON.parse(event.data)

        switch (data.type) {
          case 'starting':
            setState(prev => ({
              ...prev,
              status: 'preparing',
              progress: data.progress || 0,
              totalLocales: data.totalLocales || prev.totalLocales,
              completedLocales: data.completedLocales || 0,
            }))
            break

          case 'preparing':
            setState(prev => ({
              ...prev,
              status: 'preparing',
              preparingMessage: data.message,
            }))
            break

          case 'locale_start':
            if (data.locale) {
              setState(prev => ({
                ...prev,
                status: 'pushing',
                progress: data.progress || prev.progress,
                completedLocales: data.completedLocales || prev.completedLocales,
                locales: {
                  ...prev.locales,
                  [data.locale!]: {
                    ...prev.locales[data.locale!],
                    locale: data.locale!,
                    localeName: data.localeName || data.locale!,
                    status: 'pushing',
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
              results: data.results || prev.results,
            }))
            eventSource.close()
            eventSourceRef.current = null
            setIsConnected(false)
            if (data.results) {
              onCompleteRef.current?.(data.results)
            }
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
  }, [jobId])

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
      results: {
        success: [],
        failed: [],
        created: [],
        updated: [],
        appLevelCreated: [],
        appLevelUpdated: [],
      },
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

  // Cleanup only on unmount
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
