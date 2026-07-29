const toFive = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return number > 5 ? number / 2 : number;
};

const avg = (values) => {
  const nums = values.map(toFive).filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2));
};

const clampScore = (value) => Number(Math.max(0, Math.min(5, value || 0)).toFixed(2));

const compact = (items) => items.filter(Boolean);
const responseScore = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return toFive(number);
};
const studentScore = (row, key) => responseScore(row?.[key]);
const teacherRating = (row, key, fallbackKey = null) => responseScore(row?.[key] ?? (fallbackKey ? row?.[fallbackKey] : null));

const bucketComments = (comments) => {
  const themes = [
    { key: 'clarity', match: ['clear', 'explain', 'understand', 'concept'] },
    { key: 'pace', match: ['fast', 'slow', 'pace', 'speed'] },
    { key: 'practice', match: ['practice', 'question', 'homework', 'revision'] },
    { key: 'difficulty', match: ['difficult', 'hard', 'confusing', 'tough'] },
  ];

  return themes
    .map((theme) => ({
      theme: theme.key,
      count: comments.filter((comment) => theme.match.some((word) => comment.toLowerCase().includes(word))).length,
    }))
    .filter((theme) => theme.count > 0)
    .sort((a, b) => b.count - a.count);
};

const supportCategory = (score) => score >= 4 ? 'Strong' : score >= 3.25 ? 'Progressing Well' : score >= 2.5 ? 'Developing' : score >= 1.75 ? 'Needs Support' : 'Immediate Follow-up Recommended';

export const buildChapterAnalysisSummary = ({ poll, students = [], votes = [], evaluations = [], assessmentResults = [], adminId = null, adminNotes = null }) => {
  const votesByStudentId = new Map(votes.map((vote) => [vote.studentId, vote]));
  const evaluationsByStudentId = new Map(evaluations.map((evaluation) => [evaluation.studentId, evaluation]));
  const assessmentsByStudentId = new Map();
  assessmentResults.forEach((result) => {
    const values = assessmentsByStudentId.get(result.studentId) || [];
    values.push(Number(result.normalizedScore));
    assessmentsByStudentId.set(result.studentId, values);
  });

  const understandingAverage = avg(votes.map((vote) => studentScore(vote, 'understandingRating')));
  const confidenceAverage = avg(votes.map((vote) => studentScore(vote, 'confidenceRating')));
  const difficultyAverage = avg(votes.map((vote) => studentScore(vote, 'difficultyRating')));
  const teachingAverage = avg(votes.map((vote) => studentScore(vote, 'teachingRating')));
  const clarityAverage = avg(votes.map((vote) => studentScore(vote, 'clarityRating') ?? studentScore(vote, 'teachingRating')));
  const paceAverage = avg(votes.map((vote) => studentScore(vote, 'paceRating')));
  const teacherStudentAverage = avg(evaluations.flatMap((evaluation) => [
    teacherRating(evaluation, 'understandingRating', 'conceptClarityRating'),
    teacherRating(evaluation, 'participationRating'),
    teacherRating(evaluation, 'practiceRating', 'homeworkRating'),
    teacherRating(evaluation, 'improvementRating'),
    teacherRating(evaluation, 'applicationRating'),
    teacherRating(evaluation, 'confidenceRating'),
    teacherRating(evaluation, 'independenceRating'),
    teacherRating(evaluation, 'consistencyRating'),
  ]));

  const studentSummaries = students.map((student) => {
    const vote = votesByStudentId.get(student.id);
    const evaluation = evaluationsByStudentId.get(student.id);
    const assessmentValues = assessmentsByStudentId.get(student.id) || [];
    const assessmentPercent = assessmentValues.length ? avg(assessmentValues.map((value) => value / 20)) * 20 : null;
    const selfScore = avg(compact([studentScore(vote, 'understandingRating'), studentScore(vote, 'confidenceRating'), studentScore(vote, 'testReadinessRating')]));
    const teacherScore = avg(compact([
      teacherRating(evaluation, 'understandingRating', 'conceptClarityRating'),
      teacherRating(evaluation, 'participationRating'),
      teacherRating(evaluation, 'practiceRating', 'homeworkRating'),
      teacherRating(evaluation, 'applicationRating'),
      teacherRating(evaluation, 'confidenceRating'),
      teacherRating(evaluation, 'improvementRating'),
      teacherRating(evaluation, 'independenceRating'),
      teacherRating(evaluation, 'consistencyRating'),
    ]));
    const supportScore = avg(compact([studentScore(vote, 'confidenceRating'), studentScore(vote, 'testReadinessRating'), teacherRating(evaluation, 'participationRating'), teacherRating(evaluation, 'practiceRating', 'homeworkRating')]));
    const combinedScore = clampScore((selfScore * 0.4) + (teacherScore * 0.4) + (supportScore * 0.2));
    const perceptionGap = vote && evaluation ? Number(Math.abs(teacherRating(evaluation, 'understandingRating', 'conceptClarityRating') - studentScore(vote, 'understandingRating')).toFixed(2)) : null;
    const assessmentOnFive = assessmentPercent == null ? null : assessmentPercent / 20;
    let perceptionIndicator = null;
    if (perceptionGap >= 1.5 && assessmentOnFive != null) {
      if (studentScore(vote, 'understandingRating') < teacherRating(evaluation, 'understandingRating', 'conceptClarityRating') && assessmentOnFive >= 3.5) perceptionIndicator = 'Performance evidence is stronger than self-confidence; confidence-building support may help.';
      if (studentScore(vote, 'understandingRating') > teacherRating(evaluation, 'understandingRating', 'conceptClarityRating') && assessmentOnFive < 3) perceptionIndicator = 'Self-readiness may be higher than current performance evidence; guided practice may help.';
    }

    return {
      studentId: student.id,
      name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '),
      rollNumber: student.rollNumber,
      combinedScore,
      teacherFeedbackAverage: teacherScore,
      studentSelfAssessmentAverage: selfScore,
      chapterReadinessScore: combinedScore,
      supportNeedLevel: supportCategory(combinedScore),
      perceptionGap,
      perceptionIndicator,
      assessmentPercent,
      rawValues: { teacher: evaluation || null, student: vote || null, assessmentPercent },
      normalizedValues: { teacherAverage: teacherScore, studentAverage: selfScore, assessmentOnFive },
      formulaVersion: 'chapter-feedback-v2.0',
      selfSubmitted: Boolean(vote),
      teacherEvaluated: Boolean(evaluation),
      strengths: compact([
        studentScore(vote, 'understandingRating') >= 4 ? 'Good chapter understanding' : null,
        studentScore(vote, 'confidenceRating') >= 4 ? 'Confident with questions' : null,
        teacherRating(evaluation, 'participationRating') >= 4 ? 'Active participation' : null,
        teacherRating(evaluation, 'practiceRating', 'homeworkRating') >= 4 ? 'Consistent practice' : null,
        evaluation?.strengths || null,
      ]),
      weaknesses: compact([
        studentScore(vote, 'difficultyRating') >= 4 ? 'Finds the chapter difficult' : null,
        vote?.understandingRating && studentScore(vote, 'understandingRating') <= 2 ? 'Needs concept revision' : null,
        vote?.confidenceRating && studentScore(vote, 'confidenceRating') <= 2 ? 'May need confidence-building support' : null,
        teacherRating(evaluation, 'improvementRating') != null && teacherRating(evaluation, 'improvementRating') <= 2 ? 'May benefit from focused follow-up' : null,
        evaluation?.weaknesses || null,
      ]),
      recommendation: evaluation?.recommendation || (combinedScore < 3 ? 'Schedule a short revision and practice check.' : 'Continue regular practice.'),
    };
  });

  const riskStudents = studentSummaries
    .filter((student) => student.combinedScore < 3 || student.weaknesses.length >= 2)
    .sort((a, b) => a.combinedScore - b.combinedScore)
    .slice(0, 10);

  const topperStudents = studentSummaries
    .filter((student) => student.combinedScore >= 4)
    .sort((a, b) => b.combinedScore - a.combinedScore)
    .slice(0, 10);

  const comments = votes.map((vote) => vote.comment).filter(Boolean);
  const commonThemes = bucketComments(comments);
  const understandingDistribution = [
    { range: '1', count: votes.filter((vote) => studentScore(vote, 'understandingRating') === 1).length },
    { range: '2', count: votes.filter((vote) => studentScore(vote, 'understandingRating') === 2).length },
    { range: '3', count: votes.filter((vote) => studentScore(vote, 'understandingRating') === 3).length },
    { range: '4', count: votes.filter((vote) => studentScore(vote, 'understandingRating') === 4).length },
    { range: '5', count: votes.filter((vote) => studentScore(vote, 'understandingRating') === 5).length },
  ];

  const classWeaknesses = compact([
    understandingAverage && understandingAverage < 3 ? 'Average understanding is below expected level' : null,
    confidenceAverage && confidenceAverage < 3 ? 'Students need more confidence-building practice' : null,
    difficultyAverage >= 4 ? 'Chapter is perceived as difficult' : null,
    riskStudents.length ? `${riskStudents.length} students need attention` : null,
  ]);

  const teacherImprovementAreas = compact([
    clarityAverage && clarityAverage < 3.5 ? 'Improve explanation clarity with more examples' : null,
    paceAverage && paceAverage < 3.5 ? 'Review teaching pace for this section' : null,
    teachingAverage && teachingAverage < 3.5 ? 'Add recap and practice checkpoints' : null,
    ...commonThemes.slice(0, 2).map((theme) => `Review ${theme.theme} feedback theme`),
  ]);

  return {
    pollId: poll.id,
    schoolId: poll.schoolId,
    classId: poll.classId,
    sectionId: poll.sectionId,
    subjectId: poll.subjectId,
    chapterId: poll.chapterId,
    teacherId: poll.teacherId || null,
    compiledByAdminId: adminId,
    overallUnderstandingScore: clampScore((understandingAverage * 0.55) + (confidenceAverage * 0.25) + ((6 - difficultyAverage) * 0.2)),
    overallTeachingScore: clampScore((teachingAverage * 0.5) + (clarityAverage * 0.3) + (paceAverage * 0.2)),
    classStrengths: compact([
      understandingAverage >= 4 ? 'Strong chapter understanding' : null,
      confidenceAverage >= 4 ? 'High confidence in problem solving' : null,
      teacherStudentAverage >= 4 ? 'Teacher reports strong class engagement' : null,
      topperStudents.length ? `${topperStudents.length} high-performing students identified` : null,
    ]),
    classWeaknesses,
    teacherStrengths: compact([
      teachingAverage >= 4 ? 'Students rated teaching quality positively' : null,
      clarityAverage >= 4 ? 'Clear explanations' : null,
      paceAverage >= 4 ? 'Comfortable teaching pace' : null,
    ]),
    teacherImprovementAreas,
    studentSummaries,
    riskStudents,
    topperStudents,
    recommendations: compact([
      classWeaknesses.length ? 'Run a targeted revision session before the next assessment.' : null,
      riskStudents.length ? 'Create a support group for students needing attention.' : null,
      difficultyAverage >= 4 ? 'Add more solved examples and guided practice.' : null,
      teacherImprovementAreas.length ? 'Teacher should review summarized feedback themes and adapt the next lesson.' : null,
      'Share the compiled summary only after admin approval.',
      { formulaVersion: 'chapter-feedback-v2.0', responseCount: votes.length, eligibleStudents: students.length, understandingDistribution },
    ]),
    adminNotes,
  };
};
