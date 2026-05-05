import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";

/* =====================================================
   Summary Card
   ===================================================== */

export const SummaryCard = ({
  icon,
  label,
  value,
  trend,
  color = "blue",
}) => {
  const colors = {
    blue:
      "bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-900/20 dark:to-blue-800/10 border-blue-200 dark:border-blue-800",

    green:
      "bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-900/20 dark:to-green-800/10 border-green-200 dark:border-green-800",

    purple:
      "bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border-purple-200 dark:border-purple-800",

    orange:
      "bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-900/20 dark:to-orange-800/10 border-orange-200 dark:border-orange-800",
  };

  const iconColors = {
    blue:
      "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-800",

    green:
      "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-800",

    purple:
      "text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-800",

    orange:
      "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-800",
  };

  const isPositive = trend >= 0;

  return (
    <motion.div
      whileHover={{
        y: -6,
        scale: 1.02,
      }}
      transition={{
        type: "spring",
        stiffness: 260,
        damping: 18,
      }}
      className={`
        relative
        p-6
        rounded-2xl
        border
        backdrop-blur-sm
        cursor-pointer
        transition-all
        shadow-sm
        hover:shadow-xl
        ${colors[color]}
      `}
    >
      {/* Glow Effect */}

      <div className="absolute inset-0 rounded-2xl opacity-0 hover:opacity-100 transition bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="relative flex items-start justify-between">

        {/* Text Section */}

        <div>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-medium mb-2 tracking-wide">
            {label}
          </p>

          <h3 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {value}
          </h3>

          {trend !== undefined && (
            <div
              className={`
                flex items-center gap-1 mt-3 text-sm font-medium
                ${
                  isPositive
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }
              `}
            >
              {isPositive ? (
                <TrendingUp size={16} />
              ) : (
                <TrendingDown size={16} />
              )}

              {Math.abs(trend)}%

              <span className="text-slate-500 dark:text-slate-400 ml-1">
                vs last month
              </span>
            </div>
          )}
        </div>

        {/* Icon Section */}

        <div
          className={`
            p-3.5
            rounded-xl
            shadow-sm
            ${iconColors[color]}
          `}
        >
          <div className="text-xl">
            {icon}
          </div>
        </div>

      </div>
    </motion.div>
  );
};

/* =====================================================
   Welcome Card
   ===================================================== */

export const WelcomeCard = ({
  name,
  role,
}) => {

  const hours = new Date().getHours();

  let greeting = "Good morning";

  if (hours >= 12)
    greeting = "Good afternoon";

  if (hours >= 18)
    greeting = "Good evening";

  return (

    <motion.div
      initial={{
        opacity: 0,
        y: 24,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        duration: 0.4,
        ease: "easeOut",
      }}
      className="
        relative
        overflow-hidden
        rounded-2xl
        p-8
        mb-6
        text-white
        shadow-xl
        bg-gradient-to-r
        from-indigo-600
        via-blue-600
        to-purple-600
      "
    >

      {/* Background Glow */}

      <div className="
        absolute
        inset-0
        opacity-20
        bg-[radial-gradient(circle_at_top_right,white,transparent)]
      " />

      {/* Content */}

      <div className="relative z-10">

        <h2 className="
          text-2xl
          md:text-3xl
          font-bold
          mb-2
          tracking-tight
        ">

          {greeting},{" "}
          <span className="opacity-95">
            {name}
          </span>{" "}
          👋

        </h2>

        <p className="
          text-blue-100
          text-sm
          md:text-base
          font-medium
        ">

          Welcome to your{" "}
          <span className="capitalize">
            {role.replace("_", " ").toLowerCase()}
          </span>{" "}
          dashboard

        </p>

      </div>

      {/* Decorative Element */}

      <div className="
        absolute
        -right-10
        -bottom-10
        w-40
        h-40
        bg-white/10
        rounded-full
        blur-2xl
      " />

    </motion.div>

  );

};