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

// Validation rules for creating a student
const validateStudentData = (data) => {
  const errors = {};
  const studentFirstName = data.studentFirstName || data.firstName;
  const currentClass = data.currentClass || data.className || data.studentClass;
  const fatherName = data.fatherName || data.father_name || data.parentName;
  const parentMobile = data.parentMobile || data.parent_mobile || data.mobile;
  const session = data.session || data.academicSession;

  // Required fields
  if (!studentFirstName || !String(studentFirstName).trim()) {
    errors.studentFirstName = 'Student first name is required';
  }
  if (!data.dob) {
    errors.dob = 'Date of birth is required';
  }
  if (!data.gender || !data.gender.trim()) {
    errors.gender = 'Gender is required';
  }
  if (!(currentClass && String(currentClass).trim())) {
    errors.currentClass = 'Current class is required';
  }
  if (!fatherName || !String(fatherName).trim()) {
    errors.fatherName = 'Father name is required';
  }
  if (!parentMobile || !String(parentMobile).trim()) {
    errors.parentMobile = 'Parent mobile is required';
  } else if (!/^\d{10}$/.test(String(parentMobile).replace(/\D/g, ''))) {
    errors.parentMobile = 'Parent mobile must be exactly 10 digits';
  }
  if (data.mobile && !/^\d{10}$/.test(String(data.mobile).replace(/\D/g, ''))) {
    errors.mobile = 'Mobile must be exactly 10 digits';
  }
  if (data.alternateMobile && !/^\d{10}$/.test(String(data.alternateMobile).replace(/\D/g, ''))) {
    errors.alternateMobile = 'Alternate mobile must be exactly 10 digits';
  }
  if (!session || !String(session).trim()) {
    errors.session = 'Session is required';
  }

  return errors;
};

export const createStudent = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.body.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID is required',
      });
    }

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create student admissions',
      });
    }

    const validationErrors = validateStudentData(req.body);
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing',
        errors: validationErrors,
      });
    }

    const result = await createStudentAdmission({
      schoolId,
      payload: req.body,
    });
    let feeAllocation = { assignments: 0, chargesCreated: 0 };
    try {
      feeAllocation = await syncNewStudentFeeAssignments(req, result.student);
    } catch (feeError) {
      console.error('Student created, but automatic fee allocation failed:', feeError);
      feeAllocation = { assignments: 0, chargesCreated: 0, warning: 'Fee allocation requires retry by fee staff' };
    }

    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        id: result.student.id,
        student: result.student,
        credentials: result.credentials,
        feeAllocation,
        pdfUrl: `/api/students/${result.student.id}/pdf`,
      },
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create student',
      error: error.errors || error.message,
    });
  }
};

// Get all students (paginated)
export const getStudents = async (req, res) => {
  try {
    const { session, includeInactive = 'false' } = req.query;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID is required',
      });
    }

    const skip = (page - 1) * limit;

    const where = { schoolId };
    if (session) {
      where.session = session;
    }

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const students = await prisma.student.findMany({
      where,
      skip,
      take: limit,
      select: {
        id: true,
        admissionNo: true,
        studentFirstName: true,
        studentLastName: true,
        rollNumber: true,
        className: true,
        section: true,
        session: true,
        isActive: true,
        createdAt: true,
        school: { select: { id: true, schoolName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.student.count({ where });

    return res.status(200).json({
      success: true,
      data: students,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message,
    });
  }
};

export const getStudentAllocationRoster = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId || !['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Only school administrators can manage allocations' });
    }

    const paging = parsePagination(req.query);
    const status = String(req.query.status || 'ALL').toUpperCase();
    const search = String(req.query.search || '').trim().slice(0, 100);
    const where = {
      schoolId,
      isActive: true,
      ...(req.query.session ? { session: String(req.query.session) } : {}),
      ...(status === 'PENDING' ? { OR: [{ section: null }, { rollNumber: null }] } : {}),
      ...(status === 'ALLOCATED' ? { section: { not: null }, rollNumber: { not: null } } : {}),
      ...(search ? {
        AND: [{ OR: [
          { studentFirstName: { contains: search, mode: 'insensitive' } },
          { studentLastName: { contains: search, mode: 'insensitive' } },
          { admissionNo: { contains: search, mode: 'insensitive' } },
          { studentUserId: { contains: search, mode: 'insensitive' } },
        ] }],
      } : {}),
    };

    const [students, total, pending, allocated] = await Promise.all([
      prisma.student.findMany({
      where,
      select: {
        id: true,
        admissionNo: true,
        studentFirstName: true,
        studentLastName: true,
        studentUserId: true,
        parentUserId: true,
        className: true,
        section: true,
        rollNumber: true,
        session: true,
        createdAt: true,
      },
      orderBy: [{ className: 'asc' }, { section: 'asc' }, { createdAt: 'asc' }],
      skip: paging.skip,
      take: paging.take,
    }),
      prisma.student.count({ where }),
      prisma.student.count({ where: { schoolId, isActive: true, OR: [{ section: null }, { rollNumber: null }] } }),
      prisma.student.count({ where: { schoolId, isActive: true, section: { not: null }, rollNumber: { not: null } } }),
    ]);

    return res.json({
      success: true,
      data: students,
      pagination: paginationMeta({ ...paging, total }),
      summary: { pending, allocated, total: pending + allocated },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load student allocation roster', error: error.message });
  }
};

export const allocateStudent = async (req, res) => {
  try {
    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Only school administrators can allocate students' });
    }
    const { classId, sectionId, session } = req.body;
    if (!classId || !sectionId) {
      return res.status(400).json({ success: false, message: 'Class and section are required' });
    }

    const student = await allocateStudentAdmission({
      id: req.params.id,
      schoolId: req.user.schoolId,
      classId,
      sectionId,
      session,
    });
    return res.json({
      success: true,
      message: `Student allocated to ${student.className} - ${student.section} with roll number ${student.rollNumber}`,
      data: student,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to allocate student' });
  }
};

// Get student by ID
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        school: {
          select: {
            id: true,
            schoolName: true,
          },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if user has access to this school's data
    if (student.schoolId !== schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch student',
      error: error.message,
    });
  }
};

// Update student
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;
    const student = await updateStudentAdmission({
      id,
      schoolId,
      role: req.user?.role,
      actorStudentId: req.user?.studentId,
      payload: req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student,
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message,
    });
  }
};

// Delete student
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can deactivate students',
      });
    }

    await softDeleteStudentAdmission({ id, schoolId });

    return res.status(200).json({
      success: true,
      message: 'Student deactivated and section roll numbers resequenced successfully',
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message,
    });
  }
};

// Generate serial number for student
