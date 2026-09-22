import { describe, expect, expectTypeOf, it } from "vitest";
import {
  calculateLedResistor,
  calculateVoltageDivider,
  type LedResistorResult,
  type VoltageDividerResult,
} from "../src/formulas.js";

describe("calculateLedResistor", () => {
  it("enforces type-level return contract preventing property mismatch regression", () => {
    const res = calculateLedResistor(5.0, 2.0, 0.015);
    expectTypeOf(res).toEqualTypeOf<LedResistorResult>();
    expectTypeOf(res.exactResistance).toBeNumber();
    expectTypeOf(res.recommendedResistance).toBeNumber();
    expectTypeOf(res.operatingCurrent).toBeNumber();
    expectTypeOf(res.resistorPower).toBeNumber();
    expectTypeOf(res.recommendedPowerRating).toEqualTypeOf<
      "0.125W" | "0.25W" | "0.5W" | "1W" | "HighPower"
    >();
  });

  it("calculates 5V red LED (Vf=2.0V, If=15mA)", () => {
    // Vdrop = 3.0V. Exact R = 3.0 / 0.015 = 200 ohm.
    // 200 ohm is an exact E24 value.
    const res = calculateLedResistor(5.0, 2.0, 0.015);
    expect(res.exactResistance).toBe(200);
    expect(res.recommendedResistance).toBe(200);
    expect(res.operatingCurrent).toBeCloseTo(0.015);
    expect(res.resistorPower).toBeCloseTo(0.045); // 45 mW
    expect(res.recommendedPowerRating).toBe("0.125W");
  });

  it("calculates 5V blue LED (Vf=3.2V, If=20mA)", () => {
    // Vdrop = 1.8V. Exact R = 1.8 / 0.02 = 90 ohm.
    // In E24 ceil mode, 90 snaps up to 91 ohm.
    const res = calculateLedResistor(5.0, 3.2, 0.02);
    expect(res.exactResistance).toBe(90);
    expect(res.recommendedResistance).toBe(91);
    expect(res.operatingCurrent).toBeLessThanOrEqual(0.02);
  });

  it("throws if source voltage does not exceed forward voltage", () => {
    expect(() => calculateLedResistor(3.3, 3.5, 0.02)).toThrow(RangeError);
  });
});

describe("calculateVoltageDivider", () => {
  it("enforces type-level return contract preventing property mismatch regression", () => {
    const div = calculateVoltageDivider(5.0, 10000, 20000);
    expectTypeOf(div).toEqualTypeOf<VoltageDividerResult>();
    expectTypeOf(div.vOut).toBeNumber();
    expectTypeOf(div.rTotal).toBeNumber();
    expectTypeOf(div.quiescentCurrent).toBeNumber();
  });

  it("calculates 5V to 3.3V divider", () => {
    // 1.7k and 3.3k
    const div = calculateVoltageDivider(5.0, 1700, 3300);
    expect(div.vOut).toBeCloseTo(3.3);
    expect(div.rTotal).toBe(5000);
    expect(div.quiescentCurrent).toBeCloseTo(0.001); // 1 mA
  });
});
