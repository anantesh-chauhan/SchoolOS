import React, { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgeIndianRupee,
  BookOpenCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  GraduationCap,
  Layers3,
  Search,
  Users,
  WalletCards,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import DashboardLayout from "../../layouts/DashboardLayout";
import FeeStructurePreviewTable from "../../components/fees/FeeStructurePreviewTable";
import { authService } from "../../services/authService";
import { feeService } from "../../services/feeService";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950";
const money = (minor = 0, s = {}) =>
  new Intl.NumberFormat(s.locale || "en-IN", {
    style: "currency",
    currency: s.currencyCode || "INR",
  }).format(Number(minor) / 10 ** (s.decimalPrecision ?? 2));
const badge = {
  PAID: "bg-emerald-100 text-emerald-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  PENDING: "bg-blue-100 text-blue-700",
  NOT_ASSIGNED: "bg-slate-100 text-slate-600",
};

function Loading() {
  return (
    <div className={`${card} animate-pulse`}>
      <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 h-32 rounded bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}

function ReceiptDownload({ receipt }) {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      await feeService.downloadReceipt(receipt.id, `${receipt.receiptNumber.replaceAll("/", "-")}.pdf`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Receipt download failed");
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" disabled={busy} onClick={download} className="mt-3 flex items-center gap-2 text-sm font-semibold text-blue-600 disabled:opacity-50"><Download size={16} />{busy ? "Preparing receipt…" : receipt.receiptNumber}</button>;
}
function Summary({ totals, settings }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Expected", totals?.expected, WalletCards],
        ["Collected", totals?.collected ?? totals?.paid, CheckCircle2],
        ["Pending", totals?.pending, Clock3],
        ["Overdue", totals?.overdue, AlertCircle],
      ].map(([label, value, Icon]) => (
        <div className={card} key={label}>
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{label}</span>
            <Icon size={18} />
          </div>
          <p className="mt-3 text-2xl font-bold">{money(value, settings)}</p>
        </div>
      ))}
    </div>
  );
}

function StructureLibrary({ structures, admin, settings }) {
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

function StudentDetail({ student, settings, onBack }) {
  const [fees, setFees] = useState();
  const [error, setError] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [payerName, setPayerName] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () =>
    feeService
      .student(student.id, student.session)
      .then(setFees)
      .catch((e) =>
        setError(e.response?.data?.message || "Could not load student fees"),
      );
  useEffect(load, [student.id]);
  const collect = async () => {
    setBusy(true);
    try {
      const result = await feeService.collect(
        {
          studentId: student.id,
          academicSession: student.session,
          amountMinor: Math.round(Number(amount) * 100),
          method,
          payerName: payerName || undefined,
          payerRelation: "Parent / guardian",
          transactionReference: method === "CHEQUE" ? undefined : reference || undefined,
          instrumentNumber: method === "CHEQUE" ? reference || undefined : undefined,
          instrumentDate: method === "CHEQUE" ? new Date().toISOString() : undefined,
          remarks: notes || undefined,
        },
        crypto.randomUUID(),
      );
      toast.success(result.receipt ? "Payment recorded and receipt generated" : "Cheque recorded; receipt will be generated after clearance");
      setAmount("");
      setReference("");
      setNotes("");
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm font-semibold text-blue-600">
        ← Back to class roster
      </button>
      {error && (
        <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {!fees ? (
        <Loading />
      ) : (
        <>
          <div className={card}>
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                  Student fee account
                </p>
                <h2 className="text-xl font-bold">
                  {fees.student.studentFirstName} {fees.student.studentLastName}
                </h2>
                <p className="text-sm text-slate-500">
                  {fees.student.admissionNo || fees.student.studentUserId} ·{" "}
                  {fees.student.className} {fees.student.section || ""}
                </p>
              </div>
              <span className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-800">
                Session {student.session}
              </span>
            </div>
          </div>
          <Summary totals={fees.totals} settings={settings} />
          <div className="grid gap-5 xl:grid-cols-[1.3fr_.7fr]">
            <div className="space-y-5">
              <div className={card}>
                <h3 className="font-semibold">Assigned fee structure</h3>
                <div className="mt-3 space-y-4">
                  {(fees.assignedStructures?.length ? fees.assignedStructures : fees.assignedStructure ? [fees.assignedStructure] : []).map((structure) => <FeeStructurePreviewTable key={structure.id} structure={structure} settings={settings} studentFees={fees} />)}
                </div>
                <div className="hidden">
                {fees.assignedStructure ? (
                  <>
                    <div className="mt-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
                      <p className="font-semibold">
                        {fees.assignedStructure.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fees.assignedStructure.code} · Version{" "}
                        {fees.assignedStructure.version}
                      </p>
                    </div>
                    <div className="mt-4 space-y-2">
                      {fees.assignedStructure.components.map((c) => (
                        <div
                          className="flex justify-between border-b py-2 text-sm last:border-0 dark:border-slate-800"
                          key={c.id}
                        >
                          <span>
                            {c.name} · {c.frequency.replaceAll("_", " ")}
                          </span>
                          <strong>{money(c.amountMinor, settings)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed p-5 text-sm text-amber-700">
                    No assignment is linked. Existing generated charges remain
                    visible below.
                  </p>
                )}
                </div>
              </div>
              <div className={card}>
                <h3 className="font-semibold">Installments and charges</h3>
                <div className="mt-3 space-y-2">
                  {fees.account?.charges.map((c) => (
                    <div
                      key={c.id}
                      className="flex justify-between rounded-xl border p-3 dark:border-slate-800"
                    >
                      <div>
                        <p className="font-medium">{c.installmentName}</p>
                        <p className="text-xs text-slate-500">
                          {c.feeComponent?.name} · Due{" "}
                          {new Date(c.dueDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {money(c.baseAmountMinor, settings)}
                        </p>
                        <p className="text-xs">
                          {c.status.replaceAll("_", " ")}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!fees.account?.charges.length && (
                    <p className="text-sm text-slate-500">
                      No charges generated.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <aside className="space-y-5">
              <div className={card}>
                <h3 className="font-semibold">Collect offline payment</h3>
                <label className="mt-3 block text-sm">
                  Amount
                  <input
                    type="number"
                    min="0.01"
                    className={`${input} mt-1`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <label className="mt-3 block text-sm">
                  Payer name
                  <input className={`${input} mt-1`} value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Parent, guardian, or student" />
                </label>
                <label className="mt-3 block text-sm">
                  Method
                  <select
                    className={`${input} mt-1`}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    {[
                      "CASH",
                      "CHEQUE",
                      "UPI",
                      "BANK_TRANSFER",
                      "NEFT",
                      "RTGS",
                      "IMPS",
                      "DEMAND_DRAFT",
                      "POS_CARD",
                      "OTHER",
                    ].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                {method !== "CASH" && <label className="mt-3 block text-sm">{method === "CHEQUE" ? "Cheque number" : "Transaction reference"}<input required className={`${input} mt-1`} value={reference} onChange={(e) => setReference(e.target.value)} /></label>}
                <label className="mt-3 block text-sm">Notes<textarea className={`${input} mt-1 h-20 py-2`} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
                <p className="mt-3 text-xs text-slate-500">Payments allocate oldest due first. Any excess becomes advance credit and is never discarded.</p>
                <button
                  disabled={!amount || busy || (method !== "CASH" && !reference)}
                  onClick={collect}
                  className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Recording…" : "Record payment"}
                </button>
              </div>
              <div className={card}>
                <h3 className="font-semibold">Recent receipts</h3>
                {fees.account?.payments.map(
                  (p) =>
                    p.receipt && <ReceiptDownload key={p.id} receipt={p.receipt} />,
                )}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function Hierarchy({ session, settings }) {
  const [data, setData] = useState();
  const [selectedClass, setClass] = useState();
  const [selectedSection, setSection] = useState();
  const [selectedStudent, setStudent] = useState();
  const [query, setQuery] = useState("");
  useEffect(() => {
    feeService
      .hierarchy(session)
      .then((result) => {
        setData(result);
        setClass(result.classes[0]);
        setSection(result.classes[0]?.sections[0]);
      })
      .catch((e) =>
        toast.error(
          e.response?.data?.message || "Unable to load school roster",
        ),
      );
  }, [session]);
  if (selectedStudent)
    return (
      <StudentDetail
        student={selectedStudent}
        settings={settings}
        onBack={() => setStudent(null)}
      />
    );
  if (!data) return <Loading />;
  const students = (selectedSection?.students || []).filter(
    (s) =>
      !query ||
      `${s.name} ${s.admissionNo || ""} ${s.parentMobile || ""}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="grid gap-5 lg:grid-cols-[250px_1fr]">
      <aside className={card}>
        <div className="flex items-center gap-2">
          <GraduationCap size={19} />
          <h2 className="font-semibold">Classes</h2>
        </div>
        <div className="mt-3 space-y-1">
          {data.classes.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setClass(c);
                setSection(c.sections[0]);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${selectedClass?.id === c.id ? "bg-blue-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}
            >
              <span>{c.className}</span>
              <span>
                {c.sections.reduce((n, s) => n + s.students.length, 0)}
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="space-y-4">
        <div className={card}>
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <h2 className="text-lg font-semibold">
                {selectedClass?.className || "Class"} students
              </h2>
              <p className="text-sm text-slate-500">
                Choose a section, then open a student fee account.
              </p>
            </div>
            <div className="relative">
              <Search
                className="absolute left-3 top-3 text-slate-400"
                size={17}
              />
              <input
                className={`${input} pl-9`}
                placeholder="Search this section"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2 overflow-x-auto">
            {selectedClass?.sections.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s)}
                className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${selectedSection?.id === s.id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border dark:border-slate-700"}`}
              >
                Section {s.sectionName} ({s.students.length})
              </button>
            ))}
          </div>
        </div>
        <div className={card}>
          <div className="space-y-2">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => setStudent(s)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-4 text-left transition hover:border-blue-400 hover:bg-blue-50/50 dark:border-slate-800 dark:hover:bg-blue-950/20 sm:grid-cols-[1.3fr_.7fr_.7fr_auto]"
              >
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {s.admissionNo || s.studentUserId} · Roll{" "}
                    {s.rollNumber || "—"}
                  </p>
                </div>
                <p className="hidden text-sm sm:block">
                  {s.parentName}
                  <br />
                  <span className="text-xs text-slate-500">
                    {s.parentMobile}
                  </span>
                </p>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold">
                    {money(s.totals.pending, settings)}
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
            {!students.length && (
              <div className="py-12 text-center text-slate-500">
                No students in this section.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeeFigures({ totals, settings }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-slate-500">
          Expected
        </p>
        <p className="font-semibold">{money(totals?.expected, settings)}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-emerald-600">
          Collected
        </p>
        <p className="font-semibold text-emerald-700">
          {money(totals?.paid, settings)}
        </p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-amber-600">
          Due
        </p>
        <p className="font-semibold text-amber-700">
          {money(totals?.pending, settings)}
        </p>
      </div>
    </div>
  );
}
function FeeHierarchy({ session, settings }) {
  const [data, setData] = useState();
  const [expanded, setExpanded] = useState("");
  const [section, setSection] = useState();
  const [student, setStudent] = useState();
  const [query, setQuery] = useState("");
  useEffect(() => {
    setData();
    setExpanded("");
    setSection(null);
    feeService
      .hierarchy(session)
      .then(setData)
      .catch((e) =>
        toast.error(
          e.response?.data?.message || "Unable to load school roster",
        ),
      );
  }, [session]);
  if (student)
    return (
      <StudentDetail
        student={student}
        settings={settings}
        onBack={() => setStudent(null)}
      />
    );
  if (!data) return <Loading />;
  const school = data.classes.reduce(
    (a, c) => ({
      expected: a.expected + c.totals.expected,
      paid: a.paid + c.totals.paid,
      pending: a.pending + c.totals.pending,
    }),
    { expected: 0, paid: 0, pending: 0 },
  );
  const roster = (section?.students || []).filter((s) =>
    `${s.name} ${s.admissionNo || ""} ${s.parentMobile || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="space-y-5">
      <div className={card}>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
            <BadgeIndianRupee size={22} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">School fee summary</h2>
            <p className="text-sm text-slate-500">
              {data.totals.students} students · {data.totals.classes} classes ·{" "}
              {data.totals.sections} sections
            </p>
          </div>
        </div>
        <div className="mt-5">
          <FeeFigures totals={school} settings={settings} />
        </div>
      </div>
      <div className="space-y-4">
        {data.classes.map((c) => {
          const open = expanded === c.id;
          return (
            <article key={c.id} className={`${card} p-0 overflow-hidden`}>
              <div className="flex gap-3 p-5">
                <button
                  onClick={() => {
                    setExpanded(open ? "" : c.id);
                    setSection(null);
                  }}
                  className="mt-0.5 h-9 rounded-xl border px-2 dark:border-slate-700"
                >
                  {open ? (
                    <ChevronDown size={18} />
                  ) : (
                    <ChevronRight size={18} />
                  )}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{c.className}</h3>
                      <p className="text-sm text-slate-500">
                        {c.sections.length} sections ·{" "}
                        {c.sections.reduce((n, s) => n + s.students.length, 0)}{" "}
                        students
                      </p>
                    </div>
                    <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                      Due {money(c.totals.pending, settings)}
                    </span>
                  </div>
                  <div className="mt-4">
                    <FeeFigures totals={c.totals} settings={settings} />
                  </div>
                </div>
              </div>
              {open && (
                <div className="grid gap-3 border-t bg-slate-50 p-4 md:grid-cols-2 dark:border-slate-800 dark:bg-slate-950/30">
                  {c.sections.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSection(s);
                        setQuery("");
                      }}
                      className="rounded-xl border bg-white p-4 text-left hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-semibold">
                            Section {s.sectionName}
                          </p>
                          <p className="text-xs text-slate-500">
                            {s.students.length} students
                          </p>
                        </div>
                        <ChevronRight className="text-blue-600" size={18} />
                      </div>
                      <div className="mt-3">
                        <FeeFigures totals={s.totals} settings={settings} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {section && (
        <div className={card}>
          <div className="flex flex-col justify-between gap-3 md:flex-row">
            <div>
              <button
                onClick={() => setSection(null)}
                className="text-sm font-semibold text-blue-600"
              >
                ← All classes
              </button>
              <h2 className="mt-1 text-lg font-semibold">
                Section {section.sectionName} student fees
              </h2>
            </div>
            <div className="relative">
              <Search
                className="absolute left-3 top-3 text-slate-400"
                size={17}
              />
              <input
                className={`${input} pl-9`}
                placeholder="Search students"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {roster.map((s) => (
              <button
                key={s.id}
                onClick={() => setStudent(s)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-3 rounded-xl border p-4 text-left hover:border-blue-400 sm:grid-cols-[1fr_.7fr_.7fr_auto] dark:border-slate-800"
              >
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-xs text-slate-500">
                    {s.admissionNo || s.studentUserId} · Roll{" "}
                    {s.rollNumber || "—"}
                  </p>
                </div>
                <p className="hidden text-sm sm:block">
                  {s.parentName}
                  <br />
                  <span className="text-xs text-slate-500">
                    {s.parentMobile}
                  </span>
                </p>
                <div className="hidden sm:block">
                  <p className="text-sm font-semibold">
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
            {!roster.length && (
              <p className="py-10 text-center text-slate-500">
                No matching students.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function StaffWorkspace({ role, settings, refresh }) {
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

function PortalFees({ role, settings }) {
  const [fees, setFees] = useState();
  const [family, setFamily] = useState();
  const [error, setError] = useState("");
  const load = (studentId) =>
    feeService
      .myFees(undefined, studentId)
      .then(setFees)
      .catch((e) =>
        setError(e.response?.data?.message || "Unable to load fees"),
      );
  useEffect(() => {
    if (role === "PARENT")
      feeService
        .family()
        .then((f) => {
          setFamily(f);
          load(f.children[0]?.student.id);
        })
        .catch((e) =>
          setError(e.response?.data?.message || "Unable to load family"),
        );
    else load();
  }, [role]);
  if (error)
    return <div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div>;
  if (!fees) return <Loading />;
  return (
    <div className="space-y-5">
      {role === "PARENT" && family?.children.length > 0 && (
        <div className={card}>
          <label className="text-sm font-semibold">
            Viewing child
            <select
              className={`${input} mt-2`}
              onChange={(e) => load(e.target.value)}
            >
              {family.children.map((c) => (
                <option key={c.student.id} value={c.student.id}>
                  {c.student.name} · {c.student.className}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      <div className={card}>
        <p className="text-sm text-blue-600">
          {fees.student.className} {fees.student.section || ""} ·{" "}
          {fees.student.session}
        </p>
        <h1 className="text-2xl font-bold">
          {fees.student.studentFirstName}'s fees
        </h1>
      </div>
      <Summary totals={fees.totals} settings={settings} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className={card}>
          <h2 className="text-lg font-semibold">My fee structures</h2>
          {(fees.assignedStructures?.length ? fees.assignedStructures : fees.assignedStructure ? [fees.assignedStructure] : []).length ? (
            (fees.assignedStructures?.length ? fees.assignedStructures : [fees.assignedStructure]).map((structure) => <div key={structure.id} className="mt-4">
              <FeeStructurePreviewTable structure={structure} settings={settings} studentFees={fees} />
              <div className="hidden mt-3 rounded-xl bg-blue-50 p-4 dark:bg-blue-950/30">
                <div className="flex items-center justify-between gap-2"><p className="font-semibold">{structure.name}</p><span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-blue-700 dark:bg-slate-900">{structure.assignment?.targetType || 'ACADEMIC'}</span></div>
                <p className="text-xs text-slate-500">
                  {structure.academicSession} · Version {structure.version}
                </p>
              </div>
              <div className="hidden">{structure.components.map((c) => (
                <div
                  key={c.id}
                  className="flex justify-between border-b py-3 text-sm last:border-0 dark:border-slate-800"
                >
                  <span>
                    {c.name}
                    <br />
                    <small className="text-slate-500">
                      {c.frequency.replaceAll("_", " ")}
                    </small>
                  </span>
                  <strong>{money(c.amountMinor, settings)}</strong>
                </div>
              ))}</div>
            </div>)
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              The school has not assigned a fee structure yet.
            </p>
          )}
        </div>
        <div className={card}>
          <h2 className="text-lg font-semibold">Installment schedule</h2>
          <div className="mt-3 space-y-2">
            {fees.account?.charges.map((c) => (
              <div
                key={c.id}
                className="flex justify-between rounded-xl border p-3 dark:border-slate-800"
              >
                <div>
                  <p className="font-medium">{c.installmentName}</p>
                  <p className="text-xs text-slate-500">
                    Due {new Date(c.dueDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <strong>{money(c.baseAmountMinor, settings)}</strong>
                  <p className="text-xs">{c.status.replaceAll("_", " ")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={card}>
        <h2 className="font-semibold">Receipts</h2>
        {fees.account?.payments.map(
          (p) =>
            p.receipt && <ReceiptDownload key={p.id} receipt={p.receipt} />,
        )}
      </div>
      <div className={`${card} text-center`}>
        <CreditCard className="mx-auto text-slate-400" />
        <p className="mt-2 font-semibold">Online Payment — Coming Soon</p>
        <p className="text-sm text-slate-500">
          Secure gateway integration will be available in a future update.
        </p>
      </div>
    </div>
  );
}

function SectionStudentPage({ settings }) {
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
function AcademicFeeStudentPage({ settings }) {
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
function FeeLanding({ settings }) {
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
export default function FeePortalPage() {
  const user = authService.getCurrentUser();
  const role = user?.role;
  const { sectionId, studentId } = useParams();
  const [settings, setSettings] = useState();
  useEffect(() => {
    feeService
      .settings()
      .then(setSettings)
      .catch((e) =>
        toast.error(e.response?.data?.message || "Fee module unavailable"),
      );
  }, []);
  const content = !settings ? (
    <Loading />
  ) : sectionId ? (
    <SectionStudentPage settings={settings} />
  ) : studentId ? (
    <AcademicFeeStudentPage settings={settings} />
  ) : ["STUDENT", "PARENT"].includes(role) ? (
    <PortalFees role={role} settings={settings} />
  ) : (
    <FeeLanding settings={settings} />
  );
  return <DashboardLayout role={role}>{content}</DashboardLayout>;
}
