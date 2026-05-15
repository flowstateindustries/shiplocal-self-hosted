"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Button, Modal, Input } from "@/components/ui";
import type { ASCApp } from "@/lib/appstore";

interface AppSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (app: ASCApp) => void;
  selectedAppIds: string[];
  isAdding?: boolean;
  hasASCCredentials?: boolean;
}

interface ITunesLookupResult {
  trackId: number;
  trackName: string;
  sellerName: string;
  artworkUrl512: string;
  bundleId: string;
  trackViewUrl: string;
}

type UrlTabView = 'form' | 'loading' | 'error' | 'result';

/**
 * Extract app ID and country from an App Store URL
 * Handles formats like:
 * - https://apps.apple.com/us/app/app-name/id123456789
 * - https://apps.apple.com/app/id123456789
 * - URLs with ?id=123456789 query param
 */
function extractAppInfoFromUrl(url: string): { appId: string | null; country: string } {
  const idMatch = url.match(/\/id(\d+)|[?&]id=(\d+)/i);
  const appId = idMatch ? (idMatch[1] || idMatch[2]) : null;
  const countryMatch = url.match(/apps\.apple\.com\/([a-z]{2})\//i);
  const country = countryMatch ? countryMatch[1].toLowerCase() : 'us';
  return { appId, country };
}

export function AppSelector({
  isOpen,
  onClose,
  onSelect,
  selectedAppIds,
  isAdding,
  hasASCCredentials = true,
}: AppSelectorProps) {
  const [activeTab, setActiveTab] = useState<'asc' | 'url'>(hasASCCredentials ? 'asc' : 'url');

  // ASC tab state
  const [apps, setApps] = useState<ASCApp[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // URL tab state
  const [urlInput, setUrlInput] = useState("");
  const [urlTabView, setUrlTabView] = useState<UrlTabView>('form');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<ITunesLookupResult | null>(null);
  const [lookupCountry, setLookupCountry] = useState<string>('us');

  const fetchApps = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/apps");
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch apps");
        return;
      }

      setApps(data.apps || []);
    } catch {
      setError("Failed to fetch apps");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch apps when modal opens (only for ASC tab)
  useEffect(() => {
    if (isOpen && activeTab === 'asc' && hasASCCredentials) {
      fetchApps();
    }
  }, [isOpen, activeTab, hasASCCredentials, fetchApps]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setUrlInput("");
      setUrlTabView('form');
      setUrlError(null);
      setLookupResult(null);
    }
  }, [isOpen]);

  // Set default tab based on ASC credentials
  useEffect(() => {
    if (isOpen) {
      setActiveTab(hasASCCredentials ? 'asc' : 'url');
    }
  }, [isOpen, hasASCCredentials]);

  // Filter apps by search query
  const filteredApps = apps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.bundleId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get available apps (not already selected)
  const availableApps = filteredApps.filter(
    (app) => !selectedAppIds.includes(app.id)
  );

  // URL tab handlers
  const handleLookupApp = async () => {
    const { appId, country } = extractAppInfoFromUrl(urlInput.trim());

    if (!appId) {
      setUrlError("Please enter a valid App Store URL");
      setUrlTabView('error');
      return;
    }

    setLookupCountry(country);
    setUrlTabView('loading');
    setUrlError(null);

    try {
      const response = await fetch(`/api/itunes-lookup/${appId}?country=${country}`);
      const data = await response.json();

      if (!data.success || !data.data) {
        setUrlError(data.error || "App not found. Please check the URL.");
        setUrlTabView('error');
        return;
      }

      setLookupResult(data.data);
      setUrlTabView('result');
    } catch {
      setUrlError("Failed to look up app. Please try again.");
      setUrlTabView('error');
    }
  };

  const handleAddUrlApp = () => {
    if (!lookupResult) return;

    const app: ASCApp = {
      id: String(lookupResult.trackId),
      name: lookupResult.trackName,
      bundleId: lookupResult.bundleId,
      iconUrl: lookupResult.artworkUrl512,
      storeUrl: lookupResult.trackViewUrl,
      sku: '',
      country: lookupCountry,
    };

    onSelect(app);
  };

  const handleResetUrlForm = () => {
    setUrlInput("");
    setUrlTabView('form');
    setUrlError(null);
    setLookupResult(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select an App"
    >
      <div className="space-y-4">
        {/* Tab buttons */}
        <div className="flex gap-2">
          {hasASCCredentials && (
            <button
              onClick={() => setActiveTab('asc')}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'asc'
                  ? 'bg-[var(--color-surface-hover)] text-[var(--color-content)]'
                  : 'bg-transparent text-[var(--color-content-tertiary)] hover:text-[var(--color-content-secondary)]'
              }`}
            >
              App Store Connect
            </button>
          )}
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'url'
                ? 'bg-[var(--color-surface-hover)] text-[var(--color-content)]'
                : 'bg-transparent text-[var(--color-content-tertiary)] hover:text-[var(--color-content-secondary)]'
            }`}
          >
            Add via URL
          </button>
        </div>

        {/* ASC Tab Content */}
        {activeTab === 'asc' && hasASCCredentials && (
          <>
            {/* Search input */}
            <Input
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-content)]" />
              </div>
            )}

            {/* Error state */}
            {error && !isLoading && (
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-500">{error}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchApps}
                  className="mt-2"
                >
                  Try again
                </Button>
              </div>
            )}

            {/* No apps state */}
            {!isLoading && !error && apps.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[var(--color-content-muted)]">
                  No apps found in your App Store Connect account.
                </p>
              </div>
            )}

            {/* All apps selected state */}
            {!isLoading && !error && apps.length > 0 && availableApps.length === 0 && (
              <div className="text-center py-8">
                <p className="text-[var(--color-content-muted)]">
                  {searchQuery
                    ? "No matching apps found."
                    : "All your apps have been selected."}
                </p>
              </div>
            )}

            {/* Apps list */}
            {!isLoading && !error && availableApps.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {availableApps.map((app) => (
                  <button
                    key={app.id}
                    onClick={() => onSelect(app)}
                    disabled={isAdding}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:border-[var(--color-content-muted)] transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {/* App icon */}
                    {app.iconUrl ? (
                      <Image
                        src={app.iconUrl}
                        alt={app.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-sm font-medium text-[var(--color-content-secondary)] flex-shrink-0">
                        {app.name[0]?.toUpperCase() || "?"}
                      </div>
                    )}

                    {/* App info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[var(--color-content)] truncate">
                        {app.name}
                      </p>
                      <p className="text-xs text-[var(--color-content-muted)] truncate">
                        {app.bundleId}
                      </p>
                    </div>

                    {/* Add icon */}
                    <svg
                      className="w-5 h-5 text-[var(--color-content-muted)]"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* URL Tab Content */}
        {activeTab === 'url' && (
          <>
            {/* Form view */}
            {urlTabView === 'form' && (
              <div className="space-y-4">
                <p className="text-sm text-[var(--color-content-secondary)]">
                  Paste an App Store URL to add an app without connecting App Store Connect.
                </p>
                <Input
                  placeholder="https://apps.apple.com/us/app/my-app/id123456789"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  autoFocus
                />
                <Button
                  onClick={handleLookupApp}
                  disabled={!urlInput.trim()}
                  className="w-full"
                >
                  Look Up App
                </Button>
              </div>
            )}

            {/* Loading view */}
            {urlTabView === 'loading' && (
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-content)]" />
                <p className="text-sm text-[var(--color-content-muted)]">Looking up app...</p>
              </div>
            )}

            {/* Error view */}
            {urlTabView === 'error' && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-500">{urlError}</p>
                </div>
                <Button
                  variant="ghost"
                  onClick={handleResetUrlForm}
                  className="w-full"
                >
                  Try again
                </Button>
              </div>
            )}

            {/* Result view */}
            {urlTabView === 'result' && lookupResult && (
              <div className="space-y-4">
                {/* App preview card */}
                <div className="flex items-center gap-4 p-4 bg-[var(--color-surface-hover)]/50 border border-[var(--color-border)] rounded-xl">
                  {lookupResult.artworkUrl512 ? (
                    <Image
                      src={lookupResult.artworkUrl512}
                      alt={lookupResult.trackName}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center text-lg font-medium text-[var(--color-content-secondary)] flex-shrink-0">
                      {lookupResult.trackName[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-content)] truncate">
                      {lookupResult.trackName}
                    </p>
                    <p className="text-sm text-[var(--color-content-muted)] truncate">
                      {lookupResult.sellerName}
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={handleResetUrlForm}
                    disabled={isAdding}
                    className="flex-1"
                  >
                    Use different URL
                  </Button>
                  <Button
                    onClick={handleAddUrlApp}
                    disabled={isAdding}
                    className="flex-1"
                  >
                    {isAdding ? "Adding..." : "Add App"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-[var(--color-border)]">
          <Button variant="ghost" onClick={onClose} disabled={isAdding}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
