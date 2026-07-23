export const riskVariant = {
  LOW: 'success', MEDIUM: 'warning', HIGH: 'danger', CRITICAL: 'danger', INSUFFICIENT_DATA: 'muted',
};

export const statusVariant = {
  EXCELLENT: 'success', GOOD: 'info', STABLE: 'primary', NEEDS_ATTENTION: 'warning', AT_RISK: 'danger',
  MASTERED: 'success', COMPLETED: 'info', NEEDS_REVISION: 'warning', WEAK: 'danger',
  NOT_STARTED: 'muted', ONGOING: 'primary', INSUFFICIENT_DATA: 'muted',
};

export const label = (value) => value ? value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase()) : 'Not available';

