export type ChartPoint = {
  label: string;
  value: number;
};

export type PlottedPoint = {
  x: number;
  y: number;
  value: number;
  label: string;
};

export function getPlottedPoints(
  points: readonly ChartPoint[],
  width: number,
  height: number,
): PlottedPoint[] {
  if (points.length === 0 || width <= 0 || height <= 0) return [];

  const safeValues = points.map(({ value }) =>
    Number.isFinite(value) ? Math.max(0, value) : 0,
  );
  const minimum = Math.min(...safeValues);
  const maximum = Math.max(...safeValues);
  const range = maximum - minimum;
  const verticalPadding = Math.min(8, height / 3);
  const drawableHeight = Math.max(0, height - verticalPadding * 2);

  return points.map((point, index) => {
    const ratio = range > 0 ? (safeValues[index] - minimum) / range : 0.5;
    return {
      x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
      y: verticalPadding + (1 - ratio) * drawableHeight,
      value: safeValues[index],
      label: point.label,
    };
  });
}

export function createSmoothPath(points: readonly PlottedPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const beforePrevious = points[Math.max(0, index - 2)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const firstControlX = previous.x + (point.x - beforePrevious.x) / 6;
    const firstControlY = previous.y + (point.y - beforePrevious.y) / 6;
    const secondControlX = point.x - (next.x - previous.x) / 6;
    const secondControlY = point.y - (next.y - previous.y) / 6;
    return `${path} C ${firstControlX} ${firstControlY}, ${secondControlX} ${secondControlY}, ${point.x} ${point.y}`;
  }, '');
}

export function createAreaPath(
  points: readonly PlottedPoint[],
  height: number,
): string {
  if (points.length < 2) return '';
  const linePath = createSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L ${last.x} ${height} L ${first.x} ${height} Z`;
}

export function approximatePathLength(points: readonly PlottedPoint[]): number {
  return points.slice(1).reduce((length, point, index) => {
    const previous = points[index];
    return length + Math.hypot(point.x - previous.x, point.y - previous.y);
  }, 0);
}
