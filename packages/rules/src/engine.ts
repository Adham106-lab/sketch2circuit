/**
 * @license Apache-2.0
 * @s2c/rules — ERC execution engine.
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import { DEFAULT_RULES, RULE_REGISTRY } from "./catalog/index.js";
import { buildRuleContext } from "./context.js";
import type { RuleEngineOptions } from "./types.js";

const SEVERITY_ORDER: Record<Diagnostic["severity"], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

/**
 * Runs Electrical Rules Check (ERC) across a circuit design.
 *
 * @param circuit The Circuit IR to analyze
 * @param options Custom rule filters and execution options
 * @returns Array of diagnostics with quantitative explanations and suggested fixes
 */
export function runErc(circuit: Circuit, options: RuleEngineOptions = {}): Diagnostic[] {
  const context = buildRuleContext(circuit);
  const diagnostics: Diagnostic[] = [];

  // Determine active rules
  let rulesToRun = DEFAULT_RULES;

  if (options.enabledRules && options.enabledRules.length > 0) {
    rulesToRun = options.enabledRules
      .map((id) => RULE_REGISTRY.get(id))
      .filter((r): r is NonNullable<typeof r> => r !== undefined);
  }

  if (options.ignoredRules && options.ignoredRules.length > 0) {
    const ignoredSet = new Set(options.ignoredRules);
    rulesToRun = rulesToRun.filter((r) => !ignoredSet.has(r.id));
  }

  for (const rule of rulesToRun) {
    try {
      const results = rule.run(circuit, context);
      diagnostics.push(...results);
    } catch (err) {
      diagnostics.push({
        ruleId: rule.id,
        severity: "error",
        message: `Internal error running rule '${rule.id}': ${(err as Error).message}`,
        explanation: `Rule evaluation threw an unexpected error during execution.`,
        target: { type: "circuit", id: circuit.name || "circuit" },
      });
    }
  }

  // Sort by severity (error -> warning -> info) then rule ID
  return diagnostics.sort((a, b) => {
    const diff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (diff !== 0) return diff;
    return a.ruleId.localeCompare(b.ruleId);
  });
}
