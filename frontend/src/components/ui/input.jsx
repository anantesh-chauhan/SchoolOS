import React, { useState } from "react";
import { cn } from "../../lib/utils";
import { Eye, EyeOff } from "lucide-react";

/* =====================================================
   Input Sizes
   ===================================================== */

const sizes = {

  sm: "h-8 text-xs px-2.5",

  md: "h-10 text-sm px-3",

  lg: "h-11 text-base px-3.5",

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

    <div className="w-full space-y-1.5">

      {/* Label */}

      {label && (

        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">

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

            "bg-white text-slate-900",

            "placeholder:text-slate-400",

            "outline-none transition-all",

            "focus:ring-2 focus:ring-indigo-200",

            "focus:border-indigo-500",

            "disabled:opacity-50",

            "dark:bg-slate-900",
            "dark:text-white",
            "dark:border-slate-700",

            sizes[size],

            LeftIcon && "pl-10",

            (RightIcon || isPassword) && "pr-10",

            error
              ? "border-red-500 focus:ring-red-200 focus:border-red-500"
              : "border-slate-300",

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

        <p className="text-xs text-slate-500">

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