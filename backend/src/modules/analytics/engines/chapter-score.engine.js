import { CHAPTER_COMPONENTS } from '../analytics.constants.js';
import { calculateWeightedScore } from './weighted-score.engine.js';

export const chapterStatus = (score, coverage, curriculumStatus = 'COMPLETED') => {
  if (curriculumStatus === 'NOT_STARTED') return 'NOT_STARTED';
  if (curriculumStatus === 'ONGOING') return 'ONGOING';
  if (score === null || coverage < 20) return 'INSUFFICIENT_DATA';
  if (score >= 85) return 'MASTERED';
  if (score >= 70) return 'COMPLETED';
  if (score >= 55) return 'NEEDS_REVISION';
  if (score >= 40) return 'WEAK';
  return 'AT_RISK';
};

export const calculateChapterScore = (values, configuration, curriculumStatus) => {
  const result = calculateWeightedScore({ values, configuration, definitions: CHAPTER_COMPONENTS });
  return { ...result, chapterStatus: chapterStatus(result.score, result.dataCoverage, curriculumStatus) };
};

