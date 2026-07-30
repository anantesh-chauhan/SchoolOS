import React from 'react';
import PropTypes from 'prop-types';

const SearchInput = ({
  value,
  onChange,
  placeholder,
  ariaLabel = 'Search',
  className = '',
  leftIcon,
}) => {
  const paddingLeftClass = leftIcon ? 'pl-9' : 'pl-3';

  return (
    <div className={`relative ${className}`}>
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {leftIcon}
        </div>
      )}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 ${paddingLeftClass} pr-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-sm focus:border-[var(--school-primary)] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--school-focus-rgb)/0.2)] transition-colors sm:h-10 sm:text-sm`}
      />
    </div>
  );
};

SearchInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  ariaLabel: PropTypes.string,
  className: PropTypes.string,
  leftIcon: PropTypes.node,
};

export default React.memo(SearchInput);


