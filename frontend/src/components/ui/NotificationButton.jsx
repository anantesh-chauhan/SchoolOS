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
      className="relative h-10 w-10 rounded-xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm hover:bg-white hover:shadow transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50"
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


