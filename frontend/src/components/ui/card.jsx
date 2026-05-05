import React from "react";
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

        "rounded-2xl",
        "border border-slate-200",
        "bg-white",
        "shadow-sm",

        "transition-all duration-200",

        hover && "hover:shadow-md hover:-translate-y-[1px]",

        "dark:bg-slate-900",
        "dark:border-slate-700",

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

        "flex items-center justify-between",

        "border-b border-slate-200",

        "px-6 py-4",

        "dark:border-slate-700",

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

        "text-slate-900",

        "dark:text-white",

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

        "text-slate-500",

        "dark:text-slate-400",

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

        "px-6 py-5",

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

        "flex items-center justify-end",

        "gap-2",

        "border-t border-slate-200",

        "px-6 py-4",

        "dark:border-slate-700",

        className

      )}

      {...props}

    />

  );

}