import React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

/* =====================================================
   Button Variants
   ===================================================== */

const variants = {

  default:
    "bg-slate-900 text-white hover:bg-slate-800 shadow-sm",

  secondary:
    "bg-slate-100 text-slate-900 hover:bg-slate-200",

  primary:
    "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm",

  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",

  warning:
    "bg-amber-500 text-white hover:bg-amber-600 shadow-sm",

  danger:
    "bg-red-600 text-white hover:bg-red-700 shadow-sm",

  outline:
    "border border-slate-300 text-slate-900 hover:bg-slate-50",

  ghost:
    "text-slate-700 hover:bg-slate-100",

  link:
    "text-indigo-600 hover:underline underline-offset-4 px-0 py-0 h-auto",

};

/* =====================================================
   Button Sizes
   ===================================================== */

const sizes = {

  sm:
    "h-8 px-3 text-xs rounded-md",

  md:
    "h-10 px-4 text-sm rounded-md",

  lg:
    "h-11 px-6 text-base rounded-lg",

  icon:
    "h-10 w-10 rounded-md p-0",

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

        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-indigo-500",

        "disabled:opacity-50",
        "disabled:pointer-events-none",

        "active:scale-[0.98]",

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