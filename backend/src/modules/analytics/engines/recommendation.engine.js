const recommendations = {
  LOW_ATTENDANCE: {
    TEACHER: ['Review recent absences', 'Speak with the student about recent attendance and identify support needs.'],
    STUDENT: ['Improve attendance routine', 'Attend scheduled classes consistently and ask for help with missed lessons.'],
    PARENT: ['Review attendance together', 'Discuss recent absences and support a consistent school routine.'],
  },
  MISSING_HOMEWORK: {
    TEACHER: ['Review missing assignments', 'Confirm barriers and agree on a realistic completion plan.'],
    STUDENT: ['Complete pending homework', 'Prioritize the oldest missing assignments and ask the teacher about deadlines.'],
    PARENT: ['Support a homework plan', 'Help create a short, regular homework routine and review pending work.'],
  },
  WEAK_CHAPTERS: {
    TEACHER: ['Plan targeted revision', 'Use a short diagnostic activity before assigning focused revision.'],
    STUDENT: ['Revise weak chapters', 'Review the recommended chapter resources and attempt a practice activity.'],
    PARENT: ['Encourage regular revision', 'Support a manageable revision schedule and contact the teacher if help is needed.'],
  },
  ASSESSMENT_DECLINING: {
    TEACHER: ['Review assessment decline', 'Compare recent assessments and check for concept-specific learning gaps.'],
    STUDENT: ['Review recent mistakes', 'Rework missed questions and ask the subject teacher to explain unclear concepts.'],
    PARENT: ['Discuss the recent trend', 'Ask the child what has become difficult and contact the teacher if the decline continues.'],
  },
  LOW_ACADEMIC_HEALTH: {
    TEACHER: ['Review the full evidence profile', 'Use the component breakdown to identify the most actionable area before planning support.'],
    STUDENT: ['Choose one improvement goal', 'Start with the highest-priority recommendation and review progress with a teacher.'],
    PARENT: ['Review the progress summary', 'Discuss one manageable next step and contact the class teacher if support is needed.'],
  },
};

export const generateRecommendations = (risk, { studentId, subjectId = null, chapterId = null, now = new Date() } = {}) => {
  const due = new Date(now);
  due.setDate(due.getDate() + 7);
  return risk.reasons.flatMap((item) => Object.entries(recommendations[item.code] || {}).map(([role, [title, explanation]]) => ({
    title,
    explanation,
    recommendedRole: role,
    priority: item.severity === 'CRITICAL' ? 'URGENT' : item.severity,
    relatedStudent: studentId,
    relatedSubject: subjectId,
    relatedChapter: chapterId,
    suggestedDeadline: due.toISOString(),
    status: 'OPEN',
    completionNote: null,
    sourceCode: item.code,
  })));
};
