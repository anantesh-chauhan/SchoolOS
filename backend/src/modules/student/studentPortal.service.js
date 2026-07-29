import prisma from '../../config/prisma.client.js';

const today = () => new Date();
const nameOf = (student) => [student.studentFirstName, student.studentLastName].filter(Boolean).join(' ');
const round = (value) => Math.round(value * 10) / 10;

export const scoreLevel = (score) => {
  if (score == null) return { level: 'NOT_EVALUATED', label: 'Not evaluated', summary: 'Your performance will appear after enough academic evidence is available.' };
  if (score >= 90) return { level: 'EXCELLENT', label: 'Excellent', summary: 'You are performing exceptionally well.' };
  if (score >= 75) return { level: 'GOOD', label: 'Good', summary: 'You understand most chapters and are performing well.' };
  if (score >= 60) return { level: 'STABLE', label: 'Stable', summary: 'Your performance is stable, but selected chapters need revision.' };
  if (score >= 40) return { level: 'NEEDS_IMPROVEMENT', label: 'Needs improvement', summary: 'You need improvement in selected concepts.' };
  return { level: 'CRITICAL', label: 'Critical attention', summary: 'Immediate attention is required in multiple chapters.' };
};

export const resolveContext = async (user) => {
  if (user.role !== 'STUDENT') throw Object.assign(new Error('Only students can access this resource'), { statusCode: 403 });
  const student = await prisma.student.findFirst({
    where: { schoolId: user.schoolId, isActive: true, OR: [{ id: user.studentId || user.id }, ...(user.email ? [{ studentUserId: user.email }] : [])] },
    include: { school: { select: { id: true, schoolName: true } } },
  });
  if (!student) throw Object.assign(new Error('Student enrollment not found'), { statusCode: 404 });
  const classRow = await prisma.class.findFirst({ where: { schoolId: student.schoolId, className: student.className, deletedAt: null } });
  const section = classRow ? await prisma.section.findFirst({ where: { schoolId: student.schoolId, classId: classRow.id, sectionName: student.section || '', deletedAt: null } }) : null;
  if (!classRow || !section) throw Object.assign(new Error('Active class or section enrollment not found'), { statusCode: 409 });
  return { student, schoolId: student.schoolId, classId: classRow.id, sectionId: section.id, classRow, section, session: student.session };
};

const subjectIdsFor = async ({ classId, sectionId }) => {
  const sectionRows = await prisma.sectionSubject.findMany({ where: { sectionId }, select: { subjectId: true } });
  if (sectionRows.length) return sectionRows.map((row) => row.subjectId);
  const classRows = await prisma.classSubject.findMany({ where: { classId }, select: { subjectId: true } });
  return classRows.map((row) => row.subjectId);
};

const masteryResult = (rows) => {
  const scores = rows.map((row) => row.score).filter(Number.isFinite);
  const score = scores.length ? round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
  const meta = scoreLevel(score);
  return { score, ...meta, strengths: rows.filter((r) => Number(r.score) >= 75).map((r) => r.chapter?.chapterName).filter(Boolean), improvementAreas: rows.filter((r) => Number.isFinite(r.score) && r.score < 60).map((r) => r.chapter?.chapterName).filter(Boolean), metrics: { evaluatedChapters: scores.length, totalChapters: rows.length } };
};

export const getSubjects = async (ctx) => {
  const subjectIds = await subjectIdsFor(ctx);
  const [subjects, chapters, progress, teachers, mastery, resources, polls] = await Promise.all([
    prisma.subject.findMany({ where: { id: { in: subjectIds }, schoolId: ctx.schoolId, deletedAt: null }, orderBy: [{ displayOrder: 'asc' }, { subjectName: 'asc' }] }),
    prisma.chapter.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, subjectId: { in: subjectIds }, deletedAt: null, OR: [{ sectionId: ctx.sectionId }, { sectionId: null }] }, orderBy: { chapterNumber: 'asc' } }),
    prisma.chapterProgress.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId: { in: subjectIds } } }),
    prisma.teacherAssignment.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId: { in: subjectIds }, isActive: true, effectiveFrom: { lte: today() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today() } }] }, include: { teacher: { select: { id: true, teacherName: true } } } }),
    prisma.studentChapterMastery.findMany({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, classId: ctx.classId, sectionId: ctx.sectionId, subjectId: { in: subjectIds } }, include: { chapter: { select: { chapterName: true } } } }),
    prisma.sectionResource.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId: { in: subjectIds }, isVisibleToStudents: true } }),
    prisma.chapterPoll.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId: { in: subjectIds }, status: 'ACTIVE' }, include: { votes: { where: { studentId: ctx.student.id }, select: { id: true } } } }),
  ]);
  return subjects.map((subject) => {
    const chapterRows = chapters.filter((row) => row.subjectId === subject.id);
    const masteryRows = mastery.filter((row) => row.subjectId === subject.id);
    const performance = masteryResult(masteryRows);
    return { id: subject.id, subjectName: subject.subjectName, subjectCode: subject.subjectCode, teacher: teachers.find((row) => row.subjectId === subject.id)?.teacher || null, chapterCounts: { total: chapterRows.length, completed: chapterRows.filter((c) => progress.find((p) => p.chapterId === c.id)?.status === 'COMPLETED').length, ongoing: chapterRows.filter((c) => progress.find((p) => p.chapterId === c.id)?.status === 'ONGOING').length }, performance, pendingPolls: polls.filter((p) => p.subjectId === subject.id && !p.votes.length).length, resources: resources.filter((r) => r.subjectId === subject.id).length, updatedAt: chapterRows.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, subject.updatedAt) };
  });
};

export const getSubject = async (ctx, subjectId) => {
  const subjects = await getSubjects(ctx);
  const subject = subjects.find((row) => row.id === subjectId);
  if (!subject) throw Object.assign(new Error('Subject is outside your current curriculum'), { statusCode: 404 });
  const [chapters, progress, mastery, resources, polls, evaluations] = await Promise.all([
    prisma.chapter.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, subjectId, deletedAt: null, OR: [{ sectionId: ctx.sectionId }, { sectionId: null }] }, orderBy: { chapterNumber: 'asc' } }),
    prisma.chapterProgress.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId } }),
    prisma.studentChapterMastery.findMany({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, classId: ctx.classId, sectionId: ctx.sectionId, subjectId } }),
    prisma.sectionResource.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId, isVisibleToStudents: true } }),
    prisma.chapterPoll.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId }, include: { votes: { where: { studentId: ctx.student.id }, select: { id: true } } } }),
    prisma.teacherStudentEvaluation.findMany({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, classId: ctx.classId, sectionId: ctx.sectionId, subjectId } }),
  ]);
  return { ...subject, className: ctx.classRow.className, sectionName: ctx.section.sectionName, session: ctx.session, commonResources: resources.filter((resource) => !resource.chapterId), chapters: chapters.map((chapter) => { const master = mastery.find((m) => m.chapterId === chapter.id); const poll = polls.find((p) => p.chapterId === chapter.id); return { id: chapter.id, chapterNumber: chapter.chapterNumber, chapterName: chapter.chapterName, progress: progress.find((p) => p.chapterId === chapter.id)?.status || 'NOT_STARTED', performance: master ? { score: master.score, masteryLevel: master.masteryLevel, confidence: master.confidence, summary: master.summary } : null, pollStatus: poll ? (poll.votes.length ? 'SUBMITTED' : poll.status) : 'NOT_AVAILABLE', resources: resources.filter((r) => r.chapterId === chapter.id).length, feedbackAvailable: evaluations.some((e) => e.chapterId === chapter.id), updatedAt: chapter.updatedAt }; }) };
};

export const getChapter = async (ctx, subjectId, chapterId) => {
  const subject = await getSubject(ctx, subjectId);
  const chapter = subject.chapters.find((row) => row.id === chapterId);
  if (!chapter) throw Object.assign(new Error('Chapter is outside your current curriculum'), { statusCode: 404 });
  const [resources, mastery, evaluation, vote, poll] = await Promise.all([
    prisma.sectionResource.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId, chapterId, isVisibleToStudents: true }, include: { teacher: { select: { teacherName: true } } }, orderBy: { createdAt: 'desc' } }),
    prisma.studentChapterMastery.findFirst({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, chapterId } }),
    prisma.teacherStudentEvaluation.findFirst({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, chapterId }, orderBy: { submittedAt: 'desc' } }),
    prisma.studentChapterVote.findFirst({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, chapterId } }),
    prisma.chapterPoll.findFirst({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId, chapterId }, include: { summary: { select: { isPublished: true } } } }),
  ]);
  return { subject: { id: subject.id, subjectName: subject.subjectName, teacher: subject.teacher }, chapter, resources, performance: mastery, teacherFeedback: evaluation ? { strengths: evaluation.strengths, weaknesses: evaluation.weaknesses, recommendation: evaluation.recommendation, submittedAt: evaluation.submittedAt } : null, poll: poll ? { id: poll.id, title: poll.title, status: poll.status, submitted: Boolean(vote), submittedAt: vote?.submittedAt || null, editable: Boolean(vote) && poll.status === 'ACTIVE' && (!poll.endAt || poll.endAt > today()) && !poll.compiledAt && !poll.summary } : null };
};

export const getAttendance = async (ctx) => {
  const rows = await prisma.studentAttendance.findMany({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, academicSession: ctx.session }, orderBy: { attendanceDate: 'asc' } });
  const counts = rows.reduce((acc, row) => ({ ...acc, [row.status]: (acc[row.status] || 0) + 1 }), {});
  const workingDays = rows.length; const attended = (counts.PRESENT || 0) + (counts.LATE || 0) + (counts.HALF_DAY || 0) * .5;
  const percentage = workingDays ? round(attended / workingDays * 100) : null;
  const yearMatch = String(ctx.session).match(/(20\d{2})/); const startYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
  const sessionMonths = Array.from({ length: 12 }, (_, index) => { const date = new Date(Date.UTC(startYear, 3 + index, 2)); return { key: date.toISOString().slice(0, 7), year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, label: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }) }; });
  const byMonth = new Map(); rows.forEach((row) => { const key = row.attendanceDate.toISOString().slice(0, 7); const list = byMonth.get(key) || []; list.push(row); byMonth.set(key, list); });
  let currentStreak=0,longestStreak=0,running=0; rows.forEach((row)=>{if(['PRESENT','LATE','HALF_DAY'].includes(row.status)){running+=1;longestStreak=Math.max(longestStreak,running)}else if(row.status==='ABSENT'){running=0}}); currentStreak=running;
  return { student: { name: nameOf(ctx.student), className: ctx.student.className, sectionName: ctx.student.section, rollNumber: ctx.student.rollNumber }, session: ctx.session, percentage, status: scoreLevel(percentage).label, requiredPercentage: 75, currentStreak, longestStreak, counts: { present: counts.PRESENT || 0, absent: counts.ABSENT || 0, leave: counts.LEAVE || 0, late: counts.LATE || 0, halfDay: counts.HALF_DAY || 0, workingDays }, daysNeeded: percentage != null && percentage < 75 ? Math.ceil((.75 * workingDays - attended) / .25) : 0, months: sessionMonths.map((base) => { const list=byMonth.get(base.key)||[]; const c=list.reduce((a,r)=>({...a,[r.status]:(a[r.status]||0)+1}),{}); const value=list.length?((c.PRESENT||0)+(c.LATE||0)+(c.HALF_DAY||0)*.5)/list.length*100:null; return {...base,workingDays:list.length,present:c.PRESENT||0,absent:c.ABSENT||0,leave:c.LEAVE||0,late:c.LATE||0,halfDay:c.HALF_DAY||0,holidays:0,notMarked:0,percentage:value==null?null:round(value),status:scoreLevel(value).label}; }) };
};

export const getAttendanceCalendar = async (ctx, year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1)); const end = new Date(Date.UTC(year, month, 1));
  const [rows,calendar]=await Promise.all([prisma.studentAttendance.findMany({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, academicSession: ctx.session, attendanceDate: { gte: start, lt: end } }, orderBy: { attendanceDate: 'asc' } }),prisma.academicCalendarDay.findMany({where:{schoolId:ctx.schoolId,academicSession:ctx.session,calendarDate:{gte:start,lt:end}}})]);
  const rowMap=new Map(rows.map(r=>[r.attendanceDate.toISOString().slice(0,10),r])); const calendarMap=new Map(calendar.map(r=>[r.calendarDate.toISOString().slice(0,10),r])); const now=new Date();
  const records=Array.from({length:new Date(Date.UTC(year,month,0)).getUTCDate()},(_,i)=>{const date=new Date(Date.UTC(year,month-1,i+1));const key=date.toISOString().slice(0,10);const attendance=rowMap.get(key);const marker=calendarMap.get(key);const sunday=date.getUTCDay()===0;const status=attendance?.status||(date>now?'FUTURE_DATE':marker&&marker.dayType!=='WORKING_DAY'?'HOLIDAY':sunday?'SUNDAY':'NOT_MARKED');return {date:key,status,dayType:marker?.dayType||(sunday?'WEEKLY_OFF':'WORKING_DAY'),title:marker?.title||null,remarks:attendance?.remarks||marker?.description||null,updatedAt:attendance?.updatedAt||marker?.updatedAt||null};});
  return { year, month, session:ctx.session, records };
};

const editableState = (poll) => {
  const response = poll.votes?.[0];
  if (response && ['SUBMITTED', 'LOCKED', 'COMPILED'].includes(response.state)) return { editable: false, reason: 'Submitted feedback is read-only.' };
  if (!['ACTIVE', 'OPEN'].includes(poll.status)) return { editable: false, reason: 'This poll is closed or has been archived.' };
  if (poll.compiledAt || poll.summary) return { editable: false, reason: 'This poll can no longer be edited because its responses have been compiled into the chapter analysis.' };
  if (poll.endAt && poll.endAt <= today()) return { editable: false, reason: 'This poll is closed because the submission deadline has passed.' };
  return { editable: true, reason: null };
};

export const getPolls = async (ctx, mode) => {
  const polls = await prisma.chapterPoll.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId }, include: { subject: { select: { id: true, subjectName: true } }, chapter: { select: { id: true, chapterName: true, chapterNumber: true } }, teacher: { select: { teacherName: true } }, votes: { where: { studentId: ctx.student.id } }, summary: { select: { id: true, isPublished: true } } }, orderBy: { updatedAt: 'desc' } });
  return polls.filter((poll) => {
    const locked = ['SUBMITTED', 'LOCKED', 'COMPILED'].includes(poll.votes[0]?.state);
    return mode === 'pending' ? !locked && editableState(poll).editable : locked;
  }).map((poll) => ({ id: poll.id, submissionId: poll.votes[0]?.id || null, title: poll.title, description: poll.description, instructions: poll.instructions, status: poll.status, startAt: poll.startAt, endAt: poll.endAt, subject: poll.subject, chapter: poll.chapter, teacher: poll.teacher, submission: poll.votes[0] || null, ...editableState(poll), summaryAvailable: Boolean(poll.summary?.isPublished) }));
};

export const getPoll = async (ctx, pollId) => {
  const rows = await getPolls(ctx, 'submitted'); const pending = await getPolls(ctx, 'pending');
  const poll = [...rows, ...pending].find((row) => row.id === pollId || row.submissionId === pollId);
  if (!poll) throw Object.assign(new Error('Poll or submission not found'), { statusCode: 404 });
  return poll;
};

export const saveVote = async (ctx, pollId, body, editing = false) => {
  const poll = await prisma.chapterPoll.findFirst({ where: { id: pollId, schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId }, include: { summary: true, votes: { where: { studentId: ctx.student.id } } } });
  if (!poll) throw Object.assign(new Error('Poll not found'), { statusCode: 404 });
  const state = editableState(poll); if (!state.editable) throw Object.assign(new Error(state.reason), { statusCode: 409 });
  if (editing) throw Object.assign(new Error('Submitted feedback is read-only and cannot be edited'), { statusCode: 409 });
  if (poll.votes.length && ['SUBMITTED','LOCKED','COMPILED'].includes(poll.votes[0].state)) throw Object.assign(new Error('You have already submitted this poll'), { statusCode: 409 });
  const fields = ['understandingRating','teachingRating','paceRating','examplesRating','practiceRating','resourcesRating','confidenceRating','interestRating','doubtResolutionRating','testReadinessRating']; const data = {};
  for (const field of fields) { const value = Number(body[field]); if (!Number.isInteger(value) || value < 1 || value > 5) throw Object.assign(new Error(`${field} must be an integer from 1 to 5`), { statusCode: 400 }); data[field] = value; }
  const now=today(); data.clarityRating=data.teachingRating; data.comment=body.suggestion?String(body.suggestion).trim().slice(0,2000):null; data.suggestion=data.comment; data.difficultArea=body.difficultArea||null; data.helpfulMethod=body.helpfulMethod||null; data.supportNeeded=Array.isArray(body.supportNeeded)?body.supportNeeded:[]; data.state='SUBMITTED'; data.submittedAt=now; data.submittedById=ctx.user?.id||null; data.lockedAt=now; data.lastSavedAt=now; data.version=(poll.votes[0]?.version||0)+1; data.snapshot=JSON.parse(JSON.stringify({...data,pollId:poll.id,studentId:ctx.student.id}));
  return poll.votes.length ? prisma.studentChapterVote.update({ where: { id: poll.votes[0].id }, data }) : prisma.studentChapterVote.create({ data: { ...data, pollId: poll.id, schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, subjectId: poll.subjectId, chapterId: poll.chapterId, studentId: ctx.student.id } });
};

export const getDashboard = async (ctx) => {
  const [subjects, attendance, pending, submitted, classTeacher, resources, mastery] = await Promise.all([getSubjects(ctx), getAttendance(ctx), getPolls(ctx, 'pending'), getPolls(ctx, 'submitted'), prisma.teacherAssignment.findFirst({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, isActive: true, roleType: { in: ['CLASS_TEACHER','BOTH'] }, effectiveFrom: { lte: today() }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: today() } }] }, include: { teacher: { select: { id: true, teacherName: true } }, subject: { select: { subjectName: true } } } }), prisma.sectionResource.findMany({ where: { schoolId: ctx.schoolId, classId: ctx.classId, sectionId: ctx.sectionId, isVisibleToStudents: true }, include: { subject: { select: { id: true, subjectName: true } }, chapter: { select: { id: true, chapterName: true } }, teacher: { select: { teacherName: true } } }, orderBy: { createdAt: 'desc' }, take: 5 }), prisma.studentChapterMastery.findMany({ where: { schoolId: ctx.schoolId, studentId: ctx.student.id, classId: ctx.classId, sectionId: ctx.sectionId }, include: { chapter: { select: { chapterName: true } }, subject: { select: { subjectName: true } } } })]);
  const performance = masteryResult(mastery); const ranked = subjects.filter((s) => s.performance.score != null).sort((a,b) => b.performance.score-a.performance.score);
  return { student: { name: nameOf(ctx.student), className: ctx.student.className, sectionName: ctx.student.section, rollNumber: ctx.student.rollNumber, admissionNo: ctx.student.admissionNo, session: ctx.session }, school: ctx.student.school, classTeacher: classTeacher ? { id: classTeacher.teacher.id, name: classTeacher.teacher.teacherName, subject: classTeacher.subject.subjectName } : null, attendance, counts: { subjects: subjects.length, pendingPolls: pending.length, submittedPolls: submitted.length, completedChapters: subjects.reduce((s,x)=>s+x.chapterCounts.completed,0), improvementChapters: mastery.filter((m)=>Number.isFinite(m.score)&&m.score<60).length }, performance, strongestSubject: ranked[0] || null, improvementSubject: ranked.length ? ranked[ranked.length-1] : null, subjects: subjects.slice(0,6), pendingPolls: pending.slice(0,4), recentResources: resources };
};
