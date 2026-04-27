import React from 'react';

export default function ImageSkeletonGrid({ items = 6 }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="aspect-[4/3] rounded-xl border border-slate-200 bg-gradient-to-r from-slate-100 via-slate-50 to-slate-100 bg-[length:200%_100%] animate-shimmer" />
      ))}
    </div>
  );
}
