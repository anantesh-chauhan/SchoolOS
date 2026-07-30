import React, { useState } from "react";
import PropTypes from "prop-types";
import { cn } from "../../lib/utils";
import { Eye, EyeOff } from "lucide-react";

/* =====================================================
   Input Sizes
   ===================================================== */

const sizes = {

  sm: "h-10 text-base px-2.5 sm:h-8 sm:text-xs",

  md: "h-11 text-base px-3 sm:h-10 sm:text-sm",

  lg: "h-12 text-base px-3.5 sm:h-11",

};

/* =====================================================
   Input Component
   ===================================================== */

export function Input({

  className,

  label,

  error,

  helperText,

  leftIcon: LeftIcon,

  rightIcon: RightIcon,

  type = "text",

  size = "md",

  disabled = false,

  ...props

}) {

  const [showPassword, setShowPassword] =
    useState(false);

  const isPassword = type === "password";

  const actualType =
    isPassword && showPassword
      ? "text"
      : type;

  return (

    <div className="min-w-0 w-full space-y-1.5">

      {/* Label */}

      {label && (

        <label className="text-sm font-medium text-[var(--text-primary)]">

          {label}

        </label>

      )}

      {/* Input Wrapper */}

      <div className="relative">

        {/* Left Icon */}

        {LeftIcon && (

          <LeftIcon
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          />

        )}

        <input

          type={actualType}

          disabled={disabled}

          className={cn(

            "w-full rounded-lg border",

            "bg-[var(--surface-elevated)] text-[var(--text-primary)]",

            "placeholder:text-slate-400",

            "outline-none transition-all",

            "focus:ring-2 focus:ring-[rgb(var(--school-focus-rgb)/0.2)]",
            "focus:border-[var(--school-primary)]",

            "disabled:opacity-50",

            sizes[size],

            LeftIcon && "pl-10",

            (RightIcon || isPassword) && "pr-10",

            error
              ? "border-red-500 focus:ring-red-200 focus:border-red-500"
              : "border-[var(--border-soft)]",

            className

          )}

          {...props}

        />

        {/* Password Toggle */}

        {isPassword && (

          <button
            type="button"
            onClick={() =>
              setShowPassword((p) => !p)
            }
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >

            {showPassword ? (

              <EyeOff className="h-4 w-4" />

            ) : (

              <Eye className="h-4 w-4" />

            )}

          </button>

        )}

        {/* Right Icon */}

        {!isPassword && RightIcon && (

          <RightIcon
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          />

        )}

      </div>

      {/* Helper Text */}

      {helperText && !error && (

        <p className="text-xs text-[var(--text-muted)]">

          {helperText}

        </p>

      )}

      {/* Error Message */}

      {error && (

        <p className="text-xs text-red-600">

          {error}

        </p>

      )}

    </div>

  );

}

Input.propTypes = {
  className: PropTypes.string,
  label: PropTypes.string,
  error: PropTypes.node,
  helperText: PropTypes.node,
  leftIcon: PropTypes.elementType,
  rightIcon: PropTypes.elementType,
  type: PropTypes.string,
  size: PropTypes.oneOf(Object.keys(sizes)),
  disabled: PropTypes.bool,
};
