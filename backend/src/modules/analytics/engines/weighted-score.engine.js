const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
const validScore = (value) => value !== null && value !== undefined && value !== ''
  && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100;

export const validateWeights = (definitions, configuration) => {
  const values = definitions.map(([, , key]) => Number(configuration[key]));
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 100)) {
    return { valid: false, total: null, message: 'Weights must be numbers between 0 and 100.' };
  }
  const total = round(values.reduce((sum, value) => sum + value, 0));
  return {
    valid: Math.abs(total - 100) < 0.001,
    total,
    message: Math.abs(total - 100) < 0.001 ? null : `Active component weights must total 100; received ${total}.`,
  };
};

export const calculateWeightedScore = ({ values = {}, configuration = {}, definitions = [] }) => {
  const configuredTotal = definitions.reduce((sum, [, , key]) => sum + (Number(configuration[key]) || 0), 0);
  const available = definitions
    .map(([name, valueKey, weightKey]) => ({
      name,
      valueKey,
      rawScore: validScore(values[valueKey]) ? Number(values[valueKey]) : null,
      configuredWeight: Math.max(0, Number(configuration[weightKey]) || 0),
    }))
    .filter((component) => component.rawScore !== null && component.configuredWeight > 0);
  const availableWeight = available.reduce((sum, component) => sum + component.configuredWeight, 0);

  if (!availableWeight || !configuredTotal) {
    return { score: null, dataCoverage: 0, components: [], status: 'INSUFFICIENT_DATA' };
  }

  const components = available.map((component) => {
    const effectiveWeight = (component.configuredWeight / availableWeight) * 100;
    return {
      name: component.name,
      rawScore: round(component.rawScore),
      configuredWeight: round(component.configuredWeight),
      effectiveWeight: round(effectiveWeight),
      contribution: round(component.rawScore * effectiveWeight / 100),
    };
  });

  const preciseScore = available.reduce((sum, component) =>
    sum + component.rawScore * (component.configuredWeight / availableWeight), 0);
  const finalScore = round(preciseScore);
  if (components.length) {
    const prior = components.slice(0, -1).reduce((sum, component) => sum + component.contribution, 0);
    components.at(-1).contribution = round(finalScore - prior);
  }
  return {
    score: finalScore,
    dataCoverage: round(Math.min(100, availableWeight / configuredTotal * 100)),
    components,
    status: 'AVAILABLE',
  };
};

export const average = (values) => {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? round(valid.reduce((sum, value) => sum + value, 0) / valid.length) : null;
};

export const percentage = (numerator, denominator) => {
  const top = Number(numerator);
  const bottom = Number(denominator);
  return Number.isFinite(top) && Number.isFinite(bottom) && bottom > 0
    ? round(Math.max(0, Math.min(100, top / bottom * 100)))
    : null;
};
