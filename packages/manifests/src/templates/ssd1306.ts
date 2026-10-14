/**
 * @license Apache-2.0
 * @s2c/manifests — Peripheral Sub-Circuit Template for SSD1306 0.96" OLED Display.
 */

import type { ComponentTemplateManifest } from "../types.js";

export const SSD1306_TEMPLATE: ComponentTemplateManifest = {
  id: "SSD1306",
  name: "SSD1306 128x64 I2C/SPI Monochrome OLED Display",
  category: "display",
  operatingVoltage: [3.3, 5.0],
  peakCurrentMa: 25.0, // all pixels on
  primaryKind: "module",
  primaryPartNumber: "SSD1306-0.96-OLED",
  primaryFootprint: "Module:OLED-0.96-I2C",
  primaryPorts: [
    { name: "VCC", kind: "power", required: true, role: "power" },
    { name: "GND", kind: "ground", required: true, role: "ground" },
    { name: "SCL", kind: "input", required: true, role: "i2c_scl" },
    { name: "SDA", kind: "bidirectional", required: true, role: "i2c_sda" },
  ],
  supportingPassives: [
    {
      refSuffix: "C_DEC",
      name: "OLED Local Decoupling Capacitor",
      kind: "capacitor",
      value: "100nF",
      footprint: "0805",
      role: "decoupling",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
      connections: [
        { passivePort: "1", target: "PRIMARY.VCC" },
        { passivePort: "2", target: "PRIMARY.GND" },
      ],
    },
  ],
};
