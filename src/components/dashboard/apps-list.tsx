"use client";

import Link from "next/link";
import Image from "next/image";

interface App {
  id: string;
  name: string;
  iconUrl?: string | null;
}

interface AppsListProps {
  apps: App[];
}

export function AppsList({ apps }: AppsListProps) {
  return (
    <div className="relative z-20 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-5 card-hover animate-fade-up delay-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--color-content)]">Your Apps</h3>
        <span className="text-xs text-[var(--color-content-muted)]">
          {apps.length} {apps.length === 1 ? "app" : "apps"}
        </span>
      </div>

      <div className="space-y-2">
        {apps.map((app) => (
          <div
            key={app.id}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-[var(--color-surface-secondary)]"
          >
            {app.iconUrl ? (
              <Image
                src={app.iconUrl}
                alt={app.name}
                width={32}
                height={32}
                className="w-8 h-8 rounded-lg"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-hover)] flex items-center justify-center text-xs font-medium text-[var(--color-content-secondary)]">
                {app.name[0]}
              </div>
            )}
            <span className="flex-1 text-sm text-[var(--color-content)] truncate">{app.name}</span>
          </div>
        ))}
      </div>

      {apps.length === 0 && (
        <p className="text-sm text-[var(--color-content-muted)] text-center py-4">
          No apps selected yet
        </p>
      )}

      <Link
        href="/apps"
        className="mt-4 block text-center text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors"
      >
        Manage apps
      </Link>
    </div>
  );
}
