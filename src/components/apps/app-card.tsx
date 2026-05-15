"use client";

import Image from "next/image";
import { Button } from "@/components/ui";

interface AppCardProps {
  appId: string;
  name: string;
  iconUrl?: string | null;
  isLocked: boolean;
  onRemove?: () => void;
  isRemoving?: boolean;
  onLocalize?: () => void;
}

export function AppCard({
  name,
  iconUrl,
  isLocked,
  onRemove,
  isRemoving,
  onLocalize,
}: AppCardProps) {
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking on a button
    if ((e.target as HTMLElement).closest("button")) return;
    onLocalize?.();
  };

  const handleRemoveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <div
      onClick={handleCardClick}
      className="relative flex items-center gap-4 p-5 rounded-2xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
    >

      {/* App icon */}
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt={name}
          width={56}
          height={56}
          className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center text-lg font-medium text-[var(--color-content-secondary)] flex-shrink-0">
          {name[0]?.toUpperCase() || "?"}
        </div>
      )}

      {/* App info */}
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-[var(--color-content)] truncate">
          {name}
        </h3>
        <p className="text-xs text-[var(--color-content-muted)] mt-0.5">
          {isLocked ? "Localized" : "Ready to localize"}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Lock icon for locked apps, remove button for unlocked */}
        {isLocked ? (
          <div className="p-2">
            <svg
              className="w-5 h-5 text-[var(--color-content-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveClick}
            disabled={isRemoving}
            className="text-[var(--color-content-muted)] hover:text-red-500"
          >
            {isRemoving ? (
              <span className="animate-spin">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </span>
            ) : (
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
