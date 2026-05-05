import bcryptjs from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const schoolSelect = {
  id: true,
  schoolName: true,
  schoolCode: true,
  logoUrl: true,
  address: true,
  city: true,
  state: true,
  phone: true,
  email: true,
  status: true,
};

const classSelect = {
  id: true,
  className: true,
  classOrder: true,
};

const sectionSelect = {
  id: true,
  sectionName: true,
  sectionOrder: true,
  classId: true,
};

const toFullName = (firstName, lastName) => [firstName, lastName].filter(Boolean).join(' ').trim();

const getStudentProfile = async (studentId) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      schoolId: true,
      admissionNo: true,
      studentFirstName: true,
      studentLastName: true,
      dob: true,
      gender: true,
      mobile: true,
      email: true,
      address: true,
      city: true,
      state: true,
      pincode: true,
      fatherName: true,
      motherName: true,
      parentMobile: true,
      alternateMobile: true,
      parentEmail: true,
      occupation: true,
      className: true,
      section: true,
      rollNumber: true,
      admissionDate: true,
      session: true,
      serialNo: true,
      studentUserId: true,
      parentUserId: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      school: { select: schoolSelect },
    },
  });

  if (!student) return null;

  return {
    ...student,
    name: toFullName(student.studentFirstName, student.studentLastName),
    firstName: student.studentFirstName,
    lastName: student.studentLastName || null,
    role: 'STUDENT',
    profileImage: null,
    classId: null,
    sectionId: null,
  };
};

const getParentProfile = async (studentId) => {
  const student = await getStudentProfile(studentId);
  if (!student) return null;

  return {
    ...student,
    role: 'PARENT',
    name: student.fatherName || 'Parent',
    firstName: student.fatherName || null,
    lastName: null,
  };
};

const getTeacherProfile = async (user) => {
  const baseUser = await getUserProfile(user.id);
  const teacher = await prisma.teacher.findFirst({
    where: {
      schoolId: user.schoolId || undefined,
      OR: [
        { email: user.email },
        { teacherName: user.name },
      ],
    },
    select: {
      id: true,
      teacherName: true,
      email: true,
      phone: true,
      employeeId: true,
      qualification: true,
      specialization: true,
      subjectsHandled: true,
      schoolId: true,
      createdAt: true,
      updatedAt: true,
      school: { select: schoolSelect },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!baseUser) return null;

  return {
    ...baseUser,
    teacherId: teacher?.id || null,
    teacherName: teacher?.teacherName || baseUser.name,
    name: teacher?.teacherName || baseUser.name,
    firstName: (teacher?.teacherName || baseUser.name || '').split(' ')[0] || null,
    lastName: (teacher?.teacherName || baseUser.name || '').split(' ').slice(1).join(' ') || null,
    phone: teacher?.phone || null,
    employeeId: teacher?.employeeId || null,
    qualification: teacher?.qualification || null,
    specialization: teacher?.specialization || null,
    subjectsHandled: teacher?.subjectsHandled || [],
    role: 'TEACHER',
    classId: user.classId || null,
    sectionId: user.sectionId || null,
    isActive: baseUser.isActive,
  };
};

const getUserProfile = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      schoolId: true,
      classId: true,
      sectionId: true,
      contactEmail: true,
      employeeId: true,
      joiningYear: true,
      mustChangePassword: true,
      profileImage: true,
      alternateMobile: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      school: { select: schoolSelect },
      class: { select: classSelect },
      section: { select: sectionSelect },
    },
  });
};

// GET /api/users/me
export const getMyProfile = async (req, res) => {
  try {
    let user = null;
    const canEdit = ['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'TEACHER', 'STAFF'].includes(req.user.role);

    if (req.user.role === 'STUDENT') {
      user = await getStudentProfile(req.user.studentId || req.user.id);
    } else if (req.user.role === 'PARENT') {
      user = await getParentProfile(req.user.studentId || req.user.id);
    } else if (req.user.role === 'TEACHER') {
      user = await getTeacherProfile(req.user);
    } else {
      user = await getUserProfile(req.user.id);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [firstName, ...rest] = String(user.name || '').split(' ');
    const lastName = rest.join(' ');

    res.json({
      success: true,
      data: {
        ...user,
        canEdit,
        firstName: firstName || null,
        lastName: lastName || null,
      },
    });
  } catch (error) {
    console.error('getMyProfile error', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// PUT /api/users/me
export const updateMyProfile = async (req, res) => {
  try {
    const allowedFields = ['firstName', 'lastName', 'address', 'alternateMobile', 'profileImage'];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined && req.body[key] !== null) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    // If firstName/lastName provided, combine into `name` to stay compatible
    if (updates.firstName || updates.lastName) {
      const first = updates.firstName || '';
      const last = updates.lastName || '';
      updates.name = `${first} ${last}`.trim();
      delete updates.firstName;
      delete updates.lastName;
    }

    // Only allow updating specific user fields. Do not touch role, admissionNo, email, classId, parentMobile
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...updates,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        profileImage: true,
        alternateMobile: true,
        updatedAt: true,
      },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('updateMyProfile error', error);
    res.status(500).json({ success: false, message: 'Update failed' });
  }
};

// PUT /api/users/change-password
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both currentPassword and newPassword are required' });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const isMatch = await bcryptjs.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password' });
    }

    const hashed = await bcryptjs.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashed, mustChangePassword: false, updatedAt: new Date() },
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('changePassword error', error);
    res.status(500).json({ success: false, message: 'Password update failed' });
  }
};

// Admin: PUT /api/users/:id
export const adminUpdateUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Admin may update any field; but to be safe, restrict changes to known fields
    const allowedAdminFields = [
      'name',
      'role',
      'classId',
      'admissionNo',
      'parentMobile',
      'isActive',
      'profileImage',
      'alternateMobile',
      'email',
      'contactEmail',
      'employeeId',
      'joiningYear',
      'mustChangePassword',
    ];

    const data = {};
    for (const key of allowedAdminFields) {
      if (req.body[key] !== undefined) data[key] = req.body[key];
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    // If role is being set, ensure it's valid according to enum
    if (data.role) {
      const validRoles = ['PLATFORM_OWNER','SCHOOL_OWNER','ADMIN','TEACHER','PARENT','STUDENT','STAFF'];
      if (!validRoles.includes(data.role)) {
        return res.status(400).json({ success: false, message: 'Invalid role value' });
      }
    }

    const updated = await prisma.user.update({ where: { id: userId }, data, select: { id: true, email: true, name: true, role: true, isActive: true } });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('adminUpdateUser error', error);
    res.status(500).json({ success: false, message: 'Admin update failed' });
  }
};

// GET /api/users?role=STUDENT&classId=...
export const getUsers = async (req, res) => {
  try {
    const filters = {};
    if (req.query.role) filters.role = req.query.role;
    if (req.query.classId) filters.classId = req.query.classId;

    const users = await prisma.user.findMany({ where: filters, select: { id: true, email: true, name: true, role: true, classId: true, profileImage: true, isActive: true } });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error('getUsers error', error);
    res.status(500).json({ success: false, message: 'Failed to fetch users' });
  }
};

export default {
  getMyProfile,
  updateMyProfile,
  changePassword,
  adminUpdateUser,
  getUsers,
};
