import React from "react";
import { motion } from "framer-motion";

export default function ImageSkeletonGrid({ items = 6 }) {
  return (
    <div
      className="
        grid
        grid-cols-2
        gap-4
        sm:grid-cols-3
        lg:grid-cols-4
      "
    >
      {Array.from({ length: items }).map((_, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: index * 0.04,
          }}
          className="
            group
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-sm
          "
        >
          {/* Image Placeholder */}

          <div
            className="
              relative
              aspect-[4/3]
              overflow-hidden
              bg-gradient-to-r
              from-slate-100
              via-slate-50
              to-slate-100
              bg-[length:200%_100%]
              animate-shimmer
            "
          />

          {/* Metadata Placeholder */}

          <div className="p-3 space-y-2">

            {/* Title line */}

            <div
              className="
                h-3
                w-3/4
                rounded-md
                bg-gradient-to-r
                from-slate-100
                via-slate-50
                to-slate-100
                bg-[length:200%_100%]
                animate-shimmer
              "
            />

            {/* Subtitle line */}

            <div
              className="
                h-3
                w-1/2
                rounded-md
                bg-gradient-to-r
                from-slate-100
                via-slate-50
                to-slate-100
                bg-[length:200%_100%]
                animate-shimmer
              "
            />

          </div>

        </motion.div>
      ))}
    </div>
  );
}