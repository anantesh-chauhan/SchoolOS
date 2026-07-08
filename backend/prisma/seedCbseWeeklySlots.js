import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const WEEKLY_CAPACITY = 48;

const normalize = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');

const subjectKey = (subject) => normalize(subject.subjectCode || subject.subjectName);

const aliases = (...values) => values.map(normalize);

const PLANS = {
  PRE_PRIMARY: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 10 },
    { keys: aliases('HIN', 'HINDI'), periods: 8 },
    { keys: aliases('MAT', 'MATHEMATICS'), periods: 10 },
    { keys: aliases('EVS', 'EAW', 'ENVIRONMENTAL_STUDIES', 'ENVIRONMENTAL_AWARENESS'), periods: 8 },
    { keys: aliases('RHY', 'RHYMES'), periods: 4 },
    { keys: aliases('ART', 'ARTC', 'DRW', 'DRAWING', 'ART_CRAFT'), periods: 4 },
    { keys: aliases('GACT', 'ACT', 'GENERAL_ACTIVITIES', 'ACTIVITY'), periods: 2, isOptional: true },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 2 },
  ],
  PRIMARY: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 8 },
    { keys: aliases('HIN', 'HINDI'), periods: 7 },
    { keys: aliases('MAT', 'MATHEMATICS'), periods: 8 },
    { keys: aliases('EVS', 'ENVIRONMENTAL_STUDIES'), periods: 6 },
    { keys: aliases('COMP', 'CB', 'COMPUTER', 'COMPUTER_BASICS'), periods: 3 },
    { keys: aliases('GK', 'GENERAL_KNOWLEDGE'), periods: 3 },
    { keys: aliases('ART', 'ARTC', 'DRW', 'DRAWING', 'ART_CRAFT'), periods: 4 },
    { keys: aliases('MS', 'MORAL_SCIENCE'), periods: 3 },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 4 },
    { keys: aliases('MUS', 'MUSIC'), periods: 2 },
  ],
  MIDDLE: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 7 },
    { keys: aliases('HIN', 'HINDI'), periods: 6 },
    { keys: aliases('SAN', 'SANSKRIT'), periods: 5 },
    { keys: aliases('MAT', 'MATHEMATICS'), periods: 7 },
    { keys: aliases('SCI', 'SCIENCE'), periods: 7 },
    { keys: aliases('SST', 'SOCIAL_SCIENCE'), periods: 6 },
    { keys: aliases('COMP', 'COMPUTER'), periods: 3 },
    { keys: aliases('GK', 'GENERAL_KNOWLEDGE'), periods: 2 },
    { keys: aliases('ART', 'ARTC', 'DRW', 'DRAWING', 'ART_CRAFT'), periods: 2 },
    { keys: aliases('MUS', 'MUSIC'), periods: 1 },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 2 },
  ],
  SECONDARY: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 6 },
    { keys: aliases('HIN', 'SAN', 'LANGUAGE_2', 'HINDI', 'SANSKRIT'), periods: 6 },
    { keys: aliases('MAT', 'MATHEMATICS'), periods: 7 },
    { keys: aliases('SCI', 'SCIENCE'), periods: 8 },
    { keys: aliases('SST', 'SOCIAL_SCIENCE'), periods: 7 },
    { keys: aliases('COMP', 'CA', 'AI', 'CS', 'COMPUTER', 'COMPUTER_APPLICATIONS', 'COMPUTER_SCIENCE'), periods: 4, isOptional: true },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 4 },
    { keys: aliases('ART', 'ARTC', 'DRW', 'DRAWING', 'ART_CRAFT'), periods: 3 },
    { keys: aliases('LIB', 'LIBRARY'), periods: 2 },
    { keys: aliases('VAL', 'MS', 'VALUE_EDUCATION', 'MORAL_SCIENCE'), periods: 1 },
  ],
  PCM: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 6 },
    { keys: aliases('PHY', 'PHYSICS'), periods: 7 },
    { keys: aliases('CHE', 'CHEMISTRY'), periods: 7 },
    { keys: aliases('MAT', 'AMAT', 'MATHEMATICS', 'APPLIED_MATHEMATICS'), periods: 7 },
    { keys: aliases('CS', 'IP', 'COMPUTER_SCIENCE', 'INFORMATICS_PRACTICES'), periods: 5, isOptional: true },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 4 },
    { keys: aliases('PHY_LAB', 'PHYSICS_LAB'), periods: 4 },
    { keys: aliases('CHE_LAB', 'CHEMISTRY_LAB'), periods: 4 },
    { keys: aliases('LIB', 'LIBRARY'), periods: 2 },
    { keys: aliases('VAL', 'VALUE_EDUCATION'), periods: 2 },
  ],
  PCB: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 6 },
    { keys: aliases('PHY', 'PHYSICS'), periods: 7 },
    { keys: aliases('CHE', 'CHEMISTRY'), periods: 7 },
    { keys: aliases('BIO', 'BIOLOGY'), periods: 7 },
    { keys: aliases('CS', 'IP', 'COMPUTER_SCIENCE', 'INFORMATICS_PRACTICES'), periods: 5, isOptional: true },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 4 },
    { keys: aliases('PHY_LAB', 'PHYSICS_LAB'), periods: 4 },
    { keys: aliases('CHE_LAB', 'CHEMISTRY_LAB'), periods: 4 },
    { keys: aliases('LIB', 'LIBRARY'), periods: 2 },
    { keys: aliases('VAL', 'VALUE_EDUCATION'), periods: 2 },
  ],
  PCMB: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 5 },
    { keys: aliases('PHY', 'PHYSICS'), periods: 6 },
    { keys: aliases('CHE', 'CHEMISTRY'), periods: 6 },
    { keys: aliases('MAT', 'MATHEMATICS'), periods: 6 },
    { keys: aliases('BIO', 'BIOLOGY'), periods: 6 },
    { keys: aliases('CS', 'IP', 'COMPUTER_SCIENCE', 'INFORMATICS_PRACTICES'), periods: 5, isOptional: true },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 4 },
    { keys: aliases('PHY_LAB', 'PHYSICS_LAB'), periods: 4 },
    { keys: aliases('CHE_LAB', 'CHEMISTRY_LAB'), periods: 4 },
    { keys: aliases('LIB', 'LIBRARY'), periods: 1 },
    { keys: aliases('VAL', 'VALUE_EDUCATION'), periods: 1 },
  ],
  COMMERCE: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 6 },
    { keys: aliases('ACC', 'ACCOUNTANCY'), periods: 7 },
    { keys: aliases('BST', 'BUSINESS_STUDIES'), periods: 7 },
    { keys: aliases('ECO', 'ECONOMICS'), periods: 7 },
    { keys: aliases('MAT', 'AMAT', 'MATHEMATICS', 'APPLIED_MATHEMATICS'), periods: 6 },
    { keys: aliases('CS', 'IP', 'INFORMATICS_PRACTICES', 'COMPUTER_SCIENCE'), periods: 5, isOptional: true },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 4 },
    { keys: aliases('LIB', 'LIBRARY'), periods: 3 },
    { keys: aliases('VAL', 'VALUE_EDUCATION'), periods: 3 },
  ],
  HUMANITIES: [
    { keys: aliases('ENG', 'ENGLISH'), periods: 6 },
    { keys: aliases('HIS', 'HISTORY'), periods: 7 },
    { keys: aliases('POL', 'CIV', 'POLITICAL_SCIENCE', 'CIVICS'), periods: 6 },
    { keys: aliases('GEO', 'GEOGRAPHY'), periods: 7 },
    { keys: aliases('ECO', 'ECONOMICS'), periods: 6 },
    { keys: aliases('PSY', 'SOC', 'CS', 'PSYCHOLOGY', 'SOCIOLOGY', 'COMPUTER_SCIENCE'), periods: 4, isOptional: true },
    { keys: aliases('PE', 'PHYSICAL_EDUCATION'), periods: 4 },
    { keys: aliases('LIB', 'LIBRARY'), periods: 2 },
    { keys: aliases('VAL', 'VALUE_EDUCATION'), periods: 2 },
    { keys: aliases('ART', 'ACT', 'ART_CRAFT', 'ACTIVITY'), periods: 4, isOptional: true },
  ],
};

const getClassNumber = (className) => {
  const match = String(className || '').match(/class\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

const getPlanName = (className, sectionName = '') => {
  const normalizedClassName = String(className || '').trim().toUpperCase();
  const normalizedSectionName = String(sectionName || '').trim().toUpperCase();
  const classNumber = getClassNumber(className);

  if (['NURSERY', 'LKG', 'UKG'].includes(normalizedClassName)) return 'PRE_PRIMARY';
  if (classNumber >= 1 && classNumber <= 5) return 'PRIMARY';
  if (classNumber >= 6 && classNumber <= 8) return 'MIDDLE';
  if (classNumber >= 9 && classNumber <= 10) return 'SECONDARY';
  if (normalizedSectionName.startsWith('PCMB')) return 'PCMB';
  if (normalizedSectionName.startsWith('PCM') || normalizedSectionName.startsWith('SCI')) return 'PCM';
  if (normalizedSectionName.startsWith('PCB')) return 'PCB';
  if (normalizedSectionName.startsWith('COM')) return 'COMMERCE';
  if (normalizedSectionName.startsWith('HUM')) return 'HUMANITIES';
  return 'PCM';
};

const planEntryForSubject = (plan, subject) => {
  const key = subjectKey(subject);
  const name = normalize(subject.subjectName);
  return plan.find((entry) => entry.keys.includes(key) || entry.keys.includes(name));
};

const normalizeToCapacity = (rows) => {
  if (rows.length === 0) return rows;

  let total = rows.reduce((sum, row) => sum + row.periodsPerWeek, 0);
  const addPriority = [...rows].sort((a, b) => Number(a.isOptional) - Number(b.isOptional) || b.periodsPerWeek - a.periodsPerWeek);
  let addIndex = 0;
  while (total < WEEKLY_CAPACITY) {
    addPriority[addIndex % addPriority.length].periodsPerWeek += 1;
    total += 1;
    addIndex += 1;
  }

  const reducePriority = [...rows].sort((a, b) => Number(b.isOptional) - Number(a.isOptional) || a.periodsPerWeek - b.periodsPerWeek);
  let reduceIndex = 0;
  while (total > WEEKLY_CAPACITY && reducePriority.some((row) => row.periodsPerWeek > 1)) {
    const row = reducePriority[reduceIndex % reducePriority.length];
    if (row.periodsPerWeek > 1) {
      row.periodsPerWeek -= 1;
      total -= 1;
    }
    reduceIndex += 1;
  }

  return rows;
};

const buildRows = ({ schoolId, classId, sectionId = null, className, sectionName = '', subjects }) => {
  const plan = PLANS[getPlanName(className, sectionName)];
  const plannedRows = subjects.map((subject) => {
    const entry = planEntryForSubject(plan, subject);
    const isActivity = ['ACTIVITY', 'LAB'].includes(subject.subjectType);
    return {
      schoolId,
      classId,
      sectionId,
      subjectId: subject.id,
      periodsPerWeek: entry?.periods || (isActivity ? 2 : 4),
      isMandatory: !entry?.isOptional,
      isOptional: Boolean(entry?.isOptional),
    };
  });

  return normalizeToCapacity(plannedRows);
};

const seedSchoolWeeklySlots = async (tx, school) => {
  const classes = await tx.class.findMany({
    where: { schoolId: school.id, deletedAt: null },
    include: {
      classSubjects: { include: { subject: true } },
      sections: {
        where: { deletedAt: null },
        include: { sectionSubjects: { include: { subject: true } } },
        orderBy: { sectionOrder: 'asc' },
      },
    },
    orderBy: { classOrder: 'asc' },
  });

  const rows = [];
  for (const classRow of classes) {
    const classSubjects = classRow.classSubjects.map((item) => item.subject);
    rows.push(...buildRows({
      schoolId: school.id,
      classId: classRow.id,
      className: classRow.className,
      subjects: classSubjects,
    }));

    for (const section of classRow.sections) {
      const sectionSubjects = section.sectionSubjects.map((item) => item.subject);
      rows.push(...buildRows({
        schoolId: school.id,
        classId: classRow.id,
        sectionId: section.id,
        className: classRow.className,
        sectionName: section.sectionName,
        subjects: sectionSubjects.length ? sectionSubjects : classSubjects,
      }));
    }
  }

  await tx.subjectWeeklyRequirement.deleteMany({ where: { schoolId: school.id } });
  if (rows.length > 0) {
    await tx.subjectWeeklyRequirement.createMany({ data: rows, skipDuplicates: true });
  }

  return {
    schoolId: school.id,
    schoolName: school.schoolName,
    classesProcessed: classes.length,
    rowsCreated: rows.length,
  };
};

export const seedCbseWeeklySlots = async () => {
  const schoolCodeArg = process.argv.find((arg) => arg.startsWith('--schoolCode='))?.split('=')[1];
  const schools = await prisma.school.findMany({
    where: schoolCodeArg ? { schoolCode: schoolCodeArg } : {},
    select: { id: true, schoolName: true, schoolCode: true },
    orderBy: { schoolName: 'asc' },
  });

  if (schools.length === 0) {
    throw new Error(schoolCodeArg ? `No school found with schoolCode=${schoolCodeArg}` : 'No schools found');
  }

  const results = [];
  for (const school of schools) {
    const result = await prisma.$transaction((tx) => seedSchoolWeeklySlots(tx, school), { timeout: 30_000 });
    results.push(result);
    console.log(`[cbse-weekly-slots] ${school.schoolName}: ${result.rowsCreated} weekly requirements seeded`);
  }

  return results;
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seedCbseWeeklySlots()
    .catch((error) => {
      console.error('[cbse-weekly-slots] failed', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
