import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import FeeStructurePreviewTable from "../../../components/fees/FeeStructurePreviewTable";
import { feeService } from "../../../services/feeService";
import { card, input, money, Loading, ReceiptDownload, Summary } from "./feePortal.shared";

export default function StudentDetail({ student, settings, onBack }) {
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
