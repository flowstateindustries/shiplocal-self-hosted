"use client";

import Link from "next/link";

interface MobileHeaderProps {
  onMenuClick: () => void;
}

export function MobileHeader({ onMenuClick }: MobileHeaderProps) {
  return (
    <header className="sidebar:hidden fixed top-3 left-3 right-3 z-40 bg-[var(--color-surface-secondary)] rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Hamburger Menu */}
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 text-[var(--color-content-tertiary)] hover:text-[var(--color-content)] transition-colors duration-150 focus:outline-none active:scale-95"
          aria-label="Open menu"
        >
          <svg
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center">
          <span className="text-[var(--color-content)] font-medium text-lg">
            ShipLocal
          </span>
        </Link>

        {/* Spacer to balance the layout */}
        <div className="w-10" />
      </div>
    </header>
  );
}
