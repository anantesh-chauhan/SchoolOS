import React from "react";
import PropTypes from "prop-types";
import { cn } from "../../lib/utils";

/* =====================================================
   Base Card
   ===================================================== */

export function Card({

  className,
  hover = false,
  ...props

}) {

  return (

    <div
      className={cn(

        "rounded-xl sm:rounded-2xl",
        "border border-[var(--border-soft)]",
        "bg-[var(--surface-base)] text-[var(--text-primary)]",
        "shadow-[0_8px_24px_rgb(var(--school-focus-rgb)/0.07)]",

        "transition-all duration-300",

        hover && "hover:border-[color-mix(in_srgb,var(--school-primary)_35%,var(--border-soft))] hover:shadow-[0_12px_28px_rgb(var(--school-focus-rgb)/0.11)] hover:-translate-y-px",

        className

      )}

      {...props}

    />

  );

}

/* =====================================================
   Card Header
   ===================================================== */

export function CardHeader({

  className,
  ...props

}) {

  return (

    <div
      className={cn(

        "flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center",

        "border-b border-[var(--border-soft)]",

        "px-4 py-3 sm:px-6 sm:py-4",

        className

      )}

      {...props}

    />

  );

}

/* =====================================================
   Card Title
   ===================================================== */

export function CardTitle({

  className,
  ...props

}) {

  return (

    <h3
      className={cn(

        "text-base sm:text-lg",

        "font-semibold",

        "tracking-tight",

        "text-[var(--text-primary)]",

        className

      )}

      {...props}

    />

  );

}

/* =====================================================
   Card Description (NEW)
   ===================================================== */

export function CardDescription({

  className,
  ...props

}) {

  return (

    <p
      className={cn(

        "text-sm",

        "text-[var(--text-muted)]",

        className

      )}

      {...props}

    />

  );

}

/* =====================================================
   Card Content
   ===================================================== */

export function CardContent({

  className,
  ...props

}) {

  return (

    <div
      className={cn(

        "px-4 py-4 sm:px-6 sm:py-5",

        className

      )}

      {...props}

    />

  );

}

/* =====================================================
   Card Footer (NEW)
   ===================================================== */

export function CardFooter({

  className,
  ...props

}) {

  return (

    <div
      className={cn(

        "grid grid-cols-1 items-center justify-end sm:flex",

        "gap-2",

        "border-t border-[var(--border-soft)]",

        "px-4 py-3 sm:px-6 sm:py-4",

        className

      )}

      {...props}

    />

  );

}

const sharedPropTypes = { className: PropTypes.string, children: PropTypes.node };
Card.propTypes = { ...sharedPropTypes, hover: PropTypes.bool };
CardHeader.propTypes = sharedPropTypes;
CardTitle.propTypes = sharedPropTypes;
CardDescription.propTypes = sharedPropTypes;
CardContent.propTypes = sharedPropTypes;
CardFooter.propTypes = sharedPropTypes;
