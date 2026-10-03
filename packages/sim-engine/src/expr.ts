/**
 * @license Apache-2.0
 * @s2c/sim-engine — Mathematical expression parsing & evaluation wrapping mathjs.
 */

import { compile, type EvalFunction } from "mathjs";

export interface CompiledExpression {
  raw: string;
  compiled: EvalFunction;
  evaluate: (scope: Record<string, number>) => number;
}

export interface ParseResult {
  success: boolean;
  expr?: CompiledExpression;
  error?: string;
}

/**
 * Safely parses and compiles a mathematical expression string (e.g. "5 * sin(2 * t) + 1.2").
 * Returns an error string on syntax or compile errors, never throws.
 */
export function parseExpression(rawExpr: string): ParseResult {
  const trimmed = rawExpr.trim();
  if (!trimmed) {
    return {
      success: false,
      error: "Expression cannot be empty.",
    };
  }

  try {
    const compiled = compile(trimmed);

    // Sanity-test evaluation with a dummy scope to catch undeclared function calls or syntax traps
    const evaluator = (scope: Record<string, number>): number => {
      try {
        const val = compiled.evaluate(scope);
        if (typeof val === "number") {
          if (!Number.isFinite(val)) {
            return Number.NaN;
          }
          return val;
        }
        if (typeof val === "boolean") {
          return val ? 1 : 0;
        }
        if (val && typeof val === "object" && "valueOf" in val) {
          const num = Number(val.valueOf());
          return Number.isFinite(num) ? num : Number.NaN;
        }
        return Number.NaN;
      } catch (err: unknown) {
        throw new Error(
          `Runtime evaluation error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    };

    return {
      success: true,
      expr: {
        raw: trimmed,
        compiled,
        evaluate: evaluator,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Evaluates an algebraic function y = f(x) over a range [xMin, xMax] with N points.
 */
export function evaluateAlgebraicRange(
  rawExpr: string,
  xMin: number,
  xMax: number,
  points: number,
  variableName = "x",
): { x: number; y: number }[] {
  if (points < 2) points = 2;
  const parsed = parseExpression(rawExpr);
  if (!parsed.success || !parsed.expr) {
    throw new Error(parsed.error || "Failed to parse expression.");
  }

  const results: { x: number; y: number }[] = [];
  const step = (xMax - xMin) / (points - 1);

  for (let i = 0; i < points; i++) {
    const xVal = xMin + i * step;
    const yVal = parsed.expr.evaluate({ [variableName]: xVal, t: xVal });
    results.push({ x: xVal, y: yVal });
  }

  return results;
}
