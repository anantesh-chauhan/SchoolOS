import React from 'react';

const PageHeader = ({
  title,
  subtitle,
  right,
  icon,
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="h-11 w-11 rounded-2xl border border-slate-200 bg-white/80 shadow-sm flex items-center justify-center text-slate-700">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900">
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
          <div className="flex items-center gap-2 shrink-0">{right}</div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PageHeader);



