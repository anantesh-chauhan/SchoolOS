export const FORMULA_VERSION = '1.0';

export const DEFAULT_CONFIGURATION = Object.freeze({
  examWeight: 30,
  chapterQuizWeight: 20,
  attendanceWeight: 15,
  homeworkWeight: 15,
  teacherEvaluationWeight: 10,
  studentFeedbackWeight: 5,
  resourceEngagementWeight: 5,
  chapterAssessmentWeight: 30,
  chapterHomeworkWeight: 20,
  chapterTeacherWeight: 15,
  chapterFeedbackWeight: 15,
  chapterAttendanceWeight: 10,
  chapterResourceWeight: 10,
  lowRiskThreshold: 70,
  mediumRiskThreshold: 50,
  minimumAttendanceTarget: 75,
  minimumHomeworkTarget: 70,
  minimumChapterTarget: 60,
  rankingEnabled: false,
  formulaVersion: FORMULA_VERSION,
});

export const ACADEMIC_COMPONENTS = Object.freeze([
  ['Exam performance', 'exam', 'examWeight'],
  ['Chapter and quiz performance', 'chapterQuiz', 'chapterQuizWeight'],
  ['Attendance', 'attendance', 'attendanceWeight'],
  ['Homework completion', 'homework', 'homeworkWeight'],
  ['Teacher evaluation', 'teacherEvaluation', 'teacherEvaluationWeight'],
  ['Student understanding feedback', 'studentFeedback', 'studentFeedbackWeight'],
  ['Resource engagement', 'resourceEngagement', 'resourceEngagementWeight'],
]);

export const CHAPTER_COMPONENTS = Object.freeze([
  ['Quiz and chapter assessment', 'assessment', 'chapterAssessmentWeight'],
  ['Homework', 'homework', 'chapterHomeworkWeight'],
  ['Teacher evaluation', 'teacherEvaluation', 'chapterTeacherWeight'],
  ['Student understanding', 'studentFeedback', 'chapterFeedbackWeight'],
  ['Attendance during chapter period', 'attendance', 'chapterAttendanceWeight'],
  ['Resource engagement', 'resourceEngagement', 'chapterResourceWeight'],
]);

export const ANALYTICS_ROLES = Object.freeze([
  'SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'TEACHER', 'STUDENT', 'PARENT',
]);

export const STAFF_ANALYTICS_ROLES = Object.freeze([
  'SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'TEACHER',
]);

