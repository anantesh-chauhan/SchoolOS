const severityPoints = { LOW: 10, MEDIUM: 20, HIGH: 35, CRITICAL: 50 };

const reason = (code, severity, message, evidence = {}) => ({ code, severity, message, evidence });

export const detectRisk = (signals = {}, configuration = {}) => {
  const reasons = [];
  const configuredRules = Array.isArray(configuration.riskRules) ? configuration.riskRules : [];
  const rules = new Map(configuredRules.map((row) => [row.code, row]));
  const threshold = (code, fallback) => Number.isFinite(Number(rules.get(code)?.threshold)) ? Number(rules.get(code).threshold) : fallback;
  const attendanceTarget = threshold('LOW_ATTENDANCE', Number(configuration.minimumAttendanceTarget ?? 75));
  const homeworkTarget = threshold('LOW_HOMEWORK_COMPLETION', Number(configuration.minimumHomeworkTarget ?? 70));
  const chapterTarget = Number(configuration.minimumChapterTarget ?? 60);

  if (Number.isFinite(signals.attendance) && signals.attendance < attendanceTarget) {
    reasons.push(reason('LOW_ATTENDANCE', signals.attendance < attendanceTarget - 15 ? 'HIGH' : 'MEDIUM',
      `Attendance is ${signals.attendance}%, below the school target of ${attendanceTarget}%.`,
      { actual: signals.attendance, target: attendanceTarget }));
  }
  if (['DECLINING', 'STRONGLY_DECLINING'].includes(signals.attendanceTrend)) {
    reasons.push(reason('ATTENDANCE_DECLINING', signals.attendanceTrend === 'STRONGLY_DECLINING' ? 'HIGH' : 'MEDIUM',
      'Attendance has declined across recent valid periods and requires teacher review.'));
  }
  if (Number(signals.consecutiveAbsences) >= threshold('CONSECUTIVE_ABSENCES', 3)) {
    reasons.push(reason('CONSECUTIVE_ABSENCES', 'HIGH', `${signals.consecutiveAbsences} consecutive absences were recorded.`));
  }
  if (Number.isFinite(signals.homework) && signals.homework < homeworkTarget) {
    reasons.push(reason('LOW_HOMEWORK_COMPLETION', signals.homework < homeworkTarget - 25 ? 'HIGH' : 'MEDIUM',
      `Homework completion is ${signals.homework}%, below the school target of ${homeworkTarget}%.`,
      { actual: signals.homework, target: homeworkTarget }));
  }
  if (Number(signals.missingHomework) >= threshold('MISSING_HOMEWORK', 3)) {
    reasons.push(reason('MISSING_HOMEWORK', 'MEDIUM', `${signals.missingHomework} assignments are currently missing.`));
  }
  if (Number(signals.weakChapters) >= threshold('WEAK_CHAPTERS', 2)) {
    reasons.push(reason('WEAK_CHAPTERS', Number(signals.weakChapters) >= 4 ? 'HIGH' : 'MEDIUM',
      `${signals.weakChapters} chapters are below the configured ${chapterTarget}% target.`));
  }
  const lowRiskHealth = Number(configuration.lowRiskThreshold ?? 70);
  const mediumRiskHealth = Number(configuration.mediumRiskThreshold ?? 50);
  if (Number.isFinite(signals.academicHealth) && signals.academicHealth < lowRiskHealth) {
    reasons.push(reason('LOW_ACADEMIC_HEALTH', signals.academicHealth < mediumRiskHealth ? 'HIGH' : 'MEDIUM',
      `Academic health is ${signals.academicHealth}, below the school review threshold of ${lowRiskHealth}.`,
      { actual: signals.academicHealth, reviewThreshold: lowRiskHealth, highConcernThreshold: mediumRiskHealth }));
  }
  if (['DECLINING', 'STRONGLY_DECLINING'].includes(signals.examTrend)) {
    reasons.push(reason('ASSESSMENT_DECLINING', signals.examTrend === 'STRONGLY_DECLINING' ? 'HIGH' : 'MEDIUM',
      'Assessment scores are declining across recent valid assessments.'));
  }
  if (signals.teacherConcern) reasons.push(reason('TEACHER_CONCERN', 'HIGH', 'A teacher has recorded a concern requiring review.'));
  if (signals.noImprovementAfterIntervention) reasons.push(reason('NO_IMPROVEMENT_AFTER_INTERVENTION', 'HIGH',
    'No improvement is visible after a completed intervention; this is an association and requires review.'));

  const availableSignals = [
    signals.attendance, signals.homework, signals.academicHealth, signals.weakChapters,
    signals.examTrend, signals.teacherConcern,
  ].filter((value) => value !== null && value !== undefined).length;
  if (!availableSignals) return { riskLevel: 'INSUFFICIENT_DATA', riskScore: null, reasons: [], dataSignals: 0 };

  // Related signals are evidence for the same concern and should not be double
  // counted (for example low homework plus several missing assignments).
  const category = (code) => code.includes('ATTENDANCE') || code.includes('ABSENCE') ? 'ATTENDANCE'
    : code.includes('HOMEWORK') ? 'HOMEWORK'
      : code.includes('CHAPTER') || code.includes('ASSESSMENT') ? 'PERFORMANCE'
        : code.includes('INTERVENTION') ? 'INTERVENTION' : code;
  const effectiveReasons = reasons
    .filter((item) => !rules.has(item.code) || rules.get(item.code).isEnabled !== false)
    .map((item) => rules.get(item.code)?.severity ? { ...item, severity: rules.get(item.code).severity } : item);
  const categoryPoints = new Map();
  effectiveReasons.forEach((item) => categoryPoints.set(category(item.code), Math.max(categoryPoints.get(category(item.code)) || 0, severityPoints[item.severity])));
  const riskScore = Math.min(100, [...categoryPoints.values()].reduce((sum, points) => sum + points, 0));
  const riskLevel = riskScore >= 85 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW';
  return { riskLevel, riskScore, reasons: effectiveReasons, dataSignals: availableSignals };
};
