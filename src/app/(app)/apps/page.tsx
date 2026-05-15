"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppCard, AppSelector } from "@/components/apps";
import type { SelectedApp } from "@/lib/database/types";
import type { ASCApp } from "@/lib/appstore";

export default function AppsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<SelectedApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [removingAppId, setRemovingAppId] = useState<string | null>(null);
  const [isAddingApp, setIsAddingApp] = useState(false);
  const [hasASCCredentials, setHasASCCredentials] = useState(true);

  const fetchApps = useCallback(async () => {
    try {
      const response = await fetch("/api/selected-apps");
      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to fetch apps");
        return;
      }

      setApps(data.apps || []);
      setHasASCCredentials(data.ascConnected ?? true);
    } catch {
      toast.error("Failed to fetch apps");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  const handleAddApp = async (ascApp: ASCApp) => {
    setIsAddingApp(true);

    try {
      const response = await fetch("/api/selected-apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appId: ascApp.id,
          appName: ascApp.name,
          appIconUrl: ascApp.iconUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to add app");
        return;
      }

      toast.success(`Added ${ascApp.name}`);
      setSelectorOpen(false);
      fetchApps();
    } catch {
      toast.error("Failed to add app");
    } finally {
      setIsAddingApp(false);
    }
  };

  const handleRemoveApp = async (appId: string, appName: string) => {
    setRemovingAppId(appId);

    try {
      const response = await fetch(`/api/selected-apps/${appId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to remove app");
        return;
      }

      toast.success(`Removed ${appName}`);
      fetchApps();
    } catch {
      toast.error("Failed to remove app");
    } finally {
      setRemovingAppId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-content)]">Apps</h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-1">
            Manage your App Store Connect apps
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-content)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-content)]">Apps</h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-1">
            Manage your App Store Connect apps
          </p>
        </div>
      </div>

      {apps.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <AppCard
              key={app.id}
              appId={app.app_id}
              name={app.app_name}
              iconUrl={app.app_icon_url}
              isLocked={false}
              onRemove={() => handleRemoveApp(app.app_id, app.app_name)}
              isRemoving={removingAppId === app.app_id}
              onLocalize={() => router.push(`/localization/${app.app_id}`)}
            />
          ))}

          <button
            onClick={() => setSelectorOpen(true)}
            className="flex items-center justify-center p-5 rounded-2xl border-2 border-dashed border-[var(--color-border-secondary)] cursor-pointer transition-colors min-h-[88px]"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
              <svg
                className="w-5 h-5 text-[var(--color-content-tertiary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <button
            onClick={() => setSelectorOpen(true)}
            className="flex items-center justify-center p-5 rounded-2xl border-2 border-dashed border-[var(--color-border-secondary)] cursor-pointer transition-colors min-h-[88px]"
          >
            <div className="w-10 h-10 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center">
              <svg
                className="w-5 h-5 text-[var(--color-content-tertiary)]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
          </button>
        </div>
      )}

      <AppSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleAddApp}
        selectedAppIds={apps.map((a) => a.app_id)}
        isAdding={isAddingApp}
        hasASCCredentials={hasASCCredentials}
      />
    </div>
  );
}
