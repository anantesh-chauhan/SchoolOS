import 'dotenv/config';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { default: prisma } = await import('../src/config/prisma.client.js');

try {
  const schoolCode = process.env.FEE_SEED_SCHOOL_CODE || 'GVS001';
  const school = await prisma.school.findUnique({ where: { schoolCode }, select: { id: true, schoolName: true } });
  if (!school) throw new Error(`School ${schoolCode} was not found`);
  const [structures, activeStudents, assignments, accounts, charges, receipts, transportAssignments, statusRows] = await Promise.all([
    prisma.feeStructure.findMany({ where: { schoolId: school.id }, select: { name: true, code: true, status: true, _count: { select: { assignments: true, charges: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.student.count({ where: { schoolId: school.id, isActive: true } }),
    prisma.feeAssignment.count({ where: { schoolId: school.id, active: true } }),
    prisma.studentFeeAccount.count({ where: { schoolId: school.id } }),
    prisma.studentFeeCharge.count({ where: { schoolId: school.id } }),
    prisma.feeReceipt.count({ where: { schoolId: school.id, status: 'VALID' } }),
    prisma.transportFeeAssignment.count({ where: { schoolId: school.id, status: 'ACTIVE' } }),
    prisma.studentFeeCharge.groupBy({ by: ['status'], where: { schoolId: school.id }, _count: { _all: true } }),
  ]);
  console.log(JSON.stringify({ school: school.schoolName, activeStudents, structures, assignments, accounts, charges, receipts, transportAssignments, statuses: Object.fromEntries(statusRows.map((row) => [row.status, row._count._all])) }, null, 2));
} finally {
  await prisma.$disconnect();
}
