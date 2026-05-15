"use client";

import { useState, useEffect, useCallback } from "react";
import type { LocalizationJob, SelectedApp } from "@/lib/database/types";

export type ActivityType = "push" | "complete" | "create";

export interface Activity {
  type: ActivityType;
  appName: string;
  description: string;
  time: string;
  timestamp: Date;
}

export interface DashboardData {
  appsLocalized: number;
  totalTranslations: number;
  totalApps: number;
  hasCredentials: boolean;
  isSetup: boolean;
  selectedApps: Array<{
    id: string;
    name: string;
    iconUrl?: string | null;
  }>;
  activity: Activity[];
  gettingStartedSteps: Array<{
    label: string;
    completed: boolean;
    href: string;
  }>;
}

interface UseDashboardReturn {
  data: DashboardData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}w ago`;
  return date.toLocaleDateString();
}

function jobsToActivities(jobs: LocalizationJob[]): Activity[] {
  const activities: Activity[] = [];

  for (const job of jobs) {
    const localeCount = job.target_locales?.length || 0;

    if (job.pushed_to_asc) {
      activities.push({
        type: "push",
        appName: job.app_name,
        description: `Pushed ${localeCount} locale${localeCount !== 1 ? "s" : ""} to App Store Connect`,
        time: formatRelativeTime(new Date(job.completed_at || job.created_at)),
        timestamp: new Date(job.completed_at || job.created_at),
      });
    }

    if (job.status === "completed" && job.completed_at) {
      activities.push({
        type: "complete",
        appName: job.app_name,
        description: `Completed localization for ${localeCount} locale${localeCount !== 1 ? "s" : ""}`,
        time: formatRelativeTime(new Date(job.completed_at)),
        timestamp: new Date(job.completed_at),
      });
    }

    activities.push({
      type: "create",
      appName: job.app_name,
      description: "Started new localization job",
      time: formatRelativeTime(new Date(job.created_at)),
      timestamp: new Date(job.created_at),
    });
  }

  return activities
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);
}

export function useDashboard(): UseDashboardReturn {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [appsResponse, jobsResponse] = await Promise.all([
        fetch("/api/selected-apps"),
        fetch("/api/localization-jobs"),
      ]);

      if (!appsResponse.ok) throw new Error("Failed to fetch selected apps");
      if (!jobsResponse.ok) throw new Error("Failed to fetch localization jobs");

      const appsData = await appsResponse.json();
      const jobsData = await jobsResponse.json();

      const apps: SelectedApp[] = appsData.apps || [];
      const jobs: LocalizationJob[] = jobsData.jobs || [];
      const ascConnected: boolean = appsData.ascConnected ?? false;

      const completedJobs = jobs.filter((j) => j.status === "completed");
      const uniqueAppIds = [...new Set(completedJobs.map((j) => j.app_id))];
      const appsLocalized = uniqueAppIds.length;
      const totalTranslations = completedJobs.reduce(
        (sum, j) => sum + (j.target_locales?.length || 0),
        0
      );

      const selectedApps = apps.map((app) => ({
        id: app.app_id,
        name: app.app_name,
        iconUrl: app.app_icon_url,
      }));

      const activity = jobsToActivities(jobs);
      const hasLocalizedAnApp = completedJobs.length > 0;

      const gettingStartedSteps = [
        {
          label: "Configure App Store Connect",
          completed: ascConnected,
          href: "/settings",
        },
        {
          label: "Add your first app",
          completed: apps.length > 0,
          href: "/apps",
        },
        {
          label: "Localize an app",
          completed: hasLocalizedAnApp,
          href: "/apps",
        },
      ];

      const isSetup = ascConnected && apps.length > 0;

      setData({
        appsLocalized,
        totalTranslations,
        totalApps: apps.length,
        hasCredentials: ascConnected,
        isSetup,
        selectedApps,
        activity,
        gettingStartedSteps,
      });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && data && !isLoading) {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [data, isLoading, fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
