import prisma from '../src/config/prisma.client.js';

const defaultRules = [
  ['LOW_ATTENDANCE', 'Attendance below target', 'HIGH', 75],
  ['ATTENDANCE_DECLINING', 'Attendance declining', 'MEDIUM', null],
  ['CONSECUTIVE_ABSENCES', 'Consecutive absences', 'HIGH', 3],
  ['LOW_HOMEWORK_COMPLETION', 'Homework completion below target', 'HIGH', 70],
  ['MISSING_HOMEWORK', 'Several assignments missing', 'MEDIUM', 3],
  ['WEAK_CHAPTERS', 'Multiple weak chapters', 'HIGH', 2],
  ['LOW_ACADEMIC_HEALTH', 'Academic health below review threshold', 'MEDIUM', 70],
  ['ASSESSMENT_DECLINING', 'Assessment results declining', 'MEDIUM', null],
  ['TEACHER_CONCERN', 'Teacher concern recorded', 'HIGH', null],
  ['NO_IMPROVEMENT_AFTER_INTERVENTION', 'No improvement after intervention', 'HIGH', null],
];

const outcomeTemplates = [
  'Explain the key ideas in this chapter',
  'Apply the concept to a guided problem',
  'Solve an unfamiliar problem independently',
];

const demoProfiles = [
  { name: 'High performer with strong attendance', attendance: 0.96, homework: 1, scores: [88, 92, 95] },
  { name: 'High performer with weak attendance', attendance: 0.62, homework: 1, scores: [86, 90, 93] },
  { name: 'Average student improving gradually', attendance: 0.84, homework: 0.75, scores: [58, 68, 78] },
  { name: 'Student with low homework completion', attendance: 0.9, homework: 0.25, scores: [61, 63, 64] },
  { name: 'Student weak in one subject only', attendance: 0.88, homework: 0.75, scores: [82, 45, 80] },
  { name: 'Student weak in several chapters', attendance: 0.78, homework: 0.5, scores: [48, 42, 51] },
  { name: 'Student with declining exam scores', attendance: 0.82, homework: 0.75, scores: [86, 70, 54] },
  { name: 'Student with insufficient data', attendance: null, homework: null, scores: [] },
  { name: 'Student improving after intervention', attendance: 0.86, homework: 0.75, scores: [44, 56, 76], intervention: true },
  { name: 'Student with good marks but low participation', attendance: 0.92, homework: 1, scores: [84, 86, 88], lowParticipation: true },
];

const addDays = (value, count) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + count);
  return date;
};

async function seedVariedProfiles(school) {
  const session = await prisma.academicSession.findFirst({ where: { schoolId: school.id, isActive: true }, orderBy: { startDate: 'desc' } });
  if (!session) return;
  const students = await prisma.student.findMany({ where: { schoolId: school.id, isActive: true }, orderBy: { createdAt: 'asc' }, take: demoProfiles.length });
  for (let index = 0; index < students.length; index += 1) {
    const student = students[index];
    const profile = demoProfiles[index];
    const classRow = await prisma.class.findFirst({ where: { schoolId: school.id, className: student.className, deletedAt: null } });
    const section = classRow && student.section ? await prisma.section.findFirst({ where: { schoolId: school.id, classId: classRow.id, sectionName: student.section, deletedAt: null } }) : null;
    if (!classRow || !section) continue;
    const chapters = await prisma.chapter.findMany({ where: { schoolId: school.id, classId: classRow.id, deletedAt: null, OR: [{ sectionId: section.id }, { sectionId: null }] }, orderBy: [{ subjectId: 'asc' }, { chapterNumber: 'asc' }], take: 3 });
    if (!chapters.length) continue;

    const attendanceDays = profile.attendance === null ? 1 : 30;
    for (let day = 0; day < attendanceDays; day += 1) {
      const attendanceDate = addDays(session.startDate, day + 5);
      const present = profile.attendance === null ? true : day / attendanceDays < profile.attendance;
      await prisma.studentAttendance.upsert({
        where: { schoolId_classId_sectionId_studentId_attendanceDate: { schoolId: school.id, classId: classRow.id, sectionId: section.id, studentId: student.id, attendanceDate } },
        update: {},
        create: { schoolId: school.id, classId: classRow.id, sectionId: section.id, studentId: student.id, attendanceDate, academicSession: session.name, status: present ? 'PRESENT' : 'ABSENT', attendanceUnits: present ? 1 : 0, remarks: `Analytics demo: ${profile.name}` },
      });
    }

    for (let assessmentIndex = 0; assessmentIndex < profile.scores.length; assessmentIndex += 1) {
      const chapter = chapters[assessmentIndex % chapters.length];
      const title = `[Analytics demo ${index + 1}] Assessment ${assessmentIndex + 1}`;
      let assessment = await prisma.chapterAssessment.findFirst({ where: { schoolId: school.id, classId: classRow.id, sectionId: section.id, chapterId: chapter.id, title } });
      if (!assessment) assessment = await prisma.chapterAssessment.create({ data: {
        schoolId: school.id, classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id,
        title, assessmentType: assessmentIndex === 2 ? 'CLASS_TEST' : 'CHAPTER_QUIZ',
        assessmentDate: addDays(session.startDate, 35 + assessmentIndex * 30), maxScore: 100,
        notes: profile.name,
      } });
      const score = profile.scores[assessmentIndex];
      await prisma.chapterAssessmentResult.upsert({
        where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
        update: { rawScore: score, maxScore: 100, normalizedScore: score },
        create: { assessmentId: assessment.id, schoolId: school.id, classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id, studentId: student.id, rawScore: score, maxScore: 100, normalizedScore: score, notes: profile.name },
      });
    }

    if (profile.scores.length) {
      const chapter = chapters[0];
      const assignment = await prisma.teacherAssignment.findFirst({
        where: { schoolId: school.id, classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, isActive: true },
      });
      const poll = await prisma.chapterPoll.upsert({
        where: { schoolId_classId_sectionId_subjectId_chapterId: { schoolId: school.id, classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id } },
        update: {},
        create: {
          schoolId: school.id, classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id,
          teacherId: assignment?.teacherId || null, title: `[Analytics demo] ${chapter.chapterName} reflection`, status: 'ACTIVE',
          description: 'Student-friendly chapter understanding reflection.',
        },
      });
      const finalScore = profile.scores.at(-1);
      const rating = Math.max(1, Math.min(5, Math.round(finalScore / 20)));
      await prisma.studentChapterVote.upsert({
        where: { pollId_studentId: { pollId: poll.id, studentId: student.id } },
        update: {},
        create: {
          pollId: poll.id, schoolId: school.id, classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id, studentId: student.id,
          understandingRating: rating, difficultyRating: 6 - rating, confidenceRating: rating, teachingRating: 4, paceRating: 4, clarityRating: 4,
          comment: profile.name,
        },
      });
      if (assignment?.teacherId) {
        await prisma.teacherStudentEvaluation.upsert({
          where: { pollId_teacherId_studentId: { pollId: poll.id, teacherId: assignment.teacherId, studentId: student.id } },
          update: {},
          create: {
            pollId: poll.id, schoolId: school.id, classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id,
            teacherId: assignment.teacherId, studentId: student.id,
            attentionRating: profile.lowParticipation ? 2 : rating,
            participationRating: profile.lowParticipation ? 1 : rating,
            homeworkRating: profile.homework === null ? 3 : Math.max(1, Math.round(profile.homework * 5)),
            conceptClarityRating: rating, improvementNeedRating: finalScore < 60 ? 4 : 2,
            strengths: finalScore >= 75 ? 'Demonstrates secure understanding in recorded assessments.' : 'Responds to guided practice.',
            weaknesses: profile.lowParticipation ? 'Participation is currently limited despite strong recorded marks.' : finalScore < 60 ? 'Some concepts require targeted revision.' : null,
            recommendation: profile.lowParticipation ? 'Use low-pressure participation prompts and monitor confidence.' : 'Continue focused practice and review progress.',
          },
        });
      }
    }

    if (profile.homework !== null) {
      for (let homeworkIndex = 0; homeworkIndex < 4; homeworkIndex += 1) {
        const chapter = chapters[homeworkIndex % chapters.length];
        const title = `[Analytics demo ${index + 1}] Homework ${homeworkIndex + 1}`;
        let homework = await prisma.homework.findFirst({ where: { schoolId: school.id, title } });
        if (!homework) {
          homework = await prisma.homework.create({ data: {
            schoolId: school.id, academicSession: session.name, createdByRole: 'ADMIN',
            classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id,
            title, description: profile.name, homeworkType: 'PRACTICE', maximumMarks: 100,
            status: 'PUBLISHED', publishedAt: addDays(session.startDate, 15 + homeworkIndex * 7),
            assignedAt: addDays(session.startDate, 15 + homeworkIndex * 7), dueAt: addDays(session.startDate, 20 + homeworkIndex * 7),
            audienceMode: 'SELECTED_STUDENTS', audienceScope: 'SELECTED_STUDENTS',
          } });
          await prisma.homeworkAudience.create({ data: { schoolId: school.id, homeworkId: homework.id, studentId: student.id, kind: 'INCLUDE' } });
        }
        if (homeworkIndex < Math.round(4 * profile.homework)) {
          await prisma.homeworkSubmission.upsert({
            where: { homeworkId_studentId_attemptNumber: { homeworkId: homework.id, studentId: student.id, attemptNumber: 1 } },
            update: {},
            create: { schoolId: school.id, homeworkId: homework.id, studentId: student.id, attemptNumber: 1, submittedAt: addDays(session.startDate, 19 + homeworkIndex * 7), status: 'GRADED', marksAwarded: Math.max(40, profile.scores.at(-1) || 70), reviewedAt: addDays(session.startDate, 21 + homeworkIndex * 7), marksReleasedAt: addDays(session.startDate, 21 + homeworkIndex * 7) },
          });
        }
      }
    }

    if (profile.intervention) {
      const chapter = chapters[0];
      const existing = await prisma.learningIntervention.findFirst({ where: { schoolId: school.id, studentId: student.id, title: '[Analytics demo] Targeted revision plan' } });
      if (!existing) await prisma.learningIntervention.create({ data: {
        schoolId: school.id, classId: classRow.id, sectionId: section.id, subjectId: chapter.subjectId, chapterId: chapter.id, studentId: student.id,
        interventionType: 'REVISION_PLAN', title: '[Analytics demo] Targeted revision plan', priority: 'HIGH',
        reason: 'Early assessments indicated that focused revision may be helpful.', recommendedAction: 'Complete a two-week revision plan and short reassessment.',
        status: 'COMPLETED', startDate: addDays(session.startDate, 45), dueDate: addDays(session.startDate, 59), completedAt: addDays(session.startDate, 59),
        beforeScore: profile.scores[0], afterScore: profile.scores.at(-1), improvement: profile.scores.at(-1) - profile.scores[0],
        outcome: 'Scores improved after the follow-up period. This is an association and does not establish causation.', parentVisible: true,
      } });
    }
  }
}

async function seedSchool(school) {
  await prisma.analyticsConfiguration.upsert({
    where: { schoolId: school.id },
    update: {},
    create: { schoolId: school.id },
  });
  for (const [code, title, severity, threshold] of defaultRules) {
    await prisma.analyticsRiskRule.upsert({
      where: { schoolId_code: { schoolId: school.id, code } },
      update: {},
      create: { schoolId: school.id, code, title, severity, threshold, description: `${title}. The rule remains explainable and configurable by the school.` },
    });
  }

  const chapters = await prisma.chapter.findMany({
    where: { schoolId: school.id, deletedAt: null },
    select: { id: true },
    orderBy: [{ subjectId: 'asc' }, { chapterNumber: 'asc' }],
    take: 12,
  });
  for (const chapter of chapters) {
    for (let order = 0; order < outcomeTemplates.length; order += 1) {
      const title = outcomeTemplates[order];
      await prisma.learningOutcome.upsert({
        where: { schoolId_chapterId_title: { schoolId: school.id, chapterId: chapter.id, title } },
        update: {},
        create: { schoolId: school.id, chapterId: chapter.id, title, order },
      });
    }
  }

  // Convert existing aggregate activity into one initial event per resource and
  // student. Further UI events remain event-level and are rapid-event deduplicated.
  const activities = await prisma.resourceActivity.findMany({
    where: { schoolId: school.id, resourceId: { not: null } },
    take: 300,
  });
  for (const activity of activities) {
    const eventType = activity.kind === 'COMPLETION' ? 'COMPLETED'
      : activity.kind === 'DOWNLOAD' ? 'DOWNLOADED' : 'OPENED';
    await prisma.resourceEngagementEvent.upsert({
      where: { dedupeKey: `seed:${activity.id}` },
      update: {},
      create: {
        schoolId: school.id, resourceId: activity.resourceId, studentId: activity.studentId,
        eventType, occurredAt: activity.lastAt, dedupeKey: `seed:${activity.id}`,
      },
    });
  }
  await seedVariedProfiles(school);
}

async function main() {
  const schools = await prisma.school.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'asc' } });
  if (schools.length < 2) {
    console.warn('Analytics seed expects at least two existing schools; seeding all available schools without inventing tenant records.');
  }
  for (const school of schools) await seedSchool(school);
  console.log(`Analytics configuration, rules, outcomes, and engagement evidence seeded for ${schools.length} school(s).`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => prisma.$disconnect());
