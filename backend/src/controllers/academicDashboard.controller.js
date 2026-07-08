import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';


const toTitleStatus = (status) => {
  const normalized = String(status || 'not_started').toLowerCase();
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'in_progress' || normalized === 'ongoing') return 'In Progress';
  return 'Not Started';
};

const toDbStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase().replace(/\s+/g, '_');
  if (['not_started', 'in_progress', 'completed'].includes(normalized)) return normalized;
  if (normalized === 'ongoing') return 'in_progress';
  return 'not_started';
};

const toProgressStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (normalized === 'IN_PROGRESS') return 'ONGOING';
  if (['NOT_STARTED', 'ONGOING', 'COMPLETED'].includes(normalized)) return normalized;
  return 'NOT_STARTED';
};

const progressCompletion = (status) => {
  if (status === 'COMPLETED') return 100;
  if (status === 'ONGOING') return 50;
  return 0;
};

const mapSubject = (row, teacherName = 'Unassigned') => ({
  id: row.subject.id,
  name: row.subject.subjectName,
  code: row.subject.subjectCode,
  teacher: teacherName,
  icon: row.subject.isLab ? 'Lab' : 'Book',
  status: row.subject.deletedAt ? 'Inactive' : 'Active',
  periodsPerWeek: row.periodsPerWeek || 0,
  room: row.subject.isLab ? 'Lab' : 'Classroom',
});

const mapStudent = (student, subjects) => ({
  id: student.id,
  name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '),
  rollNo: student.rollNumber ? `Roll ${student.rollNumber}` : 'Roll -',
  admissionNo: student.admissionNo || '-',
  gender: student.gender || '-',
  bloodGroup: student.bloodGroup || '-',
  dob: student.dob ? student.dob.toISOString().slice(0, 10) : '-',
  house: '-',
  attendance: '0%',
  status: student.isActive ? 'Present' : 'Absent',
  fatherName: student.fatherName || '-',
  phone: student.parentMobile || student.mobile || '-',
  photo: `https://ui-avatars.com/api/?name=${encodeURIComponent(student.studentFirstName || 'Student')}&background=f8fafc&color=0f172a`,
  subjects: subjects.map((subject) => ({ id: subject.id, name: subject.name })),
});

export const getClassSectionDashboard = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { classId, sectionId } = req.query;

    if (!classId || !sectionId) {
      return res.status(400).json({ success: false, message: 'classId and sectionId are required' });
    }

    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId, deletedAt: null },
      include: { class: true, stream: true },
    });

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found for this school' });
    }

    let subjectRows = await prisma.sectionSubject.findMany({
      where: { sectionId },
      include: { subject: true },
      orderBy: { createdAt: 'asc' },
    });

    if (subjectRows.length === 0) {
      subjectRows = await prisma.classSubject.findMany({
        where: { classId },
        include: { subject: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const subjectIds = subjectRows.map((row) => row.subject.id);
    const assignments = await prisma.teacherAssignment.findMany({
      where: { schoolId, classId, sectionId, subjectId: { in: subjectIds } },
      include: { teacher: true },
    });
    const teacherBySubject = new Map(assignments.map((row) => [row.subjectId, row.teacher?.teacherName || 'Unassigned']));

    const subjects = subjectRows.map((row) => mapSubject(row, teacherBySubject.get(row.subject.id)));

    const students = await prisma.student.findMany({
      where: {
        schoolId,
        className: section.class.className,
        section: section.sectionName,
        isActive: true,
      },
      orderBy: [{ rollNumber: 'asc' }, { studentFirstName: 'asc' }],
    });

    return res.json({
      success: true,
      data: {
        meta: {
          classId,
          sectionId,
          className: section.class.className,
          sectionName: `Section ${section.sectionName}`,
          streamName: section.stream?.name || null,
          classTeacher: 'Unassigned',
          academicSession: new Date().getFullYear().toString(),
          totalStudents: students.length,
          subjectsCount: subjects.length,
          attendancePercent: 0,
        },
        subjects,
        students: students.map((student) => mapStudent(student, subjects)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load class dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getSubjectDashboard = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { classId, sectionId, subjectId } = req.query;

    if (!classId || !sectionId || !subjectId) {
      return res.status(400).json({ success: false, message: 'classId, sectionId and subjectId are required' });
    }

    const [section, subject] = await Promise.all([
      prisma.section.findFirst({ where: { id: sectionId, classId, schoolId, deletedAt: null }, include: { class: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, schoolId, deletedAt: null } }),
    ]);

    if (!section || !subject) {
      return res.status(404).json({ success: false, message: 'Section or subject not found for this school' });
    }

    const sectionSubject = await prisma.sectionSubject.findFirst({ where: { sectionId, subjectId } });
    const classSubject = await prisma.classSubject.findFirst({ where: { classId, subjectId } });
    if (!sectionSubject && !classSubject) {
      return res.status(403).json({ success: false, message: 'Subject is not assigned to this class or section' });
    }

    const [chapters, totalStudents, assignment] = await Promise.all([
      prisma.chapter.findMany({
        where: {
          schoolId,
          classId,
          subjectId,
          deletedAt: null,
          OR: [{ sectionId }, { sectionId: null }],
        },
        orderBy: { chapterNumber: 'asc' },
      }),
      prisma.student.count({
        where: {
          schoolId,
          className: section.class.className,
          section: section.sectionName,
          isActive: true,
        },
      }),
      prisma.teacherAssignment.findFirst({ where: { schoolId, classId, sectionId, subjectId }, include: { teacher: true } }),
    ]);

    const chapterIds = chapters.map((chapter) => chapter.id);
    const [progressRows, resources] = await Promise.all([
      chapterIds.length
        ? prisma.chapterProgress.findMany({
            where: {
              schoolId,
              classId,
              sectionId,
              subjectId,
              chapterId: { in: chapterIds },
            },
            include: { teacher: { select: { teacherName: true } } },
          })
        : [],
      prisma.sectionResource.findMany({
        where: {
          schoolId,
          classId,
          sectionId,
          subjectId,
        },
        select: { id: true, chapterId: true },
      }),
    ]);

    const progressByChapterId = new Map(progressRows.map((row) => [row.chapterId, row]));
    const resourcesByChapterId = resources.reduce((map, resource) => {
      if (resource.chapterId) {
        map.set(resource.chapterId, (map.get(resource.chapterId) || 0) + 1);
      }
      return map;
    }, new Map());

    const mappedChapters = chapters.map((chapter) => ({
      id: chapter.id,
      chapterName: chapter.chapterName,
      chapterNumber: chapter.chapterNumber,
      status: toTitleStatus(progressByChapterId.get(chapter.id)?.status || 'NOT_STARTED'),
      remarks: progressByChapterId.get(chapter.id)?.remarks || '',
      completedAt: progressByChapterId.get(chapter.id)?.completedAt || null,
      lastUpdatedBy: progressByChapterId.get(chapter.id)?.teacher?.teacherName || null,
      estimatedClasses: chapter.estimatedClasses,
      resources: resourcesByChapterId.get(chapter.id) || 0,
      assignments: chapter.assignmentsCount,
      completion: progressCompletion(progressByChapterId.get(chapter.id)?.status || 'NOT_STARTED'),
      updatedAt: progressByChapterId.get(chapter.id)?.updatedAt || chapter.updatedAt,
    }));

    const completedChapters = mappedChapters.filter((chapter) => chapter.status === 'Completed').length;
    const totalChapters = mappedChapters.length;

    return res.json({
      success: true,
      data: {
        meta: {
          classId,
          sectionId,
          className: section.class.className,
          sectionName: `Section ${section.sectionName}`,
          academicSession: new Date().getFullYear().toString(),
          totalStudents,
        },
        subject: {
          id: subject.id,
          name: subject.subjectName,
          teacher: assignment?.teacher?.teacherName || 'Unassigned',
          icon: subject.isLab ? 'Lab' : 'Book',
        },
        chapters: mappedChapters,
        stats: {
          totalChapters,
          completedChapters,
          completionPct: totalChapters === 0 ? 0 : Math.round((completedChapters / totalChapters) * 100),
          upcomingChapters: mappedChapters.filter((chapter) => chapter.status === 'Not Started').length,
          assignments: mappedChapters.reduce((sum, chapter) => sum + Number(chapter.assignments || 0), 0),
          homework: 0,
          resources: resources.length,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load subject dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createChapter = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { subjectId, classId, sectionId = null, chapterName, chapterNumber, status, estimatedClasses } = req.body;

    if (!subjectId || !classId || !chapterName || Number.isNaN(Number(chapterNumber))) {
      return res.status(400).json({ success: false, message: 'classId, subjectId, chapterName and chapterNumber are required' });
    }

    const [subject, classRow, section] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, schoolId, deletedAt: null } }),
      prisma.class.findFirst({ where: { id: classId, schoolId, deletedAt: null } }),
      sectionId ? prisma.section.findFirst({ where: { id: sectionId, classId, schoolId, deletedAt: null } }) : Promise.resolve(null),
    ]);
    if (!subject || !classRow || (sectionId && !section)) {
      return res.status(404).json({ success: false, message: 'Class, section or subject not found for this school' });
    }

    const chapter = await prisma.chapter.create({
      data: {
        schoolId,
        classId,
        sectionId,
        subjectId,
        chapterName: String(chapterName).trim(),
        chapterNumber: Number(chapterNumber),
        status: toDbStatus(status),
        estimatedClasses: Number(estimatedClasses || 4),
      },
    });

    return res.status(201).json({ success: true, data: chapter });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Chapter already exists for this subject' });
    return res.status(500).json({ success: false, message: 'Failed to create chapter', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const updateChapter = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { id } = req.params;
    const existing = await prisma.chapter.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: 'Chapter not found' });

    const chapter = await prisma.chapter.update({
      where: { id },
      data: {
        ...(req.body.chapterName ? { chapterName: String(req.body.chapterName).trim() } : {}),
        ...(req.body.chapterNumber !== undefined ? { chapterNumber: Number(req.body.chapterNumber) } : {}),
        ...(req.body.status && !req.body.sectionId ? { status: toDbStatus(req.body.status) } : {}),
        ...(req.body.estimatedClasses !== undefined ? { estimatedClasses: Number(req.body.estimatedClasses) } : {}),
        ...(req.body.assignmentsCount !== undefined ? { assignmentsCount: Number(req.body.assignmentsCount) } : {}),
      },
    });

    if (req.body.status && req.body.sectionId && existing.classId && existing.subjectId) {
      const section = await prisma.section.findFirst({
        where: { id: req.body.sectionId, schoolId, classId: existing.classId, deletedAt: null },
      });
      if (!section) return res.status(404).json({ success: false, message: 'Section not found for chapter progress update' });

      const status = toProgressStatus(req.body.status);
      await prisma.chapterProgress.upsert({
        where: {
          schoolId_classId_sectionId_subjectId_chapterId: {
            schoolId,
            classId: existing.classId,
            sectionId: req.body.sectionId,
            subjectId: existing.subjectId,
            chapterId: id,
          },
        },
        create: {
          schoolId,
          classId: existing.classId,
          sectionId: req.body.sectionId,
          subjectId: existing.subjectId,
          chapterId: id,
          status,
          remarks: req.body.remarks?.trim() || null,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
        update: {
          status,
          remarks: req.body.remarks?.trim() || null,
          completedAt: status === 'COMPLETED' ? new Date() : null,
        },
      });
    }

    return res.json({ success: true, data: chapter });
  } catch (error) {
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Duplicate chapter name or number for this subject' });
    return res.status(500).json({ success: false, message: 'Failed to update chapter', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const deleteChapter = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { id } = req.params;
    const existing = await prisma.chapter.findFirst({ where: { id, schoolId, deletedAt: null } });
    if (!existing) return res.status(404).json({ success: false, message: 'Chapter not found' });

    await prisma.chapter.update({ where: { id }, data: { deletedAt: new Date() } });
    return res.json({ success: true, message: 'Chapter deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete chapter', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};
