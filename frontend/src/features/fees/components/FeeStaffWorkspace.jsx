import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { feeService } from "../../../services/feeService";
import { card, input, Loading, Summary } from "./feePortal.shared";
import FeeHierarchy from "./FeeHierarchy";
import StructureLibrary from "./FeeStructureLibrary";

export default function StaffWorkspace({ role, settings, refresh }) {
  const admin = ["ADMIN", "SCHOOL_OWNER", "FEE_MANAGER"].includes(role);
  const [tab, setTab] = useState("students");
  const [session, setSession] = useState("2026-27");
  const [dashboard, setDashboard] = useState();
  const [structures, setStructures] = useState([]);
  useEffect(() => {
    Promise.all([feeService.dashboard(session), feeService.structures(session)])
      .then(([d, s]) => {
        setDashboard(d);
        setStructures(s);
      })
      .catch((e) =>
        toast.error(
          e.response?.data?.message || "Unable to load fee workspace",
        ),
      );
  }, [session]);
  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-2xl font-bold">Fee management</h1>
            <p className="text-sm text-slate-500">
              Move from class to section to student, then review or collect.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              className={`${input} w-32`}
              value={session}
              onChange={(e) => setSession(e.target.value)}
            />
            {admin && (
              <Link
                to="/dashboard/fees/structures/new"
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white"
              >
                New structure
              </Link>
            )}
          </div>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto">
          {[
            ["overview", "Overview"],
            ["students", "Classes & students"],
            ["structures", "Fee structures"],
            ["operations", "Operations & reports"],
          ].map(([id, label]) =>
            id === "operations" ? (
              <Link
                key={id}
                to="/dashboard/fees/operations"
                className="whitespace-nowrap rounded-xl border px-4 py-2 text-sm font-semibold dark:border-slate-700"
              >
                {label}
              </Link>
            ) : (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border dark:border-slate-700"}`}
              >
                {label}
              </button>
            ),
          )}
        </div>
      </div>
      {tab === "overview" &&
        (!dashboard ? (
          <Loading />
        ) : (
          <Summary totals={dashboard.totals} settings={settings} />
        ))}
      {tab === "students" && (
        <FeeHierarchy session={session} settings={settings} />
      )}{" "}
      {tab === "structures" && (
        <StructureLibrary
          structures={structures}
          admin={admin}
          settings={settings}
        />
      )}
    </div>
  );
}
