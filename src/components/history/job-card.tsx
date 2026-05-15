"use client";

import Link from "next/link";
import Image from "next/image";
import { Upload, FileText } from "lucide-react";
import { JobStatusBadge } from "./job-status-badge";
import type { LocalizationJob, StringsJob } from "@/lib/database/types";

// Discriminated union for job types
interface LocalizationJobCardProps {
  type: "localization";
  job: LocalizationJob;
}

interface StringsJobCardProps {
  type: "strings";
  job: StringsJob;
}

type JobCardProps = LocalizationJobCardProps | StringsJobCardProps;

// Format date to relative time
function formatRelativeTime(dateString: string): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Unknown";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

// Format fields to human-readable text
function formatFields(fields: string[]): string {
  if (!fields || fields.length === 0) return "No fields";

  const fieldLabels: Record<string, string> = {
    description: "Description",
    keywords: "Keywords",
    promotionalText: "Promo Text",
    whatsNew: "What's New",
    name: "Name",
    subtitle: "Subtitle",
  };

  const formatted = fields.map((f) => fieldLabels[f] || f);

  if (formatted.length <= 2) {
    return formatted.join(", ");
  }

  return `${formatted[0]}, ${formatted[1]} +${formatted.length - 2}`;
}

export function JobCard(props: JobCardProps) {
  if (props.type === "strings") {
    const { job } = props;
    return (
      <Link
        href={`/strings/${job.id}/preview`}
        className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
      >
        {/* File icon for strings jobs */}
        <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-[var(--color-content-secondary)]" />
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-[var(--color-content)] truncate">
              {job.file_name}
            </h3>
            <JobStatusBadge status={job.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-[var(--color-content-muted)]">
            <span>{job.strings_to_translate} strings</span>
            <span className="text-[var(--color-content-muted)]/50">·</span>
            <span>{job.target_locales?.length || 0} locales</span>
          </div>
        </div>

        {/* Timestamp and chevron */}
        <div className="flex items-center gap-3 text-[var(--color-content-muted)] flex-shrink-0">
          <span className="text-sm">{formatRelativeTime(job.created_at)}</span>
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </Link>
    );
  }

  // Localization job (default)
  const { job } = props;
  return (
    <Link
      href={`/history/${job.id}`}
      className="flex items-center gap-4 p-4 rounded-xl bg-[var(--color-surface-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors duration-150"
    >
      {/* App icon */}
      {job.app_icon_url ? (
        <Image
          src={job.app_icon_url}
          alt={job.app_name}
          width={48}
          height={48}
          className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-[var(--color-surface-hover)] flex items-center justify-center text-lg font-medium text-[var(--color-content-secondary)] flex-shrink-0">
          {job.app_name?.[0]?.toUpperCase() || "?"}
        </div>
      )}

      {/* Job info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-[var(--color-content)] truncate">
            {job.app_name}
          </h3>
          <JobStatusBadge status={job.status} />
          {job.pushed_to_asc && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 rounded-full">
              <Upload className="w-3 h-3" />
              Pushed
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-[var(--color-content-muted)]">
          <span>{job.target_locales?.length || 0} locales</span>
          <span className="text-[var(--color-content-muted)]/50">·</span>
          <span>{formatFields(job.fields_localized)}</span>
        </div>
      </div>

      {/* Timestamp and chevron */}
      <div className="flex items-center gap-3 text-[var(--color-content-muted)] flex-shrink-0">
        <span className="text-sm">{formatRelativeTime(job.created_at)}</span>
        <svg
          className="w-5 h-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </Link>
  );
}
