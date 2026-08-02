import {
  correctStudentAttendanceSession, getAttendanceOverview, getAttendanceSessionHistory,
  markAttendanceNotApplicable, saveStudentAttendanceSession,
} from '../services/attendanceWorkflow.service.js';
import prisma from '../config/prisma.client.js';
import { getStudentAttendanceRoster } from './attendance.controller.js';

const send = (res, error, fallback) => res.status(error.statusCode || 400).json({ success: false, message: error.message || fallback });

export const saveAttendanceDraft = async (req, res) => {
  try { const data = await saveStudentAttendanceSession({ user: req.user, sectionId: req.params.sectionId || req.body.sectionId, attendanceDate: req.params.date || req.body.date, payload: req.body, targetState: 'DRAFT', request: req }); return res.json({ success: true, message: data.message, data }); }
  catch (error) { return send(res, error, 'Attendance draft could not be saved'); }
};

export const submitAttendance = async (req, res) => {
  try { const data = await saveStudentAttendanceSession({ user: req.user, sectionId: req.params.sectionId || req.body.sectionId, attendanceDate: req.params.date || req.body.date, payload: req.body, targetState: 'SUBMITTED', request: req }); return res.json({ success: true, message: data.message, data }); }
  catch (error) { return send(res, error, 'Attendance could not be submitted'); }
};

export const correctAttendance = async (req, res) => {
  try { const data = await correctStudentAttendanceSession({ user: req.user, attendanceSessionId: req.params.attendanceSessionId, payload: req.body, request: req }); return res.json({ success: true, message: `Attendance corrected as revision ${data.revision.revisionNumber}`, data }); }
  catch (error) { return send(res, error, 'Attendance correction could not be saved'); }
};

export const attendanceHistory = async (req, res) => {
  try { return res.json({ success: true, data: await getAttendanceSessionHistory({ user: req.user, attendanceSessionId: req.params.attendanceSessionId }) }); }
  catch (error) { return send(res, error, 'Attendance history could not be loaded'); }
};

export const attendanceOverview = async (req, res) => {
  try { return res.json({ success: true, data: await getAttendanceOverview({ user: req.user, attendanceDate: req.query.date }) }); }
  catch (error) { return send(res, error, 'Attendance overview could not be loaded'); }
};

export const pendingAttendance = async (req, res) => {
  try { const data = await getAttendanceOverview({ user: req.user, attendanceDate: req.query.date }); return res.json({ success: true, data: { ...data, sections: data.sections.filter((row) => ['NOT_STARTED', 'DRAFT'].includes(row.attendanceStatus)) } }); }
  catch (error) { return send(res, error, 'Pending attendance could not be loaded'); }
};

export const setAttendanceNotApplicable = async (req, res) => {
  try { const data = await markAttendanceNotApplicable({ user: req.user, sectionId: req.params.sectionId || req.body.sectionId, attendanceDate: req.params.date || req.body.date, payload: req.body, request: req }); return res.json({ success: true, message: 'Attendance marked not applicable', data }); }
  catch (error) { return send(res, error, 'Attendance could not be marked not applicable'); }
};

export const getSectionAttendance = async (req, res) => {
  try {
    const section = await prisma.section.findFirst({ where: { id: req.params.sectionId, schoolId: req.user.schoolId, deletedAt: null }, select: { classId: true } });
    if (!section) return res.status(404).json({ success: false, message: 'Section not found in this school' });
    req.query = { ...req.query, classId: section.classId, sectionId: req.params.sectionId, date: req.params.date };
    return getStudentAttendanceRoster(req, res);
  } catch (error) { return send(res, error, 'Attendance could not be loaded'); }
};
