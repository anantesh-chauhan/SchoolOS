import { ACADEMIC_COMPONENTS } from '../analytics.constants.js';
import { calculateWeightedScore } from './weighted-score.engine.js';

export const calculateAcademicHealth = (values, configuration) =>
  calculateWeightedScore({ values, configuration, definitions: ACADEMIC_COMPONENTS });

