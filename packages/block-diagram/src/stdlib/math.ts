/**
 * @license Apache-2.0
 * @s2c/block-diagram — Standard Library Algebraic & Math Blocks.
 */

import type { BlockDefinition } from "../blocks.js";

export const GainBlock: BlockDefinition = {
  type: "Gain",
  name: "Gain",
  category: "math",
  description: "Multiplies input signal by a constant gain factor: y = gain * u.",
  inputs: [{ id: "in", name: "In", required: true, description: "Input signal" }],
  outputs: [{ id: "out", name: "Out", required: true, description: "Scaled signal output" }],
  hasDirectFeedthrough: () => true,
  defaultParams: { gain: 1.0 },
  numStates: () => 0,
  execute: ({ inputs, params }) => {
    const gain = typeof params.gain === "number" ? params.gain : 1.0;
    const u = inputs.in ?? 0.0;
    return { outputs: { out: gain * u } };
  },
};

export const SumBlock: BlockDefinition = {
  type: "Sum",
  name: "Sum",
  category: "math",
  description:
    "Computes algebraic sum of input signals according to sign string (e.g. '+-' or '++').",
  inputs: [
    { id: "in1", name: "+", required: true, description: "First input signal" },
    { id: "in2", name: "-", required: true, description: "Second input signal" },
  ],
  outputs: [{ id: "out", name: "Out", required: true, description: "Sum output" }],
  hasDirectFeedthrough: () => true,
  defaultParams: { signs: "+-" },
  numStates: () => 0,
  execute: ({ inputs, params }) => {
    const signs = typeof params.signs === "string" ? params.signs : "+-";
    let sum = 0.0;
    for (let i = 0; i < signs.length; i++) {
      const portId = `in${i + 1}`;
      const sign = signs[i];
      const val = inputs[portId] ?? (i === 0 ? (inputs.in1 ?? 0) : (inputs.in2 ?? 0));
      if (sign === "-") {
        sum -= val;
      } else {
        sum += val;
      }
    }
    return { outputs: { out: sum } };
  },
};

export const ProductBlock: BlockDefinition = {
  type: "Product",
  name: "Product",
  category: "math",
  description: "Multiplies input signals: y = in1 * in2.",
  inputs: [
    { id: "in1", name: "In1", required: true, description: "First input signal" },
    { id: "in2", name: "In2", required: true, description: "Second input signal" },
  ],
  outputs: [{ id: "out", name: "Out", required: true, description: "Product output" }],
  hasDirectFeedthrough: () => true,
  defaultParams: {},
  numStates: () => 0,
  execute: ({ inputs }) => {
    const in1 = inputs.in1 ?? 0.0;
    const in2 = inputs.in2 ?? 0.0;
    return { outputs: { out: in1 * in2 } };
  },
};

export const SaturationBlock: BlockDefinition = {
  type: "Saturation",
  name: "Saturation",
  category: "math",
  description:
    "Limits output signal between lowerLimit and upperLimit: y = clamp(u, lower, upper).",
  inputs: [{ id: "in", name: "In", required: true, description: "Input signal" }],
  outputs: [{ id: "out", name: "Out", required: true, description: "Clamped output signal" }],
  hasDirectFeedthrough: () => true,
  defaultParams: {
    upperLimit: 1.0,
    lowerLimit: -1.0,
  },
  numStates: () => 0,
  execute: ({ inputs, params }) => {
    const upperLimit = typeof params.upperLimit === "number" ? params.upperLimit : 1.0;
    const lowerLimit = typeof params.lowerLimit === "number" ? params.lowerLimit : -1.0;
    const u = inputs.in ?? 0.0;
    const clamped = Math.max(lowerLimit, Math.min(upperLimit, u));
    return { outputs: { out: clamped } };
  },
};

export const AbsBlock: BlockDefinition = {
  type: "Abs",
  name: "Absolute Value",
  category: "math",
  description: "Computes absolute value of input signal: y = |u|.",
  inputs: [{ id: "in", name: "In", required: true, description: "Input signal" }],
  outputs: [{ id: "out", name: "Out", required: true, description: "Absolute value output" }],
  hasDirectFeedthrough: () => true,
  defaultParams: {},
  numStates: () => 0,
  execute: ({ inputs }) => {
    const u = inputs.in ?? 0.0;
    return { outputs: { out: Math.abs(u) } };
  },
};
