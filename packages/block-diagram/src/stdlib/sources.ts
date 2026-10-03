/**
 * @license Apache-2.0
 * @s2c/block-diagram — Standard Library Source Blocks.
 */

import type { BlockDefinition } from "../blocks.js";

export const ConstantBlock: BlockDefinition = {
  type: "Constant",
  name: "Constant",
  category: "source",
  description: "Outputs a constant scalar value.",
  inputs: [],
  outputs: [{ id: "out", name: "Out", required: true, description: "Constant signal output" }],
  hasDirectFeedthrough: () => false,
  defaultParams: { value: 1.0 },
  numStates: () => 0,
  execute: ({ params }) => {
    const val = typeof params.value === "number" ? params.value : 1.0;
    return { outputs: { out: val } };
  },
};

/**
 * Note on Numerical Integration with Step Discontinuities:
 * Evaluating discontinuous step functions with fixed-step RK4 produces an O(dt)
 * error at interior transition times (t = stepTime) because Runge-Kutta intermediate
 * stage k4 samples across the discontinuity boundary during the step immediately preceding it.
 * For high-precision simulation of diagrams containing Step blocks, RKF45 adaptive-step
 * integration is the default recommended solver, as it subdivides the grid near t = stepTime.
 */
export const StepBlock: BlockDefinition = {
  type: "Step",
  name: "Step",
  category: "source",
  description:
    "Outputs a step function transitioning from initial to final value at a specified step time.",
  inputs: [],
  outputs: [{ id: "out", name: "Out", required: true, description: "Step signal output" }],
  hasDirectFeedthrough: () => false,
  defaultParams: {
    stepTime: 1.0,
    initialValue: 0.0,
    finalValue: 1.0,
  },
  numStates: () => 0,
  execute: ({ t, params }) => {
    const stepTime = typeof params.stepTime === "number" ? params.stepTime : 1.0;
    const initialValue = typeof params.initialValue === "number" ? params.initialValue : 0.0;
    const finalValue = typeof params.finalValue === "number" ? params.finalValue : 1.0;
    return { outputs: { out: t >= stepTime ? finalValue : initialValue } };
  },
};

export const RampBlock: BlockDefinition = {
  type: "Ramp",
  name: "Ramp",
  category: "source",
  description: "Outputs a linear ramp signal starting at a specified time with a given slope.",
  inputs: [],
  outputs: [{ id: "out", name: "Out", required: true, description: "Ramp signal output" }],
  hasDirectFeedthrough: () => false,
  defaultParams: {
    slope: 1.0,
    startTime: 0.0,
    initialOutput: 0.0,
  },
  numStates: () => 0,
  execute: ({ t, params }) => {
    const slope = typeof params.slope === "number" ? params.slope : 1.0;
    const startTime = typeof params.startTime === "number" ? params.startTime : 0.0;
    const initialOutput = typeof params.initialOutput === "number" ? params.initialOutput : 0.0;
    const out = t >= startTime ? initialOutput + slope * (t - startTime) : initialOutput;
    return { outputs: { out } };
  },
};

export const SineBlock: BlockDefinition = {
  type: "Sine",
  name: "Sine Wave",
  category: "source",
  description: "Outputs a sinusoidal waveform: bias + amplitude * sin(2*pi*frequency*t + phase).",
  inputs: [],
  outputs: [{ id: "out", name: "Out", required: true, description: "Sine wave output" }],
  hasDirectFeedthrough: () => false,
  defaultParams: {
    amplitude: 1.0,
    frequencyHz: 1.0,
    phaseRad: 0.0,
    bias: 0.0,
  },
  numStates: () => 0,
  execute: ({ t, params }) => {
    const amplitude = typeof params.amplitude === "number" ? params.amplitude : 1.0;
    const frequencyHz = typeof params.frequencyHz === "number" ? params.frequencyHz : 1.0;
    const phaseRad = typeof params.phaseRad === "number" ? params.phaseRad : 0.0;
    const bias = typeof params.bias === "number" ? params.bias : 0.0;
    const out = bias + amplitude * Math.sin(2 * Math.PI * frequencyHz * t + phaseRad);
    return { outputs: { out } };
  },
};
