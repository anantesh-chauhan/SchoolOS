import * as portal from './studentPortal.service.js';

const run = (handler) => async (req, res) => { try { const ctx = await portal.resolveContext(req.user); const data = await handler(ctx, req); res.json({ success: true, data }); } catch (error) { res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Unable to load student data' }); } };
export const dashboard = run((ctx) => portal.getDashboard(ctx));
export const subjects = run((ctx) => portal.getSubjects(ctx));
export const subject = run((ctx, req) => portal.getSubject(ctx, req.params.subjectId));
export const chapter = run((ctx, req) => portal.getChapter(ctx, req.params.subjectId, req.params.chapterId));
export const attendance = run((ctx) => portal.getAttendance(ctx));
export const attendanceCalendar = run((ctx, req) => { const year=Number(req.query.year); const month=Number(req.query.month); if (!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12) throw Object.assign(new Error('Valid year and month are required'),{statusCode:400}); return portal.getAttendanceCalendar(ctx,year,month); });
export const attendanceMonth = run((ctx, req) => { const year=Number(req.params.year); const month=Number(req.params.month); if (!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12) throw Object.assign(new Error('Valid year and month are required'),{statusCode:400}); return portal.getAttendanceCalendar(ctx,year,month); });
export const attendanceDate = run(async (ctx, req) => { const [year,month]=String(req.params.date).split('-').map(Number); const data=await portal.getAttendanceCalendar(ctx,year,month); const record=data.records.find(row=>row.date===req.params.date); if(!record) throw Object.assign(new Error('Attendance date not found'),{statusCode:404}); return record; });
export const pendingPolls = run((ctx) => portal.getPolls(ctx, 'pending'));
export const submittedPolls = run((ctx) => portal.getPolls(ctx, 'submitted'));
export const poll = run((ctx, req) => portal.getPoll(ctx, req.params.pollId));
export const submitPoll = run((ctx, req) => portal.saveVote(ctx, req.params.pollId, req.body));
export const editPoll = run(async (ctx, req) => { const item=await portal.getPoll(ctx, req.params.submissionId); return portal.saveVote(ctx,item.id,req.body,true); });
