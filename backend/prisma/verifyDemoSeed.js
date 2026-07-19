import 'dotenv/config';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { default: prisma } = await import('../src/config/prisma.client.js');

try {
  const school = await prisma.school.findUnique({
    where: { schoolCode: 'GVS001' },
    select: { id: true, schoolName: true },
  });
  if (!school) throw new Error('Demo school GVS001 was not found.');

  const schoolId = school.id;
  const [
    users,
    teachers,
    students,
    classes,
    sections,
    subjects,
    chapters,
    feeStructures,
    feeAccounts,
    feeCharges,
    feePayments,
    feeReceipts,
    feeScholarships,
    feeReminders,
    chargeStatuses,
  ] = await Promise.all([
    prisma.user.count({ where: { schoolId } }),
    prisma.teacher.count({ where: { schoolId } }),
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.class.count({ where: { schoolId } }),
    prisma.section.count({ where: { schoolId } }),
    prisma.subject.count({ where: { schoolId } }),
    prisma.chapter.count({ where: { schoolId } }),
    prisma.feeStructure.count({ where: { schoolId } }),
    prisma.studentFeeAccount.count({ where: { schoolId } }),
    prisma.studentFeeCharge.count({ where: { schoolId } }),
    prisma.feePayment.count({ where: { schoolId } }),
    prisma.feeReceipt.count({ where: { schoolId } }),
    prisma.feeScholarship.count({ where: { schoolId } }),
    prisma.feeReminder.count({ where: { schoolId } }),
    prisma.studentFeeCharge.groupBy({ by: ['status'], where: { schoolId }, _count: { _all: true } }),
  ]);

  console.log(JSON.stringify({
    school: school.schoolName,
    users,
    teachers,
    students,
    classes,
    sections,
    subjects,
    chapters,
    fees: {
      structures: feeStructures,
      accounts: feeAccounts,
      charges: feeCharges,
      payments: feePayments,
      receipts: feeReceipts,
      scholarships: feeScholarships,
      reminders: feeReminders,
      statuses: Object.fromEntries(chargeStatuses.map((row) => [row.status, row._count._all])),
    },
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
