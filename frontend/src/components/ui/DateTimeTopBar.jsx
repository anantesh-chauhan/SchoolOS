import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";

function formatTime(date) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDate(date) {
  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const DateTimeTopBar = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const time = useMemo(() => formatTime(now), [now]);
  const date = useMemo(() => formatDate(now), [now]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] h-5 overflow-hidden"
      aria-label="Current date and time"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-slate-50/90 to-white/85 dark:from-slate-950/85 dark:via-slate-900/90 dark:to-slate-950/85 backdrop-blur-xl border-b border-slate-200/60 dark:border-slate-800/70" />

      {/* Decorative Glow */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-0 top-0 h-full w-32 bg-gradient-to-r from-blue-500/10 to-transparent" />
        <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-cyan-500/10 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative flex h-full items-center justify-center gap-2 text-[10px] font-semibold tracking-wide text-slate-700 dark:text-slate-200">
        <span className="flex items-center gap-1">
          <CalendarDays size={10} className="text-blue-600 dark:text-cyan-400" />
          {date}
        </span>

        <span className="h-1 w-1 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)] animate-pulse" />

        <span className="flex items-center gap-1 font-mono">
          <Clock3 size={10} className="text-emerald-600 dark:text-emerald-400" />
          {time}
        </span>
      </div>
    </div>
  );
};

export default DateTimeTopBar;