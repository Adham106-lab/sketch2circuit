import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { nearestE } from "../src/series.js";

describe("nearestE series snapping", () => {
  it("snaps to standard E24 values", () => {
    // 330 ohm is exact E24
    expect(nearestE(330, "E24")).toBe(330);
    // 320 ohm should snap to 330 in nearest mode
    expect(nearestE(320, "E24", "nearest")).toBe(330);
    // 320 ohm in ceil mode should snap to 330
    expect(nearestE(320, "E24", "ceil")).toBe(330);
    // 320 ohm in floor mode should snap to 300
    expect(nearestE(320, "E24", "floor")).toBe(300);
  });

  it("snaps 4700 across decades correctly", () => {
    expect(nearestE(4600, "E24", "nearest")).toBe(4700);
    expect(nearestE(4750, "E24", "nearest")).toBe(4700);
    expect(nearestE(0.047, "E24", "nearest")).toBe(0.047);
  });

  it("throws on non-positive values", () => {
    expect(() => nearestE(0, "E24")).toThrow(RangeError);
    expect(() => nearestE(-100, "E24")).toThrow(RangeError);
  });
});

describe("fast-check property tests: nearestE", () => {
  it("monotonicity: ceil is always >= target, floor is always <= target", () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 1e7, noNaN: true }), (val) => {
        const ceilVal = nearestE(val, "E24", "ceil");
        const floorVal = nearestE(val, "E24", "floor");
        expect(ceilVal).toBeGreaterThanOrEqual(val * (1 - 1e-6));
        expect(floorVal).toBeLessThanOrEqual(val * (1 + 1e-6));
        expect(ceilVal).toBeGreaterThanOrEqual(floorVal);
      }),
      { numRuns: 200 },
    );
  });
});
