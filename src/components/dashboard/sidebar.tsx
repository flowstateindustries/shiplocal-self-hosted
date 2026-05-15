"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { CommandMenu } from "@/components/command-menu";

interface SidebarProps {
  onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [commandOpen, setCommandOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(path);
  };

  const isSettingsActive = pathname.startsWith("/settings");

  const navItemClass = (active: boolean) =>
    `cursor-pointer flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors duration-150 focus:outline-none active:scale-[0.98] ${
      active
        ? "bg-[var(--color-surface-hover)] text-[var(--color-content)]"
        : "text-[var(--color-content-tertiary)] hover:text-[var(--color-content)] hover:bg-[var(--color-surface-hover)]/50 active:bg-[var(--color-surface-hover)]"
    }`;

  const footerItemClass =
    "cursor-pointer flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--color-content-tertiary)] transition-colors duration-150 hover:text-[var(--color-content)] hover:bg-[var(--color-surface-hover)]/50 focus:outline-none active:scale-[0.98] active:bg-[var(--color-surface-hover)]";

  return (
    <aside className="flex flex-col h-full w-64 bg-[var(--color-surface-secondary)] rounded-2xl border border-[var(--color-border)] shadow-[0_0_20px_rgba(59,130,246,0.08),0_0_40px_rgba(139,92,246,0.05)] dark:shadow-[0_0_20px_rgba(59,130,246,0.15),0_0_40px_rgba(139,92,246,0.1)]">
      {onClose && (
        <button
          onClick={onClose}
          className="sidebar:hidden absolute top-4 right-4 p-2 text-[var(--color-content-tertiary)] hover:text-[var(--color-content)] transition-colors duration-150 focus:outline-none active:scale-95"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Brand header */}
      <div className="px-4 pt-6 pb-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="h-11 w-11 shrink-0 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center">
            <svg
              className="h-6 w-6 text-[var(--color-content)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 12l8-8 8 8M5 10v10h14V10"
              />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-medium text-[var(--color-content)] truncate">
              ShipLocal
            </p>
            <p className="text-sm text-[var(--color-content-tertiary)] truncate">
              Running locally
            </p>
          </div>
        </Link>
      </div>

      {/* Content area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto px-4 py-2 hide-scrollbar">
        <button
          onClick={() => setCommandOpen(true)}
          className="cursor-pointer flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-tertiary)] px-3 py-2.5 mb-3 text-sm transition-colors duration-150 hover:bg-[var(--color-surface-hover)] focus:outline-none active:scale-[0.98] active:bg-[var(--color-surface-hover)]"
        >
          <svg
            className="h-5 w-5 text-[var(--color-content-muted)]"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14" />
          </svg>
          <span className="flex-1 text-left text-[var(--color-content-muted)]">Search...</span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface-hover)] px-1.5 font-mono text-[11px] text-[var(--color-content-tertiary)]">
            <span className="text-sm">⌘</span>K
          </kbd>
        </button>

        <nav className="flex flex-col gap-1">
          <Link
            href="/dashboard"
            className={navItemClass(isActive("/dashboard"))}
            onClick={onClose}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M5 19V5h6v14zm14 0h-6v-7h6zm0-9h-6V5h6z" />
            </svg>
            <span className="font-medium">Dashboard</span>
          </Link>

          <Link
            href="/apps"
            className={navItemClass(isActive("/apps"))}
            onClick={onClose}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" />
            </svg>
            <span className="font-medium">Apps</span>
          </Link>

          <Link
            href="/strings"
            className={navItemClass(isActive("/strings"))}
            onClick={onClose}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" />
            </svg>
            <span className="font-medium">Strings</span>
          </Link>

          <Link
            href="/history"
            className={navItemClass(isActive("/history"))}
            onClick={onClose}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9m-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8z" />
            </svg>
            <span className="font-medium">History</span>
          </Link>

          <Link
            href="/settings"
            className={navItemClass(isSettingsActive)}
            onClick={onClose}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6" />
            </svg>
            <span className="font-medium">Settings</span>
          </Link>
        </nav>
      </div>

      <div className="flex flex-col gap-1 px-4 py-3">
        <button onClick={toggleTheme} className={footerItemClass}>
          {theme === "dark" ? (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5M2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1m18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1M11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1m0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1M5.99 4.58c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41zm12.37 12.37c-.39-.39-1.03-.39-1.41 0-.39.39-.39 1.03 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0 .39-.39.39-1.03 0-1.41zm1.06-10.96c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0zM7.05 18.36c.39-.39.39-1.03 0-1.41-.39-.39-1.03-.39-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1" />
            </svg>
          )}
          <span className="font-medium">
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </span>
        </button>
      </div>

      <CommandMenu
        open={commandOpen}
        onOpenChange={setCommandOpen}
        theme={theme}
        toggleTheme={toggleTheme}
      />
    </aside>
  );
}
