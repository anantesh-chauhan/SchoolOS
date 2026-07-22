import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import {
  DEFAULT_ACADEMIC_CONFIGURATION,
  getSlotDefault,
  getTeacherWorkloads,
  isTeacherEligible,
  resolveAcademicContext,
  runStaffingAudit,
  selectBestTeacher,
} from '../services/academicStaffing.service.js';

const fail = (res, error, fallback) => res.status(error.statusCode || 500).json({ success: false, message: error.message || fallback });
const sessionIdFrom = (req) => req.query.academicSessionId || req.body?.academicSessionId;
const audit = (tx, req, data) => tx.academicStaffingAuditLog.create({ data: { actorUserId: req.user.id, ...data } });

export const getAcademicConfig = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const context = await resolveAcademicContext(schoolId, sessionIdFrom(req));
    res.json({ success: true, data: context });
  } catch (error) { fail(res, error, 'Failed to load academic configuration'); }
};

export const updateAcademicConfig = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { session, config } = await resolveAcademicContext(schoolId, sessionIdFrom(req));
    const allowed = Object.keys(DEFAULT_ACADEMIC_CONFIGURATION);
    const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    const days = Number(changes.workingDaysPerWeek ?? config.workingDaysPerWeek);
    const periods = Number(changes.periodsPerDay ?? config.periodsPerDay);
    const total = Number(changes.totalPeriodsPerWeek ?? days * periods);
    if (total > days * periods || days < 1 || days > 6 || periods < 1 || periods > 12) return res.status(400).json({ success: false, message: 'Total periods must fit within working days × periods per day' });
    changes.totalPeriodsPerWeek = total;
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.academicConfiguration.update({ where: { id: config.id }, data: changes });
      await audit(tx, req, { schoolId, academicSessionId: session.id, action: 'ACADEMIC_CONFIG_UPDATED', entityType: 'AcademicConfiguration', entityId: config.id, previousValue: config, newValue: row, reason: req.body.reason });
      return row;
    });
    res.json({ success: true, data: updated });
  } catch (error) { fail(res, error, 'Failed to update academic configuration'); }
};

export const listWeeklySlots = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { session, config } = await resolveAcademicContext(schoolId, sessionIdFrom(req));
    const where = { schoolId, academicSessionId: session.id, ...(req.query.classId ? { classId: req.query.classId } : {}), ...(req.query.sectionId ? { sectionId: req.query.sectionId } : {}) };
    const [templates, allocations] = await Promise.all([
      prisma.weeklySubjectSlotTemplate.findMany({ where: { schoolId, academicSessionId: session.id, ...(req.query.classId ? { classId: req.query.classId } : {}) }, include: { class: true, subject: true }, orderBy: [{ class: { classOrder: 'asc' } }, { subject: { displayOrder: 'asc' } }] }),
      prisma.sectionSubjectAllocation.findMany({ where, include: { class: true, section: true, subject: true, teacher: true }, orderBy: [{ class: { classOrder: 'asc' } }, { section: { sectionOrder: 'asc' } }, { subject: { displayOrder: 'asc' } }] }),
    ]);
    const allocated = allocations.reduce((sum, row) => sum + row.weeklySlots, 0);
    res.json({ success: true, data: { session, config, templates, allocations, utilization: { allocated, capacityPerSection: config.totalPeriodsPerWeek, remainingForSelectedSection: req.query.sectionId ? config.totalPeriodsPerWeek - allocated : null } } });
  } catch (error) { fail(res, error, 'Failed to load weekly slots'); }
};

export const updateWeeklySlot = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const existing = await prisma.sectionSubjectAllocation.findFirst({ where: { id: req.params.id, schoolId }, include: { subject: true, class: true } });
    if (!existing) return res.status(404).json({ success: false, message: 'Section subject allocation not found' });
    const weeklySlots = Number(req.body.weeklySlots ?? existing.weeklySlots);
    const other = await prisma.sectionSubjectAllocation.aggregate({ where: { schoolId, academicSessionId: existing.academicSessionId, sectionId: existing.sectionId, id: { not: existing.id }, status: { not: 'INACTIVE' } }, _sum: { weeklySlots: true } });
    const { config } = await resolveAcademicContext(schoolId, existing.academicSessionId);
    if (weeklySlots < 0 || weeklySlots + (other._sum.weeklySlots || 0) > config.totalPeriodsPerWeek) return res.status(409).json({ success: false, message: `Allocation would exceed ${config.totalPeriodsPerWeek} periods for this section` });
    const theorySlots = Number(req.body.theorySlots ?? Math.max(0, weeklySlots - existing.practicalSlots - existing.remedialSlots));
    const practicalSlots = Number(req.body.practicalSlots ?? existing.practicalSlots);
    const remedialSlots = Number(req.body.remedialSlots ?? existing.remedialSlots);
    if (theorySlots + practicalSlots + remedialSlots !== weeklySlots) return res.status(400).json({ success: false, message: 'Theory, practical and remedial slots must equal weekly slots' });
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.sectionSubjectAllocation.update({ where: { id: existing.id }, data: { weeklySlots, theorySlots, practicalSlots, remedialSlots, workloadContribution: weeklySlots, status: existing.teacherId ? 'READY' : 'TEACHER_REQUIRED' } });
      await tx.teacherAssignment.updateMany({ where: { schoolId, classId: existing.classId, sectionId: existing.sectionId, subjectId: existing.subjectId, isActive: true }, data: { weeklySlots } });
      await tx.timetable.updateMany({ where: { schoolId, sectionId: existing.sectionId, academicYear: (await tx.academicSession.findUnique({ where: { id: existing.academicSessionId } })).name }, data: { requiresRegeneration: true } });
      await audit(tx, req, { schoolId, academicSessionId: existing.academicSessionId, action: 'WEEKLY_SLOT_UPDATED', entityType: 'SectionSubjectAllocation', entityId: existing.id, previousValue: existing, newValue: row, reason: req.body.reason });
      return row;
    });
    res.json({ success: true, data: updated, timetableRegenerationRequired: true });
  } catch (error) { fail(res, error, 'Failed to update weekly slot'); }
};

export const applyTemplate = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { session, config } = await resolveAcademicContext(schoolId, sessionIdFrom(req));
    const classRow = await prisma.class.findFirst({ where: { id: req.body.classId, schoolId, deletedAt: null }, include: { sections: { where: { deletedAt: null } } } });
    if (!classRow) return res.status(404).json({ success: false, message: 'Class not found' });
    const templates = await prisma.weeklySubjectSlotTemplate.findMany({ where: { schoolId, academicSessionId: session.id, classId: classRow.id, isActive: true } });
    if (templates.reduce((sum, row) => sum + row.recommendedSlots, 0) > config.totalPeriodsPerWeek) return res.status(409).json({ success: false, message: 'Class template exceeds configured weekly capacity' });
    const sectionIds = req.body.sectionId ? [req.body.sectionId] : classRow.sections.map((row) => row.id);
    await prisma.$transaction(async (tx) => {
      for (const sectionId of sectionIds) for (const template of templates) await tx.sectionSubjectAllocation.upsert({ where: { schoolId_academicSessionId_sectionId_subjectId: { schoolId, academicSessionId: session.id, sectionId, subjectId: template.subjectId } }, update: { weeklySlots: template.recommendedSlots, theorySlots: template.theorySlots, practicalSlots: template.practicalSlots, workloadContribution: template.recommendedSlots, requiresLab: template.practicalSlots > 0, requiresDoublePeriod: template.labDoublePeriods > 0, status: 'TEACHER_REQUIRED' }, create: { schoolId, academicSessionId: session.id, classId: classRow.id, sectionId, subjectId: template.subjectId, weeklySlots: template.recommendedSlots, theorySlots: template.theorySlots, practicalSlots: template.practicalSlots, workloadContribution: template.recommendedSlots, requiresLab: template.practicalSlots > 0, requiresDoublePeriod: template.labDoublePeriods > 0, status: 'TEACHER_REQUIRED' } });
      await audit(tx, req, { schoolId, academicSessionId: session.id, action: 'CLASS_TEMPLATE_APPLIED', entityType: 'Class', entityId: classRow.id, newValue: { sectionIds, allocations: templates.length * sectionIds.length }, reason: req.body.reason });
    });
    res.json({ success: true, data: { sectionsUpdated: sectionIds.length, allocationsUpdated: templates.length * sectionIds.length } });
  } catch (error) { fail(res, error, 'Failed to apply template'); }
};

export const resetDefaults = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { session, config } = await resolveAcademicContext(schoolId, sessionIdFrom(req));
    const classes = await prisma.class.findMany({ where: { schoolId, deletedAt: null, ...(req.body.classId ? { id: req.body.classId } : {}) }, include: { classSubjects: { include: { subject: true } } } });
    await prisma.$transaction(async (tx) => {
      for (const classRow of classes) {
        const defaults = classRow.classSubjects.map((row) => ({ row, slots: getSlotDefault(classRow.className, row.subject) }));
        let total = defaults.reduce((sum, item) => sum + item.slots.recommendedSlots, 0);
        for (const item of [...defaults].reverse()) while (total > config.totalPeriodsPerWeek && item.slots.recommendedSlots > item.slots.minimumSlots) { item.slots.recommendedSlots -= 1; item.slots.theorySlots = Math.max(0, item.slots.theorySlots - 1); total -= 1; }
        if (total > config.totalPeriodsPerWeek) throw Object.assign(new Error(`${classRow.className} minimum subject slots exceed configured capacity`), { statusCode: 409 });
        for (const item of defaults) await tx.weeklySubjectSlotTemplate.upsert({ where: { schoolId_academicSessionId_classId_subjectId: { schoolId, academicSessionId: session.id, classId: classRow.id, subjectId: item.row.subjectId } }, update: { ...item.slots, sourceType: 'CBSE_DEFAULT', isActive: true }, create: { schoolId, academicSessionId: session.id, classId: classRow.id, subjectId: item.row.subjectId, ...item.slots, sourceType: 'CBSE_DEFAULT' } });
      }
      await audit(tx, req, { schoolId, academicSessionId: session.id, action: 'WEEKLY_DEFAULTS_RESET', entityType: 'WeeklySubjectSlotTemplate', newValue: { classes: classes.length }, reason: req.body.reason });
    });
    res.json({ success: true, data: { classesUpdated: classes.length } });
  } catch (error) { fail(res, error, 'Failed to reset defaults'); }
};

export const listWorkloads = async (req, res) => {
  try { const schoolId = getScopedSchoolId(req.user, req.query.schoolId); res.json({ success: true, data: await getTeacherWorkloads({ schoolId, academicSessionId: sessionIdFrom(req), teacherId: req.params.teacherId }) }); }
  catch (error) { fail(res, error, 'Failed to calculate workload'); }
};

export const staffingAudit = async (req, res) => {
  try { const schoolId = getScopedSchoolId(req.user, req.query.schoolId); res.json({ success: true, data: await runStaffingAudit({ schoolId, academicSessionId: sessionIdFrom(req) }) }); }
  catch (error) { fail(res, error, 'Failed to run staffing audit'); }
};

export const autoAllocate = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { session } = await resolveAcademicContext(schoolId, sessionIdFrom(req));
    const [allocations, teachers, workloads] = await Promise.all([
      prisma.sectionSubjectAllocation.findMany({ where: { schoolId, academicSessionId: session.id, status: { not: 'INACTIVE' } }, include: { subject: true, class: true } }),
      prisma.teacher.findMany({ where: { schoolId, isActive: true, deletedAt: null }, include: { qualifications: true }, orderBy: { employeeId: 'asc' } }),
      getTeacherWorkloads({ schoolId, academicSessionId: session.id }),
    ]);
    const loadByTeacher = new Map(workloads.map((row) => [row.teacherId, row.totalAllocatedPeriods]));
    let assigned = 0; let unresolved = 0;
    await prisma.$transaction(async (tx) => {
      for (const allocation of allocations.sort((a, b) => a.class.classOrder - b.class.classOrder || a.subject.subjectCode.localeCompare(b.subject.subjectCode))) {
        const currentLoad = allocation.teacherId ? loadByTeacher.get(allocation.teacherId) || 0 : 0;
        if (allocation.teacherId && currentLoad <= (teachers.find((row) => row.id === allocation.teacherId)?.maximumPeriodsPerWeek || 0)) continue;
        const teacher = selectBestTeacher({ teachers, subject: allocation.subject, className: allocation.class.className, requiresPractical: allocation.practicalSlots > 0, loadByTeacher });
        if (!teacher || (loadByTeacher.get(teacher.id) || 0) + allocation.weeklySlots > teacher.maximumPeriodsPerWeek) { await tx.sectionSubjectAllocation.update({ where: { id: allocation.id }, data: { teacherId: null, status: 'TEACHER_REQUIRED' } }); unresolved += 1; continue; }
        await tx.sectionSubjectAllocation.update({ where: { id: allocation.id }, data: { teacherId: teacher.id, status: 'READY' } });
        await tx.teacherAssignment.upsert({ where: { schoolId_classId_sectionId_subjectId: { schoolId, classId: allocation.classId, sectionId: allocation.sectionId, subjectId: allocation.subjectId } }, update: { teacherId: teacher.id, academicSessionId: session.id, weeklySlots: allocation.weeklySlots, roleType: allocation.assignmentType, status: 'ACTIVE', isActive: true, effectiveTo: null }, create: { schoolId, academicSessionId: session.id, teacherId: teacher.id, classId: allocation.classId, sectionId: allocation.sectionId, subjectId: allocation.subjectId, weeklySlots: allocation.weeklySlots, roleType: allocation.assignmentType } });
        loadByTeacher.set(teacher.id, (loadByTeacher.get(teacher.id) || 0) + allocation.weeklySlots); assigned += 1;
      }
      await audit(tx, req, { schoolId, academicSessionId: session.id, action: 'AUTO_ALLOCATION_RUN', entityType: 'SectionSubjectAllocation', newValue: { assigned, unresolved }, reason: req.body.reason });
    }, { timeout: 60_000 });
    res.json({ success: true, data: { assigned, unresolved } });
  } catch (error) { fail(res, error, 'Failed to auto-allocate teachers'); }
};

export const listClassTeachers = async (req, res) => {
  try { const schoolId = getScopedSchoolId(req.user, req.query.schoolId); const { session } = await resolveAcademicContext(schoolId, sessionIdFrom(req)); const data = await prisma.sectionClassTeacherAssignment.findMany({ where: { schoolId, academicSessionId: session.id, status: 'ACTIVE' }, include: { teacher: true, section: { include: { class: true } } } }); res.json({ success: true, data }); }
  catch (error) { fail(res, error, 'Failed to load class teachers'); }
};

export const assignClassTeacher = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId); const { session, config } = await resolveAcademicContext(schoolId, sessionIdFrom(req));
    const [section, teacher] = await Promise.all([prisma.section.findFirst({ where: { id: req.body.sectionId, schoolId }, include: { class: true } }), prisma.teacher.findFirst({ where: { id: req.body.teacherId, schoolId, isActive: true, deletedAt: null } })]);
    if (!section || !teacher) return res.status(404).json({ success: false, message: 'Active teacher or section not found in this school' });
    if (!teacher.canBeClassTeacher) return res.status(409).json({ success: false, message: 'Teacher is not eligible for class-teacher duty' });
    const otherPrimary = await prisma.sectionClassTeacherAssignment.findFirst({ where: { schoolId, academicSessionId: session.id, teacherId: teacher.id, isPrimary: true, status: 'ACTIVE', sectionId: { not: section.id } } });
    if (otherPrimary) return res.status(409).json({ success: false, message: 'Teacher is already primary class teacher for another section' });
    const row = await prisma.$transaction(async (tx) => { const saved = await tx.sectionClassTeacherAssignment.upsert({ where: { schoolId_academicSessionId_sectionId_isPrimary: { schoolId, academicSessionId: session.id, sectionId: section.id, isPrimary: true } }, update: { teacherId: teacher.id, status: 'ACTIVE', endDate: null, dutyPeriods: config.classTeacherDutyPeriods }, create: { schoolId, academicSessionId: session.id, sectionId: section.id, teacherId: teacher.id, isPrimary: true, startDate: session.startDate, dutyPeriods: config.classTeacherDutyPeriods } }); await audit(tx, req, { schoolId, academicSessionId: session.id, action: 'CLASS_TEACHER_ASSIGNED', entityType: 'SectionClassTeacherAssignment', entityId: saved.id, newValue: saved, reason: req.body.reason }); return saved; });
    res.json({ success: true, data: row });
  } catch (error) { fail(res, error, 'Failed to assign class teacher'); }
};

export const replaceSubjectTeacher = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId); const allocation = await prisma.sectionSubjectAllocation.findFirst({ where: { id: req.params.id, schoolId }, include: { class: true, subject: true } }); const teacher = await prisma.teacher.findFirst({ where: { id: req.body.teacherId, schoolId }, include: { qualifications: true } });
    if (!allocation || !teacher) return res.status(404).json({ success: false, message: 'Allocation or teacher not found' });
    if (!isTeacherEligible({ teacher, subject: allocation.subject, className: allocation.class.className, requiresPractical: allocation.practicalSlots > 0 })) return res.status(409).json({ success: false, message: 'Teacher is not qualified or class-level eligible for this allocation' });
    const [load] = await getTeacherWorkloads({ schoolId, academicSessionId: allocation.academicSessionId, teacherId: teacher.id });
    if (load.totalAllocatedPeriods + allocation.weeklySlots > teacher.maximumPeriodsPerWeek) return res.status(409).json({ success: false, message: 'Assignment would exceed the teacher maximum weekly workload' });
    const row = await prisma.$transaction(async (tx) => { const saved = await tx.sectionSubjectAllocation.update({ where: { id: allocation.id }, data: { teacherId: teacher.id, status: 'READY' } }); await tx.teacherAssignment.upsert({ where: { schoolId_classId_sectionId_subjectId: { schoolId, classId: allocation.classId, sectionId: allocation.sectionId, subjectId: allocation.subjectId } }, update: { teacherId: teacher.id, academicSessionId: allocation.academicSessionId, weeklySlots: allocation.weeklySlots, isActive: true, status: 'ACTIVE' }, create: { schoolId, academicSessionId: allocation.academicSessionId, teacherId: teacher.id, classId: allocation.classId, sectionId: allocation.sectionId, subjectId: allocation.subjectId, weeklySlots: allocation.weeklySlots } }); await audit(tx, req, { schoolId, academicSessionId: allocation.academicSessionId, action: 'SUBJECT_TEACHER_REPLACED', entityType: 'SectionSubjectAllocation', entityId: allocation.id, previousValue: allocation, newValue: saved, reason: req.body.reason }); return saved; });
    res.json({ success: true, data: row });
  } catch (error) { fail(res, error, 'Failed to replace subject teacher'); }
};

export const unassignSubjectTeacher = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const allocation = await prisma.sectionSubjectAllocation.findFirst({ where: { id: req.params.id, schoolId } });
    if (!allocation) return res.status(404).json({ success: false, message: 'Allocation not found' });
    await prisma.$transaction(async (tx) => {
      await tx.sectionSubjectAllocation.update({ where: { id: allocation.id }, data: { teacherId: null, status: 'TEACHER_REQUIRED' } });
      await tx.teacherAssignment.deleteMany({ where: { schoolId, classId: allocation.classId, sectionId: allocation.sectionId, subjectId: allocation.subjectId } });
      await audit(tx, req, { schoolId, academicSessionId: allocation.academicSessionId, action: 'SUBJECT_TEACHER_UNASSIGNED', entityType: 'SectionSubjectAllocation', entityId: allocation.id, previousValue: allocation, reason: req.body?.reason });
    });
    res.json({ success: true, message: 'Teacher unassigned; allocation requires a replacement' });
  } catch (error) { fail(res, error, 'Failed to unassign subject teacher'); }
};
