/**
 * @license Apache-2.0
 * @s2c/units — Engineering notation and SI prefix parser/formatter.
 */

export interface FormatEngineeringOptions {
  /** Target unit symbol, e.g. "Ω", "F", "V", "A", "Hz", "s" */
  unit?: string;
  /** Significant decimal places (default: 3) */
  precision?: number;
  /** Whether to format using R-notation (e.g. 4k7 instead of 4.7 k) */
  rNotation?: boolean;
}

const PREFIX_FACTORS: Record<string, number> = {
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  µ: 1e-6, // Unicode micro
  m: 1e-3,
  k: 1e3,
  K: 1e3,
  M: 1e6,
  G: 1e9,
};

const FACTOR_PREFIXES: Array<{ factor: number; prefix: string }> = [
  { factor: 1e9, prefix: "G" },
  { factor: 1e6, prefix: "M" },
  { factor: 1e3, prefix: "k" },
  { factor: 1, prefix: "" },
  { factor: 1e-3, prefix: "m" },
  { factor: 1e-6, prefix: "u" },
  { factor: 1e-9, prefix: "n" },
  { factor: 1e-12, prefix: "p" },
];

/**
 * Parses an engineering string or number into a standard float.
 * Supports:
 * - Literals: "4700", "0.01"
 * - Standard SI prefixes: "4.7k", "100nF", "10uF", "3.3V", "20mA", "16MHz"
 * - R-notation: "4k7" (4700), "2R2" (2.2), "0R1" (0.1), "1n0" (1e-9)
 */
export function parseEngineering(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new TypeError(`Cannot parse non-finite number: ${input}`);
    }
    return input;
  }

  const raw = input.trim();
  if (raw.length === 0) {
    throw new TypeError("Cannot parse empty engineering string");
  }

  // 1. Check for R-notation: e.g. "4k7", "2R2", "0R1", "4M7", "1u5"
  // Format: (digits)(prefix/R)(digits)(optional unit)
  const rMatch = raw.match(/^([0-9]+)([pnumµkKMGrR])([0-9]+)(?:[a-zA-ZΩµ]*)?$/);
  if (rMatch) {
    const whole = rMatch[1] ?? "0";
    const prefixChar = rMatch[2] ?? "R";
    const frac = rMatch[3] ?? "0";
    const numVal = parseFloat(`${whole}.${frac}`);
    if (prefixChar.toLowerCase() === "r") {
      return numVal;
    }
    const factor = PREFIX_FACTORS[prefixChar] ?? 1;
    return numVal * factor;
  }

  // 2. Standard format: optional sign, digits/decimal, optional prefix, optional unit
  const stdMatch = raw.match(
    /^([+-]?(?:[0-9]*\.[0-9]+|[0-9]+(?:\.[0-9]*)?)(?:[eE][+-]?[0-9]+)?)\s*([pnumµkKMGrR])?(?:[a-zA-ZΩµ]*)?$/,
  );

  if (stdMatch && stdMatch[1] !== undefined) {
    const baseVal = parseFloat(stdMatch[1]);
    const prefix = stdMatch[2];
    if (!prefix || prefix.toLowerCase() === "r") {
      return baseVal;
    }
    const factor = PREFIX_FACTORS[prefix];
    if (factor !== undefined) {
      return baseVal * factor;
    }
    return baseVal;
  }

  throw new TypeError(`Invalid engineering notation value: "${input}"`);
}

/**
 * Formats a numeric value into engineering notation.
 */
export function formatEngineering(value: number, options: FormatEngineeringOptions = {}): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const { unit = "", precision = 3, rNotation = false } = options;

  if (value === 0) {
    return unit ? `0 ${unit}` : "0";
  }

  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);

  // Find suitable engineering tier
  const defaultTier = FACTOR_PREFIXES[FACTOR_PREFIXES.length - 1] ?? { factor: 1, prefix: "" };
  let chosen = defaultTier;
  for (const item of FACTOR_PREFIXES) {
    if (abs >= item.factor * 0.999999) {
      chosen = item;
      break;
    }
  }

  const scaled = abs / chosen.factor;
  const roundedStr = Number(scaled.toFixed(precision)).toString();

  if (rNotation) {
    const sep = chosen.prefix || (unit === "Ω" || !unit ? "R" : chosen.prefix || "");
    const parts = roundedStr.split(".");
    if (parts.length === 2 && parts[1]) {
      return `${sign}${parts[0]}${sep}${parts[1]}`;
    }
    return `${sign}${roundedStr}${sep}`;
  }

  const unitSuffix = unit
    ? chosen.prefix
      ? ` ${chosen.prefix}${unit}`
      : ` ${unit}`
    : chosen.prefix;
  return `${sign}${roundedStr}${unitSuffix}`;
}
