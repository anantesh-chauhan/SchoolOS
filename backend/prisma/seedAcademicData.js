import { PrismaClient } from '@prisma/client';
import {
  CBSE_CLASS_CATALOG,
  DEFAULT_SECTION_NAMES,
  SENIOR_CLASS_CATALOG,
  SENIOR_STREAMS,
  SUBJECT_CODE_BY_NAME,
  getChapterNames,
} from '../src/constants/cbseAcademicSeed.js';

const prisma = new PrismaClient();

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

export const seedAcademicDataForSchool = async (schoolId) => {
  const stats = {
    schoolId,
    created: { classes: 0, sections: 0, subjects: 0, streams: 0, assignments: 0, chapters: 0 },
    existing: { classes: 0, sections: 0, subjects: 0, streams: 0, assignments: 0, chapters: 0 },
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

  return stats;
};

export const seedAcademicData = async () => {
  const schools = await prisma.school.findMany({ select: { id: true, schoolName: true } });
  const results = [];

  for (const school of schools) {
    const result = await seedAcademicDataForSchool(school.id);
    results.push({ schoolName: school.schoolName, ...result });
    console.log(`[academic-seed] ${school.schoolName}:`, JSON.stringify(result));
  }

  return results;
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
