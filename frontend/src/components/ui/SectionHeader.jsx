import React from 'react';

const SectionHeader = ({
  title,
  subtitle,
  right,
}) => {
  return (
    <div className="flex items-start justify-between gap-4 mb-5">
      <div className="min-w-0">
        <h2 className="text-lg md:text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
};

export default React.memo(SectionHeader);



