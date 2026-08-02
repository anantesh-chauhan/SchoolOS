import React, { useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import FeeStructurePreviewTable from "../../../components/fees/FeeStructurePreviewTable";
import { feeService } from "../../../services/feeService";
import { card, input, money, Loading, ReceiptDownload, Summary } from "./feePortal.shared";

export default function PortalFees({ role, settings }) {
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
