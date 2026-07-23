import { calculateWeightedScore } from './weighted-score.engine.js';

const SUBJECT_COMPONENTS = [
  ['Assessment performance', 'assessment', 'examWeight'],
  ['Chapter mastery', 'chapterQuiz', 'chapterQuizWeight'],
  ['Attendance', 'attendance', 'attendanceWeight'],
  ['Homework', 'homework', 'homeworkWeight'],
  ['Teacher evaluation', 'teacherEvaluation', 'teacherEvaluationWeight'],
  ['Student feedback', 'studentFeedback', 'studentFeedbackWeight'],
  ['Resource engagement', 'resourceEngagement', 'resourceEngagementWeight'],
];

export const subjectStatus = (score, coverage) => {
  if (score === null || coverage < 20) return 'INSUFFICIENT_DATA';
  if (score >= 85) return 'EXCELLENT';
  if (score >= 70) return 'GOOD';
  if (score >= 60) return 'STABLE';
  if (score >= 45) return 'NEEDS_ATTENTION';
  return 'AT_RISK';
};

export const calculateSubjectScore = (values, configuration) => {
  const result = calculateWeightedScore({ values, configuration, definitions: SUBJECT_COMPONENTS });
  return { ...result, subjectStatus: subjectStatus(result.score, result.dataCoverage) };
};

