import React from 'react';

const NotificationButton = ({
  icon,
  badge = true,
  onClick,
  ariaLabel = 'Notifications',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative h-10 w-10 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-muted)] shadow-sm transition-all hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus:border-[var(--school-primary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-focus-rgb)/0.25)]"
    >
      <span className="absolute inset-0 flex items-center justify-center">
        {icon}
      </span>
      {badge && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 shadow" />
      )}
    </button>
  );
};

export default React.memo(NotificationButton);


