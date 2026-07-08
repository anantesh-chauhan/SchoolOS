import bcryptjs from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const instantPassword = 'admin123';

try {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      role: { in: ['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT'] },
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      password: true,
      school: { select: { schoolName: true } },
    },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });

  const invalidPasswordUsers = [];
  for (const user of users) {
    const matches = await bcryptjs.compare(instantPassword, user.password);
    if (!matches) {
      invalidPasswordUsers.push({ email: user.email, role: user.role, name: user.name });
    }
  }

  const grouped = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {});

  const teacherEmails = users.filter((user) => user.role === 'TEACHER').map((user) => user.email);
  const teachersWithAssignments = await prisma.teacher.count({
    where: {
      email: { in: teacherEmails },
      deletedAt: null,
      teacherAssignments: { some: { isActive: true } },
    },
  });

  const [studentsWithAdmissionLogin, parentsWithAdmissionLogin] = await Promise.all([
    prisma.student.count({
      where: { isActive: true, studentUserId: { not: null }, studentPasswordHash: { not: null } },
    }),
    prisma.student.count({
      where: { isActive: true, parentUserId: { not: null }, parentPasswordHash: { not: null } },
    }),
  ]);

  console.log(JSON.stringify({
    totalInstantLoginUsers: users.length,
    grouped,
    teachersListed: teacherEmails.length,
    teachersWithAssignments,
    studentsWithAdmissionLogin,
    parentsWithAdmissionLogin,
    invalidPasswordUsers,
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
