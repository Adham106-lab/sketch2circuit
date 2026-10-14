/**
 * @license Apache-2.0
 * @s2c/manifests — Peripheral Sub-Circuit Template for Active Piezo/Magnetic Buzzer.
 */

import type { ComponentTemplateManifest } from "../types.js";

export const ACTIVE_BUZZER_TEMPLATE: ComponentTemplateManifest = {
  id: "ActiveBuzzer",
  name: "Active 5V Buzzer (Tone/Piezo Sounder)",
  category: "actuator",
  operatingVoltage: [3.3, 12.0],
  peakCurrentMa: 35.0, // exceeds typical 20mA/12mA MCU GPIO continuous limit
  isHighCurrentActuator: true,
  requiresDriverStage: true,
  primaryKind: "buzzer",
  primaryPartNumber: "Active-Buzzer-12mm",
  primaryFootprint: "Buzzer_Beeper:Buzzer_12x9.5RM7.6",
  primaryPorts: [
    { name: "POS", kind: "passive", required: true, role: "positive_terminal" },
    { name: "NEG", kind: "passive", required: true, role: "negative_terminal" },
  ],
  supportingPassives: [
    {
      refSuffix: "R_BASE",
      name: "BJT Base Current Limiting Resistor",
      kind: "resistor",
      value: "1kΩ",
      footprint: "0805",
      role: "current_limiting",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
      connections: [
        { passivePort: "1", target: "EXTERNAL_NET.GPIO_PIN" },
        { passivePort: "2", target: "PRIMARY.NEG" },
      ],
    },
    {
      refSuffix: "D_FLYBACK",
      name: "Buzzer Coil Transient Suppression Diode",
      kind: "diode",
      value: "1N4148",
      footprint: "Diode_SMD:D_SOD-123",
      role: "flyback",
      ports: [
        { name: "A", kind: "passive" },
        { name: "K", kind: "passive" },
      ],
      connections: [
        { passivePort: "A", target: "PRIMARY.NEG" },
        { passivePort: "K", target: "PRIMARY.POS" },
      ],
    },
  ],
  driverStageRecommendation: {
    type: "NPN",
    part: "2N2222",
    baseResistor: "1kΩ",
    flybackDiode: "1N4148",
  },
};
