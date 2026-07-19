import prisma from '../config/prisma.client.js';
import {
  CBSE_CLASS_CATALOG,
  SENIOR_STREAMS,
  SUBJECT_CODE_BY_NAME,
  OFFICIAL_RESOURCE_LINKS,
  getChapterEntries,
} from '../constants/cbseAcademicSeed.js';
import { ensureSchoolSecurityCurriculumDefaults } from './schoolSecurityCurriculumSeed.service.js';

const SECTION_NAMES = ['A', 'B', 'C'];
const seniorSubjects = [...new Set(SENIOR_STREAMS.flatMap((stream) => stream.subjects))];
const classTemplates = [
  ...CBSE_CLASS_CATALOG,
  { className: 'Class 11', classOrder: 14, subjects: seniorSubjects },
  { className: 'Class 12', classOrder: 15, subjects: seniorSubjects },
];

const codeFor = (name) => SUBJECT_CODE_BY_NAME[name] || String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '_');

const normalizeSectionNames = (values) => {
  const names = [...new Set((Array.isArray(values) && values.length ? values : SECTION_NAMES)
    .map((value) => String(value || '').trim().toUpperCase())
    .filter(Boolean))];
  if (!names.length || names.length > 8) throw new Error('Provide between 1 and 8 section names');
  return names;
};

export const initializeNewSchoolAcademicSetup = async (schoolId, options = {}) => {
  const sectionNames = normalizeSectionNames(options.sectionNames);
  const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } });
  if (!school) throw new Error('School not found for academic initialization');

  const existingClasses = await prisma.class.count({ where: { schoolId, deletedAt: null } });
  await prisma.class.createMany({ data: classTemplates.map(({ className, classOrder }) => ({ schoolId, className, classOrder })), skipDuplicates: true });
  const classes = await prisma.class.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, className: true, classOrder: true } });

  await prisma.section.createMany({
    data: classes.flatMap((classRow) => sectionNames.map((sectionName, index) => ({ schoolId, classId: classRow.id, sectionName, sectionOrder: index + 1 }))),
    skipDuplicates: true,
  });
  const sections = await prisma.section.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, classId: true, sectionName: true } });

  const subjectNames = [...new Set(classTemplates.flatMap((row) => row.subjects))];
  await prisma.subject.createMany({
    data: subjectNames.map((subjectName, index) => ({ schoolId, subjectName, subjectCode: codeFor(subjectName), displayOrder: index + 1, subjectType: ['Art & Craft', 'General Activities', 'Physical Education'].includes(subjectName) ? 'ACTIVITY' : 'CORE' })),
    skipDuplicates: true,
  });
  const subjects = await prisma.subject.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, subjectName: true } });
  const subjectByName = new Map(subjects.map((subject) => [subject.subjectName, subject]));
  const classByName = new Map(classes.map((row) => [row.className, row]));

  const classSubjectRows = classTemplates.flatMap((template) => template.subjects.map((name) => ({ classId: classByName.get(template.className).id, subjectId: subjectByName.get(name).id })));
  await prisma.classSubject.createMany({ data: classSubjectRows, skipDuplicates: true });
  const subjectsByClassId = new Map();
  classSubjectRows.forEach((row) => subjectsByClassId.set(row.classId, [...(subjectsByClassId.get(row.classId) || []), row.subjectId]));
  await prisma.sectionSubject.createMany({ data: sections.flatMap((section) => (subjectsByClassId.get(section.classId) || []).map((subjectId) => ({ sectionId: section.id, subjectId }))), skipDuplicates: true });

  const chapterRows = classTemplates.flatMap((template) => template.subjects.flatMap((subjectName) => {
    const classRow = classByName.get(template.className); const subject = subjectByName.get(subjectName);
    return getChapterEntries({ className: template.className, subjectName }).map((entry) => ({ schoolId, classId: classRow.id, sectionId: null, subjectId: subject.id, chapterName: entry.chapterName, chapterNumber: entry.chapterNumber, status: 'not_started', estimatedClasses: 4 }));
  }));
  const existingChapterRows = await prisma.chapter.findMany({ where: { schoolId, deletedAt: null }, select: { classId: true, subjectId: true, chapterNumber: true } });
  const existingChapterKeys = new Set(existingChapterRows.map((row) => `${row.classId}:${row.subjectId}:${row.chapterNumber}`));
  await prisma.chapter.createMany({ data: chapterRows.filter((row) => !existingChapterKeys.has(`${row.classId}:${row.subjectId}:${row.chapterNumber}`)), skipDuplicates: true });
  const chapters = await prisma.chapter.findMany({ where: { schoolId, deletedAt: null }, select: { id: true, classId: true, subjectId: true, chapterNumber: true, chapterName: true } });

  const commonResources = [];
  for (const section of sections) {
    for (const subjectId of subjectsByClassId.get(section.classId) || []) {
      commonResources.push(
        { schoolId, classId: section.classId, sectionId: section.id, subjectId, chapterId: null, title: 'NCERT Textbook Library', description: 'Official NCERT textbook catalogue for this subject.', resourceType: 'LINK', externalUrl: OFFICIAL_RESOURCE_LINKS.ncertTextbooks, isVisibleToStudents: true },
        { schoolId, classId: section.classId, sectionId: section.id, subjectId, chapterId: null, title: 'CBSE Curriculum Reference', description: 'Official CBSE curriculum and syllabus reference.', resourceType: 'LINK', externalUrl: OFFICIAL_RESOURCE_LINKS.cbseCurriculum, isVisibleToStudents: true },
      );
    }
  }
  await prisma.sectionResource.deleteMany({ where: { schoolId, teacherId: null, OR: [{ title: 'NCERT Textbook Library' }, { title: 'CBSE Curriculum Reference' }, { title: { endsWith: ' - DIKSHA Learning Resources' } }] } });
  await prisma.sectionResource.createMany({ data: commonResources });

  const chapterResources = [];
  const sectionsByClassId = new Map();
  sections.forEach((section) => sectionsByClassId.set(section.classId, [...(sectionsByClassId.get(section.classId) || []), section]));
  for (const chapter of chapters) {
    for (const section of sectionsByClassId.get(chapter.classId) || []) {
      chapterResources.push({ schoolId, classId: chapter.classId, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id, title: `${chapter.chapterName} - DIKSHA Learning Resources`, description: 'Curated search on the Government of India DIKSHA learning platform.', resourceType: 'LINK', externalUrl: `https://diksha.gov.in/search?query=${encodeURIComponent(chapter.chapterName)}`, isVisibleToStudents: true });
    }
  }
  await prisma.sectionResource.createMany({ data: chapterResources });

  const securityCurriculumCalendar = await ensureSchoolSecurityCurriculumDefaults(schoolId);
  return { schoolId, template: 'CBSE_NURSERY_TO_12', editable: true, alreadyInitialized: existingClasses > 0, repaired: existingClasses > 0, classes: classes.length, sections: sections.length, sectionsPerClass: sectionNames.length, sectionNames, subjects: subjects.length, chapters: chapters.length, resources: commonResources.length + chapterResources.length, securityCurriculumCalendar };
};
