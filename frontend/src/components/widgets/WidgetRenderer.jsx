import React from 'react';
import {
  BellRing,
  Bookmark,
  BookOpenCheck,
  Building2,
  CalendarPlus,
  CalendarRange,
  CheckSquare,
  ExternalLink,
  FileText,
  Flame,
  FlaskConical,
  GitBranch,
  Image,
  Layers3,
  LibraryBig,
  Palette,
  Shuffle,
  Sparkles,
  StickyNote,
  UsersRound,
} from 'lucide-react';
import WidgetCard from './WidgetCard';

const ICONS = {
  Building2,
  BookOpenCheck,
  CalendarRange,
  UsersRound,
  Layers3,
  Shuffle,
  GitBranch,
  LibraryBig,
  Image,
  Palette,
  CheckSquare,
  StickyNote,
  Bookmark,
  BellRing,
  Sparkles,
  Flame,
  FlaskConical,
  CalendarPlus,
  FileText,
};

const labelClass = 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2';

const renderListRow = (item, index) => {
  if (item && typeof item === 'object') {
    return (
      <div key={item.id || item.key || item.title || index} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-slate-900">{item.title || item.label || item.name || 'Item'}</p>
            {item.description || item.body || item.summary ? (
              <p className="mt-1 text-sm text-slate-500 line-clamp-2">{item.description || item.body || item.summary}</p>
            ) : null}
          </div>
          {'url' in item ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-sky-700">
              Open <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          {item.count !== undefined ? <span>{item.count} items</span> : null}
          {item.value !== undefined ? <span>{item.value}</span> : null}
          {item.isVisible !== undefined ? <span>{item.isVisible ? 'Visible' : 'Hidden'}</span> : null}
          {item.isRead !== undefined ? <span>{item.isRead ? 'Read' : 'Unread'}</span> : null}
          {item.isCompleted !== undefined ? <span>{item.isCompleted ? 'Done' : 'Open'}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div key={`${item}-${index}`} className={labelClass}>
      <p className="text-sm text-slate-700">{String(item)}</p>
    </div>
  );
};

const renderSummary = (data) => {
  if (!data) {
    return <p className="text-sm text-slate-500">No data available.</p>;
  }

  if (Array.isArray(data)) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {data.map((item, index) => (
          <div key={item.label || item.title || index} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label || item.title}</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{item.value ?? item.count ?? item.name ?? '—'}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      {Object.entries(data).map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-3 py-1">
          <span className="text-sm text-slate-500 capitalize">{label.replace(/([A-Z])/g, ' $1')}</span>
          <span className="text-sm font-semibold text-slate-900">{String(value ?? '—')}</span>
        </div>
      ))}
    </div>
  );
};

const renderStats = (data) => {
  const rows = Array.isArray(data) ? data : Object.entries(data || {}).map(([label, value]) => ({ label, value }));

  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map((item, index) => (
        <div key={item.label || item.name || index} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{item.label || item.name}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{item.value ?? item.count ?? '—'}</p>
        </div>
      ))}
    </div>
  );
};

const renderActions = (data) => (
  <div className="grid gap-3">
    {(data || []).map((item, index) => (
      <a
        key={item.href || item.label || index}
        href={item.href || '#'}
        className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-sky-200 hover:bg-sky-50"
      >
        <div>
          <p className="font-medium text-slate-900">{item.label || item.title || 'Action'}</p>
          {item.description ? <p className="text-sm text-slate-500">{item.description}</p> : null}
        </div>
        <ExternalLink size={16} className="text-slate-400" />
      </a>
    ))}
  </div>
);

export default function WidgetRenderer({ widget, onTogglePin, onToggleVisibility }) {
  const Icon = ICONS[widget.icon] || FileText;

  return (
    <WidgetCard
      title={widget.title}
      description={widget.description}
      badge={
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          <Icon size={14} />
          {widget.kind}
        </div>
      }
      actions={
        <div className="flex items-center gap-2 text-xs text-slate-500">
          {onTogglePin ? (
            <button type="button" onClick={() => onTogglePin(widget)} className="rounded-full border border-slate-200 px-2 py-1 hover:bg-slate-50">
              {widget.pinned ? 'Unpin' : 'Pin'}
            </button>
          ) : null}
          {onToggleVisibility ? (
            <button type="button" onClick={() => onToggleVisibility(widget)} className="rounded-full border border-slate-200 px-2 py-1 hover:bg-slate-50">
              {widget.visible === false ? 'Show' : 'Hide'}
            </button>
          ) : null}
        </div>
      }
    >
      {widget.kind === 'summary' ? renderSummary(widget.data) : null}
      {widget.kind === 'stats' ? renderStats(widget.data) : null}
      {widget.kind === 'list' || widget.kind === 'editor' ? (
        <div className="grid gap-3">{(widget.data || []).map(renderListRow)}</div>
      ) : null}
      {widget.kind === 'actions' ? renderActions(widget.data) : null}
      {widget.kind === 'summary' && widget.data === null ? <p className="text-sm text-slate-500">No data available.</p> : null}
    </WidgetCard>
  );
}
