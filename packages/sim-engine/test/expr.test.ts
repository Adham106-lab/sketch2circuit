/**
 * @license Apache-2.0
 * @s2c/sim-engine — Tests for mathjs wrapper and defensive error reporting.
 */

import { describe, expect, it } from "vitest";
import { evaluateAlgebraicRange, parseExpression } from "../src/expr.js";

describe("M17 Math Expression Parsing & Defensive Error Handling", () => {
  it("evaluates valid mathematical expressions over a range", () => {
    const points = evaluateAlgebraicRange("3 * sin(2 * x) + 1", 0, Math.PI, 5, "x");
    expect(points.length).toBe(5);
    expect(points[0]?.x).toBe(0);
    expect(points[0]?.y).toBeCloseTo(1.0, 4);
  });

  it("defensively catches syntax errors and never fails silently", () => {
    const malformed = parseExpression("3 * sin( + ");
    expect(malformed.success).toBe(false);
    expect(malformed.error).toBeDefined();
    expect(malformed.error).toContain("Parse error");
  });

  it("defensively catches empty strings", () => {
    const empty = parseExpression("   ");
    expect(empty.success).toBe(false);
    expect(empty.error).toBe("Expression cannot be empty.");
  });

  it("throws clear inline error when evaluating range with malformed expression", () => {
    expect(() => {
      evaluateAlgebraicRange("x + * 2", 0, 10, 10);
    }).toThrow(/Parse error/);
  });
});
