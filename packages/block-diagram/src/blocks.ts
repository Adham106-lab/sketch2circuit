/**
 * @license Apache-2.0
 * @s2c/block-diagram — Block Type Registry and Specifications.
 */

import type { PortDefinition } from "./graph.js";

export type BlockCategory = "source" | "math" | "dynamics" | "sink";

export interface BlockExecutionContext {
  t: number;
  params: Record<string, unknown>;
  inputs: Record<string, number>;
  stateSlice: number[];
  history?: {
    lookupDelay: (delayTime: number, fallback: number) => number;
  };
}

export interface BlockExecutionResult {
  outputs: Record<string, number>;
  derivatives?: number[];
}

export interface BlockDefinition {
  type: string;
  name: string;
  category: BlockCategory;
  description: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  /**
   * Whether output depends algebraically on current input at the exact same instant t.
   * True for algebraic math blocks (Gain, Sum, Product, Saturation, Abs, PID).
   * False for sources (Constant, Step, Ramp, Sine), state blocks (Integrator, strictly proper TF, Delay), and sinks (Scope).
   */
  hasDirectFeedthrough: (params: Record<string, unknown>) => boolean;
  defaultParams: Record<string, unknown>;
  numStates: (params: Record<string, unknown>) => number;
  stateNames?: (params: Record<string, unknown>) => string[];
  initialState?: (params: Record<string, unknown>) => number[];
  execute: (ctx: BlockExecutionContext) => BlockExecutionResult;
}

export const BLOCK_REGISTRY: Record<string, BlockDefinition> = {};

export function registerBlock(def: BlockDefinition): void {
  BLOCK_REGISTRY[def.type] = def;
}

export function getBlockDefinition(type: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY[type];
}

export function getAllBlockDefinitions(): BlockDefinition[] {
  return Object.values(BLOCK_REGISTRY);
}
