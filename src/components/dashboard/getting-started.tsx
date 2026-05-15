"use client";

import Link from "next/link";

interface Step {
  label: string;
  completed: boolean;
  href: string;
}

interface GettingStartedProps {
  steps: Step[];
}

export function GettingStarted({ steps }: GettingStartedProps) {
  const completedCount = steps.filter((s) => s.completed).length;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="relative z-20 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-5 card-hover animate-fade-up delay-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-[var(--color-content)]">Getting Started</h3>
        <span className="text-xs text-[var(--color-content-muted)]">
          {completedCount}/{steps.length} complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-[var(--color-surface-hover)] rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, index) => (
          <Link
            key={index}
            href={step.href}
            className="flex items-center gap-3 group"
          >
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                step.completed
                  ? "bg-green-500 text-white"
                  : "border-2 border-[var(--color-border)] group-hover:border-blue-500"
              }`}
            >
              {step.completed && (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span
              className={`text-sm transition-colors ${
                step.completed
                  ? "text-[var(--color-content-muted)] line-through"
                  : "text-[var(--color-content)] group-hover:text-blue-500"
              }`}
            >
              {step.label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
