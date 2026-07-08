import prisma from '../config/prisma.client.js';
import {
  assertSameSchool,
  getTeacherForUser,
  isSchoolAdmin,
  requireSchoolAdminOrAssignedTeacher,
  sendAuthorizationError,
} from '../utils/teacherAuthorization.util.js';


const VALID_PROGRESS_STATUSES = new Set(['NOT_STARTED', 'ONGOING', 'COMPLETED']);
const VALID_RESOURCE_TYPES = new Set(['NOTE', 'LINK', 'PDF', 'IMAGE', 'VIDEO', 'ASSIGNMENT', 'OTHER']);

const normalizeProgressStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase().replace(/\s+/g, '_');
  return VALID_PROGRESS_STATUSES.has(normalized) ? normalized : null;
};

const normalizeResourceType = (type) => {
  const normalized = String(type || 'NOTE').trim().toUpperCase();
  return VALID_RESOURCE_TYPES.has(normalized) ? normalized : 'OTHER';
};

const getAccessibleAssignments = async (user) => {
  if (isSchoolAdmin(user)) {
    const rows = await prisma.teacherAssignment.findMany({
      where: { schoolId: user.schoolId, isActive: true },
      include: {
        teacher: true,
        class: true,
        section: true,
        subject: true,
      },
      orderBy: [{ class: { classOrder: 'asc' } }, { section: { sectionOrder: 'asc' } }],
    });
    return { rows, teacher: null };
  }

  const teacher = await getTeacherForUser(user);
  if (!teacher) {
    return { rows: [], teacher: null };
  }

  const rows = await prisma.teacherAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      teacherId: teacher.id,
      isActive: true,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    include: {
      teacher: true,
      class: true,
      section: true,
      subject: true,
    },
    orderBy: [{ class: { classOrder: 'asc' } }, { section: { sectionOrder: 'asc' } }],
  });

  return { rows, teacher };
};

const assignmentWhereOr = (assignments) => assignments.map((item) => ({
  classId: item.classId,
  sectionId: item.sectionId,
  subjectId: item.subjectId,
}));

const countChaptersForAssignment = async (assignment) => prisma.chapter.count({
  where: {
    schoolId: assignment.schoolId,
    classId: assignment.classId,
    subjectId: assignment.subjectId,
    deletedAt: null,
    OR: [{ sectionId: assignment.sectionId }, { sectionId: null }],
  },
});

const mapProgressCounts = (progressRows) => {
  const counts = { NOT_STARTED: 0, ONGOING: 0, COMPLETED: 0 };
  progressRows.forEach((row) => {
    counts[row.status] = (counts[row.status] || 0) + 1;
  });
  return counts;
};

const schoolHeader = async (schoolId) => prisma.school.findUnique({
  where: { id: schoolId },
  select: { id: true, schoolName: true, schoolCode: true },
});

export const getTeacherDashboard = async (req, res) => {
  try {
    assertSameSchool(req.user, req.user.schoolId);
    const { rows: assignments, teacher } = await getAccessibleAssignments(req.user);
    const filters = assignmentWhereOr(assignments);

    const [school, chapterTotals] = await Promise.all([
      schoolHeader(req.user.schoolId),
      Promise.all(assignments.map((assignment) => countChaptersForAssignment(assignment))),
    ]);

    const progressRows = filters.length
      ? await prisma.chapterProgress.findMany({ where: { schoolId: req.user.schoolId, OR: filters } })
      : [];
    const resourceCount = filters.length
      ? await prisma.sectionResource.count({ where: { schoolId: req.user.schoolId, OR: filters } })
      : 0;

    const counts = mapProgressCounts(progressRows);
    const totalChapters = chapterTotals.reduce((sum, value) => sum + value, 0);
    const started = counts.COMPLETED + counts.ONGOING + counts.NOT_STARTED;
    const pendingChapters = Math.max(0, totalChapters - counts.COMPLETED - counts.ONGOING);

    const recentProgress = progressRows
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5)
      .map((row) => ({
        id: row.id,
        type: 'PROGRESS',
        message: `Chapter progress marked ${row.status.replace(/_/g, ' ').toLowerCase()}`,
        createdAt: row.updatedAt,
      }));

    const recentResources = filters.length
      ? await prisma.sectionResource.findMany({
          where: { schoolId: req.user.schoolId, OR: filters },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: { id: true, title: true, updatedAt: true },
        })
      : [];

    return res.json({
      success: true,
      data: {
        teacher: {
          id: teacher?.id || req.user.id,
          name: teacher?.teacherName || req.user.name,
          role: req.user.role,
        },
        school,
        stats: {
          assignedClasses: new Set(assignments.map((item) => item.classId)).size,
          assignedSections: new Set(assignments.map((item) => item.sectionId)).size,
          assignedSubjects: new Set(assignments.map((item) => item.subjectId)).size,
          completedChapters: counts.COMPLETED,
          ongoingChapters: counts.ONGOING,
          pendingChapters,
          totalSharedResources: resourceCount,
          untouchedChapters: Math.max(0, totalChapters - started),
        },
        recentActivity: [
          ...recentProgress,
          ...recentResources.map((row) => ({
            id: row.id,
            type: 'RESOURCE',
            message: `Shared resource: ${row.title}`,
            createdAt: row.updatedAt,
          })),
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6),
      },
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(500).json({ success: false, message: 'Failed to load teacher dashboard', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const getTeacherAssignments = async (req, res) => {
  try {
    const { rows: assignments } = await getAccessibleAssignments(req.user);
    const grouped = new Map();

    for (const assignment of assignments) {
      const totalChapters = await countChaptersForAssignment(assignment);
      const progressRows = await prisma.chapterProgress.findMany({
        where: {
          schoolId: assignment.schoolId,
          classId: assignment.classId,
          sectionId: assignment.sectionId,
          subjectId: assignment.subjectId,
        },
      });
      const counts = mapProgressCounts(progressRows);
      const pendingChapters = Math.max(0, totalChapters - counts.COMPLETED - counts.ONGOING);
      const progressPercentage = totalChapters === 0 ? 0 : Math.round((counts.COMPLETED / totalChapters) * 100);

      if (!grouped.has(assignment.classId)) {
        grouped.set(assignment.classId, {
          classId: assignment.classId,
          className: assignment.class.className,
          sections: new Map(),
        });
      }

      const classGroup = grouped.get(assignment.classId);
      if (!classGroup.sections.has(assignment.sectionId)) {
        classGroup.sections.set(assignment.sectionId, {
          sectionId: assignment.sectionId,
          sectionName: assignment.section.sectionName,
          subjects: [],
        });
      }

      classGroup.sections.get(assignment.sectionId).subjects.push({
        subjectId: assignment.subjectId,
        subjectName: assignment.subject.subjectName,
        roleType: assignment.roleType,
        totalChapters,
        completedChapters: counts.COMPLETED,
        ongoingChapters: counts.ONGOING,
        pendingChapters,
        progressPercentage,
        classId: assignment.classId,
      });
    }

    return res.json({
      success: true,
      data: [...grouped.values()].map((classGroup) => ({
        ...classGroup,
        sections: [...classGroup.sections.values()],
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load teacher assignments', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const getTeacherChapters = async (req, res) => {
  try {
    const { sectionId, subjectId } = req.params;
    const section = await prisma.section.findFirst({
      where: { id: sectionId, schoolId: req.user.schoolId, deletedAt: null },
      include: { class: true },
    });
    if (!section) return res.status(404).json({ success: false, message: 'Section not found' });

    await requireSchoolAdminOrAssignedTeacher(req.user, {
      schoolId: req.user.schoolId,
      classId: section.classId,
      sectionId,
      subjectId,
    });

    const subject = await prisma.subject.findFirst({ where: { id: subjectId, schoolId: req.user.schoolId, deletedAt: null } });
    if (!subject) return res.status(404).json({ success: false, message: 'Subject not found' });

    const chapters = await prisma.chapter.findMany({
      where: {
        schoolId: req.user.schoolId,
        classId: section.classId,
        subjectId,
        deletedAt: null,
        OR: [{ sectionId }, { sectionId: null }],
      },
      orderBy: { chapterNumber: 'asc' },
    });

    const progressRows = await prisma.chapterProgress.findMany({
      where: {
        schoolId: req.user.schoolId,
        classId: section.classId,
        sectionId,
        subjectId,
        chapterId: { in: chapters.map((chapter) => chapter.id) },
      },
      include: { teacher: { select: { id: true, teacherName: true } } },
    });
    const progressByChapterId = new Map(progressRows.map((row) => [row.chapterId, row]));

    return res.json({
      success: true,
      data: {
        meta: {
          classId: section.classId,
          className: section.class.className,
          sectionId,
          sectionName: section.sectionName,
          subjectId,
          subjectName: subject.subjectName,
        },
        chapters: chapters.map((chapter) => {
          const progress = progressByChapterId.get(chapter.id);
          return {
            chapterId: chapter.id,
            chapterName: chapter.chapterName,
            chapterOrder: chapter.chapterNumber,
            status: progress?.status || 'NOT_STARTED',
            remarks: progress?.remarks || '',
            completedAt: progress?.completedAt || null,
            lastUpdatedBy: progress?.teacher?.teacherName || null,
          };
        }),
      },
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(500).json({ success: false, message: 'Failed to load chapters', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const patchTeacherProgress = async (req, res) => {
  try {
    const { classId, sectionId, subjectId, chapterId, remarks } = req.body;
    const status = normalizeProgressStatus(req.body.status);
    if (!classId || !sectionId || !subjectId || !chapterId || !status) {
      return res.status(400).json({ success: false, message: 'classId, sectionId, subjectId, chapterId and valid status are required' });
    }

    const permission = await requireSchoolAdminOrAssignedTeacher(req.user, {
      schoolId: req.user.schoolId,
      classId,
      sectionId,
      subjectId,
    });

    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        schoolId: req.user.schoolId,
        classId,
        subjectId,
        deletedAt: null,
        OR: [{ sectionId }, { sectionId: null }],
      },
    });
    if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found for this class-section-subject' });

    const teacherId = permission.teacher?.id || null;
    const progress = await prisma.chapterProgress.upsert({
      where: {
        schoolId_classId_sectionId_subjectId_chapterId: {
          schoolId: req.user.schoolId,
          classId,
          sectionId,
          subjectId,
          chapterId,
        },
      },
      create: {
        schoolId: req.user.schoolId,
        classId,
        sectionId,
        subjectId,
        chapterId,
        teacherId,
        status,
        remarks: remarks?.trim() || null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      update: {
        teacherId,
        status,
        remarks: remarks?.trim() || null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });

    return res.json({ success: true, data: progress });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(500).json({ success: false, message: 'Failed to update chapter progress', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const getTeacherResources = async (req, res) => {
  try {
    const { rows: assignments } = await getAccessibleAssignments(req.user);
    const filters = assignmentWhereOr(assignments);
    const where = {
      schoolId: req.user.schoolId,
      ...(filters.length ? { OR: filters } : { id: '__none__' }),
      ...(req.query.sectionId ? { sectionId: req.query.sectionId } : {}),
      ...(req.query.subjectId ? { subjectId: req.query.subjectId } : {}),
    };

    const resources = await prisma.sectionResource.findMany({
      where,
      include: {
        class: { select: { className: true } },
        section: { select: { sectionName: true } },
        subject: { select: { subjectName: true } },
        chapter: { select: { chapterName: true, chapterNumber: true } },
        teacher: { select: { id: true, teacherName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: resources });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load resources', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const createTeacherResource = async (req, res) => {
  try {
    const { classId, sectionId, subjectId, chapterId = null, title, description, fileUrl, externalUrl, isVisibleToStudents = true } = req.body;
    if (!classId || !sectionId || !subjectId || !title) {
      return res.status(400).json({ success: false, message: 'classId, sectionId, subjectId and title are required' });
    }

    const permission = await requireSchoolAdminOrAssignedTeacher(req.user, {
      schoolId: req.user.schoolId,
      classId,
      sectionId,
      subjectId,
    });

    if (chapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: chapterId, schoolId: req.user.schoolId, classId, subjectId, deletedAt: null, OR: [{ sectionId }, { sectionId: null }] },
      });
      if (!chapter) return res.status(404).json({ success: false, message: 'Chapter not found for this class-section-subject' });
    }

    const resource = await prisma.sectionResource.create({
      data: {
        schoolId: req.user.schoolId,
        classId,
        sectionId,
        subjectId,
        chapterId,
        teacherId: permission.teacher?.id || null,
        title: title.trim(),
        description: description?.trim() || null,
        resourceType: normalizeResourceType(req.body.resourceType),
        fileUrl: fileUrl?.trim() || null,
        externalUrl: externalUrl?.trim() || null,
        isVisibleToStudents: Boolean(isVisibleToStudents),
      },
    });

    return res.status(201).json({ success: true, data: resource });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(500).json({ success: false, message: 'Failed to create resource', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const updateTeacherResource = async (req, res) => {
  try {
    const resource = await prisma.sectionResource.findFirst({ where: { id: req.params.resourceId, schoolId: req.user.schoolId } });
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });

    const permission = await requireSchoolAdminOrAssignedTeacher(req.user, resource);
    if (!permission.isAdmin && resource.teacherId !== permission.teacher.id) {
      return res.status(403).json({ success: false, message: 'You do not have permission to manage this resource.' });
    }

    const updated = await prisma.sectionResource.update({
      where: { id: resource.id },
      data: {
        ...(req.body.title !== undefined ? { title: String(req.body.title).trim() } : {}),
        ...(req.body.description !== undefined ? { description: String(req.body.description || '').trim() || null } : {}),
        ...(req.body.resourceType !== undefined ? { resourceType: normalizeResourceType(req.body.resourceType) } : {}),
        ...(req.body.fileUrl !== undefined ? { fileUrl: String(req.body.fileUrl || '').trim() || null } : {}),
        ...(req.body.externalUrl !== undefined ? { externalUrl: String(req.body.externalUrl || '').trim() || null } : {}),
        ...(req.body.isVisibleToStudents !== undefined ? { isVisibleToStudents: Boolean(req.body.isVisibleToStudents) } : {}),
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(500).json({ success: false, message: 'Failed to update resource', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const deleteTeacherResource = async (req, res) => {
  try {
    const resource = await prisma.sectionResource.findFirst({ where: { id: req.params.resourceId, schoolId: req.user.schoolId } });
    if (!resource) return res.status(404).json({ success: false, message: 'Resource not found' });

    const permission = await requireSchoolAdminOrAssignedTeacher(req.user, resource);
    if (!permission.isAdmin && resource.teacherId !== permission.teacher.id) {
      return res.status(403).json({ success: false, message: 'You do not have permission to manage this resource.' });
    }

    await prisma.sectionResource.delete({ where: { id: resource.id } });
    return res.json({ success: true, message: 'Resource deleted successfully' });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(500).json({ success: false, message: 'Failed to delete resource', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};
