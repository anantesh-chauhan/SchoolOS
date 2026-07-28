import React from 'react';
import PropTypes from 'prop-types';

const PageHeader = ({
  title,
  subtitle,
  right,
  icon,
}) => {
  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="h-11 w-11 rounded-2xl border border-slate-200 bg-white/80 shadow-sm flex items-center justify-center text-slate-700">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-sm md:text-base text-slate-500 max-w-2xl leading-relaxed">
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



