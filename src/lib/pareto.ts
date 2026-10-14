/** 多目标里没有被全面超过的点。每个指标都是越小越好。 */

export type ParetoPoint = { id: string; axes: number[] };

export function paretoFront(points: ParetoPoint[]): string[] {
  return points
    .filter((point) => !points.some((other) => other.id !== point.id && dominates(other.axes, point.axes)))
    .map((point) => point.id);
}

function dominates(a: number[], b: number[]): boolean {
  if (a.length !== b.length || !a.length) return false;
  let better = false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]! > b[i]!) return false;
    if (a[i]! < b[i]!) better = true;
  }
  return better;
}
