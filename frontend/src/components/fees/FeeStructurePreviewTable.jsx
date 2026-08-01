/* eslint-disable react/prop-types */
import React, { useMemo, useState } from 'react';
import { Download, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { feeService } from '../../services/feeService';

const MONTHS = [[4, 'Apr'], [5, 'May'], [6, 'Jun'], [7, 'Jul'], [8, 'Aug'], [9, 'Sep'], [10, 'Oct'], [11, 'Nov'], [12, 'Dec'], [1, 'Jan'], [2, 'Feb'], [3, 'Mar']];
const defaults = { MONTHLY: MONTHS.map(([number]) => number), BI_MONTHLY: [4, 6, 8, 10, 12, 2], QUARTERLY: [4, 7, 10, 1], FOUR_MONTHLY: [4, 8, 12], HALF_YEARLY: [4, 10], ANNUAL: [4], ONE_TIME: [4], PER_TERM: [4], PER_SEMESTER: [4] };
const tones = { PAID: 'bg-emerald-100 text-emerald-700', PARTIAL: 'bg-amber-100 text-amber-700', OVERDUE: 'bg-red-100 text-red-700', DUE: 'bg-orange-100 text-orange-700', UPCOMING: 'bg-blue-100 text-blue-700', WAIVED: 'bg-violet-100 text-violet-700', CANCELLED: 'bg-slate-100 text-slate-500' };

const amountFor = (component, month) => {
  const selected = component.applicability?.months?.length ? component.applicability.months.map(Number) : (defaults[component.frequency] || [4]);
  if (!selected.includes(month)) return null;
  return Number(component.applicability?.monthAmountsMinor?.[String(month)] ?? component.amountMinor ?? 0);
};
const chargeMoney = (charge) => {
  const expected = Math.max(0, Number(charge.baseAmountMinor || 0) + Number(charge.lateFeeMinor || 0) - Number(charge.discountMinor || 0) - Number(charge.scholarshipMinor || 0) - Number(charge.waiverMinor || 0));
  const paid = Math.max(0, Number(charge.paidMinor || 0) - Number(charge.refundedMinor || 0));
  return { expected, paid, pending: Math.max(0, expected - paid) };
};
const chargeStatus = (charge) => {
  if (['CANCELLED', 'REFUNDED'].includes(charge.status)) return 'CANCELLED';
  if (charge.status === 'WAIVED') return 'WAIVED';
  const totals = chargeMoney(charge);
  if (totals.expected > 0 && totals.pending === 0) return 'PAID';
  if (totals.paid > 0) return 'PARTIAL';
  const due = new Date(charge.dueDate);
  if (due < new Date(new Date().setHours(0, 0, 0, 0)) || charge.status === 'OVERDUE') return 'OVERDUE';
  if (charge.status === 'DUE') return 'DUE';
  if (due <= new Date(Date.now() + 7 * 86400000)) return 'DUE';
  return 'UPCOMING';
};

export default function FeeStructurePreviewTable({ structure, settings = {}, badge, studentFees, scopeSummary }) {
  const [detail, setDetail] = useState();
  const components = structure?.components || [];
  const currency = (minor = 0) => new Intl.NumberFormat(settings.locale || 'en-IN', { style: 'currency', currency: settings.currencyCode || 'INR', maximumFractionDigits: settings.decimalPrecision ?? 2 }).format(Number(minor) / 10 ** (settings.decimalPrecision ?? 2));
  const structureCharges = useMemo(() => (studentFees?.account?.charges || []).filter((charge) => charge.feeStructureId === structure.id), [studentFees, structure.id]);
  const receiptsByCharge = useMemo(() => {
    const map = new Map();
    for (const payment of studentFees?.account?.payments || []) for (const allocation of payment.allocations || []) {
      const rows = map.get(allocation.chargeId) || [];
      rows.push({ payment, allocation, receipt: payment.receipt }); map.set(allocation.chargeId, rows);
    }
    return map;
  }, [studentFees]);
  const rows = useMemo(() => components.map((component) => {
    const amounts = Object.fromEntries(MONTHS.map(([month]) => [month, amountFor(component, month)]));
    const charges = Object.fromEntries(MONTHS.map(([month]) => [month, structureCharges.filter((charge) => charge.feeComponentId === component.id && new Date(charge.dueDate).getUTCMonth() + 1 === month)]));
    return { component, amounts, charges, total: Object.values(amounts).reduce((sum, amount) => sum + Number(amount || 0), 0) };
  }), [components, structureCharges]);
  const monthTotals = useMemo(() => Object.fromEntries(MONTHS.map(([month]) => [month, rows.reduce((sum, row) => sum + Number(row.amounts[month] || 0), 0)])), [rows]);
  const annualTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const studentSummary = structureCharges.filter((charge) => !['CANCELLED', 'REFUNDED'].includes(charge.status)).reduce((sum, charge) => { const value = chargeMoney(charge); return { expectedMinor: sum.expectedMinor + value.expected, collectedMinor: sum.collectedMinor + value.paid, pendingMinor: sum.pendingMinor + value.pending }; }, { expectedMinor: 0, collectedMinor: 0, pendingMinor: 0 });
  const summary = scopeSummary || (studentFees ? studentSummary : structure.financialSummary);
  const expected = summary?.expectedMinor ?? summary?.expected ?? 0;
  const collected = summary?.collectedMinor ?? summary?.paidMinor ?? summary?.paid ?? 0;
  const pending = summary?.pendingMinor ?? summary?.dueMinor ?? summary?.pending ?? Math.max(0, Number(expected) - Number(collected));

  const openCell = (component, month, charges) => { if (studentFees && charges.length) setDetail({ component, month, charges }); };
  const download = async (receipt) => { try { await feeService.downloadReceipt(receipt.id, `${receipt.receiptNumber.replaceAll('/', '-')}.pdf`); } catch (error) { toast.error(error.response?.data?.message || 'Receipt download failed'); } };

  return <><article className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-blue-50/70 p-4 dark:border-slate-700 dark:bg-blue-950/20"><div><h3 className="font-black text-slate-900 dark:text-white">{structure.name}</h3><p className="mt-1 text-xs text-slate-500">{structure.academicSession} · {structure.code} · Version {structure.version}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold uppercase text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300">{badge || structure.assignment?.targetType || structure.status || 'ASSIGNED'}</span></header>
    <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-xs"><thead className="bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300"><tr><th className="sticky left-0 z-10 min-w-48 bg-slate-50 p-3 text-left dark:bg-slate-950">Fee head</th>{MONTHS.map(([month, label]) => <th key={month} className="p-2 text-right">{label}</th>)}<th className="p-3 text-right">Annual total</th></tr></thead>
      <tbody>{rows.map(({ component, amounts, charges, total }) => <tr key={component.id || component.code} className="border-t border-slate-100 dark:border-slate-800"><td className="sticky left-0 z-10 bg-white p-3 dark:bg-slate-900"><p className="font-bold">{component.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{component.frequency?.replaceAll('_', ' ')}{component.dueDay ? ` · due day ${component.dueDay}` : ''}</p></td>{MONTHS.map(([month]) => { const monthCharges = charges[month]; const status = monthCharges.length ? chargeStatus(monthCharges[0]) : null; return <td key={month} className="p-1 text-right tabular-nums">{amounts[month] == null ? '—' : <button type="button" disabled={!studentFees || !monthCharges.length} onClick={() => openCell(component, month, monthCharges)} className={`w-full rounded-lg p-1.5 text-right ${studentFees && monthCharges.length ? 'hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:hover:bg-blue-950/30' : ''}`}><span className="block">{currency(monthCharges[0]?.baseAmountMinor ?? amounts[month])}</span>{status && <span className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-black ${tones[status]}`}>{status}</span>}</button>}</td>})}<td className="p-3 text-right font-bold tabular-nums">{currency(total)}</td></tr>)}
        <tr className="border-t-2 border-slate-200 bg-slate-50 font-black dark:border-slate-700 dark:bg-slate-950"><td className="sticky left-0 bg-slate-50 p-3 dark:bg-slate-950">Monthly total</td>{MONTHS.map(([month]) => <td key={month} className="p-2 text-right tabular-nums">{currency(monthTotals[month])}</td>)}<td className="p-3 text-right tabular-nums text-blue-700 dark:text-blue-300">{currency(annualTotal)}</td></tr>
        {summary && <tr className="border-t border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20"><td colSpan={14} className="p-3"><div className="flex flex-wrap justify-end gap-x-6 gap-y-2 text-sm"><span>Total expected <strong>{currency(expected)}</strong></span><span className="text-emerald-700 dark:text-emerald-300">Collected <strong>{currency(collected)}</strong></span><span className="text-amber-700 dark:text-amber-300">Pending <strong>{currency(pending)}</strong></span></div></td></tr>}
      </tbody></table></div>{!components.length && <p className="p-5 text-sm text-slate-500">No fee heads are configured.</p>}
  </article>
  {detail && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase text-blue-600">Month fee details</p><h3 className="mt-1 text-xl font-black">{detail.component.name} · {MONTHS.find(([month]) => month === detail.month)?.[1]}</h3></div><button type="button" aria-label="Close details" onClick={() => setDetail()} className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800"><X size={18}/></button></div><div className="mt-4 space-y-3">{detail.charges.map((charge) => { const totals = chargeMoney(charge); const status = chargeStatus(charge); const receipts = receiptsByCharge.get(charge.id) || []; return <article key={charge.id} className="rounded-xl border p-4 dark:border-slate-700"><div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold">{charge.installmentName}</p><p className="text-xs text-slate-500">Due {new Date(charge.dueDate).toLocaleDateString()}</p></div><span className={`self-start rounded-full px-2 py-1 text-xs font-black ${tones[status]}`}>{status}</span></div><div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><p className="text-xs text-slate-500">Expected</p><strong>{currency(totals.expected)}</strong></div><div><p className="text-xs text-slate-500">Paid</p><strong className="text-emerald-700">{currency(totals.paid)}</strong></div><div><p className="text-xs text-slate-500">Due</p><strong className="text-amber-700">{currency(totals.pending)}</strong></div></div><div className="mt-4 border-t pt-3 dark:border-slate-700"><p className="text-xs font-bold uppercase text-slate-500">Receipts</p>{receipts.filter((row) => row.receipt).map(({ receipt, allocation }) => <button type="button" key={receipt.id} onClick={() => download(receipt)} className="mt-2 flex w-full items-center justify-between rounded-lg bg-slate-50 p-3 text-left text-sm font-semibold text-blue-700 dark:bg-slate-800 dark:text-blue-300"><span>{receipt.receiptNumber} · {currency(allocation.amountMinor)}</span><Download size={16}/></button>)}{!receipts.some((row) => row.receipt) && <p className="mt-2 text-sm text-slate-500">No receipt is available for this installment.</p>}</div></article>; })}</div></div></div>}
  </>;
}
