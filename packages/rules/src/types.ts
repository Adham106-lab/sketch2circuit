/**
 * @license Apache-2.0
 * @s2c/rules — Electrical Rules Check (ERC) type definitions.
 */

import type { Circuit, Component, Diagnostic, Net, Port } from "@s2c/circuit-json";

export type RuleCategory =
  | "electrical-safety"
  | "signal-integrity"
  | "power"
  | "connectivity"
  | "component-ratings";

export interface RuleContext {
  /** Map of component ID to Component */
  componentsById: Map<string, Component>;
  /** Map of net ID to Net */
  netsById: Map<string, Net>;
  /** Map of port ID to Port */
  portsById: Map<string, Port>;
  /** Map of port ID to connected Net */
  portToNet: Map<string, Net>;
  /** Map of port ID to parent Component */
  portToComponent: Map<string, Component>;
  /** Map of net ID to all ports on that net */
  netToPorts: Map<string, Port[]>;
}

export interface RuleDefinition {
  /** Unique rule ID: e.g. "erc.led-current", "erc.floating-input" */
  id: string;
  /** Human-readable title */
  name: string;
  /** High-level description of what the rule checks */
  description: string;
  /** Category of check */
  category: RuleCategory;
  /** Default severity when triggered */
  defaultSeverity: "error" | "warning" | "info";
  /** Execution function returning diagnostics */
  run: (circuit: Circuit, context: RuleContext) => Diagnostic[];
}

export interface RuleEngineOptions {
  /** Enable only a specific subset of rule IDs */
  enabledRules?: string[];
  /** Exclude specific rule IDs from running */
  ignoredRules?: string[];
  /** Custom tolerance or limit overrides if applicable */
  customThresholds?: Record<string, number>;
}
