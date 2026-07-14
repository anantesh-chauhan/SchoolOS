const integer = (value, field = 'amount') => {
  const parsed = typeof value === 'bigint' ? value : BigInt(value ?? 0);
  if (parsed < 0n) throw new Error(`${field} cannot be negative`);
  return parsed;
};

export const calculateLateFee = ({ outstandingMinor, dueDate, gracePeriodDays = 0, rule, asOf = new Date() }) => {
  const outstanding = integer(outstandingMinor, 'outstandingMinor');
  if (!rule || outstanding === 0n) return 0n;
  const due = new Date(dueDate);
  const daysLate = Math.floor((new Date(asOf).setHours(0, 0, 0, 0) - due.setHours(0, 0, 0, 0)) / 86400000) - gracePeriodDays;
  if (daysLate <= 0) return 0n;
  let fee = 0n;
  if (rule.type === 'FIXED') fee = integer(rule.amountMinor);
  if (rule.type === 'DAILY') fee = integer(rule.amountMinor) * BigInt(daysLate);
  if (rule.type === 'WEEKLY') fee = integer(rule.amountMinor) * BigInt(Math.ceil(daysLate / 7));
  if (rule.type === 'MONTHLY') fee = integer(rule.amountMinor) * BigInt(Math.ceil(daysLate / 30));
  if (rule.type === 'PERCENTAGE') fee = (outstanding * integer(rule.basisPoints)) / 10000n;
  if (rule.type === 'SLAB') {
    fee = (rule.slabs || []).reduce((total, slab) => daysLate >= slab.fromDay && (!slab.toDay || daysLate <= slab.toDay)
      ? total + integer(slab.amountMinor) : total, 0n);
  }
  return rule.maximumMinor == null ? fee : fee > integer(rule.maximumMinor) ? integer(rule.maximumMinor) : fee;
};

export const calculateCharge = ({ baseAmountMinor, paidMinor = 0, refundedMinor = 0, discountMinor = 0, scholarshipMinor = 0, waiverMinor = 0, lateFeeMinor = 0, advanceAppliedMinor = 0 }) => {
  const base = integer(baseAmountMinor, 'baseAmountMinor');
  const reductionsRequested = integer(discountMinor) + integer(scholarshipMinor) + integer(waiverMinor);
  const reductions = reductionsRequested > base ? base : reductionsRequested;
  const grossMinor = base + integer(lateFeeMinor);
  const netMinor = grossMinor - reductions;
  const creditsMinor = integer(paidMinor) - integer(refundedMinor) + integer(advanceAppliedMinor);
  const payableMinor = netMinor > creditsMinor ? netMinor - creditsMinor : 0n;
  return { baseMinor: base, grossMinor, reductionsMinor: reductions, netMinor, creditsMinor, payableMinor, excessMinor: creditsMinor > netMinor ? creditsMinor - netMinor : 0n };
};

export const allocatePayment = (amountMinor, charges) => {
  let remaining = integer(amountMinor, 'amountMinor');
  const allocations = [];
  for (const charge of [...charges].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))) {
    const breakdown = calculateCharge(charge);
    const amount = breakdown.payableMinor < remaining ? breakdown.payableMinor : remaining;
    if (amount > 0n) allocations.push({ chargeId: charge.id, amountMinor: amount });
    remaining -= amount;
    if (remaining === 0n) break;
  }
  return { allocations, unappliedMinor: remaining };
};

export const serializeMoney = (value) => Number(BigInt(value));
