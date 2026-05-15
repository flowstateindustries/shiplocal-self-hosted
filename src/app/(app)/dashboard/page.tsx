"use client";

import Link from "next/link";
import {
  StatCard,
  ActivityItem,
  ConnectionCard,
  GettingStarted,
  AppsList,
} from "@/components/dashboard";
import { Button } from "@/components/ui";
import { useDashboard } from "@/hooks/use-dashboard";

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-32 bg-[var(--color-surface-tertiary)] rounded" />
          <div className="h-4 w-64 bg-[var(--color-surface-tertiary)] rounded mt-2" />
        </div>
        <div className="h-10 w-36 bg-[var(--color-surface-tertiary)] rounded-xl" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl"
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="h-80 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl" />
        <div className="space-y-6">
          <div className="h-32 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl" />
          <div className="h-48 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

function DashboardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg
        className="w-12 h-12 text-red-500 mb-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <h2 className="text-lg font-semibold text-[var(--color-content)] mb-2">
        Failed to load dashboard
      </h2>
      <p className="text-sm text-[var(--color-content-secondary)] mb-4">{message}</p>
      <Button onClick={onRetry}>Try Again</Button>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, error, refetch } = useDashboard();

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error || !data) {
    return <DashboardError message={error || "Unknown error"} onRetry={refetch} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-fade-up">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-content)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-1">
            Welcome back! Here&apos;s an overview of your localization activity.
          </p>
        </div>
        <Link href="/apps">
          <Button className="shadow-lg">
            <svg
              className="w-4 h-4 mr-2"
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
            New Localization
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Apps Localized"
          value={data.appsLocalized}
          iconColor="blue"
          delay={100}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          }
        />

        <StatCard
          label="Translations"
          value={data.totalTranslations}
          iconColor="green"
          delay={200}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
              />
            </svg>
          }
        />

        <StatCard
          label="Apps Tracked"
          value={data.totalApps}
          iconColor="purple"
          delay={300}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          }
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="relative z-20 bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-6 card-hover animate-fade-up delay-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-500 to-purple-500" />
              <h2 className="text-lg font-semibold text-[var(--color-content)]">Activity</h2>
            </div>
            <Link
              href="/history"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-500 hover:text-blue-400 transition-colors group"
            >
              View all
              <svg
                className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>

          {data.activity.length > 0 ? (
            <div className="divide-y divide-[var(--color-border)]">
              {data.activity.map((activity, index) => (
                <ActivityItem
                  key={index}
                  type={activity.type}
                  appName={activity.appName}
                  description={activity.description}
                  time={activity.time}
                />
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <svg
                className="w-12 h-12 mx-auto text-[var(--color-content-muted)] mb-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-[var(--color-content-secondary)]">No activity yet</p>
              <p className="text-sm text-[var(--color-content-muted)] mt-1">
                Start localizing to see your activity here
              </p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <ConnectionCard isConnected={data.hasCredentials} />

          {data.isSetup ? (
            <AppsList apps={data.selectedApps} />
          ) : (
            <GettingStarted steps={data.gettingStartedSteps} />
          )}
        </div>
      </div>
    </div>
  );
}
