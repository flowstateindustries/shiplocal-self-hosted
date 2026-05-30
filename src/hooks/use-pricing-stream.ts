"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// =============================================================================
// Compute stream (POST job -> GET /stream computes proposals)
// =============================================================================

export type PricingComputeStatus =
  | 'idle'
  | 'connecting'
  | 'computing'
  | 'complete'
  | 'error'

export interface PricingProductState {
  productId: string
  name: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  territoryCount?: number
  error?: string
}

interface ComputeEvent {
  type:
    | 'starting'
    | 'product_start'
    | 'product_complete'
    | 'product_error'
    | 'complete'
    | 'error'
    | 'heartbeat'
  productId?: string
  productName?: string
  territoryCount?: number
  progress?: number
  totalProducts?: number
  completedProducts?: number
  error?: string
}

interface UsePricingComputeOptions {
  onComplete?: () => void
  onError?: (error: string) => void
  autoStart?: boolean
  useResumeEndpoint?: boolean
}

/**
 * Connect to the pricing compute SSE stream (or resume endpoint) and track
 * per-product progress.
 */
export function usePricingCompute(
  jobId: string | null,
  products: Array<{ id: string; name: string }> = [],
  options: UsePricingComputeOptions = {}
) {
  const { onComplete, onError, autoStart = true, useResumeEndpoint = false } =
    options
  const eventSourceRef = useRef<EventSource | null>(null)
  const hasStartedRef = useRef(false)

  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  })

  const [status, setStatus] = useState<PricingComputeStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [totalProducts, setTotalProducts] = useState(products.length)
  const [completedProducts, setCompletedProducts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [productStates, setProductStates] = useState<
    Record<string, PricingProductState>
  >(() =>
    Object.fromEntries(
      products.map((p) => [
        p.id,
        { productId: p.id, name: p.name, status: 'pending' as const },
      ])
    )
  )

  const connect = useCallback(() => {
    if (!jobId || eventSourceRef.current) return
    setStatus('connecting')

    const endpoint = useResumeEndpoint
      ? `/api/pricing-jobs/${jobId}/resume`
      : `/api/pricing-jobs/${jobId}/stream`
    const es = new EventSource(endpoint)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data: ComputeEvent = JSON.parse(event.data)
        switch (data.type) {
          case 'starting':
            setStatus('computing')
            setTotalProducts(data.totalProducts || products.length)
            break
          case 'product_start':
            if (data.productId)
              setProductStates((prev) => ({
                ...prev,
                [data.productId!]: {
                  ...prev[data.productId!],
                  productId: data.productId!,
                  name: data.productName || data.productId!,
                  status: 'processing',
                },
              }))
            break
          case 'product_complete':
            setProgress(data.progress ?? 0)
            setCompletedProducts(data.completedProducts ?? 0)
            if (data.productId)
              setProductStates((prev) => ({
                ...prev,
                [data.productId!]: {
                  productId: data.productId!,
                  name: data.productName || data.productId!,
                  status: 'completed',
                  territoryCount: data.territoryCount,
                },
              }))
            break
          case 'product_error':
            setProgress(data.progress ?? 0)
            setCompletedProducts(data.completedProducts ?? 0)
            if (data.productId)
              setProductStates((prev) => ({
                ...prev,
                [data.productId!]: {
                  productId: data.productId!,
                  name: data.productName || data.productId!,
                  status: 'failed',
                  error: data.error,
                },
              }))
            break
          case 'complete':
            setStatus('complete')
            setProgress(100)
            es.close()
            eventSourceRef.current = null
            onCompleteRef.current?.()
            break
          case 'error':
            setStatus('error')
            setError(data.error || 'Unknown error')
            es.close()
            eventSourceRef.current = null
            onErrorRef.current?.(data.error || 'Unknown error')
            break
          case 'heartbeat':
            break
        }
      } catch (e) {
        console.error('Error parsing pricing SSE event:', e)
      }
    }

    es.onerror = () => {
      setStatus('error')
      setError('Connection to server lost')
      es.close()
      eventSourceRef.current = null
      onErrorRef.current?.('Connection to server lost')
    }
  }, [jobId, useResumeEndpoint, products])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (autoStart && jobId && !hasStartedRef.current) {
      hasStartedRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initiate SSE on mount
      connect()
    }
  }, [autoStart, jobId, connect])

  useEffect(() => () => disconnect(), [disconnect])

  return {
    status,
    progress,
    totalProducts,
    completedProducts,
    productStates,
    error,
    connect,
    disconnect,
  }
}

// =============================================================================
// Push stream (GET /push writes prices to App Store Connect)
// =============================================================================

export type PricingPushStatus =
  | 'idle'
  | 'connecting'
  | 'pushing'
  | 'complete'
  | 'error'

export interface PricingPushProductState {
  productId: string
  name: string
  status: 'pending' | 'pushing' | 'complete' | 'error'
  pushedTerritories?: number
  failedTerritories?: number
  totalTerritories?: number
  error?: string
}

interface PushEvent {
  type:
    | 'starting'
    | 'product_start'
    | 'product_complete'
    | 'product_error'
    | 'territory_progress'
    | 'complete'
    | 'error'
  productId?: string
  productName?: string
  progress?: number
  totalProducts?: number
  completedProducts?: number
  pushedTerritories?: number
  failedTerritories?: number
  totalTerritories?: number
  effectiveStartDate?: string
  error?: string
}

interface UsePricingPushOptions {
  onComplete?: () => void
  onError?: (error: string) => void
  autoStart?: boolean
}

/**
 * Connect to the pricing push SSE stream and track per-product push progress.
 */
export function usePricingPush(
  jobId: string | null,
  options: UsePricingPushOptions = {}
) {
  const { onComplete, onError, autoStart = false } = options
  const eventSourceRef = useRef<EventSource | null>(null)
  const hasStartedRef = useRef(false)

  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  })

  const [status, setStatus] = useState<PricingPushStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [effectiveStartDate, setEffectiveStartDate] = useState<string | null>(
    null
  )
  const [productStates, setProductStates] = useState<
    Record<string, PricingPushProductState>
  >({})

  const connect = useCallback(() => {
    if (!jobId || eventSourceRef.current) return
    setStatus('connecting')

    const es = new EventSource(`/api/pricing-jobs/${jobId}/push`)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data: PushEvent = JSON.parse(event.data)
        switch (data.type) {
          case 'starting':
            setStatus('pushing')
            break
          case 'product_start':
            if (data.productId)
              setProductStates((prev) => ({
                ...prev,
                [data.productId!]: {
                  productId: data.productId!,
                  name: data.productName || data.productId!,
                  status: 'pushing',
                  totalTerritories: data.totalTerritories,
                  pushedTerritories: 0,
                  failedTerritories: 0,
                },
              }))
            break
          case 'territory_progress':
            if (data.productId)
              setProductStates((prev) => ({
                ...prev,
                [data.productId!]: {
                  ...prev[data.productId!],
                  pushedTerritories: data.pushedTerritories,
                  failedTerritories: data.failedTerritories,
                  totalTerritories:
                    data.totalTerritories ??
                    prev[data.productId!]?.totalTerritories,
                },
              }))
            break
          case 'product_complete':
          case 'product_error':
            setProgress(data.progress ?? 0)
            if (data.productId)
              setProductStates((prev) => ({
                ...prev,
                [data.productId!]: {
                  ...prev[data.productId!],
                  productId: data.productId!,
                  name: data.productName || data.productId!,
                  status: data.type === 'product_complete' ? 'complete' : 'error',
                  pushedTerritories:
                    data.pushedTerritories ??
                    prev[data.productId!]?.pushedTerritories,
                  failedTerritories:
                    data.failedTerritories ??
                    prev[data.productId!]?.failedTerritories,
                  totalTerritories:
                    data.totalTerritories ??
                    prev[data.productId!]?.totalTerritories,
                  error: data.error,
                },
              }))
            break
          case 'complete':
            setStatus('complete')
            setProgress(100)
            if (data.effectiveStartDate)
              setEffectiveStartDate(data.effectiveStartDate)
            es.close()
            eventSourceRef.current = null
            onCompleteRef.current?.()
            break
          case 'error':
            setStatus('error')
            setError(data.error || 'Unknown error')
            es.close()
            eventSourceRef.current = null
            onErrorRef.current?.(data.error || 'Unknown error')
            break
        }
      } catch (e) {
        console.error('Error parsing pricing push SSE event:', e)
      }
    }

    es.onerror = () => {
      setStatus('error')
      setError('Connection to server lost')
      es.close()
      eventSourceRef.current = null
      onErrorRef.current?.('Connection to server lost')
    }
  }, [jobId])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    if (autoStart && jobId && !hasStartedRef.current) {
      hasStartedRef.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initiate SSE on mount
      connect()
    }
  }, [autoStart, jobId, connect])

  useEffect(() => () => disconnect(), [disconnect])

  return {
    status,
    progress,
    productStates,
    error,
    effectiveStartDate,
    connect,
    disconnect,
  }
}
