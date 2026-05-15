"use client";

import { HTMLAttributes, forwardRef } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "error" | "info";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variants = {
      default:
        "bg-[var(--color-surface-hover)] text-[var(--color-content-secondary)]",
      success: "bg-green-500/10 text-green-500",
      warning: "bg-amber-500/10 text-amber-500",
      error: "bg-red-500/10 text-red-500",
      info: "bg-blue-500/10 text-blue-500",
    };

    return (
      <span
        ref={ref}
        className={`
          inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium
          ${variants[variant]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";
