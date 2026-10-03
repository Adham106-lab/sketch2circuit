/**
 * @license Apache-2.0
 * @s2c/block-diagram — Standard Library Composite Blocks (PID Controller).
 */

import type { BlockDefinition } from "../blocks.js";

export const PidControllerBlock: BlockDefinition = {
  type: "PID",
  name: "PID Controller",
  category: "dynamics",
  description:
    "Continuous Proportional-Integral-Derivative controller with 1st-order filtered derivative: u_pid = Kp*e + Ki*∫e + Kd*s/(1 + s/N)*e.",
  inputs: [{ id: "in", name: "e", required: true, description: "Error input signal e(t)" }],
  outputs: [{ id: "out", name: "u", required: true, description: "Control effort output u(t)" }],
  hasDirectFeedthrough: () => true,
  defaultParams: {
    Kp: 1.0,
    Ki: 0.0,
    Kd: 0.0,
    N: 100.0, // Derivative filter coefficient
    initialCondition: 0.0,
  },
  numStates: () => 2, // [x_integrator, x_derivative_filter]
  stateNames: () => ["x_integrator", "x_derivative_filter"],
  initialState: (params) => [
    typeof params.initialCondition === "number" ? params.initialCondition : 0.0,
    0.0,
  ],
  execute: ({ inputs, stateSlice, params }) => {
    const Kp = typeof params.Kp === "number" ? params.Kp : 1.0;
    const Ki = typeof params.Ki === "number" ? params.Ki : 0.0;
    const Kd = typeof params.Kd === "number" ? params.Kd : 0.0;
    const N = typeof params.N === "number" ? Math.max(1.0, params.N) : 100.0;

    const e = inputs.in ?? 0.0;
    const xI = stateSlice[0] ?? 0.0;
    const xD = stateSlice[1] ?? 0.0;

    // Integral derivative: dx_I/dt = e
    const dxI = e;

    // Filtered derivative state: dx_D/dt = N * (e - x_D)
    const dxD = N * (e - xD);

    // Filtered derivative output: y_D = Kd * N * (e - x_D)
    const yD = Kd * dxD;

    // Integral output: y_I = Ki * x_I
    const yI = Ki * xI;

    // Proportional output: y_P = Kp * e
    const yP = Kp * e;

    const out = yP + yI + yD;

    return {
      outputs: { out },
      derivatives: [dxI, dxD],
    };
  },
};
