import React from "react";
import { cn } from "../../lib/utils";

/* =====================================================
   Badge Variants
   ===================================================== */

const variants = {

  default:
    "bg-[var(--surface-muted)] text-[var(--text-primary)] border border-[var(--border-soft)]",

  muted:
    "bg-[var(--surface-muted)] text-[var(--text-muted)] border border-[var(--border-soft)]",

  success:
    "bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800",

  warning:
    "bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800",

  danger:
    "bg-red-100 text-red-800 border border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800",

  info:
    "bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-800",

  primary:
    "bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)] border border-[color-mix(in_srgb,var(--school-primary)_24%,var(--border-soft))]",

};

/* =====================================================
   Badge Sizes
   ===================================================== */

const sizes = {

  sm:
    "text-[10px] px-2 py-0.5",

  md:
    "text-xs px-2.5 py-1",

  lg:
    "text-sm px-3 py-1.5",

};

/* =====================================================
   Badge Component
   ===================================================== */

export function Badge({

  className,

  variant = "muted",

  size = "md",

  icon: Icon,

  children,

  ...props

}) {

  return (

    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium whitespace-nowrap transition-colors",
        variants[variant],
        sizes[size],
        className
      )}

      {...props}

    >

      {/* Optional Icon */}

      {Icon && (

        <Icon className="h-3 w-3 opacity-80" />

      )}

      {children}

    </span>

  );

}
