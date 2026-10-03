/**
 * @license Apache-2.0
 * @s2c/arduino — Sub-step 4: Constant Resolution & Folding (Doc §12.3).
 */

import type { SketchFacts } from "./types.js";

export interface ResolvedPinRef {
  pinId: string; // e.g. "D13", "D2", "A0"
  pinNumber: number; // e.g. 13, 2, 14
  nameHint?: string; // identifier name: e.g. "ledPin", "trigPin"
}

// Built-in Arduino & MATLAB Simulink environment constants
const ARDUINO_BUILTINS: Record<string, number | string> = {
  LED_BUILTIN: 13,
  INPUT: "INPUT",
  OUTPUT: "OUTPUT",
  INPUT_PULLUP: "INPUT_PULLUP",
  MW_INPUT: "INPUT",
  MW_OUTPUT: "OUTPUT",
  MW_INPUT_PULLUP: "INPUT_PULLUP",
  HIGH: 1,
  LOW: 0,
  A0: "A0",
  A1: "A1",
  A2: "A2",
  A3: "A3",
  A4: "A4",
  A5: "A5",
};

/**
 * Resolves an expression or identifier into a canonical Pin ID and numeric value.
 */
export function resolvePin(rawExpr: string | number, facts: SketchFacts): ResolvedPinRef | null {
  if (typeof rawExpr === "number") {
    return {
      pinId: formatPinId(rawExpr),
      pinNumber: rawExpr,
    };
  }

  const expr = rawExpr.trim();

  // 1. Check direct integer literal
  if (/^\d+$/.test(expr)) {
    const num = Number.parseInt(expr, 10);
    return {
      pinId: formatPinId(num),
      pinNumber: num,
    };
  }

  // 2. Check analog pin literal (e.g. "A0", "A1")
  if (/^A\d+$/i.test(expr)) {
    const num = Number.parseInt(expr.slice(1), 10) + 14;
    return {
      pinId: expr.toUpperCase(),
      pinNumber: num,
      nameHint: expr,
    };
  }

  // 3. Check Arduino built-in constants
  if (ARDUINO_BUILTINS[expr] !== undefined) {
    const val = ARDUINO_BUILTINS[expr];
    if (typeof val === "number") {
      return {
        pinId: formatPinId(val),
        pinNumber: val,
        nameHint: expr,
      };
    }
    if (typeof val === "string" && /^A\d+$/i.test(val)) {
      return {
        pinId: val.toUpperCase(),
        pinNumber: Number.parseInt(val.slice(1), 10) + 14,
        nameHint: expr,
      };
    }
  }

  // 4. Check user constants / defines
  if (facts.constants.has(expr)) {
    const constVal = facts.constants.get(expr);
    if (typeof constVal === "number") {
      return {
        pinId: formatPinId(constVal),
        pinNumber: constVal,
        nameHint: expr,
      };
    }
    if (typeof constVal === "string") {
      const resolved = resolvePin(constVal, facts);
      if (resolved) {
        return {
          ...resolved,
          nameHint: expr,
        };
      }
    }
  }

  // 5. Check if it's an array lookup: leds[0], leds[i]
  const arrMatch = expr.match(/^([A-Za-z_][A-Za-z0-9_]*)\[(\d+)\]$/);
  if (arrMatch) {
    const arrName = arrMatch[1];
    const index = Number.parseInt(arrMatch[2], 10);
    const arr = facts.arrays.get(arrName);
    if (arr && arr[index] !== undefined) {
      const val = arr[index];
      const resolved = resolvePin(val, facts);
      if (resolved) {
        return {
          ...resolved,
          nameHint: `${arrName}_${index}`,
        };
      }
    }
  }

  // 6. Simple constant arithmetic: e.g. 10 + 2 or BASE + 1
  const arithMatch = expr.match(/^([A-Za-z0-9_]+)\s*([+\-*/])\s*([A-Za-z0-9_]+)$/);
  if (arithMatch) {
    const left = resolveValue(arithMatch[1], facts);
    const op = arithMatch[2];
    const right = resolveValue(arithMatch[3], facts);
    if (typeof left === "number" && typeof right === "number") {
      let res = 0;
      switch (op) {
        case "+":
          res = left + right;
          break;
        case "-":
          res = left - right;
          break;
        case "*":
          res = left * right;
          break;
        case "/":
          res = Math.floor(left / right);
          break;
      }
      return {
        pinId: formatPinId(res),
        pinNumber: res,
        nameHint: expr,
      };
    }
  }

  return null;
}

export function resolveValue(expr: string | number, facts: SketchFacts): string | number {
  if (typeof expr === "number") return expr;
  const trimmed = expr.trim();
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  if (ARDUINO_BUILTINS[trimmed] !== undefined) return ARDUINO_BUILTINS[trimmed];
  if (facts.constants.has(trimmed)) {
    const c = facts.constants.get(trimmed);
    if (c !== undefined) return c;
  }
  return trimmed;
}

export function resolveMode(
  rawMode: string | number,
  facts: SketchFacts,
): "INPUT" | "OUTPUT" | "INPUT_PULLUP" {
  const resolved = String(resolveValue(rawMode, facts)).toUpperCase();
  if (resolved === "OUTPUT" || resolved === "1" || resolved === "MW_OUTPUT") return "OUTPUT";
  if (resolved === "INPUT_PULLUP" || resolved === "2" || resolved === "MW_INPUT_PULLUP")
    return "INPUT_PULLUP";
  return "INPUT";
}

function formatPinId(num: number): string {
  if (num >= 14 && num <= 19) {
    return `A${num - 14}`;
  }
  return `D${num}`;
}
