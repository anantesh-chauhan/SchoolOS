import prisma from '../src/config/prisma.client.js';

try {
  const admins = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SCHOOL_OWNER'] }, isActive: true },
    select: {
      email: true,
      role: true,
      schoolId: true,
      school: { select: { schoolName: true } },
    },
    orderBy: [{ role: 'asc' }, { email: 'asc' }],
  });

  const rows = [];
  for (const admin of admins) {
    rows.push({
      email: admin.email,
      role: admin.role,
      school: admin.school?.schoolName || null,
      classes: await prisma.class.count({ where: { schoolId: admin.schoolId } }),
      sections: await prisma.section.count({ where: { schoolId: admin.schoolId } }),
    });
  }

  console.log(JSON.stringify(rows, null, 2));
} finally {
  await prisma.$disconnect();
}
