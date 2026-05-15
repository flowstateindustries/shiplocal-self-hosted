"use client";

import { Badge } from "@/components/ui";
import type { JobStatus } from "@/lib/database/types";

interface JobStatusBadgeProps {
  status: JobStatus;
  errorMessage?: string;
}

type DisplayStatus = JobStatus | "cancelled";

const statusConfig: Record<DisplayStatus, { label: string; variant: "default" | "success" | "warning" | "error" | "info" }> = {
  pending: { label: "Pending", variant: "warning" },
  processing: { label: "Processing", variant: "info" },
  interrupted: { label: "Interrupted", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "error" },
  cancelled: { label: "Cancelled", variant: "warning" },
};

export function JobStatusBadge({ status, errorMessage }: JobStatusBadgeProps) {
  // Determine the display status
  let displayStatus: DisplayStatus = status;

  // If failed due to user cancellation, show as cancelled
  if (status === "failed" && errorMessage === "Cancelled by user") {
    displayStatus = "cancelled";
  }

  const config = statusConfig[displayStatus] || statusConfig.pending;

  // Only animate pulse for actively processing jobs
  const shouldPulse = status === "processing";

  return (
    <Badge variant={config.variant} className={shouldPulse ? "animate-pulse" : ""}>
      {config.label}
    </Badge>
  );
}
