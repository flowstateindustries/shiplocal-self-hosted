"use client"

import { useEffect, useState, use, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button, Modal } from "@/components/ui"
import { getTerritoryName } from "@/lib/pricing/ppp-data"
import type { PricingJob } from "@/lib/database/types"
import type {
  PricePoint,
  PricingResults,
  ProductPriceProposal,
} from "@/lib/pricing/types"

type LaddersByProduct = Record<string, Record<string, PricePoint[]>>

export default function PricingPreviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = use(params)
  const router = useRouter()

  const [job, setJob] = useState<PricingJob | null>(null)
  const [results, setResults] = useState<PricingResults | null>(null)
  const [ladders, setLadders] = useState<LaddersByProduct>({})
  const [loadingLadders, setLoadingLadders] = useState<Set<string>>(new Set())
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`/api/pricing-jobs/${jobId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (!data.job) throw new Error("Job not found")
        setJob(data.job)
        setResults(data.job.results)
        setIsLoading(false)
      })
      .catch((e) => {
        if (!active) return
        setError(e instanceof Error ? e.message : "Failed to load job")
        setIsLoading(false)
      })
    return () => {
      active = false
    }
  }, [jobId])

  const loadLadders = useCallback(
    async (product: ProductPriceProposal) => {
      if (ladders[product.productId] || loadingLadders.has(product.productId))
        return
      setLoadingLadders((prev) => new Set(prev).add(product.productId))
      try {
        const res = await fetch(
          `/api/pricing-jobs/price-points?type=${product.type}&productId=${encodeURIComponent(
            product.productId
          )}`
        )
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to load price options")
        setLadders((prev) => ({ ...prev, [product.productId]: data.ladders }))
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load price options")
      } finally {
        setLoadingLadders((prev) => {
          const next = new Set(prev)
          next.delete(product.productId)
          return next
        })
      }
    },
    [ladders, loadingLadders]
  )

  const changePricePoint = (
    productId: string,
    territory: string,
    pricePointId: string
  ) => {
    setResults((prev) => {
      if (!prev) return prev
      const ladder = ladders[productId]?.[territory] || []
      const chosen = ladder.find((pp) => pp.id === pricePointId)
      if (!chosen) return prev
      return {
        ...prev,
        products: prev.products.map((p) =>
          p.productId !== productId
            ? p
            : {
                ...p,
                territories: p.territories.map((t) =>
                  t.territory !== territory
                    ? t
                    : {
                        ...t,
                        pricePointId: chosen.id,
                        proposedPrice: chosen.customerPrice,
                      }
                ),
              }
        ),
      }
    })
    setDirty(true)
  }

  const handleSave = async () => {
    if (!results) return
    setSaving(true)
    try {
      const res = await fetch(`/api/pricing-jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ results }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save")
      }
      setDirty(false)
      toast.success("Changes saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const confirmPush = () => {
    setConfirmOpen(false)
    router.push(`/pricing/${jobId}/pushing`)
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Pricing Error
        </h1>
        <p className="text-sm text-red-500">{error}</p>
        <Button onClick={() => router.push("/pricing")}>Start Over</Button>
      </div>
    )
  }

  if (isLoading || !job || !results) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-48 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
        <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded animate-pulse" />
      </div>
    )
  }

  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

  const missing = Array.from(
    new Set(results.products.flatMap((p) => p.missingTerritories ?? []))
  )

  const totalChanges = results.products.reduce(
    (sum, p) => sum + p.territories.length,
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Review Proposed Prices
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          {job.app_name} · base territory {getTerritoryName(job.base_territory)}
          {job.pushed_to_asc ? " · already pushed" : ""}
        </p>
      </div>

      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
            {missing.length} territor{missing.length === 1 ? "y" : "ies"} couldn&apos;t be priced
          </p>
          <p className="text-sm text-amber-600/90 dark:text-amber-400/90 mt-1">
            App Store Connect rate-limited these and they will keep their current
            price (no discount): {missing.map(getTerritoryName).join(", ")}. Run
            the compute again to fill them in before pushing.
          </p>
        </div>
      )}

      {results.products.map((product) => {
        const productLadders = ladders[product.productId]
        const isLoadingLadder = loadingLadders.has(product.productId)
        return (
          <div
            key={product.productId}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] overflow-hidden"
          >
            <div className="flex items-center justify-between gap-4 p-4 border-b border-[var(--color-border)]">
              <div className="min-w-0">
                <p className="font-medium text-[var(--color-content)] truncate">
                  {product.name}
                </p>
                <p className="text-xs text-[var(--color-content-muted)]">
                  {product.type === "subscription" ? "Subscription" : "In-App Purchase"}{" "}
                  · {product.territories.length} territories · base{" "}
                  {fmt(product.basePrice)}
                </p>
              </div>
              {!productLadders && !job.pushed_to_asc && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadLadders(product)}
                  disabled={isLoadingLadder}
                >
                  {isLoadingLadder ? "Loading…" : "Edit prices"}
                </Button>
              )}
            </div>

            <div className="max-h-[28rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-[var(--color-surface-secondary)]">
                  <tr className="text-left text-[var(--color-content-tertiary)]">
                    <th className="px-4 py-2 font-medium">Territory</th>
                    <th className="px-4 py-2 font-medium">Reference</th>
                    <th className="px-4 py-2 font-medium">Factor</th>
                    <th className="px-4 py-2 font-medium">Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {product.territories.map((t) => {
                    const ladder = productLadders?.[t.territory]
                    return (
                      <tr
                        key={t.territory}
                        className="border-t border-[var(--color-border)]"
                      >
                        <td className="px-4 py-2 text-[var(--color-content)]">
                          {getTerritoryName(t.territory)}
                          <span className="text-[var(--color-content-muted)]">
                            {" "}
                            ({t.currency || t.territory})
                          </span>
                        </td>
                        <td className="px-4 py-2 text-[var(--color-content-secondary)]">
                          {fmt(t.referencePrice)}
                        </td>
                        <td className="px-4 py-2 text-[var(--color-content-muted)]">
                          {Math.round(t.factor * 100)}%
                        </td>
                        <td className="px-4 py-2">
                          {ladder ? (
                            <select
                              value={t.pricePointId}
                              onChange={(e) =>
                                changePricePoint(
                                  product.productId,
                                  t.territory,
                                  e.target.value
                                )
                              }
                              className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] px-2 py-1 text-sm text-[var(--color-content)] focus:outline-none"
                            >
                              {ladder.map((pp) => (
                                <option key={pp.id} value={pp.id}>
                                  {fmt(pp.customerPrice)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="font-medium text-[var(--color-content)]">
                              {fmt(t.proposedPrice)}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      <div className="flex flex-col items-end gap-2 pt-2">
        {dirty && !job.pushed_to_asc && (
          <p className="text-xs text-[var(--color-content-muted)]">
            Save your changes to enable pushing.
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={() => router.push("/pricing")}>
            Start Over
          </Button>
          {dirty && (
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          )}
          {!job.pushed_to_asc && (
            <Button onClick={() => setConfirmOpen(true)} disabled={dirty}>
              Push to App Store Connect
            </Button>
          )}
        </div>
      </div>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Push prices to App Store?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmPush}>Push to App Store Connect</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-content-secondary)]">
            This updates{" "}
            <span className="font-medium text-[var(--color-content)]">
              {results.products.length}
            </span>{" "}
            product{results.products.length === 1 ? "" : "s"} across{" "}
            <span className="font-medium text-[var(--color-content)]">
              {totalChanges}
            </span>{" "}
            territory price{totalChanges === 1 ? "" : "s"} for {job.app_name}.
          </p>
          <p className="text-sm text-[var(--color-content-secondary)]">
            Effective{" "}
            <span className="font-medium text-[var(--color-content)]">
              {job.strategy?.startDate ?? "today"}
            </span>
            {" · "}existing subscribers also get the lower price at renewal.
          </p>
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Pricing changes affect live customers and can&apos;t be easily
              undone. Developed markets and anything not listed keep their
              current price.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  )
}
