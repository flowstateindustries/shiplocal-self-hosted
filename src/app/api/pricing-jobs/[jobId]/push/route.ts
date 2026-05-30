import { NextRequest } from 'next/server'
import { sseErrorResponse, sseNotFoundResponse } from '@/lib/api/responses'
import { SSE_HEADERS } from '@/lib/api/sse'
import { mapWithConcurrency } from '@/lib/api/concurrent'
import { getASCCredentials } from '@/lib/appstore/credentials'
import {
  pushSubscriptionPrice,
  pushIapPriceSchedule,
  parseMinStartDate,
} from '@/lib/appstore/pricing'
import type { ProductPriceProposal } from '@/lib/pricing/types'
import { getPricingJob, updatePricingJob } from '@/lib/db/queries'

interface RouteParams {
  params: Promise<{ jobId: string }>
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
  totalTerritories?: number
  failedTerritories?: number
  effectiveStartDate?: string
  error?: string
}

const TERRITORY_CONCURRENCY = 4

/**
 * GET /api/pricing-jobs/[jobId]/push
 * Push computed price proposals to App Store Connect, streamed as SSE.
 * Subscriptions are priced one territory at a time; IAPs use a single price
 * schedule covering all territories at once.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params

  const job = getPricingJob(jobId)
  if (!job) return sseNotFoundResponse('Job')
  if (job.status !== 'completed') {
    return sseErrorResponse('Job is not completed yet', 400)
  }

  const credentials = getASCCredentials()
  if (!credentials) {
    return sseErrorResponse(
      'No App Store Connect credentials found. Set them in .env.local.',
      400
    )
  }

  const products: ProductPriceProposal[] = job.results?.products || []
  if (products.length === 0) {
    return sseErrorResponse('No price proposals to push', 400)
  }

  const encoder = new TextEncoder()
  const baseTerritory = job.base_territory
  // Rollout options (default for jobs created before these fields existed).
  const startDate =
    job.strategy?.startDate || new Date().toISOString().slice(0, 10)
  // ASC may reject the chosen date as too early (weekends/holidays); when it
  // tells us its minimum we adopt it and reuse it for the rest of the push.
  let effectiveStartDate = startDate

  // Stop pushing the moment the client disconnects.
  const abortController = new AbortController()
  let aborted = request.signal.aborted
  if (aborted) abortController.abort()
  else request.signal.addEventListener('abort', () => {
    aborted = true
    abortController.abort()
  })

  const stream = new ReadableStream({
    async start(controller) {
      let isOpen = true
      const send = (event: PushEvent) => {
        if (!isOpen) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          isOpen = false
        }
      }

      const total = products.length
      let completed = 0
      let anySuccess = false

      try {
        send({ type: 'starting', totalProducts: total, completedProducts: 0 })

        for (const product of products) {
          if (aborted) break

          send({
            type: 'product_start',
            productId: product.productId,
            productName: product.name,
            totalTerritories: product.territories.length,
            progress: Math.round((completed / total) * 100),
            totalProducts: total,
            completedProducts: completed,
          })

          let failedTerritories = 0
          let pushedTerritories = 0
          let productError: string | undefined

          try {
            if (product.type === 'iap') {
              // IAPs: one price schedule covering every territory at once.
              const prices: Array<{ territory: string; pricePointId: string; startDate?: string | null }> = product.territories.map((t) => ({
                territory: t.territory,
                pricePointId: t.pricePointId,
              }))
              // Apple requires the base territory in manualPrices even when its
              // price is unchanged (the base is skipped during compute because
              // its PPP factor is 1.0 and proposed === reference). startDate: null
              // omits the date attribute so it covers the full timeline from the
              // beginning, which Apple requires for the base territory.
              if (!prices.some((p) => p.territory === baseTerritory)) {
                prices.unshift({
                  territory: baseTerritory,
                  pricePointId: product.basePricePointId,
                  startDate: null,
                })
              }
              let result = await pushIapPriceSchedule(
                credentials,
                product.productId,
                baseTerritory,
                prices,
                effectiveStartDate,
                abortController.signal
              )
              // Adopt Apple's stated minimum date and retry once if too early.
              const minDate = !result.success
                ? parseMinStartDate(result.error)
                : null
              if (minDate && minDate > effectiveStartDate) {
                effectiveStartDate = minDate
                result = await pushIapPriceSchedule(
                  credentials,
                  product.productId,
                  baseTerritory,
                  prices,
                  effectiveStartDate,
                  abortController.signal
                )
              }
              if (result.success) {
                pushedTerritories = product.territories.length
                anySuccess = true
              } else {
                failedTerritories = product.territories.length
                productError = result.error
              }
            } else {
              // Subscriptions: one POST per territory.
              await mapWithConcurrency(
                product.territories,
                TERRITORY_CONCURRENCY,
                async (t) => {
                  if (aborted) return
                  let result = await pushSubscriptionPrice(
                    credentials,
                    product.productId,
                    t.pricePointId,
                    effectiveStartDate,
                    abortController.signal
                  )
                  // If ASC says the date is too early, adopt its minimum and
                  // retry. effectiveStartDate is shared, so once one territory
                  // discovers the valid date the rest reuse it (no retry).
                  const minDate = !result.success
                    ? parseMinStartDate(result.error)
                    : null
                  if (minDate && minDate > effectiveStartDate) {
                    effectiveStartDate = minDate
                  }
                  if (!result.success && minDate) {
                    result = await pushSubscriptionPrice(
                      credentials,
                      product.productId,
                      t.pricePointId,
                      effectiveStartDate,
                      abortController.signal
                    )
                  }
                  if (result.success) {
                    pushedTerritories++
                    anySuccess = true
                  } else {
                    failedTerritories++
                  }
                  send({
                    type: 'territory_progress',
                    productId: product.productId,
                    productName: product.name,
                    pushedTerritories,
                    failedTerritories,
                    totalTerritories: product.territories.length,
                  })
                }
              )
            }

            completed++
            send({
              type: failedTerritories > 0 && pushedTerritories === 0
                ? 'product_error'
                : 'product_complete',
              productId: product.productId,
              productName: product.name,
              pushedTerritories,
              failedTerritories,
              totalTerritories: product.territories.length,
              progress: Math.round((completed / total) * 100),
              totalProducts: total,
              completedProducts: completed,
              ...(productError && { error: productError }),
            })
          } catch (productError) {
            completed++
            send({
              type: 'product_error',
              productId: product.productId,
              productName: product.name,
              error:
                productError instanceof Error
                  ? productError.message
                  : String(productError),
              progress: Math.round((completed / total) * 100),
              totalProducts: total,
              completedProducts: completed,
            })
          }
        }

        if (anySuccess) {
          const current = getPricingJob(jobId)
          if (current?.status === 'completed') {
            updatePricingJob(jobId, {
              pushed_to_asc: true,
              pushed_at: new Date().toISOString(),
            })
          }
        }

        send({
          type: 'complete',
          progress: 100,
          totalProducts: total,
          completedProducts: completed,
          effectiveStartDate,
        })
      } catch (error) {
        console.error('Error in pricing push stream:', error)
        send({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
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
