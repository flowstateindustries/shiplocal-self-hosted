export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const

export interface SSEController<T> {
  send: (event: T) => void
  close: () => void
  isClosed: () => boolean
}

export function createSSEStream<T>(
  handler: (controller: SSEController<T>) => Promise<void>
): Response {
  const encoder = new TextEncoder()
  let isOpen = true

  const stream = new ReadableStream({
    async start(controller) {
      const sseController: SSEController<T> = {
        send: (event: T) => {
          if (!isOpen) return
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
          } catch {
            isOpen = false
          }
        },
        close: () => {
          if (!isOpen) return
          try {
            controller.close()
          } catch {
            // Already closed
          }
          isOpen = false
        },
        isClosed: () => !isOpen,
      }

      try {
        await handler(sseController)
      } finally {
        sseController.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
