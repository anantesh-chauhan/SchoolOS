const avg = (values) => {
  const nums = values.map(Number).filter((value) => Number.isFinite(value));
  if (!nums.length) return 0;
  return Number((nums.reduce((sum, value) => sum + value, 0) / nums.length).toFixed(2));
};

const clampScore = (value) => Number(Math.max(0, Math.min(5, value || 0)).toFixed(2));

const compact = (items) => items.filter(Boolean);

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

export const buildChapterAnalysisSummary = ({ poll, students = [], votes = [], evaluations = [], adminId = null, adminNotes = null }) => {
  const votesByStudentId = new Map(votes.map((vote) => [vote.studentId, vote]));
  const evaluationsByStudentId = new Map(evaluations.map((evaluation) => [evaluation.studentId, evaluation]));

  const understandingAverage = avg(votes.map((vote) => vote.understandingRating));
  const confidenceAverage = avg(votes.map((vote) => vote.confidenceRating));
  const difficultyAverage = avg(votes.map((vote) => vote.difficultyRating));
  const teachingAverage = avg(votes.map((vote) => vote.teachingRating));
  const clarityAverage = avg(votes.map((vote) => vote.clarityRating));
  const paceAverage = avg(votes.map((vote) => vote.paceRating));
  const teacherStudentAverage = avg(evaluations.flatMap((evaluation) => [
    evaluation.attentionRating,
    evaluation.participationRating,
    evaluation.homeworkRating,
    evaluation.conceptClarityRating,
    6 - evaluation.improvementNeedRating,
  ]));

  const studentSummaries = students.map((student) => {
    const vote = votesByStudentId.get(student.id);
    const evaluation = evaluationsByStudentId.get(student.id);
    const selfScore = avg(compact([vote?.understandingRating, vote?.confidenceRating]));
    const teacherScore = avg(compact([
      evaluation?.attentionRating,
      evaluation?.participationRating,
      evaluation?.homeworkRating,
      evaluation?.conceptClarityRating,
      evaluation ? 6 - evaluation.improvementNeedRating : null,
    ]));
    const supportScore = avg(compact([vote?.confidenceRating, evaluation?.participationRating, evaluation?.homeworkRating]));
    const combinedScore = clampScore((selfScore * 0.4) + (teacherScore * 0.4) + (supportScore * 0.2));

    return {
      studentId: student.id,
      name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '),
      rollNumber: student.rollNumber,
      combinedScore,
      selfSubmitted: Boolean(vote),
      teacherEvaluated: Boolean(evaluation),
      strengths: compact([
        vote?.understandingRating >= 4 ? 'Good chapter understanding' : null,
        vote?.confidenceRating >= 4 ? 'Confident with questions' : null,
        evaluation?.participationRating >= 4 ? 'Active participation' : null,
        evaluation?.homeworkRating >= 4 ? 'Consistent homework' : null,
        evaluation?.strengths || null,
      ]),
      weaknesses: compact([
        vote?.difficultyRating >= 4 ? 'Finds the chapter difficult' : null,
        vote?.understandingRating && vote.understandingRating <= 2 ? 'Needs concept revision' : null,
        vote?.confidenceRating && vote.confidenceRating <= 2 ? 'Low confidence' : null,
        evaluation?.improvementNeedRating >= 4 ? 'Needs focused attention' : null,
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
    ]),
    adminNotes,
  };
};
