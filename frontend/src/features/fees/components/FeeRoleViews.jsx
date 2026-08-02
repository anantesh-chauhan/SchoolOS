import React, { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { feeService } from "../../../services/feeService";
import { card, input, money, badge, Loading, ReceiptDownload, Summary, FeeFigures } from "./feePortal.shared";

export function SectionStudentPage({ settings }) {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState();
  const [query, setQuery] = useState("");
  useEffect(() => {
    feeService
      .hierarchy("2026-27")
      .then(setData)
      .catch(() => toast.error("Unable to load section"));
  }, [sectionId]);
  if (!data) return <Loading />;
  const found = data.classes
    .flatMap((c) => c.sections.map((s) => ({ ...s, className: c.className })))
    .find((s) => s.id === sectionId);
  if (!found) return <div className={card}>Section not found.</div>;
  const students = found.students.filter((s) =>
    `${s.name} ${s.admissionNo || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate("/dashboard/fees")}
        className="text-sm font-semibold text-blue-600"
      >
        ← Fee summary
      </button>
      <div className={card}>
        <p className="text-sm text-blue-600">{found.className}</p>
        <h1 className="text-2xl font-bold">
          Section {found.sectionName} students
        </h1>
        <div className="mt-4">
          <FeeFigures totals={found.totals} settings={settings} />
        </div>
      </div>
      <div className={card}>
        <div className="relative">
          <Search className="absolute left-3 top-3 text-slate-400" size={17} />
          <input
            className={`${input} pl-9`}
            placeholder="Search student"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="mt-4 space-y-2">
          {students.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/dashboard/fees/students/${s.id}`)}
              className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-4 text-left hover:border-blue-400 sm:grid-cols-[1fr_.7fr_auto] dark:border-slate-800"
            >
              <div>
                <p className="font-semibold">{s.name}</p>
                <p className="text-xs text-slate-500">
                  {s.admissionNo || s.studentUserId} · Roll{" "}
                  {s.rollNumber || "—"}
                </p>
              </div>
              <div className="hidden sm:block">
                <p className="font-semibold">
                  Due {money(s.totals.pending, settings)}
                </p>
                <span
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badge[s.feeStatus]}`}
                >
                  {s.feeStatus.replaceAll("_", " ")}
                </span>
              </div>
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AcademicFeeStudentPage({ settings }) {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [fees, setFees] = useState();
  useEffect(() => {
    feeService
      .student(studentId, "2026-27")
      .then(setFees)
      .catch((e) =>
        toast.error(e.response?.data?.message || "Unable to load student fees"),
      );
  }, [studentId]);
  if (!fees) return <Loading />;
  const chargeById = Object.fromEntries(
    (fees.account?.charges || []).map((c) => [c.id, c]),
  );
  return (
    <div className="space-y-5">
      <button
        onClick={() => navigate(-1)}
        className="text-sm font-semibold text-blue-600"
      >
        ← Student list
      </button>
      <div className={card}>
        <p className="text-sm text-blue-600">
          {fees.student.className} · Section {fees.student.section}
        </p>
        <h1 className="text-2xl font-bold">
          {fees.student.studentFirstName} {fees.student.studentLastName}
        </h1>
        <p className="text-sm text-slate-500">
          {fees.student.admissionNo || fees.student.studentUserId}
        </p>
      </div>
      <Summary totals={fees.totals} settings={settings} />
      <div className={card}>
        <h2 className="text-lg font-semibold">Academic fee history</h2>
        <div className="mt-4 space-y-2">
          {(fees.account?.charges || []).map((c) => (
            <div
              key={c.id}
              className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[1fr_auto_auto] dark:border-slate-800"
            >
              <div>
                <p className="font-semibold">{c.installmentName}</p>
                <p className="text-xs text-slate-500">
                  Due {new Date(c.dueDate).toLocaleDateString()} ·{" "}
                  {c.feeComponent?.name}
                </p>
              </div>
              <p className="font-semibold">
                {money(c.baseAmountMinor, settings)}
              </p>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${badge[c.status] || "bg-slate-100 text-slate-600"}`}
              >
                {c.status.replaceAll("_", " ")}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={card}>
        <h2 className="text-lg font-semibold">Payment & receipt history</h2>
        <div className="mt-4 space-y-3">
          {(fees.account?.payments || []).map((p) => (
            <div
              key={p.id}
              className="rounded-xl border p-4 dark:border-slate-800"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {money(p.amountMinor, settings)} ·{" "}
                    {p.method.replaceAll("_", " ")}
                  </p>
                  <p className="text-xs text-slate-500">
                    Paid on {new Date(p.paymentDate).toLocaleDateString()}
                  </p>
                </div>
                {p.receipt && <ReceiptDownload receipt={p.receipt} />}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Applied to:{" "}
                {(p.allocations || [])
                  .map(
                    (a) => chargeById[a.chargeId]?.installmentName || "Advance",
                  )
                  .join(", ") || "Advance balance"}
              </p>
            </div>
          ))}
          {!(fees.account?.payments || []).length && (
            <p className="py-6 text-sm text-slate-500">
              No payments recorded yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FeeLanding({ settings }) {
  const [data, setData] = useState();
  const [open, setOpen] = useState("");
  useEffect(() => {
    feeService
      .hierarchy("2026-27")
      .then(setData)
      .catch(() => toast.error("Unable to load fee summary"));
  }, []);
  if (!data) return <Loading />;
  return (
    <div className="space-y-5">
      <div className={card}>
        <h1 className="text-2xl font-bold">Fee management</h1>
        <p className="text-sm text-slate-500">
          School, class, section and student fee records.
        </p>
      </div>
      <div className={card}>
        <h2 className="text-lg font-semibold">School fee summary</h2>
        <div className="mt-4">
          <FeeFigures
            totals={data.classes.reduce(
              (a, c) => ({
                expected: a.expected + c.totals.expected,
                paid: a.paid + c.totals.paid,
                pending: a.pending + c.totals.pending,
              }),
              { expected: 0, paid: 0, pending: 0 },
            )}
            settings={settings}
          />
        </div>
      </div>
      {data.classes.map((c) => (
        <div key={c.id} className={`${card} p-0 overflow-hidden`}>
          <button
            onClick={() => setOpen(open === c.id ? "" : c.id)}
            className="flex w-full items-center gap-3 p-5 text-left"
          >
            <span className="rounded-lg border p-1">
              {open === c.id ? (
                <ChevronDown size={18} />
              ) : (
                <ChevronRight size={18} />
              )}
            </span>
            <div className="flex-1">
              <p className="font-semibold">{c.className}</p>
              <p className="text-xs text-slate-500">
                {c.sections.length} sections ·{" "}
                {c.sections.reduce((n, s) => n + s.students.length, 0)} students
              </p>
            </div>
            <span className="text-sm font-semibold text-amber-700">
              Due {money(c.totals.pending, settings)}
            </span>
          </button>
          {open === c.id && (
            <div className="grid gap-3 border-t bg-slate-50 p-4 md:grid-cols-2 dark:border-slate-800 dark:bg-slate-950">
              {c.sections.map((s) => (
                <Link
                  key={s.id}
                  to={`/dashboard/fees/sections/${s.id}`}
                  className="rounded-xl border bg-white p-4 hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex justify-between">
                    <div>
                      <p className="font-semibold">Section {s.sectionName}</p>
                      <p className="text-xs text-slate-500">
                        {s.students.length} students · Open student list
                      </p>
                    </div>
                    <ChevronRight className="text-blue-600" size={18} />
                  </div>
                  <div className="mt-3">
                    <FeeFigures totals={s.totals} settings={settings} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
