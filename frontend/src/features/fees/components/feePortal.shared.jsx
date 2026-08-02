import React, { useState } from "react";
import { AlertCircle, CheckCircle2, Clock3, Download, WalletCards } from "lucide-react";
import toast from "react-hot-toast";
import { feeService } from "../../../services/feeService";

export const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900";
export const input =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950";
export const money = (minor = 0, s = {}) =>
  new Intl.NumberFormat(s.locale || "en-IN", {
    style: "currency",
    currency: s.currencyCode || "INR",
  }).format(Number(minor) / 10 ** (s.decimalPrecision ?? 2));
export const badge = {
  PAID: "bg-emerald-100 text-emerald-700",
  PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  OVERDUE: "bg-red-100 text-red-700",
  PENDING: "bg-blue-100 text-blue-700",
  NOT_ASSIGNED: "bg-slate-100 text-slate-600",
};

export function Loading() {
  return (
    <div className={`${card} animate-pulse`}>
      <div className="h-5 w-40 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-4 h-32 rounded bg-slate-100 dark:bg-slate-800/50" />
    </div>
  );
}

export function ReceiptDownload({ receipt }) {
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
export function Summary({ totals, settings }) {
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

export function FeeFigures({ totals, settings }) {
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
