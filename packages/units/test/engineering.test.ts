import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { formatEngineering, parseEngineering } from "../src/engineering.js";

describe("parseEngineering", () => {
  it("parses numbers directly", () => {
    expect(parseEngineering(4700)).toBe(4700);
    expect(parseEngineering(0.01)).toBe(0.01);
  });

  it("parses standard metric SI prefixes", () => {
    expect(parseEngineering("100nF")).toBeCloseTo(100e-9);
    expect(parseEngineering("10uF")).toBeCloseTo(10e-6);
    expect(parseEngineering("10µF")).toBeCloseTo(10e-6);
    expect(parseEngineering("4.7k")).toBeCloseTo(4700);
    expect(parseEngineering("4.7kΩ")).toBeCloseTo(4700);
    expect(parseEngineering("1M")).toBeCloseTo(1e6);
    expect(parseEngineering("20mA")).toBeCloseTo(0.02);
    expect(parseEngineering("3.3V")).toBeCloseTo(3.3);
    expect(parseEngineering("16MHz")).toBeCloseTo(16e6);
    expect(parseEngineering("22pF")).toBeCloseTo(22e-12);
  });

  it("parses R-notation", () => {
    expect(parseEngineering("4k7")).toBeCloseTo(4700);
    expect(parseEngineering("2R2")).toBeCloseTo(2.2);
    expect(parseEngineering("0R1")).toBeCloseTo(0.1);
    expect(parseEngineering("1n0")).toBeCloseTo(1e-9);
    expect(parseEngineering("4M7")).toBeCloseTo(4.7e6);
    expect(parseEngineering("4k7Ω")).toBeCloseTo(4700);
  });

  it("throws on invalid inputs", () => {
    expect(() => parseEngineering("")).toThrow(TypeError);
    expect(() => parseEngineering("hello")).toThrow(TypeError);
    expect(() => parseEngineering(Number.NaN)).toThrow(TypeError);
  });
});

describe("formatEngineering", () => {
  it("formats standard values with unit", () => {
    expect(formatEngineering(4700, { unit: "Ω" })).toBe("4.7 kΩ");
    expect(formatEngineering(0.0000001, { unit: "F" })).toBe("100 nF");
    expect(formatEngineering(3.3, { unit: "V" })).toBe("3.3 V");
    expect(formatEngineering(0, { unit: "V" })).toBe("0 V");
  });

  it("formats R-notation correctly", () => {
    expect(formatEngineering(4700, { rNotation: true })).toBe("4k7");
    expect(formatEngineering(2.2, { rNotation: true })).toBe("2R2");
  });
});

describe("fast-check property tests: parse/format round-trip", () => {
  it("round-trips positive numbers within precision limits", () => {
    fc.assert(
      fc.property(fc.double({ min: 1e-9, max: 1e8, noNaN: true }), (val) => {
        const formatted = formatEngineering(val, { precision: 4 });
        const parsed = parseEngineering(formatted);
        // Relative error should be within 0.1% due to rounding to 4 digits
        const relError = Math.abs(parsed - val) / val;
        expect(relError).toBeLessThan(0.01);
      }),
      { numRuns: 200 },
    );
  });
});
