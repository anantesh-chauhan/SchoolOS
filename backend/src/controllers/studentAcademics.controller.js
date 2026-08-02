import prisma from '../config/prisma.client.js';
import * as parentUserIdService from '../services/parentUserId.service.js';
import * as passwordService from '../services/password.service.js';
import * as credentialService from '../services/credential.service.js';
import { formatStudentUserId } from '../services/identity.service.js';
import {
  createStudentAdmission,
  allocateStudentAdmission,
  generateStudentCredentials,
  generateStudentAdmissionPdf,
  promoteStudentAdmission,
  softDeleteStudentAdmission,
  updateStudentAdmission,
} from '../services/studentAdmission.service.js';
import { syncNewStudentFeeAssignments } from '../modules/fees/feeAdvanced.service.js';
import { paginationMeta, parsePagination } from '../utils/pagination.util.js';

export const getMyStudentAcademics = async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, message: 'Only students can access this view' });
    }

    const student = await prisma.student.findFirst({
      where: { id: req.user.studentId || req.user.id, schoolId: req.user.schoolId, isActive: true },
      include: { school: { select: { id: true, schoolName: true } } },
    });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const classRow = await prisma.class.findFirst({
      where: { schoolId: student.schoolId, className: student.className, deletedAt: null },
    });
    const section = classRow
      ? await prisma.section.findFirst({
          where: { schoolId: student.schoolId, classId: classRow.id, sectionName: student.section || '', deletedAt: null },
        })
      : null;

    if (!classRow || !section) {
      return res.json({
        success: true,
        data: { student, school: student.school, subjects: [], resources: [] },
      });
    }

    let subjectRows = await prisma.sectionSubject.findMany({
      where: { sectionId: section.id },
      include: { subject: true },
      orderBy: { createdAt: 'asc' },
    });
    if (subjectRows.length === 0) {
      subjectRows = await prisma.classSubject.findMany({
        where: { classId: classRow.id },
        include: { subject: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    const subjectIds = subjectRows.map((row) => row.subjectId);
    const chapters = await prisma.chapter.findMany({
      where: {
        schoolId: student.schoolId,
        classId: classRow.id,
        subjectId: { in: subjectIds },
        deletedAt: null,
        OR: [{ sectionId: section.id }, { sectionId: null }],
      },
      orderBy: { chapterNumber: 'asc' },
    });
    const progressRows = await prisma.chapterProgress.findMany({
      where: {
        schoolId: student.schoolId,
        classId: classRow.id,
        sectionId: section.id,
        subjectId: { in: subjectIds },
      },
    });
    const progressByChapterId = new Map(progressRows.map((row) => [row.chapterId, row]));

    const resources = await prisma.sectionResource.findMany({
      where: {
        schoolId: student.schoolId,
        classId: classRow.id,
        sectionId: section.id,
        subjectId: { in: subjectIds },
        isVisibleToStudents: true,
      },
      include: {
        subject: { select: { subjectName: true } },
        chapter: { select: { chapterName: true, chapterNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '),
          className: student.className,
          sectionName: student.section,
          rollNumber: student.rollNumber,
        },
        school: student.school,
        subjects: subjectRows.map((row) => {
          const subjectChapters = chapters.filter((chapter) => chapter.subjectId === row.subjectId);
          return {
            subjectId: row.subjectId,
            subjectName: row.subject.subjectName,
            chapters: subjectChapters.map((chapter) => {
              const progress = progressByChapterId.get(chapter.id);
              return {
                chapterId: chapter.id,
                chapterName: chapter.chapterName,
                chapterOrder: chapter.chapterNumber,
                status: progress?.status || 'NOT_STARTED',
                remarks: progress?.remarks || '',
                completedAt: progress?.completedAt || null,
              };
            }),
          };
        }),
        resources,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load student academics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Create a new student
