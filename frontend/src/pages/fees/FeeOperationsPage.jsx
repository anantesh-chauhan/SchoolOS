import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import DashboardLayout from "../../layouts/DashboardLayout";
import { authService } from "../../services/authService";
import { feeService } from "../../services/feeService";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900";
const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 dark:border-slate-700 dark:bg-slate-950";
export default function FeeOperationsPage() {
  const role = authService.getCurrentUser()?.role;
  const [tab, setTab] = useState(
    role === "FEE_MANAGER" ? "closing" : "reports",
  );
  const [rows, setRows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({
    academicSession: "2026-27",
    closingDate: new Date().toISOString().slice(0, 10),
    openingCashMinor: 0,
    actualClosingMinor: 0,
    name: "Overdue reminder",
    type: "OVERDUE",
    title: "Fee payment reminder",
    body: "Dear {{parentName}}, {{dueAmount}} is pending for {{studentName}}.",
  });
  const load = async () => {
    try {
      if (tab === "reports")
        setRows(
          (await feeService.report({ academicSession: form.academicSession }))
            .rows,
        );
      if (tab === "closing") setRows(await feeService.closings());
      if (tab === "reminders") setTemplates(await feeService.templates());
      if (tab === "approvals") setRows(await feeService.approvals());
    } catch (e) {
      toast.error(e.response?.data?.message || "Unable to load data");
    }
  };
  useEffect(() => {
    load();
  }, [tab]);
  const tabs =
    role === "FEE_MANAGER"
      ? ["closing", "reminders", "reports"]
      : ["reports", "approvals", "reminders", "closing", "periods", "rollover"];
  return (
    <DashboardLayout role={role}>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Fee operations</h1>
          <p className="text-sm text-slate-500">
            Reports, approvals, reminders, closing, and financial controls.
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((x) => (
            <button
              key={x}
              onClick={() => setTab(x)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${tab === x ? "bg-blue-600 text-white" : "border dark:border-slate-700"}`}
            >
              {x.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        {tab === "reports" && (
          <div className={card}>
            <div className="mb-4 flex gap-3">
              <input
                className={input}
                value={form.academicSession}
                onChange={(e) =>
                  setForm({ ...form, academicSession: e.target.value })
                }
              />
              <button
                onClick={load}
                className="rounded-xl bg-blue-600 px-5 text-white"
              >
                Filter
              </button>
              <button
                type="button"
                className="rounded-xl border px-5 py-3"
                onClick={() => feeService.downloadReport({ academicSession: form.academicSession, format: "csv" }, `fee-collections-${form.academicSession}.csv`).catch((error) => toast.error(error.response?.data?.message || "Export failed"))}
              >
                CSV
              </button>
            </div>
            <div className="space-y-2">
              {rows.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between rounded-xl border p-3 dark:border-slate-800"
                >
                  <span>
                    {p.student?.studentFirstName} ·{" "}
                    {p.receipt?.receiptNumber || p.paymentNumber}
                  </span>
                  <span>
                    {(p.amountMinor / 100).toLocaleString()} · {p.method}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "closing" && (
          <div className={card}>
            <div className="grid gap-3 md:grid-cols-3">
              <input
                type="date"
                className={input}
                value={form.closingDate}
                onChange={(e) =>
                  setForm({ ...form, closingDate: e.target.value })
                }
              />
              <input
                type="number"
                className={input}
                placeholder="Opening cash minor"
                value={form.openingCashMinor}
                onChange={(e) =>
                  setForm({ ...form, openingCashMinor: Number(e.target.value) })
                }
              />
              <input
                type="number"
                className={input}
                placeholder="Actual closing minor"
                value={form.actualClosingMinor}
                onChange={(e) =>
                  setForm({
                    ...form,
                    actualClosingMinor: Number(e.target.value),
                  })
                }
              />
            </div>
            {role === "FEE_MANAGER" && (
              <button
                onClick={async () => {
                  await feeService.submitClosing(form);
                  toast.success("Closing submitted");
                  load();
                }}
                className="mt-3 rounded-xl bg-emerald-600 px-5 py-2 text-white"
              >
                Submit closing
              </button>
            )}
            <div className="mt-4 space-y-2">
              {rows.map((x) => (
                <div
                  key={x.id}
                  className="rounded-xl border p-3 dark:border-slate-800"
                >
                  {new Date(x.closingDate).toLocaleDateString()} · Difference{" "}
                  {(x.differenceMinor / 100).toLocaleString()} · {x.status}
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "reminders" && (
          <div className={card}>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className={input}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <input
                className={input}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <textarea
                className={`${input} h-24 py-3 md:col-span-2`}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
            {role !== "FEE_MANAGER" && (
              <button
                onClick={async () => {
                  await feeService.saveTemplate({
                    name: form.name,
                    type: form.type,
                    title: form.title,
                    body: form.body,
                  });
                  toast.success("Template saved");
                  load();
                }}
                className="mt-3 rounded-xl bg-blue-600 px-5 py-2 text-white"
              >
                Save template
              </button>
            )}
            <div className="mt-4 space-y-2">
              {templates.map((t) => (
                <div
                  key={t.id}
                  className="flex justify-between rounded-xl border p-3 dark:border-slate-800"
                >
                  <span>{t.name}</span>
                  <button
                    onClick={async () => {
                      await feeService.sendReminders({
                        templateId: t.id,
                        academicSession: form.academicSession,
                      });
                      toast.success("In-app reminders queued");
                    }}
                    className="text-blue-600"
                  >
                    Send to dues
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "approvals" && (
          <div className={card}>
            {rows.map((x) => (
              <div
                key={x.id}
                className="mb-2 flex items-center justify-between rounded-xl border p-3 dark:border-slate-800"
              >
                <span>
                  {x.type} · {x.student?.studentFirstName} ·{" "}
                  {(x.amountMinor / 100).toLocaleString()}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      await feeService.reviewAdjustment(x.id, {
                        decision: "APPROVE",
                        comment: "Approved",
                      });
                      await feeService.processAdjustment(x.id);
                      load();
                    }}
                    className="text-emerald-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={async () => {
                      await feeService.reviewAdjustment(x.id, {
                        decision: "REJECT",
                        comment: "Rejected",
                      });
                      load();
                    }}
                    className="text-red-600"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === "periods" && (
          <div className={card}>
            <p className="mb-3 font-semibold">Lock a financial period</p>
            <button
              onClick={async () => {
                await feeService.setPeriodLock({
                  academicSession: form.academicSession,
                  periodKey: `${form.academicSession}-FULL`,
                  startDate: `${form.academicSession.slice(0, 4)}-04-01`,
                  endDate: `${Number(form.academicSession.slice(0, 4)) + 1}-03-31`,
                  lock: true,
                });
                toast.success("Period locked");
              }}
              className="rounded-xl bg-slate-900 px-5 py-2 text-white dark:bg-white dark:text-slate-900"
            >
              Lock session
            </button>
          </div>
        )}
        {tab === "rollover" && (
          <div className={card}>
            <p className="mb-3 font-semibold">
              Carry approved outstanding dues forward
            </p>
            <button
              onClick={async () => {
                const from = form.academicSession;
                const to = `${Number(from.slice(0, 4)) + 1}-${String(Number(from.slice(0, 4)) + 2).slice(-2)}`;
                await feeService.rollover({
                  fromSession: from,
                  toSession: to,
                  reason: "Approved annual rollover",
                });
                toast.success(`Dues carried to ${to}`);
              }}
              className="rounded-xl bg-amber-600 px-5 py-2 text-white"
            >
              Run rollover
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
