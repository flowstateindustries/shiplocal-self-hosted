"use client";

import { ReactNode } from "react";
import Link from "next/link";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconColor: "amber" | "blue" | "green" | "purple";
  action?: {
    label: string;
    href: string;
  };
  delay?: number;
}

const colorClasses = {
  amber: "text-amber-500 bg-amber-500/10",
  blue: "text-blue-500 bg-blue-500/10",
  green: "text-green-500 bg-green-500/10",
  purple: "text-purple-500 bg-purple-500/10",
};

const gradientStyles = {
  blue: "bg-gradient-to-br from-blue-500/5 via-transparent to-transparent",
  green: "bg-gradient-to-br from-green-500/5 via-transparent to-transparent",
  purple: "bg-gradient-to-br from-purple-500/5 via-transparent to-transparent",
  amber: "bg-gradient-to-br from-amber-500/5 via-transparent to-transparent",
};

const iconRingStyles = {
  blue: "ring-2 ring-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.15)]",
  green: "ring-2 ring-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.15)]",
  purple: "ring-2 ring-purple-500/20 shadow-[0_0_20px_rgba(168,85,247,0.15)]",
  amber: "ring-2 ring-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.15)]",
};

const glowClasses = {
  blue: "stat-glow-blue",
  green: "stat-glow-green",
  purple: "stat-glow-purple",
  amber: "stat-glow-amber",
};

const delayClasses: Record<number, string> = {
  100: "delay-100",
  200: "delay-200",
  300: "delay-300",
};

export function StatCard({ label, value, icon, iconColor, action, delay }: StatCardProps) {
  const delayClass = delay ? delayClasses[delay] || "" : "";

  return (
    <div
      className={`group card-hover animate-fade-up ${delayClass} relative z-20 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-6 ${glowClasses[iconColor]} ${gradientStyles[iconColor]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-[var(--color-content-secondary)] mb-1">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-[var(--color-content)]">{value}</p>
        </div>
        <div
          className={`p-3 rounded-xl ${colorClasses[iconColor]} ${iconRingStyles[iconColor]} transition-transform duration-300 group-hover:scale-110`}
        >
          {icon}
        </div>
      </div>
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-blue-500 hover:text-blue-400 transition-colors group/link"
        >
          {action.label}
          <svg
            className="w-3 h-3 transition-transform duration-200 group-hover/link:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}
