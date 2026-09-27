export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Nearest dollar above $20, otherwise cents. Practice figures stay easy to read. */
export function practiceMoney(value: number): number {
  if (value >= 20) return Math.round(value);
  return roundMoney(value);
}

export function median(values: number[]): number | null {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (sorted.length % 2 === 0 && lower != null && upper != null) {
    return roundMoney((lower + upper) / 2);
  }
  return upper ?? null;
}

/**
 * Drop prices that are far from the middle of the pack (wrong printing or a
 * lot). Keeps the list when trimming would leave almost nothing.
 */
export function trimOutliers(values: number[]): number[] {
  if (values.length < 4) return values;
  const mid = median(values);
  if (mid == null || mid <= 0) return values;
  const kept = values.filter((value) => value >= mid / 8 && value <= mid * 12);
  return kept.length >= 3 ? kept : values;
}
