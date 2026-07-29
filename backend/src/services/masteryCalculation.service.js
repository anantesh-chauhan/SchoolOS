import prisma from '../config/prisma.client.js';

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

const avg = (values) => {
  const nums = values.map(Number).filter(Number.isFinite);
  if (!nums.length) return null;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2));
};

const ratingToScore = (value) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return clamp((number / (number > 5 ? 10 : 5)) * 100);
};
const inverseRatingToScore = (value) => {
  if (value == null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const onFive = number > 5 ? number / 2 : number;
  return ratingToScore(6 - onFive);
};

export const masteryLevelForScore = (score) => {
  if (!Number.isFinite(Number(score))) return null;
  if (score < 40) return 'CRITICAL';
  if (score < 60) return 'NEEDS_ATTENTION';
  if (score < 75) return 'DEVELOPING';
  if (score < 90) return 'PROFICIENT';
  return 'MASTERED';
};

const confidenceForSignals = (availableSignals, totalSignals) => {
  if (availableSignals < 2) return 'INSUFFICIENT_DATA';
  if (availableSignals / totalSignals < 0.75) return 'PRELIMINARY';
  return 'RELIABLE';
};

const summarizeStudent = ({ name, score, level, confidence, components, gaps }) => {
  if (confidence === 'INSUFFICIENT_DATA') {
    return `${name} does not have enough chapter evidence yet for a reliable mastery score.`;
  }
  const readableLevel = String(level || 'DEVELOPING').replace(/_/g, ' ').toLowerCase();
  const strongest = components.filter((item) => item.available).sort((a, b) => b.score - a.score)[0];
  const weakest = components.filter((item) => item.available).sort((a, b) => a.score - b.score)[0];
  const notes = [`${name} is currently ${readableLevel} in this chapter with ${Math.round(score)}% mastery.`];
  if (strongest) notes.push(`Strongest signal: ${strongest.label}.`);
  if (weakest && weakest.score < 60) notes.push(`${weakest.label} needs attention.`);
  if (gaps.length) notes.push(gaps[0].explanation);
  return notes.join(' ');
};

export const calculateStudentMastery = ({ student, vote, evaluation, assessmentResults = [] }) => {
  const assessmentScore = avg(assessmentResults.map((result) => result.normalizedScore));
  const teacherScore = evaluation
    ? avg([
        evaluation.attentionRating,
        evaluation.participationRating,
        evaluation.homeworkRating,
        evaluation.conceptClarityRating,
        6 - evaluation.improvementNeedRating,
      ].map(ratingToScore))
    : null;
  const selfScore = vote ? avg([
    ratingToScore(vote.understandingRating),
    ratingToScore(vote.confidenceRating),
    inverseRatingToScore(vote.difficultyRating),
  ]) : null;
  const assignmentScore = evaluation ? ratingToScore(evaluation.homeworkRating) : null;

  const components = [
    { key: 'assessment', label: 'Assessment performance', score: assessmentScore, baseWeight: 40 },
    { key: 'teacherEvaluation', label: 'Teacher evaluation', score: teacherScore, baseWeight: 25 },
    { key: 'studentFeedback', label: 'Student self-assessment', score: selfScore, baseWeight: 15 },
    { key: 'assignment', label: 'Assignment/homework signal', score: assignmentScore, baseWeight: 10 },
  ].map((component) => ({ ...component, available: Number.isFinite(component.score) }));

  const available = components.filter((component) => component.available);
  const totalWeight = available.reduce((sum, component) => sum + component.baseWeight, 0);
  const score = totalWeight
    ? Number(available.reduce((sum, component) => sum + (component.score * component.baseWeight) / totalWeight, 0).toFixed(2))
    : null;
  const confidence = confidenceForSignals(available.length, components.length);
  const level = masteryLevelForScore(score);
  const gaps = [];

  if (Number.isFinite(score) && score < 40) {
    gaps.push({
      gapType: 'CRITICAL_CHAPTER_GAP',
      severity: 'CRITICAL',
      explanation: 'Chapter mastery is below 40%, so focused support is recommended.',
      evidence: { masteryScore: score },
    });
  } else if (Number.isFinite(score) && score < 60) {
    gaps.push({
      gapType: 'NEEDS_ATTENTION',
      severity: 'MEDIUM',
      explanation: 'Chapter mastery is between 40% and 59%, so revision and practice are recommended.',
      evidence: { masteryScore: score },
    });
  }

  if (vote && Number.isFinite(assessmentScore) && ratingToScore(vote.understandingRating) >= 80 && assessmentScore < 50) {
    gaps.push({
      gapType: 'POSSIBLE_HIDDEN_LEARNING_GAP',
      severity: 'HIGH',
      explanation: 'Perceived understanding is significantly higher than demonstrated assessment performance.',
      evidence: { selfUnderstanding: vote.understandingRating, assessmentScore },
    });
  }

  if (vote && Number.isFinite(assessmentScore) && ratingToScore(vote.confidenceRating) <= 40 && assessmentScore >= 75) {
    gaps.push({
      gapType: 'LOW_CONFIDENCE',
      severity: 'LOW',
      explanation: 'Assessment performance is strong, but the student reported low confidence.',
      evidence: { confidenceRating: vote.confidenceRating, assessmentScore },
    });
  }

  const name = [student.studentFirstName, student.studentLastName].filter(Boolean).join(' ');
  return {
    studentId: student.id,
    score,
    masteryLevel: level,
    confidence,
    componentBreakdown: components.map((component) => ({
      key: component.key,
      label: component.label,
      score: component.available ? component.score : null,
      baseWeight: component.baseWeight,
      appliedWeight: component.available && totalWeight ? Number(((component.baseWeight / totalWeight) * 100).toFixed(2)) : 0,
      available: component.available,
    })),
    dataCompleteness: {
      availableSignals: available.length,
      totalSignals: components.length,
      percent: Number(((available.length / components.length) * 100).toFixed(2)),
    },
    gaps,
    summary: summarizeStudent({ name, score, level, confidence, components, gaps }),
  };
};

export const getSectionStudentsForContext = async ({ schoolId, classId, sectionId }) => {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId, classId, deletedAt: null },
    include: { class: true },
  });
  if (!section) return [];
  return prisma.student.findMany({
    where: {
      schoolId,
      className: section.class.className,
      section: section.sectionName,
      isActive: true,
    },
    orderBy: [{ rollNumber: 'asc' }, { studentFirstName: 'asc' }],
  });
};

export const recalculateMasteryForPoll = async (poll) => {
  const [students, votes, evaluations, assessmentResults] = await Promise.all([
    getSectionStudentsForContext(poll),
    prisma.studentChapterVote.findMany({ where: { pollId: poll.id, schoolId: poll.schoolId } }),
    prisma.teacherStudentEvaluation.findMany({ where: { pollId: poll.id, schoolId: poll.schoolId } }),
    prisma.chapterAssessmentResult.findMany({
      where: { schoolId: poll.schoolId, classId: poll.classId, sectionId: poll.sectionId, subjectId: poll.subjectId, chapterId: poll.chapterId },
    }),
  ]);

  const votesByStudent = new Map(votes.map((vote) => [vote.studentId, vote]));
  const evaluationsByStudent = new Map(evaluations.map((evaluation) => [evaluation.studentId, evaluation]));
  const resultsByStudent = assessmentResults.reduce((map, result) => {
    map.set(result.studentId, [...(map.get(result.studentId) || []), result]);
    return map;
  }, new Map());

  const rows = students.map((student) => calculateStudentMastery({
    student,
    vote: votesByStudent.get(student.id),
    evaluation: evaluationsByStudent.get(student.id),
    assessmentResults: resultsByStudent.get(student.id) || [],
  }));

  await prisma.$transaction([
    ...rows.map((row) => prisma.studentChapterMastery.upsert({
      where: {
        schoolId_classId_sectionId_subjectId_chapterId_studentId: {
          schoolId: poll.schoolId,
          classId: poll.classId,
          sectionId: poll.sectionId,
          subjectId: poll.subjectId,
          chapterId: poll.chapterId,
          studentId: row.studentId,
        },
      },
      create: {
        schoolId: poll.schoolId,
        classId: poll.classId,
        sectionId: poll.sectionId,
        subjectId: poll.subjectId,
        chapterId: poll.chapterId,
        studentId: row.studentId,
        score: row.score,
        masteryLevel: row.masteryLevel,
        confidence: row.confidence,
        componentBreakdown: row.componentBreakdown,
        dataCompleteness: row.dataCompleteness,
        summary: row.summary,
      },
      update: {
        score: row.score,
        masteryLevel: row.masteryLevel,
        confidence: row.confidence,
        componentBreakdown: row.componentBreakdown,
        dataCompleteness: row.dataCompleteness,
        summary: row.summary,
        calculatedAt: new Date(),
      },
    })),
    prisma.learningGap.updateMany({
      where: { schoolId: poll.schoolId, classId: poll.classId, sectionId: poll.sectionId, subjectId: poll.subjectId, chapterId: poll.chapterId, isResolved: false },
      data: { isResolved: true, resolvedAt: new Date() },
    }),
    ...rows.flatMap((row) => row.gaps.map((gap) => prisma.learningGap.create({
      data: {
        schoolId: poll.schoolId,
        classId: poll.classId,
        sectionId: poll.sectionId,
        subjectId: poll.subjectId,
        chapterId: poll.chapterId,
        studentId: row.studentId,
        gapType: gap.gapType,
        severity: gap.severity,
        explanation: gap.explanation,
        evidence: gap.evidence,
      },
    }))),
  ]);

  return rows;
};

export const saveAssessmentWithResults = async ({ poll, teacherId = null, payload }) => {
  const maxScore = Number(payload.maxScore);
  if (!Number.isFinite(maxScore) || maxScore <= 0) {
    const error = new Error('maxScore must be greater than zero.');
    error.statusCode = 400;
    throw error;
  }

  const results = Array.isArray(payload.results) ? payload.results : [];
  if (!results.length) {
    const error = new Error('results array is required.');
    error.statusCode = 400;
    throw error;
  }

  const students = await getSectionStudentsForContext(poll);
  const allowedStudentIds = new Set(students.map((student) => student.id));
  results.forEach((result) => {
    if (!allowedStudentIds.has(result.studentId)) throw new Error('One or more students do not belong to this section.');
    const rawScore = Number(result.rawScore);
    if (!Number.isFinite(rawScore) || rawScore < 0 || rawScore > maxScore) throw new Error('Each rawScore must be between 0 and maxScore.');
  });

  const assessment = await prisma.chapterAssessment.create({
    data: {
      schoolId: poll.schoolId,
      classId: poll.classId,
      sectionId: poll.sectionId,
      subjectId: poll.subjectId,
      chapterId: poll.chapterId,
      pollId: poll.id,
      teacherId,
      title: payload.title?.trim() || 'Chapter assessment',
      assessmentType: payload.assessmentType || 'CHAPTER_QUIZ',
      assessmentDate: payload.assessmentDate ? new Date(payload.assessmentDate) : new Date(),
      maxScore,
      notes: payload.notes?.trim() || null,
      results: {
        create: results.map((result) => ({
          schoolId: poll.schoolId,
          classId: poll.classId,
          sectionId: poll.sectionId,
          subjectId: poll.subjectId,
          chapterId: poll.chapterId,
          studentId: result.studentId,
          rawScore: Number(result.rawScore),
          maxScore,
          normalizedScore: Number(((Number(result.rawScore) / maxScore) * 100).toFixed(2)),
          isReassessment: Boolean(result.isReassessment || payload.assessmentType === 'REASSESSMENT'),
          reassessmentNumber: Number(result.reassessmentNumber || 0),
          notes: result.notes?.trim() || null,
        })),
      },
    },
    include: { results: true },
  });

  await recalculateMasteryForPoll(poll);
  return assessment;
};
