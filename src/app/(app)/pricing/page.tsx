"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AppSelector } from "@/components/apps/app-selector"
import { PPP_FACTORS, getPppFactor } from "@/lib/pricing/ppp-data"
import type { ASCApp } from "@/lib/appstore"
import type { PricingProduct } from "@/lib/pricing/types"

const TERRITORY_OPTIONS = Object.entries(PPP_FACTORS)
  .map(([code, entry]) => ({ code, name: entry.name }))
  .sort((a, b) => a.name.localeCompare(b.name))

export default function PricingPage() {
  const router = useRouter()

  const [hasCreds, setHasCreds] = useState(true)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [app, setApp] = useState<ASCApp | null>(null)

  const [products, setProducts] = useState<PricingProduct[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const [baseTerritory, setBaseTerritory] = useState("USA")
  const [extraDiscount, setExtraDiscount] = useState(0) // percent 0-90
  // ASC requires a future start date (and bumps past weekends/holidays). The
  // picker allows tomorrow onward; we default to +2 days as a safe buffer, and
  // the push adopts Apple's exact minimum if the chosen date is still too early.
  const dateOffset = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10)
  const minDate = useMemo(() => dateOffset(1), [])
  const [startDate, setStartDate] = useState(() => dateOffset(2))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/credentials")
      .then((r) => r.json())
      .then((d) => setHasCreds(!!d.ascConnected))
      .catch(() => setHasCreds(false))
  }, [])

  const loadProducts = useCallback(async (appId: string) => {
    setLoadingProducts(true)
    setError(null)
    setProducts([])
    setSelected(new Set())
    try {
      const res = await fetch(
        `/api/pricing-jobs/products?appId=${encodeURIComponent(appId)}`
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to load products")
      setProducts(data.products || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load products")
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  const handleSelectApp = (picked: ASCApp) => {
    setApp(picked)
    setSelectorOpen(false)
    loadProducts(picked.id)
  }

  const toggleProduct = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const exampleFactor = useMemo(() => {
    const ppp = getPppFactor("IND")
    return Math.round(ppp * (1 - extraDiscount / 100) * 100)
  }, [extraDiscount])

  const handleCompute = async () => {
    if (!app || selected.size === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const chosen = products.filter((p) => selected.has(p.id))
      const res = await fetch("/api/pricing-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: app.id,
          appName: app.name,
          appIconUrl: app.iconUrl ?? null,
          baseTerritory,
          extraDiscount: extraDiscount / 100,
          startDate,
          products: chosen.map((p) => ({ id: p.id, type: p.type, name: p.name })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create job")
      router.push(`/pricing/${data.jobId}/generating`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start. Please try again.")
      setSubmitting(false)
    }
  }

  const subscriptions = products.filter((p) => p.type === "subscription")
  const iaps = products.filter((p) => p.type === "iap")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--color-content)]">
          Affordability Pricing
        </h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          Scale subscription and in-app purchase prices to local purchasing power,
          then push them to App Store Connect.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Pricing changes affect live customers and are hard to undo. You&apos;ll
          review every proposed price before anything is pushed. Test against a
          non-production app first.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      {/* App picker */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {app?.iconUrl ? (
              <Image
                src={app.iconUrl}
                alt={app.name}
                width={40}
                height={40}
                className="w-10 h-10 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-hover)] shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-[var(--color-content)] truncate">
                {app ? app.name : "No app selected"}
              </p>
              <p className="text-xs text-[var(--color-content-muted)] truncate">
                {app ? app.bundleId : "Pick an app to load its products"}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => setSelectorOpen(true)}>
            {app ? "Change" : "Select App"}
          </Button>
        </div>
      </div>

      {/* Products */}
      {app && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-4">
          <div>
            <h2 className="text-sm font-medium text-[var(--color-content)]">
              Products to re-price
            </h2>
            <p className="text-xs text-[var(--color-content-muted)] mt-1">
              {selected.size} selected
            </p>
          </div>

          {loadingProducts && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-content)]" />
            </div>
          )}

          {!loadingProducts && products.length === 0 && (
            <p className="text-sm text-[var(--color-content-muted)] py-4">
              No subscriptions or in-app purchases found for this app.
            </p>
          )}

          {!loadingProducts &&
            (
              [
                ["Subscriptions", subscriptions],
                ["In-App Purchases", iaps],
              ] as const
            ).map(([label, list]) =>
              list.length === 0 ? null : (
                <div key={label} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-content-tertiary)]">
                    {label}
                  </p>
                  {list.map((p) => {
                    const checked = selected.has(p.id)
                    return (
                      <div
                        key={p.id}
                        role="checkbox"
                        tabIndex={0}
                        aria-checked={checked}
                        onClick={() => toggleProduct(p.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault()
                            toggleProduct(p.id)
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                          checked
                            ? "border-[var(--color-content)] bg-[var(--color-content)]/5"
                            : "border-[var(--color-border)] hover:border-[var(--color-content-muted)]"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          aria-label={`Select ${p.name}`}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => toggleProduct(p.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-[var(--color-content)] truncate">
                            {p.name}
                          </p>
                          {p.productId && (
                            <p className="text-xs text-[var(--color-content-muted)] truncate">
                              {p.productId}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
        </div>
      )}

      {/* Strategy */}
      {app && products.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)] p-6 space-y-5">
          <div>
            <label
              htmlFor="base-territory"
              className="text-sm font-medium text-[var(--color-content)]"
            >
              Base / reference territory
            </label>
            <p className="text-xs text-[var(--color-content-muted)] mt-1 mb-2">
              The territory whose current price anchors every other country&apos;s
              equalized reference.
            </p>
            <select
              id="base-territory"
              value={baseTerritory}
              onChange={(e) => setBaseTerritory(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] px-3 py-2 text-sm text-[var(--color-content)] focus:outline-none"
            >
              {TERRITORY_OPTIONS.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="extra-discount"
                className="text-sm font-medium text-[var(--color-content)]"
              >
                Extra global discount
              </label>
              <span className="text-sm text-[var(--color-content-secondary)]">
                {extraDiscount}%
              </span>
            </div>
            <p className="text-xs text-[var(--color-content-muted)] mt-1 mb-2">
              Applied on top of purchasing-power scaling. For example, India ends
              up around {exampleFactor}% of its equalized price.
            </p>
            <input
              id="extra-discount"
              type="range"
              min={0}
              max={90}
              step={5}
              value={extraDiscount}
              onChange={(e) => setExtraDiscount(Number(e.target.value))}
              className="w-full accent-[var(--color-content)]"
            />
          </div>

          {/* Rollout */}
          <div className="border-t border-[var(--color-border)] pt-5 space-y-4">
            <div>
              <label
                htmlFor="start-date"
                className="text-sm font-medium text-[var(--color-content)]"
              >
                Price effective date
              </label>
              <p className="text-xs text-[var(--color-content-muted)] mt-1 mb-2">
                When the new prices take effect in App Store Connect.
              </p>
              <input
                id="start-date"
                type="date"
                value={startDate}
                min={minDate}
                onChange={(e) => setStartDate(e.target.value || minDate)}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] px-3 py-2 text-sm text-[var(--color-content)] focus:outline-none"
              />
            </div>

            <p className="text-xs text-[var(--color-content-muted)]">
              Existing subscribers automatically get the lower price at their
              next renewal — Apple applies all price decreases to current
              subscribers.
            </p>
          </div>
        </div>
      )}

      {app && products.length > 0 && (
        <Button
          onClick={handleCompute}
          disabled={selected.size === 0 || submitting}
          className="w-full h-12"
        >
          {submitting
            ? "Starting..."
            : `Compute Prices${
                selected.size > 0 ? ` for ${selected.size} Product${selected.size > 1 ? "s" : ""}` : ""
              }`}
        </Button>
      )}

      <AppSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleSelectApp}
        selectedAppIds={[]}
        hasASCCredentials={hasCreds}
      />
    </div>
  )
}
