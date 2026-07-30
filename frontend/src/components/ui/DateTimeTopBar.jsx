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
      <div className="absolute inset-0 border-b border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--surface-elevated)_90%,transparent)] backdrop-blur-xl" />

      {/* Decorative Glow */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute left-0 top-0 h-full w-32 bg-gradient-to-r from-blue-500/10 to-transparent" />
        <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-cyan-500/10 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative flex h-full items-center justify-center gap-2 text-[10px] font-semibold tracking-wide text-[var(--text-primary)]">
        <span className="flex items-center gap-1">
          <CalendarDays size={10} className="text-[var(--school-primary)]" />
          {date}
        </span>

        <span className="h-1 w-1 rounded-full bg-[var(--school-primary)] animate-pulse" />

        <span className="flex items-center gap-1 font-mono">
          <Clock3 size={10} className="text-[var(--school-secondary)]" />
          {time}
        </span>
      </div>
    </div>
  );
};

export default DateTimeTopBar;
