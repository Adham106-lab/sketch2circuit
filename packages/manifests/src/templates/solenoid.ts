/**
 * @license Apache-2.0
 * @s2c/manifests — Peripheral Sub-Circuit Template for Solenoid / Relay Inductive Actuators.
 */

import type { ComponentTemplateManifest } from "../types.js";

export const SOLENOID_TEMPLATE: ComponentTemplateManifest = {
  id: "Solenoid",
  name: "12V/5V Electromagnetic Solenoid / Relay Coil Actuator",
  category: "actuator",
  operatingVoltage: [5.0, 24.0],
  peakCurrentMa: 600.0, // High inductive surge current
  isHighCurrentActuator: true,
  requiresDriverStage: true,
  primaryKind: "relay",
  primaryPartNumber: "JF-0530B-Solenoid",
  primaryFootprint: "TerminalBlock:TerminalBlock_bornier-2_P5.08mm",
  primaryPorts: [
    { name: "COIL_POS", kind: "passive", required: true, role: "power" },
    { name: "COIL_NEG", kind: "passive", required: true, role: "switched_ground" },
  ],
  supportingPassives: [
    {
      refSuffix: "D_FLYBACK",
      name: "Flyback Diode (Back-EMF Snubber)",
      kind: "diode",
      value: "1N4007",
      footprint: "Diode_DO-41",
      role: "flyback",
      ports: [
        { name: "A", kind: "passive" },
        { name: "K", kind: "passive" },
      ],
      connections: [
        { passivePort: "A", target: "PRIMARY.COIL_NEG" }, // Anode to low side (drain)
        { passivePort: "K", target: "PRIMARY.COIL_POS" }, // Cathode to high side (VCC)
      ],
    },
    {
      refSuffix: "Q_DRV",
      name: "N-Channel Logic-Level Power MOSFET",
      kind: "transistor",
      value: "IRLZ44N",
      footprint: "Package_TO_SOT_THT:TO-220-3_Vertical",
      role: "gate_damping",
      ports: [
        { name: "G", kind: "input" },
        { name: "D", kind: "passive" },
        { name: "S", kind: "ground" },
      ],
      connections: [
        { passivePort: "D", target: "PRIMARY.COIL_NEG" },
        { passivePort: "S", target: "RAIL_GND" },
      ],
    },
    {
      refSuffix: "R_GATE",
      name: "MOSFET Gate Damping Resistor",
      kind: "resistor",
      value: "220Ω",
      footprint: "0805",
      role: "gate_damping",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
      connections: [
        { passivePort: "1", target: "EXTERNAL_NET.GPIO_PIN" },
        { passivePort: "2", target: "SUPPORTING.Q_DRV.G" },
      ],
    },
    {
      refSuffix: "R_PULLDOWN",
      name: "MOSFET Gate Pull-Down Resistor",
      kind: "resistor",
      value: "10kΩ",
      footprint: "0805",
      role: "pull_down",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
      connections: [
        { passivePort: "1", target: "SUPPORTING.Q_DRV.G" },
        { passivePort: "2", target: "RAIL_GND" },
      ],
    },
  ],
  driverStageRecommendation: {
    type: "NFET",
    part: "IRLZ44N",
    gateResistor: "220Ω",
    pullDownResistor: "10kΩ",
    flybackDiode: "1N4007",
  },
};
