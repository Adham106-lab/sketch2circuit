/**
 * @license Apache-2.0
 * @s2c/block-diagram — Standard Library Dynamic & State Blocks.
 */

import type { BlockDefinition } from "../blocks.js";

export const IntegratorBlock: BlockDefinition = {
  type: "Integrator",
  name: "Integrator",
  category: "dynamics",
  description: "Integrates continuous input signal over time: dx/dt = u, y = x.",
  inputs: [{ id: "in", name: "In", required: true, description: "Derivative input signal dx/dt" }],
  outputs: [
    { id: "out", name: "Out", required: true, description: "Integrated state output x(t)" },
  ],
  hasDirectFeedthrough: () => false,
  defaultParams: { initialCondition: 0.0 },
  numStates: () => 1,
  stateNames: () => ["x"],
  initialState: (params) => [
    typeof params.initialCondition === "number" ? params.initialCondition : 0.0,
  ],
  execute: ({ inputs, stateSlice }) => {
    const x = stateSlice[0] ?? 0.0;
    const u = inputs.in ?? 0.0;
    return {
      outputs: { out: x },
      derivatives: [u],
    };
  },
};

/**
 * Normalizes transfer function polynomial coefficients and extracts controllable canonical form.
 */
function parseTransferFunction(params: Record<string, unknown>) {
  const rawNum = Array.isArray(params.numerator) ? (params.numerator as number[]) : [1.0];
  const rawDen = Array.isArray(params.denominator) ? (params.denominator as number[]) : [1.0, 1.0];

  // Clean numerical arrays
  const num = rawNum.map((v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0.0));
  let den = rawDen.map((v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0.0));

  // Trim leading zeros from denominator
  while (den.length > 1 && den[0] === 0) {
    den.shift();
  }
  if (den.length === 0 || den[0] === 0) {
    den = [1.0];
  }

  const an = den[0] ?? 1.0;
  // Normalize denominator so leading coefficient is 1.0
  const normalizedDen = den.map((a) => a / an);
  const normalizedNum = num.map((b) => b / an);

  const n = normalizedDen.length - 1; // Order of denominator (number of states)
  const m = normalizedNum.length - 1; // Order of numerator

  return {
    num: normalizedNum,
    den: normalizedDen,
    n,
    m,
    isStrictlyProper: m < n,
  };
}

export const TransferFunctionBlock: BlockDefinition = {
  type: "TransferFunction",
  name: "Transfer Function",
  category: "dynamics",
  description:
    "Continuous linear transfer function H(s) = num(s)/den(s) in state-space Controllable Canonical Form.",
  inputs: [{ id: "in", name: "In", required: true, description: "Input signal u(t)" }],
  outputs: [{ id: "out", name: "Out", required: true, description: "Filtered output signal y(t)" }],
  hasDirectFeedthrough: (params) => {
    const { isStrictlyProper } = parseTransferFunction(params);
    // If m >= n, biproper or improper -> direct feedthrough term D exists
    return !isStrictlyProper;
  },
  defaultParams: {
    numerator: [1.0],
    denominator: [1.0, 1.0], // 1 / (s + 1)
  },
  numStates: (params) => {
    const { n } = parseTransferFunction(params);
    return Math.max(0, n);
  },
  stateNames: (params) => {
    const { n } = parseTransferFunction(params);
    return Array.from({ length: n }, (_, i) => `x${i + 1}`);
  },
  initialState: (params) => {
    const { n } = parseTransferFunction(params);
    return Array.from({ length: n }, () => 0.0);
  },
  execute: ({ inputs, stateSlice, params }) => {
    const { num, den, n, m } = parseTransferFunction(params);
    const u = inputs.in ?? 0.0;

    if (n === 0) {
      // 0th order static gain: num[0] / den[0]
      const gain = (num[0] ?? 1.0) / (den[0] ?? 1.0);
      return { outputs: { out: gain * u } };
    }

    // Controllable Canonical Form state equations:
    // den = s^n + a_{n-1} s^{n-1} + ... + a_1 s + a_0
    // stateSlice: [x_1, x_2, ..., x_n]
    // dx_1/dt = x_2
    // dx_2/dt = x_3
    // ...
    // dx_n/dt = -a_0 x_1 - a_1 x_2 - ... - a_{n-1} x_n + u
    const derivatives: number[] = new Array(n);
    let lastDeriv = u;

    for (let i = 0; i < n - 1; i++) {
      derivatives[i] = stateSlice[i + 1] ?? 0.0;
    }

    // Denominator coefficients in ascending order a_0, a_1, ..., a_{n-1}
    for (let i = 0; i < n; i++) {
      const aCoeff = den[den.length - 1 - i] ?? 0.0;
      const xi = stateSlice[i] ?? 0.0;
      lastDeriv -= aCoeff * xi;
    }
    derivatives[n - 1] = lastDeriv;

    // Output equation:
    // y = c_0 x_1 + c_1 x_2 + ... + c_{n-1} x_n + D * u
    let out = 0.0;
    let D = 0.0;

    if (m === n) {
      // Biproper: D = b_n
      D = num[0] ?? 0.0;
      for (let i = 0; i < n; i++) {
        const bi = num[num.length - 1 - i] ?? 0.0;
        const ai = den[den.length - 1 - i] ?? 0.0;
        const ci = bi - D * ai;
        const xi = stateSlice[i] ?? 0.0;
        out += ci * xi;
      }
      out += D * u;
    } else {
      // Strictly proper (m < n): D = 0
      for (let i = 0; i < n; i++) {
        const bi = num[num.length - 1 - i] ?? 0.0;
        const xi = stateSlice[i] ?? 0.0;
        out += bi * xi;
      }
    }

    return {
      outputs: { out },
      derivatives,
    };
  },
};

export const DelayBlock: BlockDefinition = {
  type: "Delay",
  name: "Transport Delay",
  category: "dynamics",
  description: "Delays input signal by a specified time delay: y(t) = u(t - delayTime).",
  inputs: [{ id: "in", name: "In", required: true, description: "Input signal" }],
  outputs: [{ id: "out", name: "Out", required: true, description: "Delayed output signal" }],
  hasDirectFeedthrough: () => false,
  defaultParams: {
    delayTime: 0.1,
    initialOutput: 0.0,
  },
  numStates: () => 1, // Single state representing past value
  stateNames: () => ["storedVal"],
  initialState: (params) => [typeof params.initialOutput === "number" ? params.initialOutput : 0.0],
  execute: ({ inputs, stateSlice, history, params }) => {
    const delayTime = typeof params.delayTime === "number" ? Math.max(1e-4, params.delayTime) : 0.1;
    const initialOutput = typeof params.initialOutput === "number" ? params.initialOutput : 0.0;
    const u = inputs.in ?? 0.0;

    // If history lookup is available, interpolate past value; otherwise use low-pass lag approximation
    let delayedVal: number;
    if (history?.lookupDelay) {
      delayedVal = history.lookupDelay(delayTime, initialOutput);
    } else {
      delayedVal = stateSlice[0] ?? initialOutput;
    }

    // Derivative relaxes state towards input
    const tau = delayTime;
    const dVal = (u - (stateSlice[0] ?? initialOutput)) / tau;

    return {
      outputs: { out: delayedVal },
      derivatives: [dVal],
    };
  },
};
