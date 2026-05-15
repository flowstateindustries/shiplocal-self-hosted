import { useState, useCallback, useRef, useEffect } from 'react'
import type { StringsStreamEvent } from '@/lib/strings/types'

export type LocaleStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface LocaleProgress {
  status: LocaleStatus
  batchProgress?: number
  translatedCount?: number
  error?: string
}

interface UseStringsStreamOptions {
  jobId: string
  onComplete?: () => void
  onError?: (error: string) => void
}

interface UseStringsStreamReturn {
  start: () => void
  resume: () => void
  cancel: () => void
  isConnecting: boolean
  isRunning: boolean
  localeProgress: Record<string, LocaleProgress>
  overallProgress: number
  completedLocales: number
  totalLocales: number
  error: string | null
}

export function useStringsStream({
  jobId,
  onComplete,
  onError,
}: UseStringsStreamOptions): UseStringsStreamReturn {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [localeProgress, setLocaleProgress] = useState<Record<string, LocaleProgress>>({})
  const [overallProgress, setOverallProgress] = useState(0)
  const [completedLocales, setCompletedLocales] = useState(0)
  const [totalLocales, setTotalLocales] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const isCancelledRef = useRef(false)

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsConnecting(false)
    setIsRunning(false)
  }, [])

  const startStream = useCallback((isResume: boolean) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    isCancelledRef.current = false
    setIsConnecting(true)
    setError(null)

    const endpoint = isResume
      ? `/api/strings-jobs/${jobId}/resume`
      : `/api/strings-jobs/${jobId}/stream`

    const eventSource = new EventSource(endpoint)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      setIsConnecting(false)
      setIsRunning(true)
    }

    eventSource.onmessage = (event) => {
      if (isCancelledRef.current) return

      try {
        const data: StringsStreamEvent = JSON.parse(event.data)

        switch (data.type) {
          case 'starting':
            setTotalLocales(data.totalLocales)
            if (data.completedLocales !== undefined) {
              setCompletedLocales(data.completedLocales)
            }
            if (data.progress !== undefined) {
              setOverallProgress(data.progress)
            }
            break

          case 'locale_start':
            setLocaleProgress(prev => ({
              ...prev,
              [data.locale]: {
                status: 'processing',
                batchProgress: 0,
                translatedCount: 0,
              },
            }))
            break

          case 'batch_complete':
            setLocaleProgress(prev => ({
              ...prev,
              [data.locale]: {
                ...prev[data.locale],
                batchProgress: data.progress,
                translatedCount: data.translatedCount,
              },
            }))
            break

          case 'locale_complete':
            setLocaleProgress(prev => ({
              ...prev,
              [data.locale]: {
                status: 'completed',
                batchProgress: 100,
                translatedCount: data.translatedCount,
              },
            }))
            setOverallProgress(data.progress)
            setCompletedLocales(prev => prev + 1)
            break

          case 'locale_error':
            setLocaleProgress(prev => ({
              ...prev,
              [data.locale]: {
                status: 'failed',
                error: data.error,
              },
            }))
            break

          case 'complete':
            setOverallProgress(100)
            setCompletedLocales(data.completedLocales)
            cleanup()
            onComplete?.()
            break

          case 'error':
            setError(data.error)
            cleanup()
            onError?.(data.error)
            break

          case 'heartbeat':
            // Keep connection alive
            break
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e)
        setError('Failed to parse server response')
        cleanup()
      }
    }

    eventSource.onerror = () => {
      if (!isCancelledRef.current) {
        setError('Connection lost. Please try resuming.')
        cleanup()
        onError?.('Connection lost')
      }
    }
  }, [jobId, cleanup, onComplete, onError])

  const start = useCallback(() => {
    startStream(false)
  }, [startStream])

  const resume = useCallback(() => {
    startStream(true)
  }, [startStream])

  const cancel = useCallback(() => {
    isCancelledRef.current = true
    cleanup()
  }, [cleanup])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isCancelledRef.current = true
      cleanup()
    }
  }, [cleanup])

  return {
    start,
    resume,
    cancel,
    isConnecting,
    isRunning,
    localeProgress,
    overallProgress,
    completedLocales,
    totalLocales,
    error,
  }
}
