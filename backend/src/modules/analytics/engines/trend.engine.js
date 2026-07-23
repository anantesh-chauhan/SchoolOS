const labels = {
  strongUp: 'STRONGLY_IMPROVING',
  up: 'IMPROVING',
  flat: 'STABLE',
  down: 'DECLINING',
  strongDown: 'STRONGLY_DECLINING',
  none: 'INSUFFICIENT_DATA',
};

export const calculateTrend = (points = []) => {
  const values = points
    .map((point, index) => typeof point === 'number' ? { value: point, index } : { value: point?.value, index })
    .filter((point) => Number.isFinite(Number(point.value)))
    .map((point) => ({ ...point, value: Number(point.value) }));
  if (values.length < 2) return { trend: labels.none, change: null, points: values.length, confidence: 'NONE' };

  if (values.length === 2) {
    const change = values[1].value - values[0].value;
    return {
      trend: Math.abs(change) < 2 ? labels.flat : change > 0 ? labels.up : labels.down,
      change: Number(change.toFixed(2)),
      points: 2,
      confidence: 'BASIC',
    };
  }

  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((sum, point) => sum + point.value, 0) / n;
  const numerator = values.reduce((sum, point, index) => sum + (index - meanX) * (point.value - meanY), 0);
  const denominator = values.reduce((sum, _point, index) => sum + (index - meanX) ** 2, 0);
  const slope = denominator ? numerator / denominator : 0;
  const trend = slope >= 5 ? labels.strongUp
    : slope >= 1.5 ? labels.up
      : slope <= -5 ? labels.strongDown
        : slope <= -1.5 ? labels.down
          : labels.flat;
  return { trend, change: Number((values.at(-1).value - values[0].value).toFixed(2)), slope: Number(slope.toFixed(2)), points: n, confidence: 'NORMAL' };
};

