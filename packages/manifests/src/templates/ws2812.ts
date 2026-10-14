/**
 * @license Apache-2.0
 * @s2c/manifests — Peripheral Sub-Circuit Template for WS2812 / NeoPixel Addressable LEDs.
 */

import type { ComponentTemplateManifest } from "../types.js";

export const WS2812_TEMPLATE: ComponentTemplateManifest = {
  id: "WS2812",
  name: "WS2812B Addressable RGB LED Strip",
  category: "led",
  operatingVoltage: [3.5, 5.3],
  peakCurrentMa: 60.0, // per pixel (20mA x 3 colors at 100% white)
  isHighCurrentActuator: true,
  primaryKind: "module",
  primaryPartNumber: "WS2812B-Strip",
  primaryFootprint: "Module:WS2812B-Strip",
  primaryPorts: [
    { name: "5V", kind: "power", required: true, role: "power" },
    { name: "GND", kind: "ground", required: true, role: "ground" },
    { name: "DIN", kind: "input", required: true, role: "data_in" },
    { name: "DOUT", kind: "output", required: false, role: "data_out" },
  ],
  supportingPassives: [
    {
      refSuffix: "R_DATA",
      name: "WS2812 Data Line Dampening Resistor",
      kind: "resistor",
      value: "330Ω",
      footprint: "0805",
      role: "current_limiting",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
      connections: [
        { passivePort: "1", target: "PRIMARY.DIN" },
        { passivePort: "2", target: "EXTERNAL_NET.DATA_PIN" },
      ],
    },
    {
      refSuffix: "C_BULK",
      name: "Power Rail Bulk Electrolytic Capacitor",
      kind: "capacitor",
      value: "100µF",
      footprint: "Capacitor_THT:CP_Radial_D6.3mm_P2.50mm",
      role: "decoupling",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
      connections: [
        { passivePort: "1", target: "PRIMARY.5V" },
        { passivePort: "2", target: "PRIMARY.GND" },
      ],
    },
  ],
};
