import React from 'react';
import PropTypes from 'prop-types';

const SectionHeader = ({
  title,
  subtitle,
  right,
}) => {
  return (
    <div className="mb-4 flex flex-col items-stretch justify-between gap-3 sm:mb-5 sm:flex-row sm:items-start">
      <div className="min-w-0">
        <h2 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {right && <div className="grid grid-cols-1 sm:block sm:shrink-0">{right}</div>}
    </div>
  );
};

SectionHeader.propTypes = {
  title: PropTypes.node.isRequired,
  subtitle: PropTypes.node,
  right: PropTypes.node,
};

export default React.memo(SectionHeader);



