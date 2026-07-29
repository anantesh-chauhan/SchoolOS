import 'dotenv/config';
import prisma from '../src/config/prisma.client.js';

const [polls, teacherPortalPolls, templates, audits, votes, evaluations, migration] = await Promise.all([
  prisma.chapterPoll.findMany({ take: 3, orderBy: { updatedAt: 'desc' } }),
  prisma.chapterPoll.findMany({
    take: 3,
    include: {
      class: { select: { id: true, className: true } },
      section: { select: { id: true, sectionName: true } },
      subject: { select: { id: true, subjectName: true } },
      chapter: { select: { id: true, chapterName: true, chapterNumber: true } },
      teacher: { select: { id: true, teacherName: true } },
      summary: true,
      evaluations: true,
    },
  }),
  prisma.feedbackTemplate.count(),
  prisma.feedbackAuditLog.count(),
  prisma.studentChapterVote.findMany({ take: 1 }),
  prisma.teacherStudentEvaluation.findMany({ take: 1 }),
  prisma.$queryRaw`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations"
    WHERE migration_name = '202607280001_chapter_feedback_performance_module'
  `,
]);

console.log(JSON.stringify({
  migration,
  chapterPollQuery: 'ok',
  pollCount: polls.length,
  pollFields: polls[0] ? Object.keys(polls[0]) : [],
  pollStates: polls.map((poll) => ({ id: poll.id, status: poll.status, startAt: poll.startAt, endAt: poll.endAt })),
  teacherPortalPollQuery: 'ok',
  teacherPortalPollCount: teacherPortalPolls.length,
  templateQuery: 'ok',
  templates,
  auditQuery: 'ok',
  audits,
  studentResponseQuery: 'ok',
  studentResponseFields: votes[0] ? Object.keys(votes[0]) : [],
  studentResponseState: votes[0] ? { state: votes[0].state, version: votes[0].version } : null,
  teacherResponseQuery: 'ok',
  teacherResponseFields: evaluations[0] ? Object.keys(evaluations[0]) : [],
  teacherResponseState: evaluations[0] ? { state: evaluations[0].state, version: evaluations[0].version } : null,
}, null, 2));

await prisma.$disconnect();
