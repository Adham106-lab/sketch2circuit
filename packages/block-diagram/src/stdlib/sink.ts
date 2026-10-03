/**
 * @license Apache-2.0
 * @s2c/block-diagram — Standard Library Sink Blocks (Scope).
 */

import type { BlockDefinition } from "../blocks.js";

export const ScopeBlock: BlockDefinition = {
  type: "Scope",
  name: "Scope",
  category: "sink",
  description: "Time-domain signal display and logging sink (records signal over simulation time).",
  inputs: [{ id: "in", name: "In", required: true, description: "Signal to observe" }],
  outputs: [],
  hasDirectFeedthrough: () => false,
  defaultParams: {
    title: "Scope",
  },
  numStates: () => 0,
  execute: ({ inputs }) => {
    // Sinks produce no downstream outputs
    return { outputs: { in: inputs.in ?? 0.0 } };
  },
};
