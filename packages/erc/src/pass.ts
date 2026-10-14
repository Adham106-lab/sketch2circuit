/**
 * @license Apache-2.0
 * @s2c/erc — Main Middle-End Electrical Rules Check Validation Pass.
 */

import type { Circuit } from "@s2c/circuit-json";
import { getBoardManifest } from "@s2c/manifests";
import { CurrentProtectionRule } from "./rules/current-protection.js";
import { I2CPullUpRule, injectVirtualI2CPullups } from "./rules/i2c-pullup.js";
import { PinContentionRule } from "./rules/pin-contention.js";
import { StrappingAndRestrictedPinsRule } from "./rules/strapping-restricted-pins.js";
import type {
  ErcContext,
  ErcDiagnostic,
  ErcPassOptions,
  ErcPassResult,
  ErcRule,
} from "./types.js";

export const DEFAULT_ERC_RULES: ErcRule[] = [
  PinContentionRule,
  I2CPullUpRule,
  CurrentProtectionRule,
  StrappingAndRestrictedPinsRule,
];

/**
 * Runs the Electrical Rules Check (ERC) pass over a Circuit IR.
 */
export function runErcPass(circuit: Circuit, options: ErcPassOptions = {}): ErcPassResult {
  let workingCircuit = circuit;
  let injectedCount = 0;

  // 1. Optional pass: Auto-inject I2C pullups if requested
  if (options.autoInjectI2CPullups) {
    const injected = injectVirtualI2CPullups(workingCircuit, options.pullupValue);
    workingCircuit = injected.circuit;
    injectedCount = injected.count;
  }

  // 2. Resolve board manifest
  const boardId = options.boardId || workingCircuit.metadata?.board || "arduino-uno";
  const board = options.boardManifest || getBoardManifest(boardId);

  const context: ErcContext = {
    circuit: workingCircuit,
    board,
    strict: options.strict ?? false,
  };

  // 3. Execute all active ERC validation rules
  const allDiagnostics: ErcDiagnostic[] = [];
  for (const rule of DEFAULT_ERC_RULES) {
    const diags = rule.run(workingCircuit, context);
    allDiagnostics.push(...diags);
  }

  // 4. Categorize by severity
  const errors = allDiagnostics.filter((d) => d.severity === "error");
  const warnings = allDiagnostics.filter((d) => d.severity === "warning");
  const infos = allDiagnostics.filter((d) => d.severity === "info");

  // 5. Update circuit with attached diagnostics
  const finalCircuit: Circuit = {
    ...workingCircuit,
    diagnostics: allDiagnostics,
  };

  return {
    circuit: finalCircuit,
    diagnostics: allDiagnostics,
    errors,
    warnings,
    infos,
    injectedComponentsCount: injectedCount,
  };
}
