import React from "react";
import { motion } from "framer-motion";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";

export default function WidgetCard({
  title,
  description,
  badge,
  actions,
  icon: Icon,
  children,
}) {
  return (

    <motion.div
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="h-full group/card"
    >

      <Card
        className="
          h-full
          overflow-hidden
          rounded-[2rem]
          border
          border-slate-200/60
          bg-white/80
          backdrop-blur-xl
          shadow-[0_8px_30px_rgb(0,0,0,0.04)]
          transition-all
          duration-500
          hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)]
          hover:border-sky-200/50
          dark:bg-slate-900/80
          dark:border-slate-700
        "
      >

        {/* Header */}

        <CardHeader
          className="
            flex
            flex-row
            items-start
            justify-between
            gap-4
            px-8
            py-5
          "
        >

          {/* Title Section */}

          <div className="flex items-start gap-3">

            {/* Optional Icon */}

            {Icon && (

              <div
                className="
                  p-3
                  rounded-xl
                  bg-slate-50
                  border border-slate-100
                  dark:bg-slate-800/50
                  text-slate-500
                  dark:text-slate-300
                  group-hover/card:bg-sky-500 group-hover/card:text-white group-hover/card:border-sky-500 transition-all duration-300"
              >

                <Icon className="h-5 w-5" />

              </div>

            )}

            <div>

              <CardTitle
                className="
                  text-lg
                  font-bold
                  text-slate-900
                  dark:text-white
                  tracking-tight
                "
              >

                {title}

              </CardTitle>

              {description && (

                <p
                  className="
                    mt-1
                    text-sm
                    text-slate-500
                    dark:text-slate-400
                  "
                >

                  {description}

                </p>

              )}

            </div>

          </div>

          {/* Actions */}

          {(badge || actions) && (

            <div
              className="
                flex
                items-center
                gap-2
                shrink-0
              "
            >

              {badge}

              {actions}

            </div>

          )}

        </CardHeader>

        {/* Divider */}

        <div className="mx-8 border-t border-slate-100/80 dark:border-slate-800" />

        {/* Content */}

        <CardContent
          className="
            px-8
            py-6
            space-y-4
          "
        >

          {children}

        </CardContent>

      </Card>

    </motion.div>

  );
}