/**
 * @license Apache-2.0
 * @s2c/manifests — Peripheral Sub-Circuit Template for DS3231 Precision RTC.
 */

import type { ComponentTemplateManifest } from "../types.js";

export const DS3231_TEMPLATE: ComponentTemplateManifest = {
  id: "DS3231",
  name: "DS3231 Extremely Accurate I2C Real-Time Clock",
  category: "rtc",
  operatingVoltage: [2.3, 5.5],
  peakCurrentMa: 0.3,
  primaryKind: "sensor",
  primaryPartNumber: "DS3231SN",
  primaryFootprint: "SOIC-16",
  primaryPorts: [
    { name: "VCC", kind: "power", required: true, role: "power" },
    { name: "GND", kind: "ground", required: true, role: "ground" },
    { name: "SDA", kind: "bidirectional", required: true, role: "i2c_sda" },
    { name: "SCL", kind: "input", required: true, role: "i2c_scl" },
    { name: "SQW", kind: "output", required: false, role: "square_wave_interrupt" },
    { name: "32K", kind: "output", required: false, role: "clock_out" },
  ],
  supportingPassives: [
    {
      refSuffix: "C_DEC",
      name: "DS3231 Decoupling Capacitor",
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
    {
      refSuffix: "R_PU_SDA",
      name: "I2C SDA Pull-up Resistor",
      kind: "resistor",
      value: "4.7kΩ",
      footprint: "0805",
      role: "pull_up",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
      connections: [
        { passivePort: "1", target: "PRIMARY.SDA" },
        { passivePort: "2", target: "PRIMARY.VCC" },
      ],
    },
    {
      refSuffix: "R_PU_SCL",
      name: "I2C SCL Pull-up Resistor",
      kind: "resistor",
      value: "4.7kΩ",
      footprint: "0805",
      role: "pull_up",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
      connections: [
        { passivePort: "1", target: "PRIMARY.SCL" },
        { passivePort: "2", target: "PRIMARY.VCC" },
      ],
    },
  ],
};
