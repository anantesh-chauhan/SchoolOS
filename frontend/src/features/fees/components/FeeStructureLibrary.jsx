import React from "react";
import { Link } from "react-router-dom";
import FeeStructurePreviewTable from "../../../components/fees/FeeStructurePreviewTable";
import { card, money } from "./feePortal.shared";

export default function StructureLibrary({ structures, admin, settings }) {
  return (
    <div className={card}>
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold">School fee structures</h2>
          <p className="text-sm text-slate-500">
            The official published and historical fee plans for this school.
          </p>
        </div>
        {admin && (
          <Link
            to="/dashboard/fees/structures/new"
            className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white"
          >
            Create fee structure
          </Link>
        )}
      </div>
      <div className="mt-5 space-y-5">
        {structures.map((s) => (
          <article
            key={s.id}
            className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800"
          >
            <FeeStructurePreviewTable structure={s} settings={settings} />
            <div className="hidden items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.academicSession} · {s.code} · Version {s.version}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
              >
                {s.status}
              </span>
            </div>
            <div className="hidden mt-4 space-y-2">
              {s.components.map((c) => (
                <div key={c.id} className="flex justify-between text-sm">
                  <span>
                    {c.name}{" "}
                    <span className="text-xs text-slate-400">
                      {c.frequency.replaceAll("_", " ")}
                    </span>
                  </span>
                  <strong>{money(c.amountMinor, settings)}</strong>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t pt-3 text-xs text-slate-500 dark:border-slate-800">
              {s._count.assignments} assignments · {s._count.charges} generated
              charges
            </div>
            {admin && ["DRAFT", "PUBLISHED"].includes(s.status) && (
              <Link to={`/dashboard/fees/structures/${s.id}/edit`} className="mt-3 inline-flex rounded-lg border px-3 py-2 text-xs font-semibold text-blue-600 dark:border-slate-700">
                {s.status === "DRAFT" ? "Continue editing" : "Create revision"}
              </Link>
            )}
          </article>
        ))}
        {!structures.length && (
          <div className="rounded-xl border border-dashed p-8 text-center text-slate-500">
            No fee structure has been configured.
          </div>
        )}
      </div>
    </div>
  );
}
