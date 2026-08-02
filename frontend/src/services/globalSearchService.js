import { ClipboardCheck, GraduationCap, UserRound } from 'lucide-react';
import { feeService } from './feeService';
import { examinationService } from './examinationService';
import { teacherService } from './managementService';

const financeRoles = new Set(['SCHOOL_OWNER', 'ADMIN', 'FEE_MANAGER']);
const teacherDirectoryRoles = new Set(['SCHOOL_OWNER', 'ADMIN']);
const examinationRoles = new Set(['SCHOOL_OWNER', 'ADMIN', 'PRINCIPAL', 'EXAM_COORDINATOR', 'EXAM_CONTROLLER', 'TEACHER', 'CLASS_TEACHER']);

const asArray = (value) => Array.isArray(value) ? value : value?.items || value?.data || value?.examinations || [];

export const globalSearchService = {
  search: async ({ role, query, workspaceId = 'home' }) => {
    const tasks = [];
    if (financeRoles.has(role) && ['home', 'finance', 'students'].includes(workspaceId)) tasks.push(feeService.searchStudents(query).then((rows) => asArray(rows).slice(0, 5).map((student) => ({
      label: `${student.studentFirstName || ''} ${student.studentLastName || ''}`.trim() || student.name,
      description: `${student.admissionNo || 'Student'} · ${student.className || ''}${student.section ? `-${student.section}` : ''}`,
      group: 'Students', href: `/dashboard/fees/students/${student.id}`, icon: GraduationCap,
    }))));
    if (teacherDirectoryRoles.has(role) && ['home', 'staff'].includes(workspaceId)) tasks.push(teacherService.list({ page: 1, limit: 5, search: query }).then((response) => asArray(response).slice(0, 5).map((teacher) => ({
      label: teacher.teacherName || teacher.name, description: teacher.employeeId || teacher.email || 'Teacher',
      group: 'Teachers', href: `/dashboard/admin/teachers?search=${encodeURIComponent(teacher.teacherName || teacher.name || query)}`, icon: UserRound,
    }))));
    if (examinationRoles.has(role) && ['home', 'examinations'].includes(workspaceId)) tasks.push(examinationService.list({ search: query, limit: 5 }).then((response) => asArray(response).filter((exam) => String(exam.name || '').toLowerCase().includes(query.toLowerCase())).slice(0, 5).map((exam) => ({
      label: exam.name, description: exam.academicSession?.name || exam.status || 'Examination',
      group: 'Examinations', href: `/examinations?search=${encodeURIComponent(exam.name)}`, icon: ClipboardCheck,
    }))));
    const settled = await Promise.allSettled(tasks);
    return settled.flatMap((result) => result.status === 'fulfilled' ? result.value : []);
  },
};
