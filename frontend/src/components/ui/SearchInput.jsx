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
        className={`h-11 w-full rounded-xl border border-slate-200 bg-white/80 px-3 ${paddingLeftClass} pr-3 text-base text-slate-900 placeholder:text-slate-400 shadow-sm backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/50 transition-colors sm:h-10 sm:text-sm`}
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


