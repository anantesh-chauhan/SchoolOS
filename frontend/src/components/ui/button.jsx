import React from "react";
import PropTypes from "prop-types";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

/* =====================================================
   Button Variants
   ===================================================== */

const variants = {

  default:
    "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400",

  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",

  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400",

  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm dark:bg-teal-400 dark:text-slate-950 dark:hover:bg-teal-300",

  warning:
    "bg-amber-500 text-white hover:bg-amber-600 shadow-sm dark:bg-amber-400 dark:text-slate-950 dark:hover:bg-amber-300",

  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-sm",

  outline:
    "border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800",

  ghost:
    "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",

  link:
    "text-indigo-600 hover:underline underline-offset-4 px-0 py-0 h-auto dark:text-indigo-300",

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

        "inline-flex items-center justify-center gap-2",

        "font-medium whitespace-nowrap",

        "transition-all duration-200",
        "hover:scale-[1.02]",

        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-indigo-500",

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
