import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();
const SEED_LOCK_ID = 9234501;

const classCatalog = ['Kindergarten', ...Array.from({ length: 12 }, (_, index) => `Class ${index + 1}`)];

const sectionCatalog = ['A', 'B'];

const subjectCatalog = [
  { name: 'English', code: 'ENG' },
  { name: 'Hindi', code: 'HIN' },
  { name: 'Sanskrit', code: 'SKT' },
  { name: 'Mathematics', code: 'MATH' },
  { name: 'Science', code: 'SCI' },
  { name: 'Environmental Studies', code: 'EVS' },
  { name: 'Social Science', code: 'SST' },
  { name: 'Physics', code: 'PHY' },
  { name: 'Chemistry', code: 'CHEM' },
  { name: 'Biology', code: 'BIO' },
  { name: 'Accountancy', code: 'ACCT' },
  { name: 'Economics', code: 'ECO' },
  { name: 'Business Studies', code: 'BST' },
  { name: 'History', code: 'HIS' },
  { name: 'Political Science', code: 'POL' },
  { name: 'Geography', code: 'GEO' },
  { name: 'Informatics Practices', code: 'IP' },
  { name: 'Artificial Intelligence', code: 'AI' },
  { name: 'Painting', code: 'PNT' },
  { name: 'Computer Science', code: 'CS' },
  { name: 'Lab Practical', code: 'LAB' },
  { name: 'Physical Education', code: 'PE' },
];

const schoolsToSeed = [
  {
    schoolName: 'Green Valley School',
    schoolCode: 'GVS001',
    address: 'Plot 18, Sector 62',
    city: 'Noida',
    state: 'Uttar Pradesh',
    phone: '+91-120-4011001',
    email: 'contact@greenvalley.edu.in',
    admin: {
      email: 'admin@greenvalley.edu.in',
      name: 'Green Valley Admin',
    },
    owner: {
      email: 'owner@greenvalley.edu.in',
      name: 'Green Valley Owner',
    },
    teacherCount: 18,
  },
  {
    schoolName: 'Delhi Public School',
    schoolCode: 'DPS002',
    address: 'Mathura Road',
    city: 'New Delhi',
    state: 'Delhi',
    phone: '+91-11-2711002',
    email: 'admin@dps.edu.in',
    admin: {
      email: 'admin.dps@schoolos.com',
      name: 'DPS Admin',
    },
    owner: {
      email: 'owner@dps.edu.in',
      name: 'DPS Owner',
    },
    teacherCount: 17,
  },
];

const teacherTemplates = [
  { teacherName: 'Rahul Sharma', specialization: 'Mathematics', qualification: 'M.Sc Mathematics, B.Ed', subjectsHandled: ['Mathematics'] },
  { teacherName: 'Neha Singh', specialization: 'Science', qualification: 'M.Sc Science, B.Ed', subjectsHandled: ['Science', 'Environmental Studies'] },
  { teacherName: 'Ankit Verma', specialization: 'English', qualification: 'M.A English, B.Ed', subjectsHandled: ['English'] },
  { teacherName: 'Priya Gupta', specialization: 'Hindi', qualification: 'M.A Hindi, B.Ed', subjectsHandled: ['Hindi', 'Sanskrit'] },
  { teacherName: 'Amit Tiwari', specialization: 'Social Science', qualification: 'M.A Social Science, B.Ed', subjectsHandled: ['Social Science', 'History', 'Geography'] },
  { teacherName: 'Kavita Mishra', specialization: 'Biology', qualification: 'M.Sc Biology, B.Ed', subjectsHandled: ['Biology', 'Science'] },
  { teacherName: 'Rohit Saxena', specialization: 'Physics', qualification: 'M.Sc Physics, B.Ed', subjectsHandled: ['Physics', 'Lab Practical'] },
  { teacherName: 'Pooja Agarwal', specialization: 'Chemistry', qualification: 'M.Sc Chemistry, B.Ed', subjectsHandled: ['Chemistry', 'Lab Practical'] },
  { teacherName: 'Sanjay Kumar', specialization: 'Computer Science', qualification: 'M.Tech CSE, B.Ed', subjectsHandled: ['Computer Science', 'Informatics Practices', 'Artificial Intelligence'] },
  { teacherName: 'Meena Yadav', specialization: 'Physical Education', qualification: 'M.P.Ed', subjectsHandled: ['Physical Education'] },
  { teacherName: 'Vikram Joshi', specialization: 'Accountancy', qualification: 'M.Com, B.Ed', subjectsHandled: ['Accountancy', 'Business Studies'] },
  { teacherName: 'Shreya Malhotra', specialization: 'Economics', qualification: 'M.A Economics, B.Ed', subjectsHandled: ['Economics', 'Business Studies'] },
  { teacherName: 'Nidhi Chauhan', specialization: 'Political Science', qualification: 'M.A Political Science, B.Ed', subjectsHandled: ['Political Science', 'History'] },
  { teacherName: 'Arjun Mehta', specialization: 'Geography', qualification: 'M.A Geography, B.Ed', subjectsHandled: ['Geography', 'Social Science'] },
  { teacherName: 'Deepa Nair', specialization: 'Art & Painting', qualification: 'MFA, B.Ed', subjectsHandled: ['Painting'] },
  { teacherName: 'Sushil Pandey', specialization: 'Sanskrit', qualification: 'M.A Sanskrit, B.Ed', subjectsHandled: ['Sanskrit', 'Hindi'] },
  { teacherName: 'Ritika Bansal', specialization: 'Lab Practical', qualification: 'M.Sc, Lab Certification', subjectsHandled: ['Lab Practical', 'Physics', 'Chemistry'] },
  { teacherName: 'Tarun Gupta', specialization: 'EVS', qualification: 'M.Sc Environmental Science, B.Ed', subjectsHandled: ['Environmental Studies', 'Science'] },
  { teacherName: 'Komal Arora', specialization: 'Business Studies', qualification: 'MBA, B.Ed', subjectsHandled: ['Business Studies', 'Economics'] },
  { teacherName: 'Harshad Kulkarni', specialization: 'Mathematics', qualification: 'M.Sc Mathematics, B.Ed', subjectsHandled: ['Mathematics', 'Informatics Practices'] },
  { teacherName: 'Reena Dutta', specialization: 'English', qualification: 'M.A English, B.Ed', subjectsHandled: ['English', 'Political Science'] },
  { teacherName: 'Yogesh Patil', specialization: 'Physics', qualification: 'M.Sc Physics, B.Ed', subjectsHandled: ['Physics', 'Science'] },
  { teacherName: 'Bhavna Sethi', specialization: 'Chemistry', qualification: 'M.Sc Chemistry, B.Ed', subjectsHandled: ['Chemistry', 'Science'] },
  { teacherName: 'Mohit Chawla', specialization: 'Computer Science', qualification: 'MCA, B.Ed', subjectsHandled: ['Computer Science', 'Artificial Intelligence'] },
  { teacherName: 'Anjana Reddy', specialization: 'Biology', qualification: 'M.Sc Biology, B.Ed', subjectsHandled: ['Biology', 'Environmental Studies'] },
];

const getSectionNamesForClass = (className) => {
  if (className === 'Class 11' || className === 'Class 12') {
    return ['SCI-A', 'COM-A', 'ART-A'];
  }

  return sectionCatalog;
};

const createSchoolClassesAndSections = async (schoolId) => {
  const createdClasses = [];

  for (let index = 0; index < classCatalog.length; index += 1) {
    const classSections = getSectionNamesForClass(classCatalog[index]).map((sectionName, sectionIndex) => ({
      sectionName,
      sectionOrder: sectionIndex + 1,
      schoolId,
    }));

    const classRow = await prisma.class.create({
      data: {
        className: classCatalog[index],
        classOrder: index + 1,
        schoolId,
        sections: {
          create: classSections,
        },
      },
    });

    createdClasses.push(classRow);
  }

  return createdClasses;
};

const acquireSeedLock = async () => {
  const rows = await prisma.$queryRaw`SELECT pg_try_advisory_lock(${SEED_LOCK_ID}) AS locked`;
  if (!Array.isArray(rows) || rows.length === 0) {
    return false;
  }

  const raw = rows[0]?.locked ?? rows[0]?.pg_try_advisory_lock;
  if (raw === true || raw === 't' || raw === 'true' || raw === 1 || raw === 1n) {
    return true;
  }

  return false;
};

const releaseSeedLock = async () => {
  await prisma.$queryRaw`SELECT pg_advisory_unlock(${SEED_LOCK_ID})`;
};

const createSubjectsForSchool = async (schoolId) => {
  const subjects = [];

  for (const item of subjectCatalog) {
    const subjectRow = await prisma.subject.create({
      data: {
        schoolId,
        subjectName: item.name,
        subjectCode: item.code,
      },
    });
    subjects.push(subjectRow);
  }

  return subjects;
};

const getSubjectId = (subjectMap, name) => {
  const subjectId = subjectMap.get(name);
  if (!subjectId) {
    throw new Error(`Missing subject ${name} in seed catalog`);
  }
  return subjectId;
};

const assignSubjects = async (classes, subjects) => {
  const subjectMap = new Map(subjects.map((subject) => [subject.subjectName, subject.id]));

  const lowerPrimary = ['English', 'Hindi', 'Mathematics', 'Environmental Studies', 'Physical Education'];
  const middleAndSecondary = [
    'English',
    'Hindi',
    'Mathematics',
    'Science',
    'Social Science',
    'Computer Science',
    'Physical Education',
    'Sanskrit',
  ];
  const higherSecondaryCommon = ['English', 'Physical Education'];

  const streamSubjects = {
    SCI: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Computer Science', 'Lab Practical'],
    COM: ['Accountancy', 'Economics', 'Business Studies', 'Mathematics', 'Informatics Practices'],
    ART: ['History', 'Political Science', 'Geography', 'Economics', 'Painting', 'Artificial Intelligence'],
  };

  for (const classRow of classes) {
    let classSubjectNames = [];

    if (classRow.className === 'Kindergarten' || ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5'].includes(classRow.className)) {
      classSubjectNames = lowerPrimary;
    } else if (['Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10'].includes(classRow.className)) {
      classSubjectNames = middleAndSecondary;
    } else {
      classSubjectNames = higherSecondaryCommon;
    }

    for (const subjectName of classSubjectNames) {
      await prisma.classSubject.create({
        data: {
          classId: classRow.id,
          subjectId: getSubjectId(subjectMap, subjectName),
        },
      });
    }

    const classSections = await prisma.section.findMany({
      where: { classId: classRow.id },
      orderBy: { sectionOrder: 'asc' },
    });

    for (const sectionRow of classSections) {
      let sectionSubjectNames = [...classSubjectNames];

      if (classRow.className === 'Class 11' || classRow.className === 'Class 12') {
        if (sectionRow.sectionName.startsWith('SCI')) {
          sectionSubjectNames = [...higherSecondaryCommon, ...streamSubjects.SCI];
        } else if (sectionRow.sectionName.startsWith('COM')) {
          sectionSubjectNames = [...higherSecondaryCommon, ...streamSubjects.COM];
        } else {
          sectionSubjectNames = [...higherSecondaryCommon, ...streamSubjects.ART];
        }
      }

      for (const subjectName of sectionSubjectNames) {
        await prisma.sectionSubject.create({
          data: {
            sectionId: sectionRow.id,
            subjectId: getSubjectId(subjectMap, subjectName),
          },
        });
      }
    }
  }
};

const createTeachers = async (schoolId, schoolCode, teacherCount, hashedPassword) => {
  const teacherUsers = [];
  const teacherProfiles = [];

  for (let index = 0; index < teacherCount; index += 1) {
    const template = teacherTemplates[index % teacherTemplates.length];
    const sequence = index + 1;
    const email = `teacher${sequence}.${schoolCode.toLowerCase()}@schoolos.com`;
    const employeeId = `${schoolCode}-T${String(sequence).padStart(3, '0')}`;
    const teacherName = `${template.teacherName} ${sequence}`;

    teacherUsers.push({
      email,
      password: hashedPassword,
      name: teacherName,
      role: 'TEACHER',
      schoolId,
    });

    teacherProfiles.push({
      schoolId,
      teacherName,
      email,
      phone: `+91-9${String(100000000 + sequence).padStart(9, '0')}`,
      employeeId,
      qualification: template.qualification,
      specialization: template.specialization,
      subjectsHandled: template.subjectsHandled,
    });
  }

  await prisma.user.createMany({ data: teacherUsers });
  await prisma.teacher.createMany({ data: teacherProfiles });

  return prisma.teacher.findMany({
    where: { schoolId },
    orderBy: { employeeId: 'asc' },
  });
};

const createTeacherAssignments = async (schoolId, teachers, sections) => {
  const subjectBuckets = new Map();
  const bucketIndex = new Map();

  for (const teacher of teachers) {
    for (const subject of teacher.subjectsHandled || []) {
      if (!subjectBuckets.has(subject)) {
        subjectBuckets.set(subject, []);
        bucketIndex.set(subject, 0);
      }
      subjectBuckets.get(subject).push(teacher);
    }
  }

  for (const section of sections) {
    const sectionSubjects = await prisma.sectionSubject.findMany({
      where: { sectionId: section.id },
      include: { subject: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const sectionSubject of sectionSubjects) {
      const preferred = subjectBuckets.get(sectionSubject.subject.subjectName) || [];
      const fallbackPool = teachers;
      const pool = preferred.length > 0 ? preferred : fallbackPool;

      const indexKey = sectionSubject.subject.subjectName;
      const currentIndex = bucketIndex.get(indexKey) || 0;
      const selectedTeacher = pool[currentIndex % pool.length];
      bucketIndex.set(indexKey, currentIndex + 1);

      await prisma.teacherAssignment.create({
        data: {
          schoolId,
          classId: section.classId,
          sectionId: section.id,
          subjectId: sectionSubject.subjectId,
          teacherId: selectedTeacher.id,
        },
      });
    }
  }
};

const createStudentsForSections = async (school, sections, hashedPassword) => {
  const students = [];

  for (const section of sections) {
    for (let i = 1; i <= 2; i += 1) {
      students.push({
        email: `student${i}.${section.class.classOrder}${section.sectionName.replace(/[^A-Za-z0-9]/g, '').toLowerCase()}.${school.schoolCode.toLowerCase()}@schoolos.com`,
        password: hashedPassword,
        name: `${school.schoolCode} ${section.class.className} ${section.sectionName} Student ${i}`,
        role: 'STUDENT',
        schoolId: school.id,
        classId: section.classId,
        sectionId: section.id,
      });
    }
  }

  await prisma.user.createMany({ data: students });
};

async function main() {
  console.log('Seeding SchoolOS database...');

  const hasLock = await acquireSeedLock();
  if (!hasLock) {
    throw new Error('Another seed process is already running. Please wait and retry.');
  }

  await prisma.teacherAssignment.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.sectionSubject.deleteMany();
  await prisma.classSubject.deleteMany();
  await prisma.section.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.class.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  const hashed = await bcryptjs.hash('admin123', 10);

  await prisma.user.create({
    data: {
      email: 'platform@schoolos.com',
      password: hashed,
      name: 'Platform Owner',
      role: 'PLATFORM_OWNER',
    },
  });

  for (const schoolInput of schoolsToSeed) {
    console.log(`Seeding school: ${schoolInput.schoolCode} (${schoolInput.schoolName})...`);

    const school = await prisma.school.create({
      data: {
        schoolName: schoolInput.schoolName,
        schoolCode: schoolInput.schoolCode,
        address: schoolInput.address,
        city: schoolInput.city,
        state: schoolInput.state,
        phone: schoolInput.phone,
        email: schoolInput.email,
        status: 'ACTIVE',
      },
    });

    await prisma.user.createMany({
      data: [
        {
          email: schoolInput.owner.email,
          password: hashed,
          name: schoolInput.owner.name,
          role: 'SCHOOL_OWNER',
          schoolId: school.id,
        },
        {
          email: schoolInput.admin.email,
          password: hashed,
          name: schoolInput.admin.name,
          role: 'ADMIN',
          schoolId: school.id,
        },
      ],
    });

    const classes = await createSchoolClassesAndSections(school.id);
    console.log(`  Created classes: ${classes.length}`);

    const sections = await prisma.section.findMany({
      where: { schoolId: school.id },
      include: {
        class: true,
      },
      orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }],
    });

    const subjects = await createSubjectsForSchool(school.id);
    console.log(`  Created subjects: ${subjects.length}`);

    await assignSubjects(classes, subjects);
    console.log('  Mapped subjects to classes and sections');

    const teachers = await createTeachers(school.id, school.schoolCode, schoolInput.teacherCount, hashed);
    console.log(`  Created teachers: ${teachers.length}`);

    await createTeacherAssignments(school.id, teachers, sections);
    console.log('  Created teacher assignments');

    await createStudentsForSections(school, sections, hashed);
    console.log('  Created students');
  }

  console.log('Seed complete.');
  console.log('Platform Owner: platform@schoolos.com / admin123');
  console.log('School Owners: owner@greenvalley.edu.in, owner@dps.edu.in / admin123');
  console.log('Admins: admin@greenvalley.edu.in, admin.dps@schoolos.com / admin123');
  const totalTeacherProfiles = await prisma.teacher.count();
  const totalTeacherAssignments = await prisma.teacherAssignment.count();

  console.log(`Teachers: ${totalTeacherProfiles} total across both schools / admin123`);
  console.log(`Teacher Assignments: ${totalTeacherAssignments} section-subject mappings`);
  console.log('Students: 2 per section for every K-12 class in each school / admin123');

  await releaseSeedLock();
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    try {
      await releaseSeedLock();
    } catch (unlockError) {
      // ignore lock release errors when lock was not held
    }
    await prisma.$disconnect();
    process.exit(1);
  });
