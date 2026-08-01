const number = (value) => Number(value ?? 0);

export const DEFAULT_GRADE_RULES = [
  { min: 91, grade: 'A1', point: 10 }, { min: 81, grade: 'A2', point: 9 },
  { min: 71, grade: 'B1', point: 8 }, { min: 61, grade: 'B2', point: 7 },
  { min: 51, grade: 'C1', point: 6 }, { min: 41, grade: 'C2', point: 5 },
  { min: 33, grade: 'D', point: 4 }, { min: 0, grade: 'E', point: 0 },
];

export const gradeFor = (percentage, rules = DEFAULT_GRADE_RULES) => {
  const ordered = [...rules].sort((a, b) => number(b.min) - number(a.min));
  return ordered.find((rule) => number(percentage) >= number(rule.min)) || ordered.at(-1);
};

export const calculateStudent = ({ subjects, gradeRules, graceConfig = {}, promotionConfig = {} }) => {
  const subjectResults = subjects.map(({ examSubjectId, components }) => {
    let obtained = 0;
    let maximum = 0;
    let attendanceStatus = 'PRESENT';
    let passed = true;
    let mandatoryDeficit = 0;
    const breakdown = components.map((component) => {
      const status = component.attendanceStatus || 'PRESENT';
      const mark = status === 'PRESENT' ? number(component.marks) : 0;
      const max = number(component.maximumMarks);
      const passing = number(component.passingMarks);
      const weighted = max ? mark * (number(component.weightage) / 100) : 0;
      const weightedMax = max * (number(component.weightage) / 100);
      if (component.isMandatory && status === 'PRESENT' && mark < passing) { passed = false; mandatoryDeficit += passing - mark; }
      if (['ABSENT', 'TRANSFERRED'].includes(status) && component.isMandatory) passed = false;
      if (status !== 'PRESENT') attendanceStatus = status;
      obtained += weighted;
      maximum += weightedMax;
      return { code: component.code, name: component.name, marks: mark, maximumMarks: max, weighted, status };
    });

    let graceMarks = 0;
    const subjectPassingPercentage = number(promotionConfig.subjectPassingPercentage || 33);
    const minimum = maximum * subjectPassingPercentage / 100;
    const allowedGrace = number(graceConfig.maximumPerSubject || 0);
    const requiredGrace = mandatoryDeficit > 0 ? mandatoryDeficit : Math.max(0, minimum - obtained);
    if (!passed && attendanceStatus === 'PRESENT' && requiredGrace > 0 && requiredGrace <= allowedGrace) {
      graceMarks = requiredGrace;
      obtained += graceMarks;
      passed = true;
    }
    const percentage = maximum ? obtained * 100 / maximum : 0;
    const grade = gradeFor(percentage, gradeRules);
    return { examSubjectId, obtainedMarks: obtained, maximumMarks: maximum, percentage, grade: grade?.grade, gradePoint: grade?.point, passed, graceMarks, attendanceStatus, componentBreakdown: breakdown };
  });

  const counted = subjectResults.filter((item) => !['EXEMPTED', 'TRANSFERRED'].includes(item.attendanceStatus));
  const totalObtained = counted.reduce((sum, item) => sum + item.obtainedMarks, 0);
  const totalMaximum = counted.reduce((sum, item) => sum + item.maximumMarks, 0);
  const percentage = totalMaximum ? totalObtained * 100 / totalMaximum : 0;
  const failedSubjects = counted.filter((item) => !item.passed).length;
  const compartmentLimit = number(promotionConfig.compartmentSubjectLimit ?? 1);
  const resultStatus = failedSubjects === 0 ? 'PASS' : failedSubjects <= compartmentLimit ? 'COMPARTMENT' : 'FAIL';
  const promotionStatus = resultStatus === 'PASS'
    ? (subjectResults.some((item) => item.graceMarks > 0) ? 'PROMOTED_WITH_GRACE' : 'PROMOTED')
    : resultStatus === 'COMPARTMENT' ? 'COMPARTMENT' : 'FAILED';
  const overallGrade = gradeFor(percentage, gradeRules);

  return { subjectResults, totalObtained, totalMaximum, percentage, grade: overallGrade?.grade, gradePoint: overallGrade?.point, resultStatus, promotionStatus, graceMarks: subjectResults.reduce((sum, item) => sum + item.graceMarks, 0) };
};

export const assignRanks = (rows) => {
  const sorted = [...rows].sort((a, b) => b.percentage - a.percentage || b.totalObtained - a.totalObtained || a.studentId.localeCompare(b.studentId));
  let previous;
  let rank = 0;
  return sorted.map((row, index) => {
    if (previous !== row.percentage) rank = index + 1;
    previous = row.percentage;
    return { ...row, rank, sectionRank: rank };
  });
};
