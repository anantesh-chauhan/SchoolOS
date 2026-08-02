import React, { useEffect, useState } from "react";
import { BadgeIndianRupee, ChevronDown, ChevronRight, GraduationCap, Search } from "lucide-react";
import toast from "react-hot-toast";
import { feeService } from "../../../services/feeService";
import { card, input, money, badge, Loading, FeeFigures } from "./feePortal.shared";
import StudentDetail from "./FeeStudentDetail";

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

export default function FeeHierarchy({ session, settings }) {
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
