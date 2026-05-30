import 'server-only'
import { sseErrorResponse, sseNotFoundResponse } from '@/lib/api/responses'
import { SSE_HEADERS } from '@/lib/api/sse'
import { mapWithConcurrency, createMutex } from '@/lib/api/concurrent'
import { getASCCredentials } from '@/lib/appstore/credentials'
import { computeProductProposal } from './compute'
import { CONCURRENT_PRICING_PRODUCTS } from './constants'
import { determineFinalPricingStatus } from './job-utils'
import type { JobStatus, PricingProductStatus } from '@/lib/database/types'
import type { ProductPriceProposal } from './types'
import {
  claimPricingJobForProcessing,
  getPricingJob,
  updatePricingJob,
} from '@/lib/db/queries'

export interface PricingComputeEvent {
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

/**
 * Shared SSE runner that computes price proposals for every product in a job.
 * `allowedFromStatuses` controls whether this is a fresh run (`['pending']`)
 * or a resume (`['interrupted', 'failed']`); on resume, products already
 * marked `completed` are skipped and their proposals preserved.
 */
export function runPricingComputeStream(
  jobId: string,
  allowedFromStatuses: ReadonlyArray<JobStatus>,
  externalSignal?: AbortSignal
): Response {
  const job = getPricingJob(jobId)
  if (!job) return sseNotFoundResponse('Job')

  if (job.status === 'processing') {
    return sseErrorResponse('Job is already being processed', 400)
  }

  const claimed = claimPricingJobForProcessing(jobId, allowedFromStatuses)
  if (!claimed) {
    return sseErrorResponse('Job is not in a runnable state', 400)
  }

  const config = job.strategy
  if (!config) {
    return sseErrorResponse('Job configuration not found', 400)
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return sseErrorResponse(
      'No App Store Connect credentials found. Set them in .env.local.',
      400
    )
  }

  const encoder = new TextEncoder()

  // Abort all in-flight/queued ASC work the moment the client disconnects
  // (Cancel button, navigation, tab close) so we stop burning rate-limit budget.
  const abortController = new AbortController()
  let aborted = externalSignal?.aborted ?? false
  if (externalSignal) {
    if (aborted) abortController.abort()
    else externalSignal.addEventListener('abort', () => {
      aborted = true
      abortController.abort()
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      let isOpen = true
      const send = (event: PricingComputeEvent) => {
        if (!isOpen) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          isOpen = false
        }
      }

      const heartbeat = setInterval(() => {
        if (isOpen) send({ type: 'heartbeat' })
      }, 15000)

      const dbMutex = createMutex()

      try {
        // Preserve any proposals already computed on a prior (resumed) run.
        const existing = new Map<string, ProductPriceProposal>(
          (job.results?.products || []).map((p) => [p.productId, p])
        )
        const productResults: Record<string, PricingProductStatus> = {
          ...job.product_results,
        }

        const total = config.products.length
        send({ type: 'starting', totalProducts: total, completedProducts: 0 })

        let completed = 0

        const processProduct = async (product: {
          id: string
          type: 'subscription' | 'iap'
          name: string
        }) => {
          // Client gone — stop launching new product work.
          if (aborted) return

          // Skip products that already succeeded (resume path).
          if (
            productResults[product.id]?.status === 'completed' &&
            existing.has(product.id)
          ) {
            completed++
            return
          }

          send({
            type: 'product_start',
            productId: product.id,
            productName: product.name,
            progress: Math.round((completed / total) * 100),
            totalProducts: total,
            completedProducts: completed,
          })

          const result = await computeProductProposal(
            credentials,
            config.baseTerritory,
            config.extraDiscount,
            product,
            abortController.signal
          )

          // Don't record a partial/aborted result as a real failure.
          if (aborted) return

          await dbMutex.acquire()
          try {
            if (result.success) {
              existing.set(product.id, result.proposal)
              productResults[product.id] = {
                status: 'completed',
                territoryCount: result.proposal.territories.length,
              }
              completed++
              send({
                type: 'product_complete',
                productId: product.id,
                productName: product.name,
                territoryCount: result.proposal.territories.length,
                progress: Math.round((completed / total) * 100),
                totalProducts: total,
                completedProducts: completed,
              })
            } else {
              productResults[product.id] = {
                status: 'failed',
                error: result.error,
              }
              send({
                type: 'product_error',
                productId: product.id,
                productName: product.name,
                error: result.error,
                progress: Math.round((completed / total) * 100),
                totalProducts: total,
                completedProducts: completed,
              })
            }

            updatePricingJob(jobId, {
              results: {
                _config: config,
                products: [...existing.values()],
              },
              product_results: productResults,
            })
          } finally {
            dbMutex.release()
          }
        }

        await mapWithConcurrency(
          config.products,
          CONCURRENT_PRICING_PRODUCTS,
          processProduct
        )

        if (aborted || !isOpen) {
          const current = getPricingJob(jobId)
          if (current?.status === 'processing') {
            updatePricingJob(jobId, { status: 'interrupted' })
          }
          return
        }

        const finalStatus = determineFinalPricingStatus(
          config.products.map((p) => p.id),
          productResults
        )

        updatePricingJob(jobId, {
          status: finalStatus,
          results: { _config: config, products: [...existing.values()] },
          product_results: productResults,
          completed_at:
            finalStatus === 'completed' ? new Date().toISOString() : null,
        })

        send({
          type: finalStatus === 'completed' ? 'complete' : 'error',
          progress: finalStatus === 'completed' ? 100 : Math.round((completed / total) * 100),
          totalProducts: total,
          completedProducts: completed,
          ...(finalStatus === 'failed' && {
            error: 'All products failed to price',
          }),
        })
      } catch (error) {
        console.error('Error in pricing compute stream:', error)
        updatePricingJob(jobId, {
          status: 'failed',
          error_message: String(error),
        })
        send({ type: 'error', error: String(error) })
      } finally {
        clearInterval(heartbeat)
        if (isOpen) {
          try {
            controller.close()
          } catch {
            // already closed
          }
        }
        isOpen = false
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
