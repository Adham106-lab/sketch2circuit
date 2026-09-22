/**
 * @license Apache-2.0
 * @s2c/units — Standard E-series resistor/capacitor values (IEC 60063).
 */

export type ESeriesName = "E12" | "E24" | "E96";

export type RoundingMode = "nearest" | "ceil" | "floor";

export const E12_BASE = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2] as const;

export const E24_BASE = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6,
  6.2, 6.8, 7.5, 8.2, 9.1,
] as const;

export const E96_BASE = [
  1.0, 1.02, 1.05, 1.07, 1.1, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.3, 1.33, 1.37, 1.4, 1.43, 1.47,
  1.5, 1.54, 1.58, 1.62, 1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2.0, 2.05, 2.1, 2.15, 2.21,
  2.26, 2.32, 2.37, 2.43, 2.49, 2.55, 2.61, 2.67, 2.74, 2.8, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24,
  3.32, 3.4, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12, 4.22, 4.32, 4.42, 4.53, 4.64, 4.75,
  4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.9, 6.04, 6.19, 6.34, 6.49, 6.65, 6.81, 6.98,
  7.15, 7.32, 7.5, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76,
] as const;

const SERIES_MAP: Record<ESeriesName, readonly number[]> = {
  E12: E12_BASE,
  E24: E24_BASE,
  E96: E96_BASE,
};

/**
 * Finds the nearest standard standard E-series value for a target number.
 * Operates across decades (from 1e-3 to 1e8).
 */
export function nearestE(
  value: number,
  series: ESeriesName = "E24",
  mode: RoundingMode = "nearest",
): number {
  if (value <= 0) {
    throw new RangeError(`E-series values must be strictly positive: ${value}`);
  }

  const baseValues = SERIES_MAP[series];
  const decade = Math.floor(Math.log10(value));
  const decadeMultiplier = 10 ** decade;

  // Build candidates including boundary values from adjacent decades
  const candidates: number[] = [];
  const lastBase = baseValues[baseValues.length - 1] ?? 1;
  const firstBase = baseValues[0] ?? 1;

  // Prior decade high end
  candidates.push(lastBase * (decadeMultiplier / 10));

  for (const b of baseValues) {
    candidates.push(b * decadeMultiplier);
  }

  // Next decade low end
  candidates.push(firstBase * (decadeMultiplier * 10));

  const fallback = candidates[0] ?? value;

  if (mode === "nearest") {
    let best = fallback;
    let bestDiff = Math.abs(best - value);
    for (const c of candidates) {
      const diff = Math.abs(c - value);
      if (diff < bestDiff) {
        best = c;
        bestDiff = diff;
      }
    }
    return Number(best.toPrecision(7));
  }

  if (mode === "ceil") {
    for (const c of candidates) {
      if (c >= value * (1 - 1e-9)) {
        return Number(c.toPrecision(7));
      }
    }
    const lastCandidate = candidates[candidates.length - 1] ?? value;
    return Number(lastCandidate.toPrecision(7));
  }

  if (mode === "floor") {
    let best = fallback;
    for (const c of candidates) {
      if (c <= value * (1 + 1e-9)) {
        best = c;
      }
    }
    return Number(best.toPrecision(7));
  }

  return value;
}
