"use client";

import { useEffect, useState } from "react";
import { ConnectionsTab } from "@/components/settings";

interface CredentialsStatus {
  ascConnected: boolean;
  ascIssuerId: string | null;
  ascKeyId: string | null;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<CredentialsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/credentials");
        if (!response.ok) throw new Error("Failed to load credentials");
        const data = (await response.json()) as CredentialsStatus;
        if (!cancelled) setStatus(data);
      } catch {
        if (!cancelled) {
          setStatus({ ascConnected: false, ascIssuerId: null, ascKeyId: null });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-content)]">Settings</h1>
        <p className="text-sm text-[var(--color-content-secondary)] mt-1">
          Manage your local connections
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-content)]" />
        </div>
      ) : (
        <ConnectionsTab
          ascConnected={status?.ascConnected ?? false}
          ascIssuerId={status?.ascIssuerId ?? null}
          ascKeyId={status?.ascKeyId ?? null}
        />
      )}
    </div>
  );
}
