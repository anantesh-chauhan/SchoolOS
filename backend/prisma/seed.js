import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
import {
  CLASS_NAMES,
  CLASS_WEEKLY_SUBJECTS,
  OPTIONAL_ACTIVITIES,
  PERIOD_TEMPLATE,
  SCIENCE_COMPONENT_SPLIT,
  SENIOR_SECTION_CATALOG,
  STREAM_DEFINITIONS,
  SUBJECT_MASTER,
  WEEK_DAYS,
  ACADEMIC_LEVELS,
} from '../src/constants/academicTemplate.js';
import { buildDefaultSchoolConfig, buildSchoolTheme, deriveSchoolSlug } from '../src/utils/publicSchool.util.js';

const prisma = new PrismaClient();
const SEED_LOCK_ID = 9234501;

const classCatalog = CLASS_NAMES;

const sectionCatalog = ['A', 'B', 'C'];
const SENIOR_SECTIONS = SENIOR_SECTION_CATALOG;
const MAX_TEACHER_SECTION_ASSIGNMENTS = 7;

const DAILY_TEMPLATE = [
  { slotType: 'FIXED', slotLabel: 'Prayer', periodNumber: null, startTime: '08:00', endTime: '08:25' },
  { slotType: 'PERIOD', slotLabel: 'P1', periodNumber: 1, startTime: '08:25', endTime: '09:05' },
  { slotType: 'PERIOD', slotLabel: 'P2', periodNumber: 2, startTime: '09:05', endTime: '09:45' },
  { slotType: 'PERIOD', slotLabel: 'P3', periodNumber: 3, startTime: '09:45', endTime: '10:25' },
  { slotType: 'PERIOD', slotLabel: 'P4', periodNumber: 4, startTime: '10:25', endTime: '11:05' },
  { slotType: 'FIXED', slotLabel: 'Lunch', periodNumber: null, startTime: '11:05', endTime: '11:35' },
  { slotType: 'PERIOD', slotLabel: 'P5', periodNumber: 5, startTime: '11:35', endTime: '12:15' },
  { slotType: 'PERIOD', slotLabel: 'P6', periodNumber: 6, startTime: '12:15', endTime: '12:55' },
  { slotType: 'PERIOD', slotLabel: 'P7', periodNumber: 7, startTime: '12:55', endTime: '13:35' },
  { slotType: 'PERIOD', slotLabel: 'P8', periodNumber: 8, startTime: '13:35', endTime: '14:15' },
  { slotType: 'FIXED', slotLabel: 'Diary', periodNumber: null, startTime: '14:15', endTime: '14:25' },
];

const DAYS = WEEK_DAYS;

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

const isTransientDbError = (error) => {
  const text = String(error?.message || '').toLowerCase();
  return text.includes('57p01')
    || text.includes('terminating connection due to administrator command')
    || text.includes('server has closed the connection')
    || text.includes('connection reset')
    || text.includes('connection terminated');
};

const withDbRetry = async (operation, { retries = 3, delayMs = 1200 } = {}) => {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === retries) {
        throw error;
      }

      // Backoff before retrying transient DB disconnects.
      await sleep(delayMs * attempt);
    }
  }

  throw lastError;
};

const subjectCatalog = SUBJECT_MASTER.map((item) => ({
  name: item.name,
  code: item.code,
  category: null,
  stream: 'GENERAL',
  subjectType: item.subjectType,
  isLab: item.isLab,
  isOptional: item.isOptional,
  displayOrder: item.displayOrder,
  parentCode: item.parentCode || null,
}));

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
    teacherCount: 60,
    branding: {
      logoUrl: 'https://picsum.photos/id/64/512/512',
      primaryColor: '#0f766e',
      secondaryColor: '#155e75',
    },
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
    teacherCount: 60,
    branding: {
      logoUrl: 'https://picsum.photos/id/91/512/512',
      primaryColor: '#1d4ed8',
      secondaryColor: '#1e3a8a',
    },
  },
];

const galleryBlueprints = [
  {
    title: 'Annual Function 2026',
    description: 'Cultural performances, awards, and stage highlights from our annual celebration.',
    coverImageUrl: 'https://picsum.photos/id/1050/1200/900',
    isVisible: true,
    photos: [
      { imageUrl: 'https://picsum.photos/id/1025/1200/900', caption: 'Opening ceremony with school choir', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1039/1200/900', caption: 'Classical dance performance', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1040/1200/900', caption: 'Drama team on stage', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1041/1200/900', caption: 'Prize distribution moment', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1042/1200/900', caption: 'Parents and students interaction', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1043/1200/900', caption: 'Backstage team coordination', isVisible: false },
    ],
  },
  {
    title: 'Sports Day 2025',
    description: 'Track events, house competitions, and team spirit from sports week.',
    coverImageUrl: 'https://picsum.photos/id/1011/1200/900',
    isVisible: true,
    photos: [
      { imageUrl: 'https://picsum.photos/id/1018/1200/900', caption: '100m sprint finals', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1019/1200/900', caption: 'Relay handoff action shot', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1020/1200/900', caption: 'Long jump competition', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1021/1200/900', caption: 'March-past by house teams', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1022/1200/900', caption: 'Medal winners group photo', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1023/1200/900', caption: 'Volunteers and referees', isVisible: true },
    ],
  },
  {
    title: 'Science Exhibition',
    description: 'Student innovation projects and interactive science demonstrations.',
    coverImageUrl: 'https://picsum.photos/id/1005/1200/900',
    isVisible: true,
    photos: [
      { imageUrl: 'https://picsum.photos/id/1006/1200/900', caption: 'Robotics project presentation', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1008/1200/900', caption: 'Renewable energy prototype', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1009/1200/900', caption: 'Chemistry lab experiment demo', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1010/1200/900', caption: 'Physics model explanation', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1060/1200/900', caption: 'Judges interacting with students', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1062/1200/900', caption: 'Project gallery overview', isVisible: true },
    ],
  },
  {
    title: 'Independence Day Celebration',
    description: 'Flag hoisting, patriotic performances, and community participation.',
    coverImageUrl: 'https://picsum.photos/id/1074/1200/900',
    isVisible: false,
    photos: [
      { imageUrl: 'https://picsum.photos/id/1076/1200/900', caption: 'Flag hoisting ceremony', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1077/1200/900', caption: 'Patriotic group song', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1078/1200/900', caption: 'NCC student march', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1080/1200/900', caption: 'Art and poster competition', isVisible: false },
      { imageUrl: 'https://picsum.photos/id/1081/1200/900', caption: 'Teachers and alumni meetup', isVisible: true },
      { imageUrl: 'https://picsum.photos/id/1082/1200/900', caption: 'Closing ceremony', isVisible: true },
    ],
  },
];

const teacherTemplates = [
  { teacherName: 'Rahul Sharma', specialization: 'Mathematics', qualification: 'M.Sc Mathematics, B.Ed', subjectsHandled: ['Mathematics'] },
  { teacherName: 'Neha Singh', specialization: 'Science', qualification: 'M.Sc Science, B.Ed', subjectsHandled: ['Science', 'Environmental Studies'] },
  { teacherName: 'Ankit Verma', specialization: 'English', qualification: 'M.A English, B.Ed', subjectsHandled: ['English'] },
  { teacherName: 'Priya Gupta', specialization: 'Hindi', qualification: 'M.A Hindi, B.Ed', subjectsHandled: ['Hindi', 'Sanskrit'] },
  { teacherName: 'Amit Tiwari', specialization: 'Social Science', qualification: 'M.A Social Science, B.Ed', subjectsHandled: ['Social Science', 'History', 'Geography'] },
  { teacherName: 'Kavita Mishra', specialization: 'Biology', qualification: 'M.Sc Biology, B.Ed', subjectsHandled: ['Biology', 'Science'] },
  { teacherName: 'Rohit Saxena', specialization: 'Physics', qualification: 'M.Sc Physics, B.Ed', subjectsHandled: ['Physics'] },
  { teacherName: 'Pooja Agarwal', specialization: 'Chemistry', qualification: 'M.Sc Chemistry, B.Ed', subjectsHandled: ['Chemistry'] },
  { teacherName: 'Sanjay Kumar', specialization: 'Computer Science', qualification: 'M.Tech CSE, B.Ed', subjectsHandled: ['Computer Science', 'Informatics Practices', 'Computer'] },
  { teacherName: 'Meena Yadav', specialization: 'Physical Education', qualification: 'M.P.Ed', subjectsHandled: ['Physical Education'] },
  { teacherName: 'Vikram Joshi', specialization: 'Accountancy', qualification: 'M.Com, B.Ed', subjectsHandled: ['Accountancy', 'Business Studies'] },
  { teacherName: 'Shreya Malhotra', specialization: 'Economics', qualification: 'M.A Economics, B.Ed', subjectsHandled: ['Economics', 'Entrepreneurship'] },
  { teacherName: 'Nidhi Chauhan', specialization: 'Political Science', qualification: 'M.A Political Science, B.Ed', subjectsHandled: ['Political Science', 'History'] },
  { teacherName: 'Arjun Mehta', specialization: 'Geography', qualification: 'M.A Geography, B.Ed', subjectsHandled: ['Geography', 'Social Science'] },
  { teacherName: 'Deepa Nair', specialization: 'Art & Craft', qualification: 'MFA, B.Ed', subjectsHandled: ['Art & Craft'] },
  { teacherName: 'Sushil Pandey', specialization: 'Rhymes', qualification: 'ECE Certification', subjectsHandled: ['Rhymes', 'Hindi'] },
  { teacherName: 'Tarun Gupta', specialization: 'General Knowledge', qualification: 'M.A, B.Ed', subjectsHandled: ['General Knowledge', 'Moral Science'] },
  { teacherName: 'Komal Arora', specialization: 'Business Studies', qualification: 'MBA, B.Ed', subjectsHandled: ['Business Studies', 'Economics'] },
  { teacherName: 'Harshad Kulkarni', specialization: 'Mathematics', qualification: 'M.Sc Mathematics, B.Ed', subjectsHandled: ['Mathematics', 'Computer Science'] },
  { teacherName: 'Reena Dutta', specialization: 'English', qualification: 'M.A English, B.Ed', subjectsHandled: ['English', 'Psychology'] },
  { teacherName: 'Yogesh Patil', specialization: 'Physics', qualification: 'M.Sc Physics, B.Ed', subjectsHandled: ['Physics', 'Science'] },
  { teacherName: 'Bhavna Sethi', specialization: 'Chemistry', qualification: 'M.Sc Chemistry, B.Ed', subjectsHandled: ['Chemistry', 'Science'] },
  { teacherName: 'Mohit Chawla', specialization: 'Computer', qualification: 'MCA, B.Ed', subjectsHandled: ['Computer', 'Computer Science'] },
  { teacherName: 'Anjana Reddy', specialization: 'Biology', qualification: 'M.Sc Biology, B.Ed', subjectsHandled: ['Biology', 'Environmental Studies'] },
  { teacherName: 'Lokesh Jain', specialization: 'Psychology', qualification: 'M.A Psychology, B.Ed', subjectsHandled: ['Psychology'] },
  { teacherName: 'Ira Nambiar', specialization: 'Moral Science', qualification: 'M.A, B.Ed', subjectsHandled: ['Moral Science', 'General Knowledge'] },
  { teacherName: 'Shilpa Verma', specialization: 'Sanskrit', qualification: 'M.A Sanskrit, B.Ed', subjectsHandled: ['Sanskrit', 'Hindi'] },
  { teacherName: 'Nitin Arora', specialization: 'Entrepreneurship', qualification: 'MBA, B.Ed', subjectsHandled: ['Entrepreneurship', 'Business Studies'] },
  { teacherName: 'Manish Rawat', specialization: 'Environmental Studies', qualification: 'M.Sc EVS, B.Ed', subjectsHandled: ['Environmental Studies', 'Science'] },
  { teacherName: 'Asha Pillai', specialization: 'Political Science', qualification: 'M.A Political Science, B.Ed', subjectsHandled: ['Political Science', 'Social Science'] },
];

const getClassNumber = (className) => {
  const match = String(className || '').match(/class\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

const getSectionNamesForClass = (className) => {
  if (className === 'Class 11' || className === 'Class 12') {
    return SENIOR_SECTIONS;
  }

  return sectionCatalog;
};

const getSectionStream = (className, sectionName) => {
  if (className !== 'Class 11' && className !== 'Class 12') {
    return null;
  }

  const normalized = String(sectionName || '').toUpperCase();
  if (normalized.startsWith('PCM')) return 'PCM';
  if (normalized.startsWith('PCB')) return 'PCB';
  if (normalized.startsWith('PCMB')) return 'PCMB';
  if (normalized.startsWith('COM')) return 'COM';
  if (normalized.startsWith('HUM')) return 'HUM';
  return null;
};

const getSubjectId = (subjectMap, name) => {
  const subjectId = subjectMap.get(name);
  if (!subjectId) {
    throw new Error(`Missing subject ${name} in seed catalog`);
  }
  return subjectId;
};

const getClassSubjectNames = (className) => {
  if (className === 'LKG') {
    return CLASS_WEEKLY_SUBJECTS.LKG.map((item) => item.name);
  }

  if (className === 'UKG') {
    return CLASS_WEEKLY_SUBJECTS.UKG.map((item) => item.name);
  }

  const classNo = getClassNumber(className);
  if (classNo >= 1 && classNo <= 5) {
    return CLASS_WEEKLY_SUBJECTS.PRIMARY_1_5.map((item) => item.name);
  }

  if (classNo >= 6 && classNo <= 8) {
    return CLASS_WEEKLY_SUBJECTS.MIDDLE_6_8.map((item) => item.name);
  }

  if (classNo === 9 || classNo === 10) {
    return CLASS_WEEKLY_SUBJECTS.SECONDARY_9_10.map((item) => item.name);
  }

  return ['English', 'Physical Education'];
};

const getSectionSubjectNames = (className, sectionName) => {
  const classNo = getClassNumber(className);

  if (classNo !== 11 && classNo !== 12) {
    return getClassSubjectNames(className);
  }

  const stream = getSectionStream(className, sectionName);
  const streamDefinition = STREAM_DEFINITIONS.find((item) => item.code === stream);
  if (!streamDefinition) {
    return ['English', 'Physical Education'];
  }

  const codeToSubject = new Map(SUBJECT_MASTER.map((item) => [item.code, item.name]));
  return streamDefinition.subjects.map((item) => codeToSubject.get(item.code)).filter(Boolean);
};

const getSectionWeeklyRequirements = (className, sectionName) => {
  const classNo = getClassNumber(className);

  if (classNo !== 11 && classNo !== 12) {
    return getWeeklyRequirements(className);
  }

  const stream = getSectionStream(className, sectionName);
  const streamDefinition = STREAM_DEFINITIONS.find((item) => item.code === stream);
  const codeToSubject = new Map(SUBJECT_MASTER.map((item) => [item.code, item.name]));

  if (!streamDefinition) {
    return [];
  }

  return streamDefinition.subjects
    .map((item) => ({
      subjectName: codeToSubject.get(item.code),
      periodsPerWeek: item.periodsPerWeek,
      isMandatory: Boolean(item.isMandatory),
      isOptional: Boolean(item.isOptional),
    }))
    .filter((item) => Boolean(item.subjectName));
};

const getWeeklyRequirements = (className) => {
  const classNo = getClassNumber(className);
  const toRequirement = (rows) => rows.map((item) => ({
    subjectName: item.name,
    periodsPerWeek: item.periodsPerWeek,
    isMandatory: !item.isOptional,
    isOptional: Boolean(item.isOptional),
  }));

  if (className === 'LKG') return toRequirement(CLASS_WEEKLY_SUBJECTS.LKG);
  if (className === 'UKG') return toRequirement(CLASS_WEEKLY_SUBJECTS.UKG);
  if (classNo >= 1 && classNo <= 5) return toRequirement(CLASS_WEEKLY_SUBJECTS.PRIMARY_1_5);
  if (classNo >= 6 && classNo <= 8) return toRequirement(CLASS_WEEKLY_SUBJECTS.MIDDLE_6_8);
  if (classNo === 9 || classNo === 10) return toRequirement(CLASS_WEEKLY_SUBJECTS.SECONDARY_9_10);
  return [];
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

const createSchoolClassesAndSections = async (schoolId) => {
  const createdClasses = [];

  for (let index = 0; index < classCatalog.length; index += 1) {
    const className = classCatalog[index];
    const classRow = await prisma.class.create({
      data: {
        className,
        classOrder: index + 1,
        schoolId,
        sections: {
          create: getSectionNamesForClass(className).map((sectionName, sectionIndex) => ({
            sectionName,
            sectionOrder: sectionIndex + 1,
            schoolId,
          })),
        },
      },
    });

    createdClasses.push(classRow);
  }

  return createdClasses;
};

const createSubjectsForSchool = async (schoolId) => {
  const subjects = [];

  for (const item of subjectCatalog) {
    const subjectRow = await prisma.subject.create({
      data: {
        schoolId,
        subjectName: item.name,
        subjectCode: item.code,
        category: item.category,
        stream: item.stream,
        subjectType: item.subjectType,
        isLab: item.isLab,
        isOptional: item.isOptional,
        displayOrder: item.displayOrder,
      },
    });
    subjects.push(subjectRow);
  }

  const subjectByCode = new Map(subjects.map((subject) => [subject.subjectCode, subject]));
  for (const item of subjectCatalog.filter((row) => row.parentCode)) {
    const current = subjectByCode.get(item.code);
    const parent = subjectByCode.get(item.parentCode);
    if (current && parent) {
      await prisma.subject.update({
        where: { id: current.id },
        data: { parentSubjectId: parent.id },
      });
    }
  }

  return prisma.subject.findMany({ where: { schoolId } });
};

const createAcademicLevelsAndMapClasses = async (schoolId, classes) => {
  const levels = [];
  for (const level of ACADEMIC_LEVELS) {
    const row = await prisma.academicLevel.create({
      data: {
        schoolId,
        code: level.code,
        name: level.name,
        minClassOrder: level.minClassOrder,
        maxClassOrder: level.maxClassOrder,
        displayOrder: level.displayOrder,
      },
    });
    levels.push(row);
  }

  for (const classRow of classes) {
    const level = levels.find((item) => classRow.classOrder >= item.minClassOrder && classRow.classOrder <= item.maxClassOrder);
    if (level) {
      await prisma.class.update({
        where: { id: classRow.id },
        data: { academicLevelId: level.id },
      });
    }
  }

  return levels;
};

const createScienceComponents = async (schoolId, subjects) => {
  const science = subjects.find((item) => item.subjectCode === 'SCI');
  if (!science) {
    return;
  }

  for (const component of SCIENCE_COMPONENT_SPLIT) {
    await prisma.subjectComponent.create({
      data: {
        schoolId,
        subjectId: science.id,
        name: component.componentName,
        code: component.code,
        periodsPerWeek: component.periodsPerWeek,
        displayOrder: component.displayOrder,
      },
    });
  }
};

const createStreamsAndMapSections = async (schoolId, classes, subjects) => {
  const streams = [];
  const subjectByCode = new Map(subjects.map((item) => [item.subjectCode, item]));

  for (const stream of STREAM_DEFINITIONS) {
    const streamRow = await prisma.stream.create({
      data: {
        schoolId,
        code: stream.code,
        name: stream.name,
        classFrom: 11,
        classTo: 12,
      },
    });

    const streamSubjects = stream.subjects.map((item) => ({
      schoolId,
      streamId: streamRow.id,
      subjectId: subjectByCode.get(item.code)?.id,
      periodsPerWeek: item.periodsPerWeek,
      isMandatory: Boolean(item.isMandatory),
      isOptional: Boolean(item.isOptional),
      displayOrder: item.displayOrder,
    })).filter((item) => Boolean(item.subjectId));

    if (streamSubjects.length > 0) {
      await prisma.streamSubject.createMany({ data: streamSubjects });
    }

    streams.push(streamRow);
  }

  const streamByCode = new Map(streams.map((item) => [item.code, item]));
  const seniorClasses = classes.filter((item) => ['Class 11', 'Class 12'].includes(item.className));

  for (const classRow of seniorClasses) {
    const sections = await prisma.section.findMany({ where: { schoolId, classId: classRow.id } });
    for (const section of sections) {
      const streamCode = getSectionStream(classRow.className, section.sectionName);
      const stream = streamCode ? streamByCode.get(streamCode) : null;
      if (!stream) {
        continue;
      }

      await prisma.section.update({ where: { id: section.id }, data: { streamId: stream.id } });
      await prisma.classStream.create({
        data: {
          schoolId,
          classId: classRow.id,
          sectionId: section.id,
          streamId: stream.id,
          academicYear: '2025-26',
        },
      });
    }
  }
};

const createActivitiesAndPeriods = async (schoolId) => {
  await prisma.activity.createMany({
    data: OPTIONAL_ACTIVITIES.map((activity) => ({
      schoolId,
      name: activity.name,
      code: activity.code,
      capacity: activity.capacity,
      displayOrder: activity.displayOrder,
    })),
  });

  const periodRows = [];
  for (const dayOfWeek of WEEK_DAYS) {
    for (const period of PERIOD_TEMPLATE) {
      periodRows.push({
        schoolId,
        dayOfWeek,
        periodNumber: period.periodNumber,
        startTime: period.startTime,
        endTime: period.endTime,
        isActivityPeriod: period.isActivityPeriod,
      });
    }
  }

  await prisma.periodDefinition.createMany({ data: periodRows });
};

const createLabRulesAndRooms = async (schoolId, subjects) => {
  const labSubjects = subjects.filter((item) => ['PHY_LAB', 'CHE_LAB'].includes(item.subjectCode));
  await prisma.labRoom.createMany({
    data: [
      { schoolId, roomName: 'Physics Lab', roomCode: 'LAB_PHY', capacity: 40 },
      { schoolId, roomName: 'Chemistry Lab', roomCode: 'LAB_CHE', capacity: 40 },
      { schoolId, roomName: 'Computer Lab', roomCode: 'LAB_CMP', capacity: 40 },
    ],
  });

  if (labSubjects.length > 0) {
    await prisma.labSubjectRule.createMany({
      data: labSubjects.map((subject) => ({
        schoolId,
        subjectId: subject.id,
        requiresLabRoom: true,
        minConsecutivePeriods: 2,
      })),
    });
  }
};

const createTeacherSubjectLoadSplits = async (schoolId) => {
  const science = await prisma.subject.findFirst({ where: { schoolId, subjectCode: 'SCI' } });
  if (!science) {
    return;
  }

  const components = await prisma.subjectComponent.findMany({ where: { schoolId, subjectId: science.id } });
  if (components.length === 0) {
    return;
  }

  const targetSections = await prisma.section.findMany({
    where: {
      schoolId,
      class: {
        className: {
          in: ['Class 9', 'Class 10'],
        },
      },
    },
    include: {
      class: true,
    },
  });

  for (const section of targetSections) {
    const assignments = await prisma.teacherAssignment.findMany({
      where: {
        schoolId,
        classId: section.classId,
        sectionId: section.id,
        subjectId: science.id,
      },
      take: 3,
    });

    if (assignments.length === 0) {
      continue;
    }

    for (let index = 0; index < components.length; index += 1) {
      const assignment = assignments[index % assignments.length];
      await prisma.teacherSubject.create({
        data: {
          schoolId,
          teacherId: assignment.teacherId,
          classId: section.classId,
          sectionId: section.id,
          subjectId: science.id,
          subjectComponentId: components[index].id,
          periodsPerWeek: components[index].periodsPerWeek,
        },
      });
    }
  }
};

const assignSubjects = async (classes, subjects) => {
  const subjectMap = new Map(subjects.map((subject) => [subject.subjectName, subject.id]));

  for (const classRow of classes) {
    const classSubjectNames = getClassSubjectNames(classRow.className);

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
      const sectionSubjectNames = getSectionSubjectNames(classRow.className, sectionRow.sectionName);

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
  const assignmentLoadByTeacherId = new Map(teachers.map((teacher) => [teacher.id, 0]));

  for (const teacher of teachers) {
    for (const subject of teacher.subjectsHandled || []) {
      if (!subjectBuckets.has(subject)) {
        subjectBuckets.set(subject, []);
        bucketIndex.set(subject, 0);
      }
      subjectBuckets.get(subject).push(teacher);
    }
  }

  const assignmentRows = [];

  for (const section of sections) {
    const sectionSubjects = await prisma.sectionSubject.findMany({
      where: { sectionId: section.id },
      include: { subject: true },
      orderBy: { createdAt: 'asc' },
    });

    for (const sectionSubject of sectionSubjects) {
      const preferred = subjectBuckets.get(sectionSubject.subject.subjectName) || [];
      const pool = preferred.length > 0 ? preferred : teachers;
      const indexKey = sectionSubject.subject.subjectName;
      const currentIndex = bucketIndex.get(indexKey) || 0;
      const orderedPool = [...pool]
        .sort((a, b) => (assignmentLoadByTeacherId.get(a.id) || 0) - (assignmentLoadByTeacherId.get(b.id) || 0));

      let selectedTeacher = orderedPool.find((teacher) => (assignmentLoadByTeacherId.get(teacher.id) || 0) < MAX_TEACHER_SECTION_ASSIGNMENTS);
      if (!selectedTeacher) {
        selectedTeacher = orderedPool[currentIndex % orderedPool.length];
      }

      bucketIndex.set(indexKey, currentIndex + 1);
      assignmentLoadByTeacherId.set(selectedTeacher.id, (assignmentLoadByTeacherId.get(selectedTeacher.id) || 0) + 1);

      assignmentRows.push({
        schoolId,
        classId: section.classId,
        sectionId: section.id,
        subjectId: sectionSubject.subjectId,
        teacherId: selectedTeacher.id,
      });
    }
  }

  const batchSize = 200;
  for (let i = 0; i < assignmentRows.length; i += batchSize) {
    const batch = assignmentRows.slice(i, i + batchSize);
    await withDbRetry(
      () => prisma.teacherAssignment.createMany({
        data: batch,
        skipDuplicates: true,
      }),
      { retries: 4, delayMs: 1500 }
    );
  }
};

const createWeeklyRequirements = async (schoolId, classes, subjects) => {
  const subjectMap = new Map(subjects.map((subject) => [subject.subjectName, subject.id]));

  for (const classRow of classes) {
    const classLevelRows = getWeeklyRequirements(classRow.className)
      .map((item) => ({
        classId: classRow.id,
        schoolId,
        sectionId: null,
        subjectId: subjectMap.get(item.subjectName),
        periodsPerWeek: item.periodsPerWeek,
        isMandatory: item.isMandatory,
        isOptional: item.isOptional,
      }))
      .filter((item) => Boolean(item.subjectId));

    if (classLevelRows.length > 0) {
      await prisma.subjectWeeklyRequirement.createMany({ data: classLevelRows });
    }

    const sections = await prisma.section.findMany({
      where: { classId: classRow.id, schoolId },
      orderBy: { sectionOrder: 'asc' },
    });

    for (const section of sections) {
      const sectionLevelRows = getSectionWeeklyRequirements(classRow.className, section.sectionName)
        .map((item) => ({
          classId: classRow.id,
          schoolId,
          sectionId: section.id,
          subjectId: subjectMap.get(item.subjectName),
          periodsPerWeek: item.periodsPerWeek,
          isMandatory: item.isMandatory,
          isOptional: item.isOptional,
        }))
        .filter((item) => Boolean(item.subjectId));

      if (sectionLevelRows.length > 0) {
        await prisma.subjectWeeklyRequirement.createMany({ data: sectionLevelRows });
      }
    }
  }
};

const createTimetableBodies = async (schoolId, sections, academicYear = '2025-26') => {
  for (const section of sections) {
    const timetable = await prisma.timetable.create({
      data: {
        schoolId,
        classId: section.classId,
        sectionId: section.id,
        academicYear,
      },
    });

    const slotRows = [];
    for (const day of DAYS) {
      for (let sequence = 0; sequence < PERIOD_TEMPLATE.length; sequence += 1) {
        const tpl = PERIOD_TEMPLATE[sequence];
        slotRows.push({
          timetableId: timetable.id,
          schoolId,
          classId: section.classId,
          sectionId: section.id,
          dayOfWeek: day,
          periodNumber: tpl.periodNumber,
          sequenceOrder: tpl.periodNumber,
          slotType: 'PERIOD',
          slotLabel: `P${tpl.periodNumber}`,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          isActivityPeriod: tpl.isActivityPeriod,
        });
      }
    }

    await prisma.timetableSlot.createMany({ data: slotRows });
  }
};

const createStudentsForSections = async (school, sections, hashedPassword) => {
  const students = [];

  for (const section of sections) {
    for (let i = 1; i <= 2; i += 1) {
      students.push({
        email: `student${i}.${section.class.classOrder}${section.sectionName.toLowerCase()}.${school.schoolCode.toLowerCase()}@schoolos.com`,
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

const createSchoolSettings = async (school, schoolInput) => {
  await prisma.schoolSettings.create({
    data: {
      schoolId: school.id,
      schoolName: school.schoolName,
      logoUrl: schoolInput.branding.logoUrl,
      email: school.email,
      phone: school.phone,
      addressLine1: school.address,
      addressLine2: 'Near Central Market',
      city: school.city,
      state: school.state,
      country: 'India',
      postalCode: school.schoolCode === 'GVS001' ? '201301' : '110003',
      website: `https://${schoolInput.schoolCode.toLowerCase()}.schoolos.demo`,
      supportEmail: `support.${schoolInput.schoolCode.toLowerCase()}@schoolos.demo`,
      primaryColor: schoolInput.branding.primaryColor,
      secondaryColor: schoolInput.branding.secondaryColor,
    },
  });
};

const createGalleryData = async (schoolId) => {
  let groupOrder = 1;
  for (const blueprint of galleryBlueprints) {
    const group = await prisma.galleryGroup.create({
      data: {
        schoolId,
        title: blueprint.title,
        description: blueprint.description,
        coverImageUrl: blueprint.coverImageUrl,
        isVisible: blueprint.isVisible,
        displayOrder: groupOrder++,
      },
    });

    await prisma.galleryPhoto.createMany({
      data: blueprint.photos.map((photo, index) => ({
        schoolId,
        groupId: group.id,
        imageUrl: photo.imageUrl,
        caption: photo.caption,
        isVisible: photo.isVisible,
        displayOrder: index + 1,
      })),
    });
  }
};

const createWidgetSeedData = async (school, schoolInput) => {
  const adminUser = await prisma.user.findFirst({
    where: {
      schoolId: school.id,
      role: 'ADMIN',
    },
  });

  if (!adminUser) {
    return;
  }

  await prisma.userWidgetPreference.createMany({
    data: [
      { schoolId: school.id, userId: adminUser.id, widgetKey: 'school-kpis', isVisible: true, orderIndex: 1, size: 'LG', pinned: true },
      { schoolId: school.id, userId: adminUser.id, widgetKey: 'curriculum-health', isVisible: true, orderIndex: 2, size: 'LG', pinned: true },
      { schoolId: school.id, userId: adminUser.id, widgetKey: 'pending-todos', isVisible: true, orderIndex: 3, size: 'MD' },
      { schoolId: school.id, userId: adminUser.id, widgetKey: 'notes', isVisible: true, orderIndex: 4, size: 'MD' },
      { schoolId: school.id, userId: adminUser.id, widgetKey: 'bookmarks', isVisible: true, orderIndex: 5, size: 'MD' },
    ],
    skipDuplicates: true,
  });

  await prisma.userWidgetTodo.createMany({
    data: [
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: `Review ${schoolInput.schoolCode} timetable audit`,
        description: 'Check timetable reconciliation warnings and repair missing assignments.',
        dueDate: new Date(Date.now() + 86400000),
        priority: 'HIGH',
      },
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Confirm gallery cover images',
        description: 'Refresh the latest gallery album covers on the public page.',
        dueDate: new Date(Date.now() + 2 * 86400000),
        priority: 'MEDIUM',
      },
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Publish weekly notice',
        description: 'Send the weekly school bulletin to staff and parents.',
        dueDate: new Date(Date.now() + 3 * 86400000),
        priority: 'LOW',
      },
    ],
  });

  await prisma.userWidgetNote.createMany({
    data: [
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Open widget idea',
        content: 'Add a short-term admissions tracker once the enquiry module ships.',
        color: '#dbeafe',
        pinned: true,
        orderIndex: 1,
      },
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Staff sync',
        content: 'Remind department heads to verify teacher load after timetable changes.',
        color: '#fce7f3',
        pinned: false,
        orderIndex: 2,
      },
    ],
  });

  await prisma.userWidgetBookmark.createMany({
    data: [
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'School Settings',
        url: '/dashboard/platform/school-settings',
        tag: 'Branding',
      },
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Timetable Builder',
        url: '/dashboard/admin/timetable-builder',
        tag: 'Operations',
      },
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Gallery Studio',
        url: '/dashboard/admin/gallery',
        tag: 'Media',
      },
    ],
  });

  await prisma.userWidgetNotification.createMany({
    data: [
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Widget system live',
        body: 'The universal widget hub is ready for the school dashboard.',
        type: 'SYSTEM',
        link: '/dashboard/widgets',
      },
      {
        schoolId: school.id,
        userId: adminUser.id,
        title: 'Gallery updated',
        body: 'Fresh annual function photos have been published.',
        type: 'INFO',
        link: '/dashboard/gallery',
      },
    ],
  });

  await prisma.userWidgetActivity.createMany({
    data: [
      {
        schoolId: school.id,
        userId: adminUser.id,
        activityKey: 'seed_widget_system',
        title: 'Widget hub seeded',
        summary: 'Demo widget records created for the admin dashboard.',
        metadata: { schoolCode: school.schoolCode },
      },
      {
        schoolId: school.id,
        userId: adminUser.id,
        activityKey: 'seed_system_content',
        title: 'System content published',
        summary: 'Homepage and notice blocks are available in the hub.',
        metadata: { schoolCode: school.schoolCode },
      },
    ],
  });

  await prisma.userLoginStreak.upsert({
    where: { userId: adminUser.id },
    create: {
      schoolId: school.id,
      userId: adminUser.id,
      currentStreak: 7,
      bestStreak: 11,
      lastLoginAt: new Date(),
      streakStartedAt: new Date(Date.now() - 6 * 86400000),
    },
    update: {
      schoolId: school.id,
      currentStreak: 7,
      bestStreak: 11,
      lastLoginAt: new Date(),
      streakStartedAt: new Date(Date.now() - 6 * 86400000),
    },
  });

  await prisma.systemContent.createMany({
    data: [
      {
        schoolId: school.id,
        contentKey: 'widget-hub-welcome',
        title: 'Welcome to the Widget Hub',
        body: 'Track the school pulse, personal tasks, and operational shortcuts from one unified screen.',
        metadata: { audience: 'all' },
        isPublished: true,
        createdById: adminUser.id,
      },
      {
        schoolId: school.id,
        contentKey: 'weekly-bulletin',
        title: 'Weekly Bulletin',
        body: 'Review the timetable audit, publish the weekly notice, and confirm gallery highlights.',
        metadata: { audience: 'staff' },
        isPublished: true,
        createdById: adminUser.id,
      },
    ],
    skipDuplicates: true,
  });
};

async function main() {
  console.log('Seeding SchoolOS database...');

  const hasLock = await acquireSeedLock();
  if (!hasLock) {
    throw new Error('Another seed process is already running. Please wait and retry.');
  }

  await prisma.timetableSlot.deleteMany();
  await prisma.timetable.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.classStream.deleteMany();
  await prisma.streamSubject.deleteMany();
  await prisma.stream.deleteMany();
  await prisma.periodDefinition.deleteMany();
  await prisma.activityEnrollment.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.labSubjectRule.deleteMany();
  await prisma.labRoom.deleteMany();
  await prisma.subjectComponent.deleteMany();
  await prisma.academicLevel.deleteMany();
  await prisma.galleryPhoto.deleteMany();
  await prisma.galleryGroup.deleteMany();
  await prisma.schoolSettings.deleteMany();
  await prisma.subjectWeeklyRequirement.deleteMany();
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
        slug: deriveSchoolSlug({ schoolCode: schoolInput.schoolCode }),
        address: schoolInput.address,
        city: schoolInput.city,
        state: schoolInput.state,
        phone: schoolInput.phone,
        email: schoolInput.email,
        status: 'ACTIVE',
        theme: buildSchoolTheme({
          schoolCode: schoolInput.schoolCode,
          theme: {
            primaryColor: schoolInput.branding.primaryColor,
            secondaryColor: schoolInput.branding.secondaryColor,
          },
        }),
        config: buildDefaultSchoolConfig({
          schoolName: schoolInput.schoolName,
          schoolCode: schoolInput.schoolCode,
          address: schoolInput.address,
          city: schoolInput.city,
          state: schoolInput.state,
          phone: schoolInput.phone,
          email: schoolInput.email,
          theme: {
            primaryColor: schoolInput.branding.primaryColor,
            secondaryColor: schoolInput.branding.secondaryColor,
          },
        }),
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

    await createAcademicLevelsAndMapClasses(school.id, classes);
    console.log('  Created academic levels and mapped classes');

    const sections = await prisma.section.findMany({
      where: { schoolId: school.id },
      include: {
        class: true,
      },
      orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }],
    });

    const subjects = await createSubjectsForSchool(school.id);
    console.log(`  Created subjects: ${subjects.length}`);

    await createScienceComponents(school.id, subjects);
    console.log('  Created subject components for Science split');

    await assignSubjects(classes, subjects);
    console.log('  Mapped subjects to classes and sections');

    await createStreamsAndMapSections(school.id, classes, subjects);
    console.log('  Created stream master and mapped senior sections');

    const teachers = await createTeachers(school.id, school.schoolCode, schoolInput.teacherCount, hashed);
    console.log(`  Created teachers: ${teachers.length}`);

    await createTeacherAssignments(school.id, teachers, sections);
    console.log('  Created teacher assignments');

    await createWeeklyRequirements(school.id, classes, subjects);
    console.log('  Created weekly subject requirements');

    await createActivitiesAndPeriods(school.id);
    console.log('  Created optional activities and 6x8 period templates');

    await createLabRulesAndRooms(school.id, subjects);
    console.log('  Created lab rooms and lab rules');

    await createTimetableBodies(school.id, sections);
    console.log('  Created timetable bodies and empty slots');

    await createStudentsForSections(school, sections, hashed);
    console.log('  Created students');

    await createSchoolSettings(school, schoolInput);
    console.log('  Created school settings and branding');

    await createGalleryData(school.id);
    console.log(`  Created gallery groups: ${galleryBlueprints.length}`);

    await createWidgetSeedData(school, schoolInput);
    console.log('  Created widget hub seed data');

    await createTeacherSubjectLoadSplits(school.id);
    console.log('  Created multi-teacher component load rows for Science');
  }

  console.log('Seed complete.');
  console.log('Platform Owner: platform@schoolos.com / admin123');
  console.log('School Owners: owner@greenvalley.edu.in, owner@dps.edu.in / admin123');
  console.log('Admins: admin@greenvalley.edu.in, admin.dps@schoolos.com / admin123');

  const totals = await Promise.all([
    prisma.teacher.count(),
    prisma.teacherAssignment.count(),
    prisma.teacherSubject.count(),
    prisma.subjectWeeklyRequirement.count(),
    prisma.timetable.count(),
    prisma.timetableSlot.count(),
    prisma.schoolSettings.count(),
    prisma.galleryGroup.count(),
    prisma.galleryPhoto.count(),
    prisma.academicLevel.count(),
    prisma.stream.count(),
    prisma.activity.count(),
    prisma.periodDefinition.count(),
    prisma.subjectComponent.count(),
  ]);

  console.log(`Teachers: ${totals[0]} total across both schools / admin123`);
  console.log(`Teacher Assignments: ${totals[1]} section-subject mappings`);
  console.log(`Teacher Subject Component Loads: ${totals[2]} rows`);
  console.log(`Weekly Requirements: ${totals[3]} class and section level subject rules`);
  console.log(`Timetables: ${totals[4]} class-section timetable bodies`);
  console.log(`Timetable Slots: ${totals[5]} empty slots in 6x8 model`);
  console.log(`School Settings: ${totals[6]} branding and contact configurations`);
  console.log(`Gallery Groups: ${totals[7]} event albums`);
  console.log(`Gallery Photos: ${totals[8]} event images`);
  console.log(`Academic Levels: ${totals[9]} rows`);
  console.log(`Streams: ${totals[10]} rows`);
  console.log(`Activities: ${totals[11]} rows`);
  console.log(`Period Definitions: ${totals[12]} rows`);
  console.log(`Subject Components: ${totals[13]} rows`);

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
