const FREQUENCY_COUNT = Object.freeze({
  ONE_TIME: 1,
  MONTHLY: 12,
  BI_MONTHLY: 6,
  QUARTERLY: 4,
  FOUR_MONTHLY: 3,
  HALF_YEARLY: 2,
  ANNUAL: 1,
  PER_TERM: 3,
  PER_SEMESTER: 2,
});

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const validMonth = (value) => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 12;

export const academicYearMonths = (startMonth = 4) =>
  Array.from({ length: 12 }, (_, index) => ((startMonth - 1 + index) % 12) + 1);

export const selectedMonthsForComponent = (component, startMonth = 4) => {
  const configured = component?.applicability?.months;
  if (Array.isArray(configured) && configured.length) {
    const wanted = new Set(configured.filter(validMonth).map(Number));
    return academicYearMonths(startMonth).filter((month) => wanted.has(month));
  }
  const count = FREQUENCY_COUNT[component?.frequency] || 1;
  const interval = Math.max(1, Math.floor(12 / count));
  return Array.from({ length: count }, (_, index) => academicYearMonths(startMonth)[index * interval]);
};

const yearForMonth = (academicSession, month, startMonth) => {
  const firstYear = Number(String(academicSession || "").slice(0, 4));
  if (!Number.isInteger(firstYear)) throw new Error("academicSession must begin with a four-digit year");
  return month >= startMonth ? firstYear : firstYear + 1;
};

export const buildComponentInstallments = (component, options = {}) => {
  const startMonth = Number(options.startMonth || 4);
  const months = selectedMonthsForComponent(component, startMonth);
  const amountByMonth = component?.applicability?.monthAmountsMinor || {};
  const dueDay = Math.min(28, Math.max(1, Number(component.dueDay || options.defaultDueDay || 1)));
  return months.map((month, index) => {
    const dueDate = new Date(Date.UTC(yearForMonth(options.academicSession, month, startMonth), month - 1, dueDay));
    const configuredAmount = Number(amountByMonth[String(month)] ?? amountByMonth[month]);
    const amountMinor = Number.isSafeInteger(configuredAmount) && configuredAmount >= 0
      ? BigInt(configuredAmount)
      : BigInt(component.amountMinor);
    return {
      month,
      dueDate,
      amountMinor,
      installmentName: months.length === 1
        ? component.name
        : `${component.name} - ${MONTH_NAMES[month - 1]}`,
      sequence: index + 1,
    };
  });
};

export const annualComponentTotal = (component, options = {}) =>
  buildComponentInstallments(component, options).reduce((total, row) => total + row.amountMinor, 0n);

