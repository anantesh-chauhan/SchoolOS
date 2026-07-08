import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import {
  CBSE_CLASS_CATALOG,
  DEFAULT_SECTION_NAMES,
  SENIOR_CLASS_CATALOG,
  SENIOR_STREAMS,
  SUBJECT_CODE_BY_NAME,
  getChapterNames,
} from '../src/constants/cbseAcademicSeed.js';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'admin123';
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

const normalizeCode = (name) => (
  SUBJECT_CODE_BY_NAME[name] || String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
);

const getAvailableClassOrder = async (tx, schoolId, preferredOrder) => {
  const existing = await tx.class.findFirst({ where: { schoolId, classOrder: preferredOrder } });
  if (!existing) return preferredOrder;

  const maxRow = await tx.class.findFirst({
    where: { schoolId },
    orderBy: { classOrder: 'desc' },
    select: { classOrder: true },
  });
  return (maxRow?.classOrder || preferredOrder) + 1;
};

const ensureClass = async (tx, schoolId, { className, classOrder }, stats) => {
  const existing = await tx.class.findFirst({ where: { schoolId, className } });
  if (existing) {
    stats.existing.classes += 1;
    return existing;
  }

  const resolvedOrder = await getAvailableClassOrder(tx, schoolId, classOrder);
  stats.created.classes += 1;
  return tx.class.create({
    data: {
      schoolId,
      className,
      classOrder: resolvedOrder,
    },
  });
};

const ensureSection = async (tx, schoolId, classId, sectionName, sectionOrder, stats, streamId = null) => {
  const existing = await tx.section.findFirst({ where: { schoolId, classId, sectionName } });
  if (existing) {
    stats.existing.sections += 1;
    if (streamId && existing.streamId !== streamId) {
      return tx.section.update({ where: { id: existing.id }, data: { streamId } });
    }
    return existing;
  }

  const orderConflict = await tx.section.findFirst({ where: { classId, sectionOrder } });
  let resolvedSectionOrder = sectionOrder;
  if (orderConflict) {
    const maxSection = await tx.section.findFirst({
      where: { classId },
      orderBy: { sectionOrder: 'desc' },
      select: { sectionOrder: true },
    });
    resolvedSectionOrder = (maxSection?.sectionOrder || sectionOrder) + 1;
  }

  stats.created.sections += 1;
  return tx.section.create({
    data: {
      schoolId,
      classId,
      sectionName,
      sectionOrder: resolvedSectionOrder,
      streamId,
    },
  });
};

const ensureSubject = async (tx, schoolId, subjectName, displayOrder, stats) => {
  const subjectCode = normalizeCode(subjectName);
  const existing = await tx.subject.findFirst({
    where: {
      schoolId,
      OR: [{ subjectName }, { subjectCode }],
    },
  });

  if (existing) {
    stats.existing.subjects += 1;
    return existing;
  }

  stats.created.subjects += 1;
  return tx.subject.create({
    data: {
      schoolId,
      subjectName,
      subjectCode,
      subjectType: ['Art & Craft', 'General Activities', 'Physical Education'].includes(subjectName) ? 'ACTIVITY' : 'CORE',
      isOptional: false,
      displayOrder,
    },
  });
};

const ensureClassSubject = async (tx, classId, subjectId, stats) => {
  const existing = await tx.classSubject.findFirst({ where: { classId, subjectId } });
  if (existing) {
    stats.existing.assignments += 1;
    return existing;
  }
  stats.created.assignments += 1;
  return tx.classSubject.create({ data: { classId, subjectId } });
};

const ensureSectionSubject = async (tx, sectionId, subjectId, stats) => {
  const existing = await tx.sectionSubject.findFirst({ where: { sectionId, subjectId } });
  if (existing) {
    stats.existing.assignments += 1;
    return existing;
  }
  stats.created.assignments += 1;
  return tx.sectionSubject.create({ data: { sectionId, subjectId } });
};

const ensureChapters = async (tx, schoolId, classRow, subject, stats) => {
  const { id: classId, className } = classRow;
  const chapterNames = getChapterNames({ className, subjectName: subject.subjectName });

  for (let index = 0; index < chapterNames.length; index += 1) {
    const chapterName = chapterNames[index];
    const chapterNumber = index + 1;
    const existing = await tx.chapter.findFirst({
      where: {
        schoolId,
        classId,
        subjectId: subject.id,
        OR: [{ chapterName }, { chapterNumber }],
      },
    });

    if (existing) {
      stats.existing.chapters += 1;
      continue;
    }

    stats.created.chapters += 1;
    await tx.chapter.create({
      data: {
        schoolId,
        classId,
        subjectId: subject.id,
        chapterName,
        chapterNumber,
        status: 'not_started',
        estimatedClasses: Math.min(8, Math.max(3, chapterName.length % 7 + 3)),
      },
    });
  }
};

const ensureStream = async (tx, schoolId, stream, displayOrder, stats) => {
  const existing = await tx.stream.findFirst({ where: { schoolId, code: stream.code } });
  if (existing) {
    stats.existing.streams += 1;
    return tx.stream.update({
      where: { id: existing.id },
      data: { name: stream.name, isActive: true, deletedAt: null, displayOrder },
    });
  }

  stats.created.streams += 1;
  return tx.stream.create({
    data: {
      schoolId,
      code: stream.code,
      name: stream.name,
      classFrom: 11,
      classTo: 12,
      displayOrder,
      isActive: true,
    },
  });
};

const ensureDemoTeacher = async (tx, school, teacherInput, passwordHash) => {
  const user = await tx.user.upsert({
    where: { email: teacherInput.email },
    update: {
      name: teacherInput.teacherName,
      role: 'TEACHER',
      schoolId: school.id,
      employeeId: teacherInput.employeeId,
      isActive: true,
    },
    create: {
      email: teacherInput.email,
      password: passwordHash,
      name: teacherInput.teacherName,
      role: 'TEACHER',
      schoolId: school.id,
      employeeId: teacherInput.employeeId,
      isActive: true,
    },
  });

  const existing = await tx.teacher.findFirst({ where: { schoolId: school.id, email: teacherInput.email } });
  const data = {
    schoolId: school.id,
    teacherName: teacherInput.teacherName,
    email: teacherInput.email,
    phone: teacherInput.phone,
    employeeId: teacherInput.employeeId,
    qualification: teacherInput.qualification,
    specialization: teacherInput.specialization,
    subjectsHandled: teacherInput.subjectsHandled,
    deletedAt: null,
  };

  const teacher = existing
    ? await tx.teacher.update({ where: { id: existing.id }, data })
    : await tx.teacher.create({ data });

  return { user, teacher };
};

const ensureTeacherAssignment = async (tx, schoolId, teacherId, classId, sectionId, subjectId, roleType = 'SUBJECT_TEACHER') => {
  return tx.teacherAssignment.upsert({
    where: {
      schoolId_teacherId_classId_sectionId_subjectId: {
        schoolId,
        teacherId,
        classId,
        sectionId,
        subjectId,
      },
    },
    update: { roleType, isActive: true, effectiveTo: null },
    create: {
      schoolId,
      teacherId,
      classId,
      sectionId,
      subjectId,
      roleType,
      isActive: true,
    },
  });
};

export const seedTeacherDashboardDemoDataForSchool = async (school) => {
  const tx = prisma;
  const passwordHash = await bcryptjs.hash(DEMO_PASSWORD, 10);
  const teacherInputs = [
    {
      teacherName: 'Ananya Sharma',
      email: `ananya.${school.schoolCode.toLowerCase()}@schoolos.com`,
      phone: '9000001001',
      employeeId: `T-${school.schoolCode}-SCI`,
      qualification: 'M.Sc, B.Ed',
      specialization: 'Science',
      subjectsHandled: ['Science'],
    },
    {
      teacherName: 'Rohan Mehta',
      email: `rohan.${school.schoolCode.toLowerCase()}@schoolos.com`,
      phone: '9000001002',
      employeeId: `T-${school.schoolCode}-MAT`,
      qualification: 'M.Sc, B.Ed',
      specialization: 'Mathematics',
      subjectsHandled: ['Mathematics'],
    },
    {
      teacherName: 'Meera Iyer',
      email: `meera.${school.schoolCode.toLowerCase()}@schoolos.com`,
      phone: '9000001003',
      employeeId: `T-${school.schoolCode}-HUM`,
      qualification: 'M.A, B.Ed',
      specialization: 'English and Social Science',
      subjectsHandled: ['English', 'Social Science'],
    },
    {
      teacherName: 'Kabir Khan',
      email: `kabir.${school.schoolCode.toLowerCase()}@schoolos.com`,
      phone: '9000001004',
      employeeId: `T-${school.schoolCode}-CLS`,
      qualification: 'B.Sc, B.Ed',
      specialization: 'Class Teacher',
      subjectsHandled: ['Mathematics', 'Science'],
    },
  ];

  const teachers = [];
  for (const input of teacherInputs) {
    teachers.push(await ensureDemoTeacher(tx, school, input, passwordHash));
  }

  const class10 = await tx.class.findFirst({ where: { schoolId: school.id, className: 'Class 10' } });
  const class9 = await tx.class.findFirst({ where: { schoolId: school.id, className: 'Class 9' } });
  if (!class10 || !class9) return;

  const [section10A, section10B, section9A, section9B] = await Promise.all([
    tx.section.findFirst({ where: { schoolId: school.id, classId: class10.id, sectionName: 'A' } }),
    tx.section.findFirst({ where: { schoolId: school.id, classId: class10.id, sectionName: 'B' } }),
    tx.section.findFirst({ where: { schoolId: school.id, classId: class9.id, sectionName: 'A' } }),
    tx.section.findFirst({ where: { schoolId: school.id, classId: class9.id, sectionName: 'B' } }),
  ]);

  const subjects = await tx.subject.findMany({
    where: {
      schoolId: school.id,
      subjectName: { in: ['Science', 'Mathematics', 'English', 'Social Science'] },
    },
  });
  const subjectByName = new Map(subjects.map((subject) => [subject.subjectName, subject]));
  const science = subjectByName.get('Science');
  const mathematics = subjectByName.get('Mathematics');
  const english = subjectByName.get('English');
  const socialScience = subjectByName.get('Social Science');

  const assignments = [
    { teacher: teachers[0].teacher, classRow: class10, section: section10B, subject: science, roleType: 'SUBJECT_TEACHER' },
    { teacher: teachers[1].teacher, classRow: class10, section: section10A, subject: mathematics, roleType: 'SUBJECT_TEACHER' },
    { teacher: teachers[1].teacher, classRow: class10, section: section10B, subject: mathematics, roleType: 'SUBJECT_TEACHER' },
    { teacher: teachers[2].teacher, classRow: class9, section: section9A, subject: english, roleType: 'SUBJECT_TEACHER' },
    { teacher: teachers[2].teacher, classRow: class9, section: section9A, subject: socialScience, roleType: 'SUBJECT_TEACHER' },
    { teacher: teachers[3].teacher, classRow: class9, section: section9B, subject: mathematics, roleType: 'BOTH' },
    { teacher: teachers[3].teacher, classRow: class9, section: section9B, subject: science, roleType: 'CLASS_TEACHER' },
  ].filter((item) => item.teacher && item.classRow && item.section && item.subject);

  for (const item of assignments) {
    await ensureTeacherAssignment(tx, school.id, item.teacher.id, item.classRow.id, item.section.id, item.subject.id, item.roleType);

    const chapters = await tx.chapter.findMany({
      where: { schoolId: school.id, classId: item.classRow.id, subjectId: item.subject.id, deletedAt: null },
      orderBy: { chapterNumber: 'asc' },
      take: 3,
    });

    for (let index = 0; index < chapters.length; index += 1) {
      const status = index === 0 ? 'COMPLETED' : index === 1 ? 'ONGOING' : 'NOT_STARTED';
      await tx.chapterProgress.upsert({
        where: {
          schoolId_classId_sectionId_subjectId_chapterId: {
            schoolId: school.id,
            classId: item.classRow.id,
            sectionId: item.section.id,
            subjectId: item.subject.id,
            chapterId: chapters[index].id,
          },
        },
        update: {
          teacherId: item.teacher.id,
          status,
          remarks: status === 'COMPLETED' ? 'Completed with class discussion and quick recap.' : status === 'ONGOING' ? 'Currently in progress.' : null,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
        create: {
          schoolId: school.id,
          classId: item.classRow.id,
          sectionId: item.section.id,
          subjectId: item.subject.id,
          chapterId: chapters[index].id,
          teacherId: item.teacher.id,
          status,
          remarks: status === 'COMPLETED' ? 'Completed with class discussion and quick recap.' : status === 'ONGOING' ? 'Currently in progress.' : null,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
      });
    }

    const demoResources = [
      {
        schoolId: school.id,
        classId: item.classRow.id,
        sectionId: item.section.id,
        subjectId: item.subject.id,
        chapterId: chapters[0]?.id || null,
        teacherId: item.teacher.id,
        title: `${item.subject.subjectName} starter notes`,
        description: `Teacher curated notes for ${item.classRow.className}-${item.section.sectionName}.`,
        resourceType: 'NOTE',
        isVisibleToStudents: true,
      },
      {
        schoolId: school.id,
        classId: item.classRow.id,
        sectionId: item.section.id,
        subjectId: item.subject.id,
        chapterId: chapters[1]?.id || null,
        teacherId: item.teacher.id,
        title: `${item.subject.subjectName} reference link`,
        description: 'External reference for revision.',
        resourceType: 'LINK',
        externalUrl: 'https://ncert.nic.in/textbook.php',
        isVisibleToStudents: true,
      },
    ];

    for (const resource of demoResources) {
      const existingResource = await tx.sectionResource.findFirst({
        where: {
          schoolId: resource.schoolId,
          classId: resource.classId,
          sectionId: resource.sectionId,
          subjectId: resource.subjectId,
          teacherId: resource.teacherId,
          title: resource.title,
        },
      });
      if (!existingResource) {
        await tx.sectionResource.create({ data: resource });
      }
    }
  }
};

export const seedAcademicDataForSchool = async (schoolId) => {
  const stats = {
    schoolId,
    created: { classes: 0, sections: 0, subjects: 0, streams: 0, assignments: 0, chapters: 0, students: 0, studentUsers: 0 },
    existing: { classes: 0, sections: 0, subjects: 0, streams: 0, assignments: 0, chapters: 0, students: 0, studentUsers: 0 },
  };

  const tx = prisma;

  for (const classTemplate of CBSE_CLASS_CATALOG) {
    const classRow = await ensureClass(tx, schoolId, classTemplate, stats);
    const sections = [];
    for (let index = 0; index < DEFAULT_SECTION_NAMES.length; index += 1) {
      sections.push(await ensureSection(tx, schoolId, classRow.id, DEFAULT_SECTION_NAMES[index], index + 1, stats));
    }

    for (let index = 0; index < classTemplate.subjects.length; index += 1) {
      const subject = await ensureSubject(tx, schoolId, classTemplate.subjects[index], index + 1, stats);
      await ensureClassSubject(tx, classRow.id, subject.id, stats);
      for (const section of sections) {
        await ensureSectionSubject(tx, section.id, subject.id, stats);
      }
      await ensureChapters(tx, schoolId, classRow, subject, stats);
    }
  }

  for (const seniorClass of SENIOR_CLASS_CATALOG) {
    const classRow = await ensureClass(tx, schoolId, seniorClass, stats);

    for (let streamIndex = 0; streamIndex < SENIOR_STREAMS.length; streamIndex += 1) {
      const stream = await ensureStream(tx, schoolId, SENIOR_STREAMS[streamIndex], streamIndex + 1, stats);
      const section = await ensureSection(
        tx,
        schoolId,
        classRow.id,
        `${SENIOR_STREAMS[streamIndex].sectionPrefix}-A`,
        streamIndex + 1,
        stats,
        stream.id
      );

      for (let subjectIndex = 0; subjectIndex < SENIOR_STREAMS[streamIndex].subjects.length; subjectIndex += 1) {
        const subject = await ensureSubject(tx, schoolId, SENIOR_STREAMS[streamIndex].subjects[subjectIndex], subjectIndex + 1, stats);
        await ensureClassSubject(tx, classRow.id, subject.id, stats);
        await ensureSectionSubject(tx, section.id, subject.id, stats);
        await ensureChapters(tx, schoolId, classRow, subject, stats);
      }
    }
  }

  await seedDemoStudentsForSchool(tx, schoolId, stats);

  return stats;
};

const cleanCode = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 18);

const seedDemoStudentsForSchool = async (tx, schoolId, stats) => {
  const school = await tx.school.findUnique({ where: { id: schoolId }, select: { schoolCode: true } });
  if (!school) return;
  const passwordHash = await bcryptjs.hash(DEMO_PASSWORD, 10);
  const sections = await tx.section.findMany({
    where: { schoolId, deletedAt: null },
    include: { class: { select: { id: true, className: true, classOrder: true } } },
    orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }],
  });

  for (const section of sections) {
    for (let index = 0; index < DEMO_STUDENT_NAMES.length; index += 1) {
      const [firstName, lastName] = DEMO_STUDENT_NAMES[index];
      const rollNumber = String(index + 1).padStart(2, '0');
      const classCode = cleanCode(section.class.className).toUpperCase();
      const sectionCode = cleanCode(section.sectionName).toUpperCase();
      const admissionNo = `${school.schoolCode}-${classCode}-${sectionCode}-${rollNumber}`;
      const studentUserId = `${cleanCode(firstName)}.${cleanCode(section.class.className)}${cleanCode(section.sectionName)}.${rollNumber}@${cleanCode(school.schoolCode)}.schoolos`;
      const parentUserId = `parent.${cleanCode(firstName)}.${cleanCode(section.class.className)}${cleanCode(section.sectionName)}.${rollNumber}@${cleanCode(school.schoolCode)}.schoolos`;
      const dob = new Date(Date.UTC(2010 + (index % 5), index % 12, 5 + index));

      const existingStudent = await tx.student.findUnique({ where: { admissionNo } });
      const studentData = {
        schoolId,
        admissionNo,
        studentFirstName: firstName,
        studentLastName: lastName,
        dob,
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

      const student = existingStudent
        ? await tx.student.update({ where: { id: existingStudent.id }, data: studentData })
        : await tx.student.create({ data: studentData });
      if (existingStudent) stats.existing.students += 1;
      else stats.created.students += 1;

      const existingUser = await tx.user.findUnique({ where: { email: studentUserId } });
      await tx.user.upsert({
        where: { email: studentUserId },
        update: {
          password: passwordHash,
          name: `${firstName} ${lastName}`,
          role: 'STUDENT',
          schoolId,
          classId: section.classId,
          sectionId: section.id,
          isActive: true,
        },
        create: {
          email: studentUserId,
          password: passwordHash,
          name: `${firstName} ${lastName}`,
          role: 'STUDENT',
          schoolId,
          classId: section.classId,
          sectionId: section.id,
          isActive: true,
        },
      });
      if (existingUser) stats.existing.studentUsers += 1;
      else stats.created.studentUsers += 1;

      const history = await tx.studentAcademicHistory.findFirst({ where: { studentId: student.id, session: '2026-27' } });
      if (!history) {
        await tx.studentAcademicHistory.create({
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
  }
};

export const seedAcademicData = async () => {
  const schools = await prisma.school.findMany({ select: { id: true, schoolName: true, schoolCode: true } });
  const results = [];

  for (const school of schools) {
    const result = await seedAcademicDataForSchool(school.id);
    await seedTeacherDashboardDemoDataForSchool(school);
    results.push({ schoolName: school.schoolName, ...result });
    console.log(`[academic-seed] ${school.schoolName}:`, JSON.stringify(result));
  }

  return results;
};

export const disconnectAcademicSeed = async () => {
  console.log("Academic Data Seeded Succesfully");
  await prisma.$disconnect();
};

if (import.meta.url === `file://${process.argv[1]}`) {
  seedAcademicData()
    .catch((error) => {
      console.error('[academic-seed] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
