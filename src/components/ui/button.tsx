"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";

const baseStyles =
  "inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

const variantStyles = {
  primary:
    "bg-[var(--color-content)] text-[var(--color-content-inverted)] hover:opacity-90 active:opacity-80 focus-visible:ring-[var(--color-content)]/50",
  secondary:
    "bg-[var(--color-surface-tertiary)] text-[var(--color-content)] hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-hover)] border border-[var(--color-border)] focus-visible:ring-[var(--color-content)]/30",
  ghost:
    "text-[var(--color-content-secondary)] hover:text-[var(--color-content)] hover:bg-[var(--color-surface-tertiary)] active:bg-[var(--color-surface-hover)] focus-visible:ring-[var(--color-content)]/30",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500/50",
  outline:
    "border border-[var(--color-border)] text-[var(--color-content)] hover:bg-[var(--color-surface-tertiary)] active:bg-[var(--color-surface-hover)] focus-visible:ring-[var(--color-content)]/30",
};

const sizeStyles = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
  icon: "h-9 w-9 p-0",
  "icon-xs": "h-6 w-6 p-0",
  "icon-sm": "h-7 w-7 p-0",
  default: "px-4 py-2 text-sm",
};

type ButtonVariant = keyof typeof variantStyles;
type ButtonSize = keyof typeof sizeStyles;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

// Helper function for getting button class names (for composition)
export function buttonVariants({
  variant = "primary",
  size = "md",
}: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]}`;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

Button.displayName = "Button";
