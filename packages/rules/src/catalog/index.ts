/**
 * @license Apache-2.0
 * @s2c/rules — Electrical Rules Catalog (Doc §9.1 Complete 18-Rule Set).
 */

import type { RuleDefinition } from "../types.js";
import { adcCapabilityRule } from "./adc-capability.js";
import { decouplingRule } from "./decoupling.js";
import { floatingInputRule } from "./floating-input.js";
import { i2cAddressConflictRule } from "./i2c-address-conflict.js";
import { i2cPullupsRule } from "./i2c-pullups.js";
import { inductiveLoadFlybackRule } from "./inductive-load.js";
import { ledCurrentRule, ledNoResistorRule } from "./led-current.js";
import { logicLevelMismatchRule } from "./logic-level-mismatch.js";
import { outputContentionRule } from "./output-contention.js";
import { pinCurrentRule } from "./pin-current.js";
import { powerBudgetRule } from "./power-budget.js";
import { powerShortRule } from "./power-short.js";
import { pwmCapabilityRule } from "./pwm-capability.js";
import { reservedPinRule } from "./reserved-pin.js";
import { servoPowerRule } from "./servo-power.js";
import { totalCurrentRule } from "./total-current.js";
import { unconnectedPortRule } from "./unconnected-port.js";

export * from "./adc-capability.js";
export * from "./decoupling.js";
export * from "./floating-input.js";
export * from "./i2c-address-conflict.js";
export * from "./i2c-pullups.js";
export * from "./inductive-load.js";
export * from "./led-current.js";
export * from "./logic-level-mismatch.js";
export * from "./output-contention.js";
export * from "./pin-current.js";
export * from "./power-budget.js";
export * from "./power-short.js";
export * from "./pwm-capability.js";
export * from "./reserved-pin.js";
export * from "./servo-power.js";
export * from "./total-current.js";
export * from "./unconnected-port.js";

/**
 * Full v1 Electrical Rules Check catalog containing all 18 rules specified in Doc §9.1.
 */
export const DEFAULT_RULES: RuleDefinition[] = [
  floatingInputRule,
  unconnectedPortRule,
  powerShortRule,
  outputContentionRule,
  ledNoResistorRule,
  ledCurrentRule,
  pinCurrentRule,
  totalCurrentRule,
  i2cPullupsRule,
  i2cAddressConflictRule,
  decouplingRule,
  logicLevelMismatchRule,
  inductiveLoadFlybackRule,
  servoPowerRule,
  pwmCapabilityRule,
  adcCapabilityRule,
  reservedPinRule,
  powerBudgetRule,
];

/**
 * Registry map of all 18 rules keyed by rule ID.
 */
export const RULE_REGISTRY = new Map<string, RuleDefinition>(
  DEFAULT_RULES.map((rule) => [rule.id, rule]),
);

export const ALL_ERC_RULES = DEFAULT_RULES;

export function getRule(id: string): RuleDefinition | undefined {
  return RULE_REGISTRY.get(id);
}
