import apiClient from './api';

export const schoolService = {
  list: async ({ page = 1, limit = 10, search = '' }) => {
    const response = await apiClient.get('/schools', { params: { page, limit, search } });
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/schools', payload, { timeout: 240000 });
    return response.data;
  },
  details: async (id) => {
    const response = await apiClient.get(`/schools/${id}`);
    return response.data;
  },
  update: async (id, payload) => {
    const response = await apiClient.patch(`/schools/${id}`, payload);
    return response.data;
  },
  initializeAcademics: async (id) => {
    const response = await apiClient.post(`/schools/${id}/initialize-academics`, {}, { timeout: 120000 });
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/schools/${id}`);
    return response.data;
  },
  getMySchool: async () => {
    const response = await apiClient.get('/school/profile');
    return response.data;
  },
  updateMySchoolBasic: async (payload) => {
    const response = await apiClient.patch('/schools/my-school/basic', payload);
    return response.data;
  },
};

export const classService = {
  list: async () => {
    const response = await apiClient.get('/classes');
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/classes', payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/classes/${id}`);
    return response.data;
  },
};

export const sectionService = {
  list: async (classId) => {
    const response = await apiClient.get('/sections', { params: classId ? { classId } : {} });
    return response.data;
  },
  createNext: async (payload) => {
    const response = await apiClient.post('/sections', payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/sections/${id}`);
    return response.data;
  },
};

export const subjectService = {
  list: async () => {
    const response = await apiClient.get('/subjects');
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/subjects', payload);
    return response.data;
  },
  update: async (id, payload) => {
    const response = await apiClient.put(`/subjects/${id}`, payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/subjects/${id}`);
    return response.data;
  },
  assignToClass: async (payload) => {
    const response = await apiClient.post('/subjects/assign-class', payload);
    return response.data;
  },
  assignToSection: async (payload) => {
    const response = await apiClient.post('/subjects/assign-section', payload);
    return response.data;
  },
  bulkAssignToClass: async (payload) => {
    const response = await apiClient.post('/subjects/assign-class/bulk', payload);
    return response.data;
  },
  unassignFromClass: async (payload) => {
    const response = await apiClient.post('/subjects/unassign-class', payload);
    return response.data;
  },
  unassignFromSection: async (payload) => {
    const response = await apiClient.post('/subjects/unassign-section', payload);
    return response.data;
  },
  classSubjects: async (classId) => {
    const response = await apiClient.get(`/subjects/class/${classId}`);
    return response.data;
  },
  sectionSubjects: async (sectionId) => {
    const response = await apiClient.get(`/subjects/section/${sectionId}`);
    return response.data;
  },
  mappings: async () => {
    const response = await apiClient.get('/subjects/mappings');
    return response.data;
  },
};

export const teacherService = {
  list: async ({ page = 1, limit = 10, search = '', subject = '' } = {}) => {
    const response = await apiClient.get('/teachers', {
      params: { page, limit, search, subject },
    });
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/teachers', payload);
    return response.data;
  },
  update: async (id, payload) => {
    const response = await apiClient.put(`/teachers/${id}`, payload);
    return response.data;
  },
  remove: async (id) => {
    const response = await apiClient.delete(`/teachers/${id}`);
    return response.data;
  },
  workload: async (id) => {
    const response = await apiClient.get(`/teachers/${id}/workload`);
    return response.data;
  },
  sectionAssignmentTable: async ({ classId, sectionId }) => {
    const response = await apiClient.get('/teachers/assignments/section', {
      params: { classId, sectionId },
    });
    return response.data;
  },
  bulkSaveAssignments: async (payload) => {
    const response = await apiClient.post('/teachers/assignments/bulk', payload);
    return response.data;
  },
  summary: async (params = {}) => {
    const response = await apiClient.get('/teachers/assignments/summary', { params });
    return response.data;
  },
  classTeacherAssignments: async (params = {}) => {
    const response = await apiClient.get('/teachers/assignments/class-teachers', { params });
    return response.data;
  },
  saveClassTeacherAssignment: async (payload) => {
    const response = await apiClient.post('/teachers/assignments/class-teachers', payload);
    return response.data;
  },
};

export const attendanceService = {
  metadata: async () => (await apiClient.get('/attendance/metadata')).data,
  updateSettings: async (payload) => (await apiClient.put('/attendance/settings', payload)).data,
  saveStatus: async (payload) => (await apiClient.put('/attendance/statuses', payload)).data,
  studentRoster: async (params = {}) => {
    const response = await apiClient.get('/attendance/students', { params });
    return response.data;
  },
  saveStudentAttendance: async (payload) => {
    const response = await apiClient.post('/attendance/student-register', payload);
    return response.data;
  },
  teacherRoster: async (params = {}) => {
    const response = await apiClient.get('/attendance/teachers', { params });
    return response.data;
  },
  saveTeacherAttendance: async (payload) => {
    const response = await apiClient.post('/attendance/teachers', payload);
    return response.data;
  },
  classMonth: async (params) => {
    const response = await apiClient.get('/attendance/class-month', { params });
    return response.data;
  },
  myAttendance: async (params = {}) => {
    const response = await apiClient.get('/attendance/me', { params });
    return response.data;
  },
  saveCalendarDay: async (payload) => {
    const response = await apiClient.put('/attendance/calendar-day', payload);
    return response.data;
  },
  calendar: async (params) => {
    const response = await apiClient.get('/attendance/calendar', { params });
    return response.data;
  },
  deleteCalendarDay: async (id) => {
    const response = await apiClient.delete(`/attendance/calendar-day/${id}`);
    return response.data;
  },
  classRegister: async (params) => {
    const response = await apiClient.get('/attendance/class-register', { params });
    return response.data;
  },
  teacherRegister: async (params) => {
    const response = await apiClient.get('/attendance/teacher-register', { params });
    return response.data;
  },
  monthlyClassReport: async ({ classId, sectionId, month, ...params }) => (await apiClient.get(`/attendance/students/class/${classId}/section/${sectionId}/month/${month}`, { params })).data,
  studentProfile: async (studentId, params = {}) => (await apiClient.get(`/attendance/students/${studentId}/profile`, { params })).data,
  employeeMonth: async (month, params = {}) => (await apiClient.get(`/attendance/employees/month/${month}`, { params })).data,
  saveEmployeeAttendance: async (payload) => (await apiClient.post('/attendance/employees', payload)).data,
  corrections: async (params = {}) => (await apiClient.get('/attendance/corrections', { params })).data,
  requestCorrection: async (payload) => (await apiClient.post('/attendance/corrections', payload)).data,
  reviewCorrection: async (id, payload) => (await apiClient.patch(`/attendance/corrections/${id}`, payload)).data,
  dashboard: async () => (await apiClient.get('/attendance/dashboard')).data,
  lock: async (payload) => (await apiClient.post('/attendance/locks', payload)).data,
  unlock: async (id, payload) => (await apiClient.post(`/attendance/locks/${id}/unlock`, payload)).data,
  audit: async (params = {}) => (await apiClient.get('/attendance/audit', { params })).data,
  exportCsv: async (kind, month) => (await apiClient.get('/attendance/export.csv', { params: { kind, month }, responseType: 'blob' })).data,
};

export const userService = {
  createTeacher: async (payload) => {
    const response = await apiClient.post('/users/create-teacher', payload);
    return response.data;
  },
  createStaff: async (payload) => {
    const response = await apiClient.post('/users/create-staff', payload);
    return response.data;
  },
  createCurriculumManager: async (payload) => {
    const response = await apiClient.post('/users/create-curriculum-manager', payload);
    return response.data;
  },
  createExaminationRole: async (payload) => {
    const response = await apiClient.post('/users/create-examination-role', payload);
    return response.data;
  },
};

export const timetableService = {
  list: async (params = {}) => {
    const response = await apiClient.get('/timetables', { params });
    return response.data;
  },
  create: async (payload) => {
    const response = await apiClient.post('/timetables', payload);
    return response.data;
  },
  getBody: async (id) => {
    const response = await apiClient.get(`/timetables/${id}`);
    return response.data;
  },
  validate: async (id) => {
    const response = await apiClient.get(`/timetables/${id}/validate`);
    return response.data;
  },
  assignSlot: async (slotId, payload) => {
    const response = await apiClient.post(`/timetables/slots/${slotId}/assign`, payload);
    return response.data;
  },
  resetSlot: async (slotId, payload = {}) => {
    const response = await apiClient.post(`/timetables/slots/${slotId}/reset`, payload);
    return response.data;
  },
  listWeeklyRequirements: async ({ classId, sectionId } = {}) => {
    const response = await apiClient.get('/timetables/weekly-requirements', {
      params: {
        classId,
        ...(sectionId ? { sectionId } : {}),
      },
    });
    return response.data;
  },
  saveWeeklyRequirements: async (payload) => {
    const response = await apiClient.put('/timetables/weekly-requirements', payload);
    return response.data;
  },
  propagateWeeklyRequirements: async (payload) => {
    const response = await apiClient.post('/timetables/weekly-requirements/propagate', payload);
    return response.data;
  },
  reconciliationReport: async (params = {}) => {
    const response = await apiClient.get('/timetables/reconciliation/report', { params });
    return response.data;
  },
};

export const academicStaffingService = {
  config: async (params = {}) => (await apiClient.get('/academic-config', { params })).data,
  updateConfig: async (payload) => (await apiClient.patch('/academic-config', payload)).data,
  weeklySlots: async (params = {}) => (await apiClient.get('/curriculum/weekly-slots', { params })).data,
  updateSlot: async ({ id, ...payload }) => (await apiClient.patch(`/curriculum/weekly-slots/${id}`, payload)).data,
  applyTemplate: async (payload) => (await apiClient.post('/curriculum/weekly-slots/apply-template', payload)).data,
  resetDefaults: async (payload = {}) => (await apiClient.post('/curriculum/weekly-slots/reset-defaults', payload)).data,
  autoAllocate: async (payload = {}) => (await apiClient.post('/teacher-assignments/auto-allocate', payload)).data,
  replaceTeacher: async ({ id, ...payload }) => (await apiClient.patch(`/teacher-assignments/${id}`, payload)).data,
  classTeachers: async (params = {}) => (await apiClient.get('/class-teacher-assignments', { params })).data,
  saveClassTeacher: async (payload) => (await apiClient.post('/class-teacher-assignments', payload)).data,
  workloads: async (params = {}) => (await apiClient.get('/teacher-workload', { params })).data,
  audit: async (params = {}) => (await apiClient.get('/academic-staffing/audit', { params })).data,
};
