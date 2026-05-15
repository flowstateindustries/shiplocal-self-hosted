"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface ConnectionCardProps {
  isConnected: boolean;
}

export function ConnectionCard({ isConnected }: ConnectionCardProps) {
  return (
    <div className="relative z-20 overflow-hidden bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-5 card-hover animate-fade-up delay-100">
      {/* Gradient accent bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isConnected
            ? "bg-gradient-to-r from-green-500 via-green-400 to-emerald-500"
            : "bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500"
        }`}
      />

      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-[var(--color-content-muted)] uppercase tracking-wider">
          Connection
        </span>
        <Badge variant={isConnected ? "success" : "warning"} className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-green-500 status-dot-pulse" : "bg-amber-500"
            }`}
          />
          {isConnected ? "Connected" : "Not Connected"}
        </Badge>
      </div>
      <p className="text-sm text-[var(--color-content-secondary)] mb-4">
        {isConnected
          ? "Your App Store Connect account is linked and ready to use."
          : "Connect your App Store Connect account to push localizations directly."}
      </p>
      <Link
        href="/settings?tab=connections"
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors group"
      >
        {isConnected ? "Manage connection" : "Connect now"}
        <svg
          className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
