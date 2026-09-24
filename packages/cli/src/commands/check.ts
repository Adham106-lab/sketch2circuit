/**
 * @license Apache-2.0
 * @s2c/cli — `s2c check <circuit.json|sketch.ino>` Command (Doc §13).
 */

import fs from "node:fs";
import { synthesizeSketch } from "@s2c/arduino";
import { type Circuit, CircuitSchema } from "@s2c/circuit-json";
import { runErc } from "@s2c/rules";

export interface CheckOptions {
  strict?: boolean;
  json?: boolean;
}

export function checkCommand(
  filePath: string,
  options: CheckOptions = {},
): { code: number; output: string } {
  if (!filePath) {
    return {
      code: 3,
      output:
        "Error: Missing input file path.\nUsage: s2c check <circuit.json|sketch.ino> [--strict]",
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      code: 3,
      output: `Error: File not found: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  let diagnostics: ReturnType<typeof runErc> = [];
  let unresolved: string[] = [];

  if (filePath.endsWith(".ino") || filePath.endsWith(".cpp") || filePath.endsWith(".c")) {
    const synthResult = synthesizeSketch(content);
    diagnostics = synthResult.diagnostics;
    unresolved = synthResult.unresolved;
  } else {
    try {
      const parsed = JSON.parse(content);
      const circuit = CircuitSchema.parse(parsed) as Circuit;
      diagnostics = runErc(circuit);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        code: 3,
        output: `Error parsing circuit JSON: ${msg}`,
      };
    }
  }

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const infos = diagnostics.filter((d) => d.severity === "info");

  if (options.json) {
    return {
      code: errors.length > 0 ? 1 : options.strict && unresolved.length > 0 ? 2 : 0,
      output: JSON.stringify(
        {
          passed: errors.length === 0,
          errorsCount: errors.length,
          warningsCount: warnings.length,
          infosCount: infos.length,
          unresolvedCount: unresolved.length,
          diagnostics,
          unresolved,
        },
        null,
        2,
      ),
    };
  }

  const lines = [
    `Checking '${filePath}' across 18 ERC rules...`,
    "--------------------------------------------------------------------------------",
  ];

  if (diagnostics.length === 0 && unresolved.length === 0) {
    lines.push("✓ All electrical rules passed cleanly. 0 errors, 0 warnings.");
  } else {
    for (const d of diagnostics) {
      const icon =
        d.severity === "error" ? "❌ ERROR" : d.severity === "warning" ? "⚠️  WARN" : "ℹ️  INFO";
      lines.push(`${icon}: [${d.ruleId}] on ${d.target.type} '${d.target.id}': ${d.message}`);
      if (d.explanation) lines.push(`   Explanation: ${d.explanation}`);
      if (d.suggestion) lines.push(`   Suggested fix: ${d.suggestion}`);
    }

    if (unresolved.length > 0) {
      lines.push("");
      lines.push("Unresolved dynamic items:");
      for (const u of unresolved) {
        lines.push(`   ⚠️ ${u}`);
      }
    }

    lines.push("--------------------------------------------------------------------------------");
    lines.push(
      `Summary: ${errors.length} error(s), ${warnings.length} warning(s), ${infos.length} info(s), ${unresolved.length} unresolved.`,
    );
  }

  // Exit codes: 0 ok, 1 ERC errors, 2 unresolved items in --strict, 3 usage error
  if (errors.length > 0) {
    return { code: 1, output: lines.join("\n") };
  }
  if (options.strict && unresolved.length > 0) {
    lines.push("FAILED in --strict mode due to unresolved dynamic pin items.");
    return { code: 2, output: lines.join("\n") };
  }

  return { code: 0, output: lines.join("\n") };
}
