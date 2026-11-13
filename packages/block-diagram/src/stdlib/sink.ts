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

/**
 * Hardware-in-the-Loop PWM Output Actuator Block (maps to D3, D5, D6, D9, D10, D11).
 */
export const PwmOutputBlock: BlockDefinition = {
  type: "PWMOutput",
  name: "PWM Output (Actuator)",
  category: "sink",
  description: "Hardware timer-driven PWM output pin driving actuator, motor, or dimmed LED.",
  inputs: [{ id: "in", name: "In", required: true, description: "Control input signal" }],
  outputs: [{ id: "out", name: "Mon", required: false, description: "Duty monitor" }],
  hasDirectFeedthrough: () => true,
  defaultParams: {
    pin: "D9",
    title: "PWM Drive (D9)",
  },
  numStates: () => 0,
  execute: ({ inputs }) => {
    const val = inputs.in ?? 0.0;
    return { outputs: { out: val } };
  },
};

/**
 * Hardware-in-the-Loop Digital Output Block (maps to D13 or any digital GPIO).
 */
export const DigitalOutputBlock: BlockDefinition = {
  type: "DigitalOutput",
  name: "Digital Output (GPIO)",
  category: "sink",
  description: "Hardware digital output pin driving digital actuator or LED indicator.",
  inputs: [{ id: "in", name: "In", required: true, description: "Binary control signal" }],
  outputs: [{ id: "out", name: "Mon", required: false, description: "State monitor" }],
  hasDirectFeedthrough: () => true,
  defaultParams: {
    pin: "D13",
    title: "Digital Output (D13)",
  },
  numStates: () => 0,
  execute: ({ inputs }) => {
    const val = (inputs.in ?? 0.0) >= 0.5 ? 1.0 : 0.0;
    return { outputs: { out: val } };
  },
};

