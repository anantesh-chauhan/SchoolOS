import React from 'react';
import PropTypes from 'prop-types';

const PageHeader = ({
  title,
  subtitle,
  right,
  icon,
}) => {
  return (
    <div className="mb-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-4 py-4 shadow-[0_6px_20px_rgb(var(--school-focus-rgb)/0.06)] sm:mb-6 sm:px-5">
      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[var(--border-soft)] bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="break-words text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl md:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 max-w-2xl break-words text-sm leading-relaxed text-[var(--text-muted)] md:text-base">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
        </div>
        {right && (
          <div className="grid grid-cols-1 gap-2 sm:flex sm:shrink-0 sm:items-center">{right}</div>
        )}
      </div>
    </div>
  );
};

PageHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  right: PropTypes.node,
  icon: PropTypes.node,
};

export default React.memo(PageHeader);



