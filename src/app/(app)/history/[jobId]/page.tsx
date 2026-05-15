"use client";

import { useState, useEffect, useCallback, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Badge } from "@/components/ui";
import { JobStatusBadge } from "@/components/history";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Upload, Loader2, CheckCircle2, ChevronDown, Play, X } from "lucide-react";
import type { LocalizationJob, LocaleResult, LocaleResultStatus } from "@/lib/database/types";
import type { JobConfig } from "@/lib/localization/types";
import { ResumeButton } from "@/components/history/resume-button";

interface PageProps {
  params: Promise<{ jobId: string }>;
}

// Format date to readable format
function formatDate(dateString: string): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Field labels mapping
const fieldLabels: Record<string, string> = {
  description: "Description",
  keywords: "Keywords",
  promotionalText: "Promotional Text",
  whatsNew: "What's New",
  name: "Name",
  subtitle: "Subtitle",
  appName: "App Name",
  appSubtitle: "Subtitle",
};

// Locale names mapping (subset of common ones)
const localeNames: Record<string, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "en-AU": "English (Australia)",
  "en-CA": "English (Canada)",
  "fr-FR": "French",
  "fr-CA": "French (Canada)",
  "de-DE": "German",
  "es-ES": "Spanish (Spain)",
  "es-MX": "Spanish (Mexico)",
  "it-IT": "Italian",
  "pt-BR": "Portuguese (Brazil)",
  "pt-PT": "Portuguese (Portugal)",
  "ja-JP": "Japanese",
  "ko-KR": "Korean",
  "zh-Hans": "Chinese (Simplified)",
  "zh-Hant": "Chinese (Traditional)",
  "nl-NL": "Dutch",
  "ru-RU": "Russian",
  "pl-PL": "Polish",
  "tr-TR": "Turkish",
  "sv-SE": "Swedish",
  "da-DK": "Danish",
  "fi-FI": "Finnish",
  "no-NO": "Norwegian",
  "th-TH": "Thai",
  "vi-VI": "Vietnamese",
  "id-ID": "Indonesian",
  "ms-MY": "Malay",
  "ar-SA": "Arabic",
  "he-IL": "Hebrew",
  "hi-IN": "Hindi",
  "cs-CZ": "Czech",
  "el-GR": "Greek",
  "hu-HU": "Hungarian",
  "ro-RO": "Romanian",
  "sk-SK": "Slovak",
  "uk-UA": "Ukrainian",
};

// Collapsible locale card component
function LocaleCard({ result }: { result: LocaleResult }) {
  const [isOpen, setIsOpen] = useState(false);
  const localeName = localeNames[result.locale] || result.locale;

  // Count available fields
  const fields = Object.entries(result)
    .filter(([key, value]) => key !== "locale" && value)
    .map(([key, value]) => ({ key, value: value as string }));

  const copyToClipboard = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${fieldName} copied`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="bg-[var(--color-surface-secondary)]/50 border border-[var(--color-border)] rounded-xl overflow-hidden">
      {/* Clickable header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-4 p-4 hover:bg-[var(--color-surface-hover)]/30 transition-colors"
      >
        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
        <div className="flex-1 text-left">
          <p className="text-[var(--color-content)] font-medium">{localeName}</p>
          <p className="text-[var(--color-content-muted)] text-xs">{result.locale}</p>
        </div>
        <span className="text-sm text-[var(--color-content-secondary)]">
          {fields.length} fields
        </span>
        <ChevronDown
          className={`w-5 h-5 text-[var(--color-content-muted)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="border-t border-[var(--color-border)] p-4 space-y-4">
          {fields.map(({ key, value }) => (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider">
                  {fieldLabels[key] || key}
                </p>
                <button
                  onClick={() => copyToClipboard(value, fieldLabels[key] || key)}
                  className="text-xs text-[var(--color-content-muted)] hover:text-[var(--color-content)] transition-colors"
                >
                  Copy
                </button>
              </div>
              <p className="text-[var(--color-content)] text-sm whitespace-pre-wrap bg-[var(--color-surface-tertiary)] rounded-lg p-3">
                {value}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Pushed badge component
function PushedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-full">
      <Upload className="w-3 h-3" />
      Pushed
    </span>
  );
}

export default function JobDetailPage({ params }: PageProps) {
  const { jobId } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<LocalizationJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasASCCredentials, setHasASCCredentials] = useState(false);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch job details
  const fetchJob = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch(`/api/localization-jobs/${jobId}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch job");
        return;
      }

      setJob(data.job);

      // Also check ASC status for the app (use selected-apps endpoint for consistency)
      if (data.job?.app_id) {
        try {
          const selectedAppResponse = await fetch(`/api/selected-apps/${data.job.app_id}`);
          if (selectedAppResponse.ok) {
            const selectedAppData = await selectedAppResponse.json();
            setHasASCCredentials(selectedAppData.ascConnected === true);
            setIsManualMode(!selectedAppData.ascConnected);
          }
        } catch {
          // Silently fail - ASC status is not critical
        }
      }
    } catch {
      setError("Failed to fetch job");
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  // Refetch job data when page becomes visible (user returns from another page)
  // fetchJob() already fetches both job data AND ASC status, so no separate fetch needed
  // Uses AbortController to prevent race conditions with rapid tab switching
  useEffect(() => {
    let abortController: AbortController | null = null

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && job && !isLoading) {
        // Abort any in-flight request
        if (abortController) abortController.abort()
        abortController = new AbortController()

        try {
          const response = await fetch(`/api/localization-jobs/${jobId}`, {
            signal: abortController.signal
          })
          const data = await response.json()

          if (!response.ok) {
            setError(data.error || "Failed to fetch job")
            return
          }

          setJob(data.job)

          // Also check ASC status for the app
          if (data.job?.app_id) {
            try {
              const selectedAppResponse = await fetch(`/api/selected-apps/${data.job.app_id}`, {
                signal: abortController.signal
              })
              if (selectedAppResponse.ok) {
                const selectedAppData = await selectedAppResponse.json()
                setHasASCCredentials(selectedAppData.ascConnected === true)
                setIsManualMode(!selectedAppData.ascConnected)
              }
            } catch (err) {
              // Silently fail unless it's not an abort error
              if (err instanceof Error && err.name !== 'AbortError') {
                console.error('Error fetching ASC status:', err)
              }
            }
          }
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('Error refetching job:', err)
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (abortController) abortController.abort()
    }
  }, [job, isLoading, jobId])

  // Handle push to ASC
  const handlePush = useCallback(async () => {
    if (!job || !hasASCCredentials || isManualMode) return;
    setIsPushing(true);
    router.push(`/localization/${job.app_id}/pushing?jobId=${jobId}`);
  }, [job, hasASCCredentials, isManualMode, router, jobId]);

  // Handle cancel job
  const handleCancel = useCallback(async () => {
    if (!job) return;
    setIsCancelling(true);
    try {
      const response = await fetch(`/api/localization-jobs/${jobId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        toast.error(data.error || "Failed to cancel job");
        return;
      }

      toast.success("Job cancelled");
      // Refresh job to show updated status
      fetchJob();
    } catch {
      toast.error("Failed to cancel job");
    } finally {
      setIsCancelling(false);
    }
  }, [job, jobId, fetchJob]);

  // Determine push button state
  const getPushButtonState = useCallback(() => {
    if (job?.status !== "completed") {
      return { disabled: true, tooltip: "Job must be completed to push", show: false };
    }
    if (isManualMode) {
      return {
        disabled: true,
        tooltip: "This app was added manually. Connect ASC in Settings to push.",
        show: true,
      };
    }
    if (!hasASCCredentials) {
      return {
        disabled: true,
        tooltip: "Connect App Store Connect in Settings to push.",
        show: true,
      };
    }
    if (job?.pushed_to_asc) {
      return { show: false };
    }
    return { disabled: false, tooltip: null, label: "Push to App Store Connect", show: true };
  }, [job?.status, job?.pushed_to_asc, isManualMode, hasASCCredentials]);

  const pushButtonState = getPushButtonState();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/history"
            className="p-2 rounded-lg hover:bg-[var(--color-surface-tertiary)] transition-colors duration-150"
          >
            <svg
              className="w-5 h-5 text-[var(--color-content)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-[var(--color-content)]">
            Job Details
          </h1>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-content)]" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/history"
            className="p-2 rounded-lg hover:bg-[var(--color-surface-tertiary)] transition-colors duration-150"
          >
            <svg
              className="w-5 h-5 text-[var(--color-content)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-[var(--color-content)]">
            Job Details
          </h1>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-[var(--color-content)] mb-2">
              {error || "Job not found"}
            </h3>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/history">Back to History</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const localeResults = job.results?.locales || [];
  const jobConfig = job.results?._config as JobConfig | undefined;
  const completedCount = localeResults.length;
  const totalCount = job.target_locales?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-6">
        <div className="flex items-start gap-5">
          {/* App icon */}
          {job.app_icon_url ? (
            <Image
              src={job.app_icon_url}
              alt={job.app_name}
              width={64}
              height={64}
              className="w-16 h-16 shrink-0 rounded-xl object-cover"
            />
          ) : (
            <div className="w-16 h-16 shrink-0 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center text-xl font-medium text-[var(--color-content-secondary)]">
              {job.app_name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          {/* App info with inline status badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-2xl font-bold text-[var(--color-content)] truncate">
                {job.app_name}
              </h1>
              <JobStatusBadge status={job.status} errorMessage={job.error_message ?? undefined} />
              {job.pushed_to_asc && <PushedBadge />}
            </div>
            <p className="text-[var(--color-content-secondary)] text-sm">
              {formatDate(job.created_at)}
            </p>
          </div>
        </div>
      </div>

      {/* Summary grid (4 columns) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider mb-1">
            Source
          </p>
          <p className="text-[var(--color-content)] font-medium">
            {localeNames[job.source_locale] || job.source_locale}
          </p>
        </div>
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider mb-1">
            Targets
          </p>
          <p className="text-[var(--color-content)] font-medium">
            {totalCount} locales
          </p>
        </div>
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider mb-1">
            Fields
          </p>
          <p className="text-[var(--color-content)] font-medium">
            {job.fields_localized?.length || 0}
          </p>
        </div>
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-xl p-4">
          <p className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider mb-1">
            Created
          </p>
          <p className="text-[var(--color-content)] font-medium">
            {new Date(job.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
      </div>

      {/* Fields Localized section */}
      {job.fields_localized && job.fields_localized.length > 0 && (
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="text-[var(--color-content)] font-semibold mb-4">
            Fields Localized
          </h2>
          <div className="flex flex-wrap gap-2">
            {job.fields_localized.map((field) => (
              <span
                key={field}
                className="px-3 py-1.5 text-sm text-[var(--color-content-secondary)] bg-[var(--color-surface-hover)] rounded-lg"
              >
                {fieldLabels[field] || field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* URL Changes section */}
      {(jobConfig?.privacyUrlReplacement ||
        jobConfig?.supportUrlReplacement ||
        jobConfig?.marketingUrlReplacement ||
        (jobConfig?.urlReplacements && jobConfig.urlReplacements.length > 0)) && (
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-6">
          <h2 className="text-[var(--color-content)] font-semibold mb-4">
            URL Changes
          </h2>
          <div className="space-y-3">
            {/* Privacy URL */}
            {jobConfig?.privacyUrlReplacement && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider">
                    Privacy Policy URL
                  </span>
                  {jobConfig.privacyUrlAllLocales && (
                    <Badge variant="default" className="text-xs">All locales</Badge>
                  )}
                </div>
                <p className="text-[var(--color-content)] text-sm font-mono truncate bg-[var(--color-surface-secondary)]/50 rounded-lg px-3 py-2">
                  {jobConfig.privacyUrlReplacement}
                </p>
              </div>
            )}

            {/* Support URL */}
            {jobConfig?.supportUrlReplacement && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider">
                    Support URL
                  </span>
                  {jobConfig.supportUrlAllLocales && (
                    <Badge variant="default" className="text-xs">All locales</Badge>
                  )}
                </div>
                <p className="text-[var(--color-content)] text-sm font-mono truncate bg-[var(--color-surface-secondary)]/50 rounded-lg px-3 py-2">
                  {jobConfig.supportUrlReplacement}
                </p>
              </div>
            )}

            {/* Marketing URL */}
            {jobConfig?.marketingUrlReplacement && (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider">
                    Marketing URL
                  </span>
                  {jobConfig.marketingUrlAllLocales && (
                    <Badge variant="default" className="text-xs">All locales</Badge>
                  )}
                </div>
                <p className="text-[var(--color-content)] text-sm font-mono truncate bg-[var(--color-surface-secondary)]/50 rounded-lg px-3 py-2">
                  {jobConfig.marketingUrlReplacement}
                </p>
              </div>
            )}

            {/* Description URL Replacements */}
            {jobConfig?.urlReplacements && jobConfig.urlReplacements.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[var(--color-content-muted)] text-xs uppercase tracking-wider">
                  Description URL Replacements
                </span>
                <div className="space-y-2">
                  {jobConfig.urlReplacements.map((replacement, index) => (
                    <div key={index} className="bg-[var(--color-surface-secondary)]/50 rounded-lg px-3 py-2">
                      <p className="text-[var(--color-content-muted)] text-xs font-mono truncate">
                        {replacement.oldUrl}
                      </p>
                      <p className="text-[var(--color-content)] text-sm font-mono truncate flex items-center gap-1">
                        <span className="text-[var(--color-content-muted)]">→</span>
                        {replacement.newUrl}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error message for failed jobs (hide for cancelled) */}
      {job.error_message && job.error_message !== "Cancelled by user" && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
          <h2 className="text-red-500 font-semibold mb-2">Error</h2>
          <p className="text-sm text-red-400">{job.error_message}</p>
        </div>
      )}

      {/* Target Locales - Collapsible */}
      {localeResults.length > 0 && (
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[var(--color-content)] font-semibold">
              Target Locales
            </h2>
            <span className="text-[var(--color-content-secondary)] text-sm">
              {completedCount}/{totalCount} completed
            </span>
          </div>

          <div className="space-y-3">
            {localeResults.map((result) => (
              <LocaleCard key={result.locale} result={result} />
            ))}
          </div>
        </div>
      )}

      {/* Empty results state */}
      {job.status === "completed" && localeResults.length === 0 && (
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg
              className="w-12 h-12 text-[var(--color-content-muted)] mb-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-[var(--color-content)] mb-2">
              No results available
            </h3>
            <p className="text-sm text-[var(--color-content-muted)]">
              This job completed but no translation results were saved.
            </p>
          </div>
        </div>
      )}

      {/* Pending/Processing state */}
      {(job.status === "pending" || job.status === "processing") && (
        <div className="bg-[var(--color-surface-tertiary)] border border-[var(--color-border)] rounded-2xl p-6">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
              <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            </div>
            <h3 className="text-lg font-medium text-[var(--color-content)] mb-2">
              {job.status === "pending" ? "Job Pending" : "Processing..."}
            </h3>
            <p className="text-sm text-[var(--color-content-muted)]">
              {job.status === "pending"
                ? "This job is waiting to be processed."
                : "This job is currently being processed. Results will appear here when complete."}
            </p>
          </div>
        </div>
      )}

      {/* Action buttons for active jobs */}
      {(job.status === "pending" || job.status === "processing") && (
        <div className="flex gap-3">
          <Button
            asChild
            variant="outline"
            className="flex-1 h-12"
          >
            <Link href={`/localization/${job.app_id}/generating?jobId=${job.id}${job.status === 'processing' ? '&resume=true' : ''}`}>
              <Play className="w-4 h-4 mr-2" />
              View Progress
            </Link>
          </Button>
          <Button
            variant="outline"
            className="flex-1 h-12 text-red-400 hover:text-red-300 hover:border-red-400/50"
            onClick={handleCancel}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </>
            )}
          </Button>
        </div>
      )}

      {/* Push Button - show for completed jobs */}
      {pushButtonState.show && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="w-full">
                <Button
                  onClick={handlePush}
                  disabled={pushButtonState.disabled || isPushing}
                  className="w-full h-12"
                >
                  {isPushing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Preparing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      {pushButtonState.label || "Push to App Store Connect"}
                    </>
                  )}
                </Button>
              </div>
            </TooltipTrigger>
            {pushButtonState.tooltip && (
              <TooltipContent side="top" className="max-w-xs">
                <p>{pushButtonState.tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Resume Button - show for failed or interrupted jobs */}
      {(job.status === 'failed' || job.status === 'interrupted') && (
        <ResumeButton
          jobId={job.id}
          appId={job.app_id}
          targetLocales={job.target_locales || []}
          localeResults={job.locale_results as Record<string, LocaleResultStatus> | null}
          status={job.status}
        />
      )}
    </div>
  );
}
