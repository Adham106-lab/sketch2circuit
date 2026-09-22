/**
 * @license Apache-2.0
 * @s2c/units — Standard electrical engineering formulas with verified tolerances.
 */

import { type ESeriesName, nearestE } from "./series.js";

export interface LedResistorResult {
  /** Ideal exact theoretical resistance (Ω) */
  exactResistance: number;
  /** Chosen standard E-series resistance (Ω) */
  recommendedResistance: number;
  /** Actual calculated current at the recommended resistance (A) */
  operatingCurrent: number;
  /** Power dissipation in the resistor: I^2 * R (W) */
  resistorPower: number;
  /** Whether standard 1/8W (0.125W) or 1/4W (0.25W) resistor is sufficient */
  recommendedPowerRating: "0.125W" | "0.25W" | "0.5W" | "1W" | "HighPower";
}

/**
 * Calculates current-limiting series resistor for an LED:
 * R = (V_src - V_forward) / I_forward
 *
 * @param vSource Source voltage (e.g. 5.0 for Uno, 3.3 for ESP32)
 * @param vForward LED forward voltage drop (e.g. 2.0V red, 3.2V blue/white)
 * @param iForward Target forward current in Amperes (e.g. 0.015 for 15mA)
 * @param series Preferred E-series (default: E24)
 */
export function calculateLedResistor(
  vSource: number,
  vForward: number,
  iForward: number,
  series: ESeriesName = "E24",
): LedResistorResult {
  if (vSource <= vForward) {
    throw new RangeError(
      `Source voltage (${vSource}V) must exceed LED forward voltage drop (${vForward}V)`,
    );
  }
  if (iForward <= 0) {
    throw new RangeError(`Target forward current must be positive: ${iForward}`);
  }

  const vDrop = Number((vSource - vForward).toPrecision(12));
  const exactR = Number((vDrop / iForward).toPrecision(10));

  // Round UP (ceil) to protect the LED and MCU pin from overcurrent
  const recommendedR = nearestE(exactR, series, "ceil");
  const operatingCurrent = vDrop / recommendedR;
  const power = operatingCurrent * operatingCurrent * recommendedR;

  let powerRating: LedResistorResult["recommendedPowerRating"] = "0.125W";
  if (power > 0.5) {
    powerRating = "HighPower";
  } else if (power > 0.25) {
    powerRating = "0.5W";
  } else if (power > 0.125) {
    powerRating = "0.25W";
  }

  return {
    exactResistance: exactR,
    recommendedResistance: recommendedR,
    operatingCurrent,
    resistorPower: power,
    recommendedPowerRating: powerRating,
  };
}

export interface VoltageDividerResult {
  /** Output voltage (V) */
  vOut: number;
  /** Total series resistance (Ω) */
  rTotal: number;
  /** Quiescent bias current drawn through divider (A) */
  quiescentCurrent: number;
}

/**
 * Calculates unloaded voltage divider:
 * V_out = V_in * (R2 / (R1 + R2))
 */
export function calculateVoltageDivider(vIn: number, r1: number, r2: number): VoltageDividerResult {
  if (r1 <= 0 || r2 <= 0) {
    throw new RangeError("Resistor values must be strictly positive");
  }
  const rTotal = r1 + r2;
  const vOut = vIn * (r2 / rTotal);
  const quiescentCurrent = vIn / rTotal;
  return { vOut, rTotal, quiescentCurrent };
}
