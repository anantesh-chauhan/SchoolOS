import { PrismaClient } from '@prisma/client';
import { getChapterEntries } from '../src/constants/cbseAcademicSeed.js';

const prisma = new PrismaClient();

const buildResourceRows = ({ schoolId, classRow, section, subject, chapter, entry }) => ([
  {
    schoolId,
    classId: classRow.id,
    sectionId: section.id,
    subjectId: subject.id,
    chapterId: chapter.id,
    title: `${entry.chapterName} - NCERT PDF`,
    description: entry.ncertBookTitle || 'Official NCERT textbook chapter PDF.',
    resourceType: 'PDF',
    fileUrl: entry.ncertPdfUrl,
    externalUrl: null,
    isVisibleToStudents: true,
  },
  {
    schoolId,
    classId: classRow.id,
    sectionId: section.id,
    subjectId: subject.id,
    chapterId: chapter.id,
    title: `${entry.chapterName} - CBSE Curriculum`,
    description: 'CBSE Academic curriculum and syllabus reference for 2026-27.',
    resourceType: 'LINK',
    fileUrl: null,
    externalUrl: entry.cbseCurriculumUrl,
    isVisibleToStudents: true,
  },
  {
    schoolId,
    classId: classRow.id,
    sectionId: section.id,
    subjectId: subject.id,
    chapterId: chapter.id,
    title: `${entry.chapterName} - DIKSHA Resources`,
    description: 'Official DIKSHA search for videos, practice and learning resources.',
    resourceType: 'LINK',
    fileUrl: null,
    externalUrl: entry.dikshaSearchUrl,
    isVisibleToStudents: true,
  },
]);

const seedOfficialChapterResources = async () => {
  const schools = await prisma.school.findMany({ select: { id: true, schoolName: true } });
  const totals = [];

  for (const school of schools) {
    let created = 0;
    const classes = await prisma.class.findMany({
      where: { schoolId: school.id, deletedAt: null, className: 'Class 10' },
      include: { sections: { where: { deletedAt: null } } },
    });

    for (const classRow of classes) {
      const subjects = await prisma.subject.findMany({
        where: { schoolId: school.id, deletedAt: null, subjectName: { in: ['Mathematics', 'Science', 'English'] } },
      });

      for (const subject of subjects) {
        const entries = getChapterEntries({ className: classRow.className, subjectName: subject.subjectName })
          .filter((entry) => entry.ncertPdfUrl);
        if (entries.length === 0) continue;

        const chapters = await prisma.chapter.findMany({
          where: { schoolId: school.id, classId: classRow.id, subjectId: subject.id, deletedAt: null },
          select: { id: true, chapterNumber: true },
        });
        const chapterByNumber = new Map(chapters.map((chapter) => [chapter.chapterNumber, chapter]));

        for (const section of classRow.sections) {
          const existingResources = await prisma.sectionResource.findMany({
            where: {
              schoolId: school.id,
              classId: classRow.id,
              sectionId: section.id,
              subjectId: subject.id,
              chapterId: { in: chapters.map((chapter) => chapter.id) },
            },
            select: { chapterId: true, title: true },
          });
          const existingKeys = new Set(existingResources.map((resource) => `${resource.chapterId}:${resource.title}`));
          const rows = [];

          for (const entry of entries) {
            const chapter = chapterByNumber.get(entry.chapterNumber);
            if (!chapter) continue;

            for (const row of buildResourceRows({ schoolId: school.id, classRow, section, subject, chapter, entry })) {
              const key = `${row.chapterId}:${row.title}`;
              if (existingKeys.has(key)) continue;
              existingKeys.add(key);
              rows.push(row);
            }
          }

          if (rows.length > 0) {
            await prisma.sectionResource.createMany({ data: rows });
            created += rows.length;
          }
        }
      }
    }

    totals.push({ schoolName: school.schoolName, created });
    console.log(`[official-resource-seed] ${school.schoolName}: created ${created}`);
  }

  return totals;
};

seedOfficialChapterResources()
  .catch((error) => {
    console.error('[official-resource-seed] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
