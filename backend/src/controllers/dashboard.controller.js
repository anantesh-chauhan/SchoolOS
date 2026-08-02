import prisma from '../config/prisma.client.js';
import { getPerformanceSnapshot } from '../infrastructure/observability/performance-metrics.js';

export const getPlatformPerformance = (_req, res) => res.json({ success: true, data: getPerformanceSnapshot() });

const startOfToday = () => { const now = new Date(); return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())); };
const currentSession = () => { const now = new Date(); const year = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1; return `${year}-${String(year + 1).slice(-2)}`; };

const schoolOverview = async (schoolId) => {
  const today = startOfToday();
  const [students, teachers, classes, sections, staff, attendance, school, upcomingEvents] = await Promise.all([
    prisma.student.count({ where: { schoolId, isActive: true } }),
    prisma.teacher.count({ where: { schoolId, deletedAt: null } }),
    prisma.class.count({ where: { schoolId, deletedAt: null } }),
    prisma.section.count({ where: { schoolId, deletedAt: null } }),
    prisma.user.count({ where: { schoolId, role: 'STAFF', isActive: true } }),
    prisma.studentAttendance.groupBy({ by: ['status'], where: { schoolId, attendanceDate: today }, _count: true }),
    prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, schoolName: true, address: true, email: true, phone: true, city: true, state: true } }),
    prisma.academicCalendarDay.findMany({ where: { schoolId, calendarDate: { gte: today }, dayType: { in: ['HOLIDAY', 'EXAM', 'EVENT', 'VACATION'] } }, orderBy: { calendarDate: 'asc' }, take: 5 }),
  ]);

  const attendanceCounts = Object.fromEntries(attendance.map((row) => [row.status, row._count]));
  const marked = Object.values(attendanceCounts).reduce((sum, value) => sum + value, 0);
  const attended = (attendanceCounts.PRESENT || 0) + (attendanceCounts.LATE || 0) + (attendanceCounts.HALF_DAY || 0) * 0.5;

  return {
    school,
    stats: {
      totalStudents: students,
      totalTeachers: teachers,
      totalStaff: teachers + staff,
      totalClasses: classes,
      totalSections: sections,
      todayPresent: attendanceCounts.PRESENT || 0,
      todayMarked: marked,
      attendanceRate: marked ? Math.round((attended / marked) * 1000) / 10 : 0,
    },
    upcomingEvents: upcomingEvents.map((row) => ({ id: row.id, date: row.calendarDate.toISOString().slice(0, 10), type: row.dayType, title: row.title })),
  };
};


export const getDashboardSummary = async (req, res) => {
  try {
    if (req.user.role === 'PLATFORM_OWNER') {
      const since = new Date(Date.now() - 30 * 86400000);
      const [totalSchools, activeSchools, totalUsers, newSchools, recentSchools] = await Promise.all([
        prisma.school.count(), prisma.school.count({ where: { status: 'ACTIVE' } }), prisma.user.count({ where: { isActive: true } }), prisma.school.count({ where: { createdAt: { gte: since } } }),
        prisma.school.findMany({ orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, schoolName: true, city: true, state: true, status: true, createdAt: true } }),
      ]);
      return res.json({ success: true, data: { role: req.user.role, stats: { totalSchools, activeSchools, totalUsers, newSchools }, recentSchools } });
    }
    if (['SCHOOL_OWNER', 'ADMIN'].includes(req.user.role)) return res.json({ success: true, data: { role: req.user.role, ...(await schoolOverview(req.user.schoolId)) } });
    if (req.user.role === 'PARENT') {
      const student = await prisma.student.findFirst({ where: { schoolId: req.user.schoolId, parentUserId: req.user.email, isActive: true } });
      if (!student) return res.status(404).json({ success: false, message: 'Linked student not found' });
      const [attendance, mastery, pendingPolls] = await Promise.all([
        prisma.studentAttendance.groupBy({ by: ['status'], where: { schoolId: req.user.schoolId, studentId: student.id, academicSession: currentSession() }, _count: true }),
        prisma.studentChapterMastery.findMany({ where: { schoolId: req.user.schoolId, studentId: student.id }, include: { subject: { select: { subjectName: true } }, chapter: { select: { chapterName: true } } }, orderBy: { updatedAt: 'desc' }, take: 8 }),
        prisma.chapterPoll.count({ where: { schoolId: req.user.schoolId, status: 'ACTIVE', class: { className: student.className }, section: { sectionName: student.section || '' }, votes: { none: { studentId: student.id } } } }),
      ]);
      const counts = Object.fromEntries(attendance.map((row) => [row.status, row._count])); const marked = Object.values(counts).reduce((a, b) => a + b, 0); const attended = (counts.PRESENT || 0) + (counts.LATE || 0) + (counts.HALF_DAY || 0) * .5;
      return res.json({ success: true, data: { role: req.user.role, student: { id: student.id, name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '), className: student.className, section: student.section }, stats: { attendanceRate: marked ? Math.round(attended / marked * 1000) / 10 : 0, markedDays: marked, pendingPolls }, mastery: mastery.map((row) => ({ id: row.id, subject: row.subject.subjectName, chapter: row.chapter.chapterName, score: row.score, level: row.masteryLevel })) } });
    }
    if (req.user.role === 'STAFF') {
      const today = startOfToday(); const week = new Date(today.getTime() + 7 * 86400000);
      const [todos, events] = await Promise.all([prisma.userWidgetTodo.findMany({ where: { schoolId: req.user.schoolId, userId: req.user.id }, orderBy: [{ isCompleted: 'asc' }, { dueDate: 'asc' }], take: 20 }), prisma.academicCalendarDay.findMany({ where: { schoolId: req.user.schoolId, calendarDate: { gte: today, lt: week }, dayType: { in: ['EVENT', 'EXAM', 'HOLIDAY'] } }, orderBy: { calendarDate: 'asc' } })]);
      return res.json({ success: true, data: { role: req.user.role, stats: { tasksCompleted: todos.filter((row) => row.isCompleted).length, tasksRemaining: todos.filter((row) => !row.isCompleted).length, scheduledEvents: events.length }, tasks: todos, events: events.map((row) => ({ id: row.id, date: row.calendarDate.toISOString().slice(0, 10), title: row.title, type: row.dayType })) } });
    }
    return res.status(400).json({ success: false, message: 'This role uses its dedicated dashboard endpoint' });
  } catch (error) { return res.status(500).json({ success: false, message: error.message || 'Failed to load dashboard' }); }
};
