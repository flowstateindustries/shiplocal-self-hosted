"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import type { UrlReplacement } from "@/lib/localization/types"
import { buildLocaleUrl } from "@/lib/localization/url-utils"

interface UrlOptionsProps {
  // Privacy URL
  privacyUrlReplacement: string
  privacyUrlAllLocales: boolean
  privacyUrlQueryEnabled: boolean
  privacyUrlQueryPattern: string
  onPrivacyUrlChange: (url: string) => void
  onPrivacyUrlAllLocalesChange: (enabled: boolean) => void
  onPrivacyUrlQueryEnabledChange: (enabled: boolean) => void
  onPrivacyUrlQueryPatternChange: (pattern: string) => void
  existingPrivacyUrl?: string
  // Support URL
  supportUrlReplacement: string
  supportUrlAllLocales: boolean
  supportUrlQueryEnabled: boolean
  supportUrlQueryPattern: string
  onSupportUrlChange: (url: string) => void
  onSupportUrlAllLocalesChange: (enabled: boolean) => void
  onSupportUrlQueryEnabledChange: (enabled: boolean) => void
  onSupportUrlQueryPatternChange: (pattern: string) => void
  existingSupportUrl?: string
  // Marketing URL
  marketingUrlReplacement: string
  marketingUrlAllLocales: boolean
  marketingUrlQueryEnabled: boolean
  marketingUrlQueryPattern: string
  onMarketingUrlChange: (url: string) => void
  onMarketingUrlAllLocalesChange: (enabled: boolean) => void
  onMarketingUrlQueryEnabledChange: (enabled: boolean) => void
  onMarketingUrlQueryPatternChange: (pattern: string) => void
  existingMarketingUrl?: string
  // Description URLs
  descriptionContent: string
  isDescriptionSelected: boolean
  urlReplacements?: UrlReplacement[]
  onUrlReplacementsChange: (replacements: UrlReplacement[]) => void
}

/**
 * Detect URLs in text content
 */
function detectUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"'\)]+/gi
  const matches = text.match(urlRegex) || []
  return [...new Set(matches)] // Deduplicate
}

export function UrlOptions({
  privacyUrlReplacement,
  privacyUrlAllLocales,
  privacyUrlQueryEnabled,
  privacyUrlQueryPattern,
  onPrivacyUrlChange,
  onPrivacyUrlAllLocalesChange,
  onPrivacyUrlQueryEnabledChange,
  onPrivacyUrlQueryPatternChange,
  existingPrivacyUrl,
  supportUrlReplacement,
  supportUrlAllLocales,
  supportUrlQueryEnabled,
  supportUrlQueryPattern,
  onSupportUrlChange,
  onSupportUrlAllLocalesChange,
  onSupportUrlQueryEnabledChange,
  onSupportUrlQueryPatternChange,
  existingSupportUrl,
  marketingUrlReplacement,
  marketingUrlAllLocales,
  marketingUrlQueryEnabled,
  marketingUrlQueryPattern,
  onMarketingUrlChange,
  onMarketingUrlAllLocalesChange,
  onMarketingUrlQueryEnabledChange,
  onMarketingUrlQueryPatternChange,
  existingMarketingUrl,
  descriptionContent,
  isDescriptionSelected,
  urlReplacements,
  onUrlReplacementsChange,
}: UrlOptionsProps) {
  // Ensure urlReplacements is always an array
  const safeUrlReplacements = urlReplacements || []
  // Detect URLs in description
  const detectedUrls = useMemo(() => {
    if (!isDescriptionSelected || !descriptionContent) {
      return []
    }
    return detectUrls(descriptionContent)
  }, [descriptionContent, isDescriptionSelected])

  // Handle URL replacement change
  const handleReplacementChange = (oldUrl: string, newUrl: string) => {
    const existingIndex = safeUrlReplacements.findIndex(r => r.oldUrl === oldUrl)

    if (newUrl === '') {
      // Remove the replacement if empty
      if (existingIndex >= 0) {
        const updated = safeUrlReplacements.filter(r => r.oldUrl !== oldUrl)
        onUrlReplacementsChange(updated)
      }
    } else {
      // Add or update the replacement
      if (existingIndex >= 0) {
        const updated = [...safeUrlReplacements]
        updated[existingIndex] = { oldUrl, newUrl }
        onUrlReplacementsChange(updated)
      } else {
        onUrlReplacementsChange([...safeUrlReplacements, { oldUrl, newUrl }])
      }
    }
  }

  // Get the current replacement value for a URL
  const getReplacementValue = (oldUrl: string): string => {
    const replacement = safeUrlReplacements.find(r => r.oldUrl === oldUrl)
    return replacement?.newUrl || ''
  }

  const [isOpen, setIsOpen] = useState(false)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-secondary)]">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-6 cursor-pointer hover:bg-[var(--color-surface-tertiary)]/50 transition-colors rounded-xl">
          <h3 className="text-sm font-medium text-[var(--color-content)]">
            URL Options
          </h3>
          <svg
            className={`w-4 h-4 text-[var(--color-content-muted)] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-6 pb-6 space-y-3">
            {/* Privacy URL Section */}
            <div>
              <label htmlFor="privacy-url" className="text-sm text-[var(--color-content)]">
                Privacy Policy URL
              </label>
              <p className="text-xs text-[var(--color-content-muted)] mt-1 mb-2">
                Set a privacy policy URL for app-level localizations
              </p>
              <Input
                id="privacy-url"
                type="url"
                value={privacyUrlReplacement}
                onChange={(e) => onPrivacyUrlChange(e.target.value)}
                placeholder="https://example.com/privacy"
                className="w-full"
              />
              {existingPrivacyUrl && (
                <p className="text-xs text-[var(--color-content-muted)] mt-1.5">
                  Current: <span className="font-mono">{existingPrivacyUrl}</span>
                </p>
              )}
            </div>

            {/* Apply to all locales toggle and locale query parameter toggle */}
            {privacyUrlReplacement && (
              <>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-[var(--color-content)]">
                        Apply to all existing locales
                      </span>
                      <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                        Not just the locales being translated
                      </p>
                    </div>
                    <Switch
                      checked={privacyUrlAllLocales}
                      onCheckedChange={onPrivacyUrlAllLocalesChange}
                    />
                  </div>
                </div>

                {/* Locale query parameter toggle */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-[var(--color-content)]">
                        Add locale query parameter
                      </span>
                      <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                        Append locale-specific parameters to the URL
                      </p>
                    </div>
                    <Switch
                      checked={privacyUrlQueryEnabled}
                      onCheckedChange={onPrivacyUrlQueryEnabledChange}
                    />
                  </div>

                  {privacyUrlQueryEnabled && (
                    <div className="space-y-2 pl-0">
                      <Input
                        type="text"
                        value={privacyUrlQueryPattern}
                        onChange={(e) => onPrivacyUrlQueryPatternChange(e.target.value)}
                        placeholder="?lang={language}"
                        className="w-full font-mono text-sm"
                      />
                      <p className="text-xs text-[var(--color-content-muted)]">
                        Use <code className="px-1 py-0.5 rounded bg-[var(--color-surface-tertiary)]">{'{language}'}</code> for language code (e.g., es) or <code className="px-1 py-0.5 rounded bg-[var(--color-surface-tertiary)]">{'{locale}'}</code> for full locale (e.g., es-ES)
                      </p>
                      {privacyUrlQueryPattern && (
                        <p className="text-xs text-[var(--color-content-secondary)]">
                          Preview (Spanish): <span className="font-mono">{buildLocaleUrl(privacyUrlReplacement, privacyUrlQueryPattern, 'es-ES')}</span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Support URL Section */}
            <div className="mt-3 pt-4 border-t border-[var(--color-border)]">
              <label htmlFor="support-url" className="text-sm text-[var(--color-content)]">
                Support URL
              </label>
              <p className="text-xs text-[var(--color-content-muted)] mt-1 mb-2">
                Set a support URL for version localizations
              </p>
              <Input
                id="support-url"
                type="url"
                value={supportUrlReplacement}
                onChange={(e) => onSupportUrlChange(e.target.value)}
                placeholder="https://example.com/support"
                className="w-full"
              />
              {existingSupportUrl && (
                <p className="text-xs text-[var(--color-content-muted)] mt-1.5">
                  Current: <span className="font-mono">{existingSupportUrl}</span>
                </p>
              )}

              {/* Apply to all locales toggle and locale query parameter toggle */}
              {supportUrlReplacement && (
                <>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-[var(--color-content)]">
                          Apply to all existing locales
                        </span>
                        <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                          Not just the locales being translated
                        </p>
                      </div>
                      <Switch
                        checked={supportUrlAllLocales}
                        onCheckedChange={onSupportUrlAllLocalesChange}
                      />
                    </div>
                  </div>

                  {/* Locale query parameter toggle */}
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-[var(--color-content)]">
                          Add locale query parameter
                        </span>
                        <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                          Append locale-specific parameters to the URL
                        </p>
                      </div>
                      <Switch
                        checked={supportUrlQueryEnabled}
                        onCheckedChange={onSupportUrlQueryEnabledChange}
                      />
                    </div>

                    {supportUrlQueryEnabled && (
                      <div className="space-y-2 pl-0">
                        <Input
                          type="text"
                          value={supportUrlQueryPattern}
                          onChange={(e) => onSupportUrlQueryPatternChange(e.target.value)}
                          placeholder="?lang={language}"
                          className="w-full font-mono text-sm"
                        />
                        <p className="text-xs text-[var(--color-content-muted)]">
                          Use <code className="px-1 py-0.5 rounded bg-[var(--color-surface-tertiary)]">{'{language}'}</code> for language code (e.g., es) or <code className="px-1 py-0.5 rounded bg-[var(--color-surface-tertiary)]">{'{locale}'}</code> for full locale (e.g., es-ES)
                        </p>
                        {supportUrlQueryPattern && (
                          <p className="text-xs text-[var(--color-content-secondary)]">
                            Preview (Spanish): <span className="font-mono">{buildLocaleUrl(supportUrlReplacement, supportUrlQueryPattern, 'es-ES')}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Marketing URL Section */}
            <div className="mt-3 pt-4 border-t border-[var(--color-border)]">
              <label htmlFor="marketing-url" className="text-sm text-[var(--color-content)]">
                Marketing URL
              </label>
              <p className="text-xs text-[var(--color-content-muted)] mt-1 mb-2">
                Set a marketing URL for version localizations
              </p>
              <Input
                id="marketing-url"
                type="url"
                value={marketingUrlReplacement}
                onChange={(e) => onMarketingUrlChange(e.target.value)}
                placeholder="https://example.com/app"
                className="w-full"
              />
              {existingMarketingUrl && (
                <p className="text-xs text-[var(--color-content-muted)] mt-1.5">
                  Current: <span className="font-mono">{existingMarketingUrl}</span>
                </p>
              )}

              {/* Apply to all locales toggle and locale query parameter toggle */}
              {marketingUrlReplacement && (
                <>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-[var(--color-content)]">
                          Apply to all existing locales
                        </span>
                        <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                          Not just the locales being translated
                        </p>
                      </div>
                      <Switch
                        checked={marketingUrlAllLocales}
                        onCheckedChange={onMarketingUrlAllLocalesChange}
                      />
                    </div>
                  </div>

                  {/* Locale query parameter toggle */}
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-[var(--color-content)]">
                          Add locale query parameter
                        </span>
                        <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
                          Append locale-specific parameters to the URL
                        </p>
                      </div>
                      <Switch
                        checked={marketingUrlQueryEnabled}
                        onCheckedChange={onMarketingUrlQueryEnabledChange}
                      />
                    </div>

                    {marketingUrlQueryEnabled && (
                      <div className="space-y-2 pl-0">
                        <Input
                          type="text"
                          value={marketingUrlQueryPattern}
                          onChange={(e) => onMarketingUrlQueryPatternChange(e.target.value)}
                          placeholder="?lang={language}"
                          className="w-full font-mono text-sm"
                        />
                        <p className="text-xs text-[var(--color-content-muted)]">
                          Use <code className="px-1 py-0.5 rounded bg-[var(--color-surface-tertiary)]">{'{language}'}</code> for language code (e.g., es) or <code className="px-1 py-0.5 rounded bg-[var(--color-surface-tertiary)]">{'{locale}'}</code> for full locale (e.g., es-ES)
                        </p>
                        {marketingUrlQueryPattern && (
                          <p className="text-xs text-[var(--color-content-secondary)]">
                            Preview (Spanish): <span className="font-mono">{buildLocaleUrl(marketingUrlReplacement, marketingUrlQueryPattern, 'es-ES')}</span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Description URLs Section (conditional) */}
            {isDescriptionSelected && detectedUrls.length > 0 && (
              <div className="mt-3 pt-4 border-t border-[var(--color-border)]">
                <div className="mb-3">
                  <span className="text-sm text-[var(--color-content)]">
                    Description URLs
                  </span>
                  <p className="text-xs text-[var(--color-content-muted)] mt-1">
                    {detectedUrls.length === 1
                      ? 'Detected 1 URL in your description'
                      : `Detected ${detectedUrls.length} URLs in your description`
                    }
                  </p>
                </div>

                <div className="space-y-4">
                  {detectedUrls.map((url) => (
                    <div key={url} className="space-y-2">
                      <div className="text-xs text-[var(--color-content-muted)] font-mono break-all bg-[var(--color-surface)] p-2 rounded border border-[var(--color-border)]">
                        {url}
                      </div>
                      <Input
                        type="url"
                        value={getReplacementValue(url)}
                        onChange={(e) => handleReplacementChange(url, e.target.value)}
                        placeholder="Replace with..."
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>

                <p className="text-xs text-[var(--color-content-muted)] mt-3">
                  Leave blank to keep original URL
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
