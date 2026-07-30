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
          border-[var(--border-soft)]
          bg-[var(--surface-base)]
          backdrop-blur-xl
          shadow-[0_8px_30px_rgb(0,0,0,0.04)]
          transition-all
          duration-500
          hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)]
          hover:border-[var(--school-primary)]
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
                  bg-[var(--school-primary-soft)]
                  border border-[var(--border-soft)]
                  text-[var(--school-primary-soft-text)]
                  group-hover/card:bg-[var(--school-primary)] group-hover/card:text-[var(--on-primary)] group-hover/card:border-[var(--school-primary)] transition-all duration-300"
              >

                <Icon className="h-5 w-5" />

              </div>

            )}

            <div>

              <CardTitle
                className="
                  text-lg
                  font-bold
                  text-[var(--text-primary)]
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
                    text-[var(--text-muted)]
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

        <div className="mx-8 border-t border-[var(--border-soft)]" />

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
