import { average, percentage } from './weighted-score.engine.js';

const SUBMITTED_STATES = new Set([
  'SUBMITTED',
  'LATE_SUBMITTED',
  'UNDER_REVIEW',
  'RETURNED',
  'RESUBMITTED',
  'GRADED',
]);

export const calculateHomeworkSummary = (homework = [], submissions = []) => {
  if (!homework.length) {
    return {
      percentage: null,
      assigned: 0,
      eligible: 0,
      submitted: 0,
      onTime: 0,
      late: 0,
      missing: 0,
      reviewed: 0,
      exempted: 0,
      reopened: 0,
      resubmitted: 0,
      averageScore: null,
    };
  }

  const latest = new Map();
  submissions.forEach((row) => {
    const current = latest.get(row.homeworkId);
    if (!current || Number(current.attemptNumber || 0) < Number(row.attemptNumber || 0)) {
      latest.set(row.homeworkId, row);
    }
  });

  let submitted = 0;
  let onTime = 0;
  let late = 0;
  let reviewed = 0;
  let exempted = 0;
  let reopened = 0;
  let resubmitted = 0;
  const scores = [];
  const eligible = homework.filter((item) => {
    if (latest.get(item.id)?.status === 'EXCUSED') {
      exempted += 1;
      return false;
    }
    return true;
  });

  eligible.forEach((item) => {
    const row = latest.get(item.id);
    if (row?.status === 'RESUBMISSION_REQUESTED') {
      reopened += 1;
      return;
    }
    if (!row || !SUBMITTED_STATES.has(row.status)) return;

    submitted += 1;
    if (row.isLate || row.status === 'LATE_SUBMITTED') late += 1;
    else onTime += 1;
    if (row.reviewedAt || ['RETURNED', 'GRADED'].includes(row.status)) reviewed += 1;
    if (row.status === 'RESUBMITTED') resubmitted += 1;
    if (row.marksAwarded !== null && row.marksAwarded !== undefined && Number(item.maximumMarks) > 0) {
      scores.push(Number(row.marksAwarded) / Number(item.maximumMarks) * 100);
    }
  });

  return {
    percentage: percentage(submitted, eligible.length),
    assigned: homework.length,
    eligible: eligible.length,
    submitted,
    onTime,
    late,
    missing: eligible.length - submitted,
    reviewed,
    exempted,
    reopened,
    resubmitted,
    averageScore: average(scores),
  };
};
