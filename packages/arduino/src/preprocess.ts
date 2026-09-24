/**
 * @license Apache-2.0
 * @s2c/arduino — Sub-step 1: Preprocessor & Annotation Extractor (Doc §12.1).
 */

import type { Annotation } from "./types.js";

export interface PreprocessResult {
  cleanedSource: string;
  includes: string[];
  defines: Map<string, string | number>;
  annotations: Annotation[];
  commentHints: Map<number, string>; // Line number -> comment text hint
}

/**
 * Preprocesses Arduino sketch text:
 * - Collects #include <X.h> headers
 * - Collects #define NAME value macros
 * - Extracts @s2c: annotations with parameter parsing
 * - Records non-annotation comments as low-weight hints
 */
export function preprocessSketch(source: string): PreprocessResult {
  const includes: string[] = [];
  const defines = new Map<string, string | number>();
  const annotations: Annotation[] = [];
  const commentHints = new Map<number, string>();

  const lines = source.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const originalLine = lines[lineIdx];
    const lineNumber = lineIdx + 1;

    // 1. Check for @s2c: annotations
    const s2cMatch = originalLine.match(/\/\/\s*@s2c:\s*(.+)$/);
    if (s2cMatch) {
      const annotation = parseAnnotation(s2cMatch[1].trim(), lineNumber);
      if (annotation) {
        annotations.push(annotation);
      }
    }

    // 2. Check for general comments as hints
    const commentMatch = originalLine.match(/\/\/\s*(?!@s2c:)(.+)$/);
    if (commentMatch) {
      commentHints.set(lineNumber, commentMatch[1].trim());
    }

    // 3. Collect #include directives
    const incMatch = originalLine.match(/^\s*#include\s*[<"]([^>"]+)[>"]/);
    if (incMatch) {
      includes.push(incMatch[1]);
      cleanedLines.push(originalLine);
      continue;
    }

    // 4. Collect #define directives
    const defMatch = originalLine.match(/^\s*#define\s+([A-Za-z_][A-Za-z0-9_]*)\s+([^\s/]+)/);
    if (defMatch) {
      const name = defMatch[1];
      const rawVal = defMatch[2];
      const num = Number(rawVal);
      defines.set(name, Number.isNaN(num) ? rawVal : num);
      cleanedLines.push(originalLine);
      continue;
    }

    cleanedLines.push(originalLine);
  }

  return {
    cleanedSource: cleanedLines.join("\n"),
    includes,
    defines,
    annotations,
    commentHints,
  };
}

/**
 * Parses an @s2c annotation line:
 * Examples:
 *   led(color=green) on D9
 *   ldr on A0
 *   i2c device=mpu6050 addr=0x68
 *   ignore D13
 */
export function parseAnnotation(content: string, line: number): Annotation | null {
  if (!content) return null;

  // Pattern: type(k=v, k=v) on <pin> key=value ...
  // or: type on <pin> key=value ...
  let working = content.trim();

  // Extract type and optional parens: e.g. "led(color=green)" or "led"
  const typeMatch = working.match(/^([A-Za-z0-9_-]+)(?:\(([^)]*)\))?/);
  if (!typeMatch) return null;

  const type = typeMatch[1].toLowerCase();
  const parenParams = typeMatch[2] || "";
  working = working.slice(typeMatch[0].length).trim();

  const params: Record<string, string> = {};

  if (parenParams) {
    const pairs = parenParams.split(",");
    for (const p of pairs) {
      const [k, v] = p.split("=").map((s) => s.trim());
      if (k && v !== undefined) {
        params[k.toLowerCase()] = v;
      }
    }
  }

  // Check for "on <pin>"
  let pin: string | undefined;
  const onPinMatch = working.match(/^on\s+([A-Za-z0-9_]+)/i);
  if (onPinMatch) {
    pin = normalizePinName(onPinMatch[1]);
    working = working.slice(onPinMatch[0].length).trim();
  }

  // Check for remaining key=value pairs or standalone pin (e.g. "ignore D13")
  const words = working.split(/\s+/).filter(Boolean);
  for (const word of words) {
    if (word.includes("=")) {
      const [k, v] = word.split("=").map((s) => s.trim());
      if (k && v !== undefined) {
        params[k.toLowerCase()] = v;
      }
    } else if (!pin && /^(?:D|A)?\d+$/i.test(word)) {
      pin = normalizePinName(word);
    }
  }

  return {
    type,
    pin,
    params,
    raw: content,
    line,
  };
}

export function normalizePinName(pinStr: string): string {
  const upper = pinStr.toUpperCase().trim();
  if (/^\d+$/.test(upper)) {
    return `D${upper}`;
  }
  return upper;
}
