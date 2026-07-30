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
        <h2 className="break-words border-l-4 border-[var(--school-primary)] pl-3 text-lg font-semibold tracking-tight text-[var(--text-primary)] md:text-xl">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 break-words pl-4 text-sm leading-relaxed text-[var(--text-muted)]">{subtitle}</p>
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



