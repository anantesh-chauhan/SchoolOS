import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'admin123';
const STUDENTS_PER_SECTION = 8;
const DEMO_STUDENT_NAMES = [
  ['Aarav', 'Mehta'],
  ['Anika', 'Sharma'],
  ['Kabir', 'Rao'],
  ['Ishita', 'Nair'],
  ['Vivaan', 'Kapoor'],
  ['Diya', 'Iyer'],
  ['Reyansh', 'Gupta'],
  ['Sara', 'Khan'],
];

const cleanCode = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);

const ensureSectionStudents = async (school, section, passwordHash) => {
  const stats = { studentsCreated: 0, studentsUpdated: 0, studentUsersCreated: 0, studentUsersUpdated: 0, parentUsersCreated: 0, parentUsersUpdated: 0 };
  const classCode = cleanCode(section.class.className).toUpperCase();
  const sectionCode = cleanCode(section.sectionName).toUpperCase();

  for (let index = 0; index < STUDENTS_PER_SECTION; index += 1) {
    const [firstName, lastName] = DEMO_STUDENT_NAMES[index];
    const rollNumber = String(index + 1).padStart(2, '0');
    const admissionNo = `${school.schoolCode}-${classCode}-${sectionCode}-${rollNumber}`;
    const studentUserId = `${cleanCode(firstName)}.${cleanCode(section.class.className)}${cleanCode(section.sectionName)}.${rollNumber}@${cleanCode(school.schoolCode)}.schoolos`;
    const parentUserId = `parent.${cleanCode(firstName)}.${cleanCode(section.class.className)}${cleanCode(section.sectionName)}.${rollNumber}@${cleanCode(school.schoolCode)}.schoolos`;

    const studentData = {
      schoolId: school.id,
      admissionNo,
      studentFirstName: firstName,
      studentLastName: lastName,
      dob: new Date(Date.UTC(2010 + (index % 5), index % 12, 5 + index)),
      gender: index % 2 === 0 ? 'Male' : 'Female',
      bloodGroup: ['O+', 'A+', 'B+', 'AB+'][index % 4],
      mobile: `98${String(70000000 + index).slice(0, 8)}`,
      email: studentUserId,
      address: 'Demo residential address',
      city: 'Demo City',
      state: 'Demo State',
      pincode: '110001',
      className: section.class.className,
      section: section.sectionName,
      rollNumber,
      admissionDate: new Date(Date.UTC(2026, 3, 1)),
      fatherName: ['Rajesh', 'Sanjay', 'Amit', 'Vikram'][index % 4],
      motherName: ['Priya', 'Neha', 'Kavita', 'Sunita'][index % 4],
      parentMobile: `99${String(60000000 + index).slice(0, 8)}`,
      parentEmail: parentUserId,
      occupation: 'Service',
      session: '2026-27',
      serialNo: index + 1,
      studentUserId,
      parentUserId,
      studentPasswordHash: passwordHash,
      parentPasswordHash: passwordHash,
      passwordGenerated: true,
      lastPasswordGeneratedAt: new Date(),
      isActive: true,
    };

    const existingStudent = await prisma.student.findUnique({ where: { admissionNo } });
    const student = existingStudent
      ? await prisma.student.update({ where: { id: existingStudent.id }, data: studentData })
      : await prisma.student.create({ data: studentData });
    if (existingStudent) stats.studentsUpdated += 1;
    else stats.studentsCreated += 1;

    const studentName = `${firstName} ${lastName}`;
    const existingStudentUser = await prisma.user.findUnique({ where: { email: studentUserId } });
    await prisma.user.upsert({
      where: { email: studentUserId },
      update: {
        password: passwordHash,
        name: studentName,
        role: 'STUDENT',
        schoolId: school.id,
        classId: section.classId,
        sectionId: section.id,
        isActive: true,
      },
      create: {
        email: studentUserId,
        password: passwordHash,
        name: studentName,
        role: 'STUDENT',
        schoolId: school.id,
        classId: section.classId,
        sectionId: section.id,
        isActive: true,
      },
    });
    if (existingStudentUser) stats.studentUsersUpdated += 1;
    else stats.studentUsersCreated += 1;

    const parentName = `${studentData.fatherName} (${studentName})`;
    const existingParentUser = await prisma.user.findUnique({ where: { email: parentUserId } });
    await prisma.user.upsert({
      where: { email: parentUserId },
      update: {
        password: passwordHash,
        name: parentName,
        role: 'PARENT',
        schoolId: school.id,
        classId: section.classId,
        sectionId: section.id,
        isActive: true,
      },
      create: {
        email: parentUserId,
        password: passwordHash,
        name: parentName,
        role: 'PARENT',
        schoolId: school.id,
        classId: section.classId,
        sectionId: section.id,
        isActive: true,
      },
    });
    if (existingParentUser) stats.parentUsersUpdated += 1;
    else stats.parentUsersCreated += 1;

    const existingHistory = await prisma.studentAcademicHistory.findFirst({
      where: { studentId: student.id, session: '2026-27' },
      select: { id: true },
    });
    if (!existingHistory) {
      await prisma.studentAcademicHistory.create({
        data: {
          studentId: student.id,
          className: section.class.className,
          section: section.sectionName,
          session: '2026-27',
          rollNumber,
        },
      });
    }
  }

  return stats;
};

try {
  const passwordHash = await bcryptjs.hash(DEMO_PASSWORD, 10);
  const schools = await prisma.school.findMany({ select: { id: true, schoolCode: true, schoolName: true } });
  const totals = [];

  for (const school of schools) {
    const sections = await prisma.section.findMany({
      where: { schoolId: school.id, deletedAt: null },
      include: { class: { select: { id: true, className: true, classOrder: true } } },
      orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }],
    });

    const schoolStats = {
      schoolName: school.schoolName,
      schoolCode: school.schoolCode,
      sections: sections.length,
      studentsCreated: 0,
      studentsUpdated: 0,
      studentUsersCreated: 0,
      studentUsersUpdated: 0,
      parentUsersCreated: 0,
      parentUsersUpdated: 0,
    };

    for (const section of sections) {
      const stats = await ensureSectionStudents(school, section, passwordHash);
      Object.keys(stats).forEach((key) => {
        schoolStats[key] += stats[key];
      });
    }

    totals.push(schoolStats);
    console.log(`[section-students] ${school.schoolName}: ${JSON.stringify(schoolStats)}`);
  }

  console.log(JSON.stringify(totals, null, 2));
} catch (error) {
  console.error('[section-students] failed', error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
