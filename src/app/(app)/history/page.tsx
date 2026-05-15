"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Card, Button } from "@/components/ui";
import { JobCard } from "@/components/history";
import type { LocalizationJob, StringsJob } from "@/lib/database/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Union type for merged jobs
type MergedJob =
  | { type: "localization"; job: LocalizationJob; sortDate: string }
  | { type: "strings"; job: StringsJob; sortDate: string };

const ALLOWED_LIMITS = [10, 25, 50];
// Maximum jobs to fetch per type to prevent memory issues
const MAX_JOBS_PER_TYPE = 100;

export default function HistoryPage() {
  const [localizationJobs, setLocalizationJobs] = useState<LocalizationJob[]>([]);
  const [stringsJobs, setStringsJobs] = useState<StringsJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Client-side pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Fetch both job types in parallel
  const fetchJobs = useCallback(async (signal?: AbortSignal) => {
    try {
      setIsLoading(true);

      // Fetch both endpoints in parallel with reasonable limits
      // This prevents memory issues for users with many jobs while still allowing merged view
      const [localizationRes, stringsRes] = await Promise.all([
        fetch(`/api/localization-jobs?page=1&limit=${MAX_JOBS_PER_TYPE}`, { signal }),
        fetch(`/api/strings-jobs?page=1&limit=${MAX_JOBS_PER_TYPE}`, { signal }),
      ]);

      const [localizationData, stringsData] = await Promise.all([
        localizationRes.json(),
        stringsRes.json(),
      ]);

      if (!localizationRes.ok) {
        toast.error(localizationData.error || "Failed to fetch localization jobs");
      } else {
        setLocalizationJobs(localizationData.jobs || []);
      }

      if (!stringsRes.ok) {
        toast.error(stringsData.error || "Failed to fetch strings jobs");
      } else {
        setStringsJobs(stringsData.jobs || []);
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      toast.error("Failed to fetch jobs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Refetch when page becomes visible (user returns from another tab)
  useEffect(() => {
    let abortController: AbortController | null = null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && !isLoading) {
        if (abortController) abortController.abort();
        abortController = new AbortController();
        fetchJobs(abortController.signal);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (abortController) abortController.abort();
    };
  }, [isLoading, fetchJobs]);

  // Merge and sort jobs by created_at descending
  const mergedJobs = useMemo((): MergedJob[] => {
    const localization: MergedJob[] = localizationJobs.map((job) => ({
      type: "localization" as const,
      job,
      sortDate: job.created_at,
    }));

    const strings: MergedJob[] = stringsJobs.map((job) => ({
      type: "strings" as const,
      job,
      sortDate: job.created_at,
    }));

    return [...localization, ...strings].sort(
      (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime()
    );
  }, [localizationJobs, stringsJobs]);

  // Calculate pagination
  const total = mergedJobs.length;
  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  // Get current page items
  const paginatedJobs = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return mergedJobs.slice(startIndex, startIndex + limit);
  }, [mergedJobs, page, limit]);

  // Handle page change
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Handle limit change
  const handleLimitChange = useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1); // Reset to page 1 when changing limit
  }, []);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      if (page > 3) {
        pages.push("ellipsis");
      }

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (page < totalPages - 2) {
        pages.push("ellipsis");
      }

      pages.push(totalPages);
    }

    return pages;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-content)]">History</h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-1">
            View your past jobs
          </p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--color-content)]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-content)]">History</h1>
          <p className="text-sm text-[var(--color-content-secondary)] mt-1">
            View your past jobs
          </p>
        </div>

        {mergedJobs.length > 0 && (
          <Button variant="ghost" onClick={() => fetchJobs()}>
            <svg
              className="w-4 h-4 mr-2"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </Button>
        )}
      </div>

      {/* Jobs list */}
      {mergedJobs.length > 0 ? (
        <>
          <div className="space-y-3">
            {paginatedJobs.map((item) => (
              <JobCard
                key={`${item.type}-${item.job.id}`}
                type={item.type}
                job={item.job as LocalizationJob & StringsJob}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[var(--color-border)]">
              {/* Showing X-Y of Z */}
              <div className="text-sm text-[var(--color-content-secondary)]">
                Showing {(page - 1) * limit + 1}-
                {Math.min(page * limit, total)} of {total} jobs
              </div>

              {/* Page navigation */}
              <div className="flex items-center gap-2">
                {/* Previous button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={!hasPrev}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((pageNum, idx) =>
                    pageNum === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-2 text-[var(--color-content-secondary)]"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={pageNum}
                        variant={pageNum === page ? "primary" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNum)}
                        className="h-8 w-8 p-0"
                      >
                        {pageNum}
                      </Button>
                    )
                  )}
                </div>

                {/* Next button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={!hasNext}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Per-page selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-[var(--color-content-secondary)]">Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => handleLimitChange(Number(e.target.value))}
                  className="h-8 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-content)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-content)]/20"
                >
                  {ALLOWED_LIMITS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </>
      ) : (
        <Card>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-[var(--color-content-muted)]"
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
            </div>
            <h3 className="text-lg font-medium text-[var(--color-content)] mb-2">
              No jobs yet
            </h3>
            <p className="text-sm text-[var(--color-content-muted)] max-w-sm mb-6">
              Once you run your first job, it will appear here.
            </p>
            <Button asChild>
              <a href="/apps">
                <svg
                  className="w-4 h-4 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Select an App
              </a>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
