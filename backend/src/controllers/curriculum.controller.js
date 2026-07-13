import prisma from '../config/prisma.client.js';

const sessionNow = () => { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-${String(y + 1).slice(-2)}`; };
const audit = (schoolId, actorUserId, action, entityType, entityId, metadata) => prisma.curriculumAuditLog.create({ data: { schoolId, actorUserId, action, entityType, entityId, metadata } });

export const overview = async (req, res) => {
  const schoolId = req.user.schoolId; const academicSession = req.query.session || sessionNow();
  const [classes, subjects, books, chapters, drafts, missingSlots, recent] = await Promise.all([
    prisma.class.count({ where: { schoolId, deletedAt: null } }), prisma.subject.count({ where: { schoolId, deletedAt: null } }),
    prisma.book.count({ where: { schoolId, academicSession, isActive: true } }), prisma.chapter.count({ where: { schoolId, deletedAt: null, OR: [{ academicSession }, { academicSession: null }] } }),
    prisma.curriculumVersion.count({ where: { schoolId, status: 'DRAFT' } }),
    prisma.classSubject.count({ where: { class: { schoolId, deletedAt: null }, OR: [{ periodsPerWeek: null }, { periodsPerWeek: 0 }] } }),
    prisma.curriculumAuditLog.findMany({ where: { schoolId }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);
  const subjectsWithBooks = await prisma.book.groupBy({ by: ['subjectId'], where: { schoolId, academicSession, isActive: true } });
  const subjectsWithChapters = await prisma.chapter.groupBy({ by: ['subjectId'], where: { schoolId, deletedAt: null } });
  return res.json({ success: true, data: { academicSession, stats: { classes, subjects, books, chapters, drafts, missingBooks: Math.max(0, subjects - subjectsWithBooks.length), missingChapters: Math.max(0, subjects - subjectsWithChapters.length), missingWeeklySlots: missingSlots }, recentActivity: recent } });
};

export const listCurricula = async (req, res) => res.json({ success: true, data: await prisma.curriculum.findMany({ where: { schoolId: req.user.schoolId }, include: { versions: { orderBy: { versionNumber: 'desc' } } }, orderBy: { updatedAt: 'desc' } }) });
export const listAcademicContext = async (req, res) => {
  const [classes, subjects] = await Promise.all([
    prisma.class.findMany({ where: { schoolId: req.user.schoolId, deletedAt: null }, include: { sections: { where: { deletedAt: null }, orderBy: { sectionName: 'asc' } } }, orderBy: { classOrder: 'asc' } }),
    prisma.subject.findMany({ where: { schoolId: req.user.schoolId, deletedAt: null }, orderBy: { subjectName: 'asc' } }),
  ]);
  return res.json({ success: true, data: { classes, subjects } });
};
export const createCurriculum = async (req, res) => { try { const row = await prisma.curriculum.create({ data: { schoolId: req.user.schoolId, name: req.body.name, curriculumType: req.body.curriculumType || 'CUSTOM', academicSession: req.body.academicSession || sessionNow(), description: req.body.description || null, versions: { create: { schoolId: req.user.schoolId, versionNumber: 1, status: 'DRAFT', createdById: req.user.id } } }, include: { versions: true } }); await audit(req.user.schoolId, req.user.id, 'CREATE', 'CURRICULUM', row.id); return res.status(201).json({ success: true, data: row }); } catch (e) { return res.status(400).json({ success: false, message: e.code === 'P2002' ? 'Curriculum name already exists for this session' : 'Could not create curriculum' }); } };

export const listPublishers = async (req, res) => res.json({ success: true, data: await prisma.publisher.findMany({ where: { schoolId: req.user.schoolId }, orderBy: { name: 'asc' } }) });
export const savePublisher = async (req, res) => { const row = await prisma.publisher.upsert({ where: { schoolId_name: { schoolId: req.user.schoolId, name: req.body.name.trim() } }, create: { schoolId: req.user.schoolId, name: req.body.name.trim(), website: req.body.website || null }, update: { website: req.body.website || null, isActive: req.body.isActive ?? true } }); await audit(req.user.schoolId, req.user.id, 'UPSERT', 'PUBLISHER', row.id); return res.json({ success: true, data: row }); };
export const listBooks = async (req, res) => res.json({ success: true, data: await prisma.book.findMany({ where: { schoolId: req.user.schoolId, ...(req.query.session ? { academicSession: req.query.session } : {}) }, include: { publisher: true, class: true, subject: true }, orderBy: [{ class: { classOrder: 'asc' } }, { title: 'asc' }] }) });
export const listChapters = async (req, res) => res.json({ success: true, data: await prisma.chapter.findMany({ where: { schoolId: req.user.schoolId, deletedAt: null, ...(req.query.subjectId ? { subjectId: req.query.subjectId } : {}), ...(req.query.classId ? { classId: req.query.classId } : {}) }, include: { subject: true, class: true, book: true, unit: true }, orderBy: [{ teachingOrder: 'asc' }, { chapterNumber: 'asc' }] }) });
export const createUnit = async (req, res) => {
  const [subject, cls, version] = await Promise.all([
    prisma.subject.findFirst({ where: { id: req.body.subjectId, schoolId: req.user.schoolId } }),
    req.body.classId ? prisma.class.findFirst({ where: { id: req.body.classId, schoolId: req.user.schoolId } }) : null,
    req.body.curriculumVersionId ? prisma.curriculumVersion.findFirst({ where: { id: req.body.curriculumVersionId, schoolId: req.user.schoolId, status: 'DRAFT' } }) : null,
  ]);
  if (!subject || (req.body.classId && !cls) || (req.body.curriculumVersionId && !version)) return res.status(400).json({ success: false, message: 'Invalid school-scoped subject, class, or draft version' });
  const row = await prisma.curriculumUnit.create({ data: { schoolId: req.user.schoolId, curriculumVersionId: version?.id, subjectId: subject.id, classId: cls?.id, name: req.body.name, displayOrder: Number(req.body.displayOrder || 0), description: req.body.description || null } });
  await audit(req.user.schoolId, req.user.id, 'CREATE', 'UNIT', row.id);
  return res.status(201).json({ success: true, data: row });
};
export const createBook = async (req, res) => {
  const [cls, subject, publisher, version] = await Promise.all([
    prisma.class.findFirst({ where: { id: req.body.classId, schoolId: req.user.schoolId } }),
    prisma.subject.findFirst({ where: { id: req.body.subjectId, schoolId: req.user.schoolId } }),
    req.body.publisherId ? prisma.publisher.findFirst({ where: { id: req.body.publisherId, schoolId: req.user.schoolId } }) : null,
    req.body.curriculumVersionId ? prisma.curriculumVersion.findFirst({ where: { id: req.body.curriculumVersionId, schoolId: req.user.schoolId, status: 'DRAFT' } }) : null,
  ]);
  if (!cls || !subject || (req.body.publisherId && !publisher) || (req.body.curriculumVersionId && !version)) return res.status(400).json({ success: false, message: 'Invalid school-scoped class, subject, publisher, or draft version' });
  const row = await prisma.book.create({ data: { schoolId: req.user.schoolId, curriculumVersionId: version?.id, classId: cls.id, subjectId: subject.id, publisherId: publisher?.id, title: req.body.title, author: req.body.author || null, edition: req.body.edition || null, isbn: req.body.isbn || null, academicSession: req.body.academicSession || sessionNow(), board: req.body.board || 'CUSTOM', resourceSource: req.body.resourceSource || null, resourcePreference: req.body.resourcePreference || 'SCHOOL_ONLY' } });
  await audit(req.user.schoolId, req.user.id, 'CREATE', 'BOOK', row.id);
  return res.status(201).json({ success: true, data: row });
};

export const createChapter = async (req, res) => {
  const [subject, cls, book, unit, version] = await Promise.all([
    prisma.subject.findFirst({ where: { id: req.body.subjectId, schoolId: req.user.schoolId } }),
    req.body.classId ? prisma.class.findFirst({ where: { id: req.body.classId, schoolId: req.user.schoolId } }) : null,
    req.body.bookId ? prisma.book.findFirst({ where: { id: req.body.bookId, schoolId: req.user.schoolId } }) : null,
    req.body.unitId ? prisma.curriculumUnit.findFirst({ where: { id: req.body.unitId, schoolId: req.user.schoolId } }) : null,
    req.body.curriculumVersionId ? prisma.curriculumVersion.findFirst({ where: { id: req.body.curriculumVersionId, schoolId: req.user.schoolId, status: 'DRAFT' } }) : null,
  ]);
  if (!subject || (req.body.classId && !cls) || (req.body.bookId && !book) || (req.body.unitId && !unit) || (req.body.curriculumVersionId && !version)) return res.status(400).json({ success: false, message: 'Invalid school-scoped subject, class, book, unit, or draft version' });
  const row = await prisma.chapter.create({ data: { schoolId: req.user.schoolId, curriculumVersionId: version?.id, subjectId: subject.id, classId: cls?.id, chapterName: req.body.chapterName, chapterNumber: Number(req.body.chapterNumber), teachingOrder: Number(req.body.teachingOrder || req.body.chapterNumber), estimatedClasses: Number(req.body.estimatedClasses || 4), academicSession: req.body.academicSession || sessionNow(), description: req.body.description || null, learningObjectives: req.body.learningObjectives || undefined, publicationStatus: req.body.publicationStatus || 'DRAFT', bookId: book?.id, unitId: unit?.id, resourcePreference: req.body.resourcePreference || null } });
  await audit(req.user.schoolId, req.user.id, 'CREATE', 'CHAPTER', row.id);
  return res.status(201).json({ success: true, data: row });
};
export const reorderChapters = async (req, res) => { const ids = req.body.items?.map((x) => x.id) || []; const owned = await prisma.chapter.count({ where: { schoolId: req.user.schoolId, id: { in: ids } } }); if (owned !== ids.length) return res.status(403).json({ success: false, message: 'One or more chapters are outside your school' }); await prisma.$transaction(req.body.items.map((item, index) => prisma.chapter.update({ where: { id: item.id }, data: { teachingOrder: Number(item.teachingOrder ?? index + 1), chapterNumber: Number(item.chapterNumber ?? index + 1) } }))); return res.json({ success: true, message: 'Chapter order updated' }); };

export const publishCurriculum = async (req, res) => { const version = await prisma.curriculumVersion.findFirst({ where: { id: req.body.versionId, schoolId: req.user.schoolId, status: 'DRAFT' }, include: { curriculum: true, books: true, chapters: true } }); if (!version) return res.status(404).json({ success: false, message: 'Draft curriculum version not found' }); const missing = []; if (!version.books.length) missing.push('No books configured'); if (!version.chapters.length) missing.push('No chapters configured'); const slotMissing = await prisma.classSubject.count({ where: { class: { schoolId: req.user.schoolId }, OR: [{ periodsPerWeek: null }, { periodsPerWeek: 0 }] } }); if (slotMissing) missing.push(`${slotMissing} subject assignments are missing weekly slots`); if (missing.length) return res.status(409).json({ success: false, message: 'Curriculum validation failed', data: { warnings: missing } }); await prisma.$transaction([prisma.curriculumVersion.updateMany({ where: { curriculumId: version.curriculumId, status: 'PUBLISHED' }, data: { status: 'ARCHIVED', archivedAt: new Date() } }), prisma.curriculumVersion.update({ where: { id: version.id }, data: { status: 'PUBLISHED', publishedAt: new Date(), publishedById: req.user.id } })]); await audit(req.user.schoolId, req.user.id, 'PUBLISH', 'CURRICULUM_VERSION', version.id); return res.json({ success: true, message: 'Curriculum published' }); };
export const curriculumAudit = async (req, res) => res.json({ success: true, data: await prisma.curriculumAuditLog.findMany({ where: { schoolId: req.user.schoolId }, orderBy: { createdAt: 'desc' }, take: 200 }) });
