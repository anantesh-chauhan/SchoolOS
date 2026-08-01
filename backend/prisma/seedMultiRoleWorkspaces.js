import bcryptjs from 'bcryptjs';
import prisma from '../src/config/prisma.client.js';

const DEMO_PASSWORD = 'SchoolOS@123';
const accounts = [
  { name: 'Ravi Sharma', email: 'ravi.multirole@schoolos.demo', employeeId: 'MULTI-001', roles: ['TEACHER', 'CLASS_TEACHER', 'EXAM_CONTROLLER'] },
  { name: 'Meera Singh', email: 'meera.multirole@schoolos.demo', employeeId: 'MULTI-002', roles: ['TEACHER', 'CURRICULUM_MANAGER'] },
  { name: 'Amit Verma', email: 'amit.multirole@schoolos.demo', employeeId: 'MULTI-003', roles: ['ADMIN', 'FEE_MANAGER', 'HR_MANAGER'] },
  { name: 'Demo Principal', email: 'principal.multirole@schoolos.demo', employeeId: 'MULTI-004', roles: ['PRINCIPAL', 'EXAM_CONTROLLER'] },
];

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo workspace seed is development-only');
  const school = await prisma.school.findFirst({ where: { status: 'ACTIVE' }, include: { classes: { include: { sections: true }, take: 1 } } });
  if (!school) throw new Error('Seed a school before multi-role demo accounts');
  const password = await bcryptjs.hash(DEMO_PASSWORD, 12);
  const section = school.classes[0]?.sections[0];

  for (const account of accounts) {
    const user = await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, isActive: true },
      create: { name: account.name, email: account.email, employeeId: account.employeeId, password, role: account.roles[0], schoolId: school.id, isActive: true },
    });
    const saved = [];
    for (const [index, role] of account.roles.entries()) {
      const assignment = await prisma.userSchoolRole.upsert({
        where: { userId_schoolId_role: { userId: user.id, schoolId: school.id, role } },
        update: { isActive: true, isDefault: index === 0 },
        create: { userId: user.id, schoolId: school.id, role, isActive: true, isDefault: index === 0, assignedById: user.id },
      });
      if (role === 'CLASS_TEACHER' && section) {
        await prisma.roleScope.upsert({
          where: { id: `demo_scope_${assignment.id}` },
          update: { classId: section.classId, sectionId: section.id },
          create: { id: `demo_scope_${assignment.id}`, roleAssignmentId: assignment.id, scopeType: 'SECTION', classId: section.classId, sectionId: section.id },
        });
      }
      saved.push(assignment);
    }
    await prisma.user.update({ where: { id: user.id }, data: { lastActiveRoleId: saved[0].id } });
    await prisma.workspaceAuditLog.create({ data: { userId: user.id, schoolId: school.id, activeRole: saved[0].role, roleAssignmentId: saved[0].id, action: 'DEMO_WORKSPACES_SEEDED', entityType: 'User', entityId: user.id } });
  }
  console.log(`Multi-role demo accounts seeded. Password: ${DEMO_PASSWORD}`);
}

main().finally(() => prisma.$disconnect());
