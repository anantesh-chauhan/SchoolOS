import React from "react";
import PropTypes from "prop-types";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

/* =====================================================
   Button Variants
   ===================================================== */

const variants = {

  default:
    "bg-[var(--school-primary)] text-[var(--on-primary)] hover:bg-[var(--school-primary-hover)] shadow-[0_5px_16px_rgb(var(--school-focus-rgb)/0.18)]",

  secondary:
    "border border-[var(--border-soft)] bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",

  primary:
    "bg-[var(--school-primary)] text-[var(--on-primary)] hover:bg-[var(--school-primary-hover)] shadow-[0_5px_16px_rgb(var(--school-focus-rgb)/0.18)]",

  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300",

  warning:
    "bg-amber-500 text-white hover:bg-amber-600 shadow-sm dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300",

  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-sm",

  outline:
    "border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",

  ghost:
    "text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",

  link:
    "text-[var(--school-primary)] hover:underline underline-offset-4 px-0 py-0 h-auto",

};

/* =====================================================
   Button Sizes
   ===================================================== */

const sizes = {

  sm:
    "h-10 px-3 text-xs rounded-lg sm:h-8 sm:rounded-md",

  md:
    "h-11 px-4 text-sm rounded-lg sm:h-10 sm:rounded-md",

  lg:
    "h-12 px-5 text-base rounded-xl sm:h-11 sm:px-6 sm:rounded-lg",

  icon:
    "h-11 w-11 rounded-lg p-0 sm:h-10 sm:w-10 sm:rounded-md",

};

/* =====================================================
   Button Component
   ===================================================== */

export function Button({

  className,

  variant = "default",

  size = "md",

  type = "button",

  loading = false,

  fullWidth = false,

  leftIcon: LeftIcon,

  rightIcon: RightIcon,

  children,

  disabled,

  ...props

}) {

  const isDisabled = disabled || loading;

  return (

    <button
      type={type}

      disabled={isDisabled}

      className={cn(

        "inline-flex max-w-full items-center justify-center gap-2",

        "font-medium whitespace-nowrap",

        "transition-all duration-200",
        "hover:-translate-y-px",

        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-[rgb(var(--school-focus-rgb)/0.42)]",

        "disabled:opacity-50",
        "disabled:pointer-events-none",

        "active:scale-[0.97]",

        fullWidth && "w-full",

        variants[variant],

        sizes[size],

        className

      )}

      {...props}

    >

      {/* Loading Spinner */}

      {loading && (

        <Loader2 className="h-4 w-4 animate-spin" />

      )}

      {/* Left Icon */}

      {!loading && LeftIcon && (

        <LeftIcon className="h-4 w-4" />

      )}

      {/* Label */}

      {children}

      {/* Right Icon */}

      {!loading && RightIcon && (

        <RightIcon className="h-4 w-4" />

      )}

    </button>

  );

}

Button.propTypes = {
  className: PropTypes.string,
  variant: PropTypes.oneOf(Object.keys(variants)),
  size: PropTypes.oneOf(Object.keys(sizes)),
  type: PropTypes.oneOf(["button", "submit", "reset"]),
  loading: PropTypes.bool,
  fullWidth: PropTypes.bool,
  leftIcon: PropTypes.elementType,
  rightIcon: PropTypes.elementType,
  children: PropTypes.node,
  disabled: PropTypes.bool,
};
