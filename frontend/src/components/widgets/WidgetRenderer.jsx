import React from "react";
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
} from "lucide-react";

import WidgetCard from "./WidgetCard";

/* =========================================
   Icon Registry
========================================= */

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

/* =========================================
   Shared Styles
========================================= */

const labelClass = `
  rounded-xl
  border
  border-slate-200
  dark:border-slate-700
  bg-slate-50
  dark:bg-slate-800/50
  px-3
  py-2
  transition
  hover:shadow-sm
`;

/* =========================================
   List Renderer
========================================= */

const renderListRow = (item, index) => {
  if (item && typeof item === "object") {
    return (
      <div
        key={
          item.id ||
          item.key ||
          item.title ||
          index
        }
        className="
          group
          rounded-xl
          rounded-2xl
          border
          border-slate-200
          border-slate-100
          dark:border-slate-700
          bg-slate-50
          dark:bg-slate-800/40
          px-4
          py-3
          bg-white
          dark:bg-slate-800/20
          p-5
          transition-all
          hover:shadow-md
          hover:border-sky-200
          hover:border-sky-100
          hover:bg-sky-50/20
        "
      >
        <div className="flex items-start justify-between gap-3">

          <div>

            <p className="
              font-semibold
              text-sm
              font-bold
              text-slate-900
              dark:text-white
            ">
              {item.title ||
                item.label ||
                item.name ||
                "Item"}
            </p>

            {item.description ||
            item.body ||
            item.summary ? (

              <p className="
                mt-1
                text-sm
                text-slate-500
                line-clamp-2
              ">
                {item.description ||
                  item.body ||
                  item.summary}
              </p>

            ) : null}

          </div>

          {"url" in item ? (

            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="
                inline-flex
                items-center
                gap-1
                text-sm
                font-medium
                text-sky-600
                hover:text-sky-700
                opacity-80
                group-hover:opacity-100
              "
            >

              Open
              <ExternalLink size={14} />

            </a>

          ) : null}

        </div>

        <div className="
          mt-3
          flex
          flex-wrap
          gap-2
          text-xs
          text-slate-500
        ">

          {item.count !== undefined && (
            <span>{item.count} items</span>
          )}

          {item.value !== undefined && (
            <span>{item.value}</span>
          )}

          {item.isVisible !== undefined && (
            <span>
              {item.isVisible
                ? "Visible"
                : "Hidden"}
            </span>
          )}

          {item.isRead !== undefined && (
            <span>
              {item.isRead
                ? "Read"
                : "Unread"}
            </span>
          )}

          {item.isCompleted !==
            undefined && (
            <span>
              {item.isCompleted
                ? "Done"
                : "Open"}
            </span>
          )}

        </div>

      </div>
    );
  }

  return (
    <div
      key={`${item}-${index}`}
      className={labelClass}
    >
      <p className="
        text-sm
        text-slate-700
        dark:text-slate-300
      ">
        {String(item)}
      </p>
    </div>
  );
};

/* =========================================
   Summary Renderer
========================================= */

const renderSummary = (data) => {

  if (!data) {

    return (
      <p className="
        text-sm
        text-slate-500
      ">
        No data available.
      </p>
    );

  }

  if (Array.isArray(data)) {

    return (

      <div className="
        grid
        grid-cols-2
        gap-3
      ">

        {data.map(
          (item, index) => (

            <div
              key={
                item.label ||
                item.title ||
                index
              }
              className="
                rounded-xl
                rounded-2xl
                border
                border-slate-200
                border-slate-100
                dark:border-slate-700
                bg-gradient-to-br
                from-slate-50
                to-slate-100/50
                bg-slate-50/50
                dark:from-slate-800
                dark:to-slate-900
                px-4
                py-3
                shadow-sm
              "
            >

              <p className="
                text-xs
                font-semibold
                text-[10px]
                font-bold
                uppercase
                tracking-wide
                tracking-[0.1em]
                text-slate-500
              ">
                {item.label ||
                  item.title}
              </p>

              <p className="
                mt-1
                text-lg
                font-bold
                text-xl
                font-black
                text-slate-900
                dark:text-white
              ">
                {item.value ??
                  item.count ??
                  item.name ??
                  "—"}
              </p>

            </div>

          )
        )}

      </div>

    );

  }

  return (
    <div className="
      rounded-xl
      border
      border-slate-200
      dark:border-slate-700
      bg-slate-50
      dark:bg-slate-800
      px-4
      py-3
    ">

      {Object.entries(data).map(
        ([label, value]) => (

          <div
            key={label}
            className="
              flex
              items-center
              justify-between
              py-1.5
            "
          >

            <span className="
              text-sm
              text-slate-500
              capitalize
            ">
              {label.replace(
                /([A-Z])/g,
                " $1"
              )}
            </span>

            <span className="
              text-sm
              font-semibold
              text-slate-900
              dark:text-white
            ">
              {String(value ?? "—")}
            </span>

          </div>

        )
      )}

    </div>
  );

};

/* =========================================
   Stats Renderer
========================================= */

const renderStats = (data) => {

  const rows = Array.isArray(data)
    ? data
    : Object.entries(data || {})
        .map(([label, value]) => ({
          label,
          value,
        }));

  return (

    <div className="
      grid
      grid-cols-2
      gap-3
    ">

      {rows.map(
        (item, index) => (

          <div
            key={
              item.label ||
              item.name ||
              index
            }
            className="
              rounded-xl
            rounded-2xl
              border
              border-slate-200
            border-slate-100
              dark:border-slate-700
              bg-white
              dark:bg-slate-800
              px-4
              py-3
            bg-white/50
            p-5
              shadow-sm
            "
          >

            <p className="
              text-xs
              font-semibold
            text-[10px]
            font-bold
              uppercase
              tracking-wide
            tracking-widest
              text-slate-500
            ">
              {item.label ||
                item.name}
            </p>

            <p className="
              mt-1
              text-2xl
              font-bold
            text-3xl
            font-black
              text-slate-900
              dark:text-white
            ">
              {item.value ??
                item.count ??
                "—"}
            </p>

          </div>

        )
      )}

    </div>

  );

};

/* =========================================
   Actions Renderer
========================================= */

const renderActions = (data) => (

  <div className="grid gap-3">

    {(data || []).map(
      (item, index) => (

        <a
          key={
            item.href ||
            item.label ||
            index
          }
          href={item.href || "#"}
          className="
            group
            flex
            items-center
            justify-between
            rounded-xl
            border
            border-slate-200
            dark:border-slate-700
            bg-slate-50
            dark:bg-slate-800/40
            px-4
            py-3
            transition
            hover:border-sky-200
            hover:bg-sky-50
            dark:hover:bg-slate-800
          "
        >

          <div>

            <p className="
              font-semibold
              text-slate-900
              dark:text-white
            ">
              {item.label ||
                item.title ||
                "Action"}
            </p>

            {item.description && (

              <p className="
                text-sm
                text-slate-500
              ">
                {item.description}
              </p>

            )}

          </div>

          <ExternalLink
            size={16}
            className="
              text-slate-400
              group-hover:text-sky-600
            "
          />

        </a>

      )
    )}

  </div>

);

/* =========================================
   Main Renderer
========================================= */

export default function WidgetRenderer({
  widget,
  onTogglePin,
  onToggleVisibility,
}) {

  const Icon =
    ICONS[widget.icon] ||
    FileText;

  return (

    <WidgetCard

      title={widget.title}

      description={
        widget.description
      }

      icon={Icon}

      badge={

        <div
          className="
            inline-flex
            items-center
            gap-1.5
            rounded-full
            bg-slate-100
            dark:bg-slate-800
            px-3
            py-1
            text-xs
            font-medium
            text-slate-600
            dark:text-slate-300
          "
        >

          <Icon size={14} />

          {widget.kind}

        </div>

      }

      actions={

        <div className="
          flex
          items-center
          gap-2
        ">

          {onTogglePin && (

            <button
              type="button"
              onClick={() =>
                onTogglePin(widget)
              }
              className="
                text-xs
                px-2.5
                py-1
                rounded-full
                border
                border-slate-200
                dark:border-slate-700
                hover:bg-slate-50
                dark:hover:bg-slate-800
              "
            >

              {widget.pinned
                ? "Unpin"
                : "Pin"}

            </button>

          )}

          {onToggleVisibility && (

            <button
              type="button"
              onClick={() =>
                onToggleVisibility(widget)
              }
              className="
                text-xs
                px-2.5
                py-1
                rounded-full
                border
                border-slate-200
                dark:border-slate-700
                hover:bg-slate-50
                dark:hover:bg-slate-800
              "
            >

              {widget.visible === false
                ? "Show"
                : "Hide"}

            </button>

          )}

        </div>

      }

    >

      {widget.kind === "summary"
        ? renderSummary(widget.data)
        : null}

      {widget.kind === "stats"
        ? renderStats(widget.data)
        : null}

      {widget.kind === "list" ||
      widget.kind === "editor" ? (

        <div className="grid gap-3">
          {(widget.data || []).map(
            renderListRow
          )}
        </div>

      ) : null}

      {widget.kind === "actions"
        ? renderActions(widget.data)
        : null}

      {widget.kind === "summary" &&
      widget.data === null ? (

        <p className="
          text-sm
          text-slate-500
        ">
          No data available.
        </p>

      ) : null}

    </WidgetCard>

  );

}