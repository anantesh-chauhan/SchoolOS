import bcryptjs from 'bcryptjs';
import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import {
  formatStaffUserId,
  formatTeacherUserId,
  generateInitialPassword,
  normalize,
} from '../services/identity.service.js';


const toYear = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const resolveSchool = async (req) => {
  const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, schoolCode: true },
  });

  if (!school) {
    const error = new Error('School not found');
    error.statusCode = 404;
    throw error;
  }

  return school;
};

const buildUserPayload = async ({ role, firstName, lastName, employeeId, joiningYear, contactEmail, phone, schoolCode, schoolId }) => {
  const plainPassword = generateInitialPassword(firstName);
  const password = await bcryptjs.hash(plainPassword, 10);

  const loginId =
    role === 'TEACHER'
      ? formatTeacherUserId({ firstName, lastName, employeeId, joiningYear, schoolCode })
      : formatStaffUserId({ firstName, role, employeeId, schoolCode });

  return {
    loginId,
    plainPassword,
    userData: {
      email: loginId,
      password,
      name: `${String(firstName || '').trim()} ${String(lastName || '').trim()}`.trim(),
      role,
      schoolId,
      contactEmail: contactEmail || null,
      alternateMobile: phone || null,
      employeeId,
      joiningYear,
      mustChangePassword: true,
    },
  };
};

export const createTeacherUser = async (req, res) => {
  try {
    const { firstName, lastName, employeeId, joiningYear, email, phone } = req.body;
    if (!firstName || !lastName || !employeeId || !joiningYear || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'firstName, lastName, employeeId, joiningYear, email and phone are required',
      });
    }

    const school = await resolveSchool(req);
    const normalizedEmployeeId = normalize(employeeId).toUpperCase();
    const year = toYear(joiningYear);

    if (!year) {
      return res.status(400).json({ success: false, message: 'joiningYear must be a valid year' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const login = await buildUserPayload({
        role: 'TEACHER',
        firstName,
        lastName,
        employeeId: normalizedEmployeeId,
        joiningYear: year,
        contactEmail: String(email).trim().toLowerCase(),
        phone: String(phone).trim(),
        schoolCode: school.schoolCode,
        schoolId: school.id,
      });

      const user = await tx.user.create({ data: login.userData });

      const teacher = await tx.teacher.create({
        data: {
          schoolId: school.id,
          teacherName: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
          email: String(email).trim().toLowerCase(),
          phone: String(phone).trim(),
          employeeId: normalizedEmployeeId,
          joiningYear: year,
          qualification: null,
          specialization: null,
          subjectsHandled: [],
        },
      });

      return { user, teacher, plainPassword: login.plainPassword };
    });

    return res.status(201).json({
      success: true,
      message: 'Teacher created successfully',
      data: {
        user: result.user,
        teacher: result.teacher,
        loginId: result.user.email,
        password: result.plainPassword,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Teacher login ID, employee ID, or contact email already exists for this school',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create teacher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createStaffUser = async (req, res) => {
  try {
    const { firstName, employeeId, email, phone } = req.body;
    if (!firstName || !employeeId || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'firstName, employeeId, email and phone are required',
      });
    }

    const school = await resolveSchool(req);
    const normalizedEmployeeId = normalize(employeeId).toUpperCase();

    const result = await prisma.$transaction(async (tx) => {
      const login = await buildUserPayload({
        role: 'STAFF',
        firstName,
        lastName: '',
        employeeId: normalizedEmployeeId,
        joiningYear: null,
        contactEmail: String(email).trim().toLowerCase(),
        phone: String(phone).trim(),
        schoolCode: school.schoolCode,
        schoolId: school.id,
      });

      const user = await tx.user.create({ data: login.userData });
      return { user, plainPassword: login.plainPassword };
    });

    return res.status(201).json({
      success: true,
      message: 'Staff created successfully',
      data: {
        user: result.user,
        loginId: result.user.email,
        password: result.plainPassword,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }

    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Staff login ID, employee ID, or contact email already exists for this school',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create staff',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createCurriculumManagerUser = async (req, res) => {
  try {
    const { firstName, lastName, employeeId, email, phone } = req.body;
    if (!firstName || !employeeId || !email || !phone) {
      return res.status(400).json({ success: false, message: 'firstName, employeeId, email and phone are required' });
    }

    const school = await resolveSchool(req);
    const normalizedEmployeeId = normalize(employeeId).toUpperCase();
    const login = await buildUserPayload({
      role: 'CURRICULUM_MANAGER', firstName, lastName: lastName || '', employeeId: normalizedEmployeeId,
      joiningYear: null, contactEmail: String(email).trim().toLowerCase(), phone: String(phone).trim(),
      schoolCode: school.schoolCode, schoolId: school.id,
    });
    const user = await prisma.user.create({ data: login.userData });
    return res.status(201).json({
      success: true,
      message: 'Curriculum Manager account created successfully',
      data: { user, loginId: user.email, password: login.plainPassword, mustChangePassword: true },
    });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Login ID, employee ID, or contact email already exists' });
    return res.status(500).json({ success: false, message: 'Failed to create Curriculum Manager account', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const createFeeManagerUser = async (req, res) => {
  try {
    const { firstName, lastName, employeeId, email, phone } = req.body;
    if (!firstName || !employeeId || !email || !phone) return res.status(400).json({ success: false, message: 'firstName, employeeId, email and phone are required' });
    const school = await resolveSchool(req);
    const normalizedEmployeeId = normalize(employeeId).toUpperCase();
    const login = await buildUserPayload({ role: 'FEE_MANAGER', firstName, lastName: lastName || '', employeeId: normalizedEmployeeId, joiningYear: null, contactEmail: String(email).trim().toLowerCase(), phone: String(phone).trim(), schoolCode: school.schoolCode, schoolId: school.id });
    const user = await prisma.user.create({ data: login.userData });
    return res.status(201).json({ success: true, message: 'Fee Manager account created successfully', data: { user, loginId: user.email, password: login.plainPassword, mustChangePassword: true } });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Login ID, employee ID, or contact email already exists' });
    return res.status(500).json({ success: false, message: 'Failed to create Fee Manager account', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const createExaminationRoleUser = async (req, res) => {
  try {
    const role = String(req.body.role || '').toUpperCase();
    if (!['PRINCIPAL', 'EXAM_COORDINATOR'].includes(role)) return res.status(422).json({ success: false, message: 'Role must be PRINCIPAL or EXAM_COORDINATOR' });
    const { firstName, lastName, employeeId, email, phone } = req.body;
    if (!firstName || !employeeId || !email || !phone) return res.status(400).json({ success: false, message: 'firstName, employeeId, email and phone are required' });
    const school = await resolveSchool(req);
    const login = await buildUserPayload({ role, firstName, lastName: lastName || '', employeeId: normalize(employeeId).toUpperCase(), joiningYear: null, contactEmail: String(email).trim().toLowerCase(), phone: String(phone).trim(), schoolCode: school.schoolCode, schoolId: school.id });
    const user = await prisma.user.create({ data: login.userData });
    return res.status(201).json({ success: true, message: `${role.replaceAll('_', ' ')} account created successfully`, data: { user, loginId: user.email, password: login.plainPassword, mustChangePassword: true } });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'Login ID, employee ID, or contact email already exists' });
    return res.status(500).json({ success: false, message: 'Failed to create examination role account', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};
