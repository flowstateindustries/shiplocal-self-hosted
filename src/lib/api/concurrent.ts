/**
 * Concurrent Processing Utilities
 * Provides a worker pool and an in-process mutex.
 * The self-hosted build runs as a single Node process, so no
 * distributed locking is required.
 */

/**
 * Process items concurrently with a worker pool.
 * Similar to Promise.allSettled but with bounded concurrency.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []
  let index = 0

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++
      const item = items[currentIndex]
      try {
        const value = await fn(item)
        results[currentIndex] = { status: 'fulfilled', value }
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason }
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker()
  )
  await Promise.all(workers)

  return results
}

/**
 * Simple in-process mutex for sequential operations.
 */
export function createMutex() {
  let locked = false
  const queue: (() => void)[] = []

  return {
    async acquire(): Promise<void> {
      if (!locked) {
        locked = true
        return
      }
      await new Promise<void>((resolve) => queue.push(resolve))
    },
    release(): void {
      const next = queue.shift()
      if (next) {
        next()
      } else {
        locked = false
      }
    },
  }
}

export type Mutex = ReturnType<typeof createMutex>
