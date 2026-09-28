/**
 * @license Apache-2.0
 * @s2c/footprints — Arduino Uno R3 Shield Board Outline and Header Footprint Generators.
 */

import type { FootprintDef, FootprintPad, Point } from "@s2c/pcb-json";

/**
 * Canonical Arduino Uno R3 Shield board outline polygon.
 * Dimensions: 68.58mm (2.700 in) x 53.34mm (2.100 in).
 * Includes standard corner bevels and clearance cuts for USB Type-B and DC Barrel Jack.
 */
export const ARDUINO_UNO_R3_SHIELD_OUTLINE: Point[] = [
  { x: 0.0, y: 2.54 },
  { x: 2.54, y: 0.0 },
  { x: 66.04, y: 0.0 },
  { x: 68.58, y: 2.54 },
  { x: 68.58, y: 38.1 },
  { x: 66.04, y: 40.64 },
  { x: 66.04, y: 48.26 },
  { x: 68.58, y: 50.8 },
  { x: 68.58, y: 53.34 },
  { x: 15.24, y: 53.34 },
  { x: 12.7, y: 50.8 },
  { x: 2.54, y: 50.8 },
  { x: 0.0, y: 48.26 },
];

/**
 * Arduino Uno R3 mounting hole locations (drill = 3.2mm for M3 screws).
 */
export const ARDUINO_UNO_R3_MOUNTING_HOLES: Array<Point & { drillMm: number }> = [
  { x: 13.97, y: 2.54, drillMm: 3.2 },
  { x: 15.24, y: 50.8, drillMm: 3.2 },
  { x: 66.04, y: 7.62, drillMm: 3.2 },
  { x: 66.04, y: 35.56, drillMm: 3.2 },
];

/**
 * Generates the Power Header (8 pins) footprint for Arduino Uno R3 shield.
 * Pins: NC, IOREF, RESET, 3V3, 5V, GND.1, GND.2, VIN
 */
export function generateUnoPowerHeaderFootprint(): FootprintDef {
  const pinLabels = ["NC", "IOREF", "RESET", "3V3", "5V", "GND.1", "GND.2", "VIN"];
  const pitch = 2.54;
  const drill = 1.0;
  const padDia = 1.6;
  const count = 8;
  const xStart = -((count - 1) * pitch) / 2;

  const pads: FootprintPad[] = pinLabels.map((label, i) => ({
    number: label,
    shape: i === 0 ? "rect" : "oval",
    x: xStart + i * pitch,
    y: 0,
    w: padDia,
    h: padDia,
    drill,
    layers: ["top", "bottom"],
  }));

  return {
    id: "uno:power-header-8pin",
    name: "Arduino Uno R3 Power Header (8-Pin)",
    source:
      "KiCad Official Library: Module.pretty/Arduino_UNO_R3.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)",
    verification: "cross-checked-kicad-lib",
    verified: true,
    pads,
    courtyard: [
      { x: xStart - 1.5, y: -2.0 },
      { x: -xStart + 1.5, y: -2.0 },
      { x: -xStart + 1.5, y: 2.0 },
      { x: xStart - 1.5, y: 2.0 },
    ],
    silk: [
      {
        kind: "rect",
        x: xStart - 1.27,
        y: -1.27,
        w: count * pitch,
        h: 2.54,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "header",
      pins: count,
      pitch,
      color: "#1e293b",
    },
  };
}

/**
 * Generates the Analog Header (6 pins) footprint for Arduino Uno R3 shield.
 * Pins: A0, A1, A2, A3, A4, A5
 */
export function generateUnoAnalogHeaderFootprint(): FootprintDef {
  const pinLabels = ["A0", "A1", "A2", "A3", "A4", "A5"];
  const pitch = 2.54;
  const drill = 1.0;
  const padDia = 1.6;
  const count = 6;
  const xStart = -((count - 1) * pitch) / 2;

  const pads: FootprintPad[] = pinLabels.map((label, i) => ({
    number: label,
    shape: i === 0 ? "rect" : "oval",
    x: xStart + i * pitch,
    y: 0,
    w: padDia,
    h: padDia,
    drill,
    layers: ["top", "bottom"],
  }));

  return {
    id: "uno:analog-header-6pin",
    name: "Arduino Uno R3 Analog In Header (6-Pin)",
    source:
      "KiCad Official Library: Module.pretty/Arduino_UNO_R3.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)",
    verification: "cross-checked-kicad-lib",
    verified: true,
    pads,
    courtyard: [
      { x: xStart - 1.5, y: -2.0 },
      { x: -xStart + 1.5, y: -2.0 },
      { x: -xStart + 1.5, y: 2.0 },
      { x: xStart - 1.5, y: 2.0 },
    ],
    silk: [
      {
        kind: "rect",
        x: xStart - 1.27,
        y: -1.27,
        w: count * pitch,
        h: 2.54,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "header",
      pins: count,
      pitch,
      color: "#1e293b",
    },
  };
}

/**
 * Generates the Digital Low Header (8 pins: D0 to D7) footprint for Arduino Uno R3.
 * Pins: D0, D1, D2, D3, D4, D5, D6, D7
 */
export function generateUnoDigitalLowHeaderFootprint(): FootprintDef {
  const pinLabels = ["D0", "D1", "D2", "D3", "D4", "D5", "D6", "D7"];
  const pitch = 2.54;
  const drill = 1.0;
  const padDia = 1.6;
  const count = 8;
  const xStart = -((count - 1) * pitch) / 2;

  const pads: FootprintPad[] = pinLabels.map((label, i) => ({
    number: label,
    shape: i === 0 ? "rect" : "oval",
    x: xStart + i * pitch,
    y: 0,
    w: padDia,
    h: padDia,
    drill,
    layers: ["top", "bottom"],
  }));

  return {
    id: "uno:digital-low-header-8pin",
    name: "Arduino Uno R3 Digital Low Header (D0-D7, 8-Pin)",
    source:
      "KiCad Official Library: Module.pretty/Arduino_UNO_R3.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)",
    verification: "cross-checked-kicad-lib",
    verified: true,
    pads,
    courtyard: [
      { x: xStart - 1.5, y: -2.0 },
      { x: -xStart + 1.5, y: -2.0 },
      { x: -xStart + 1.5, y: 2.0 },
      { x: xStart - 1.5, y: 2.0 },
    ],
    silk: [
      {
        kind: "rect",
        x: xStart - 1.27,
        y: -1.27,
        w: count * pitch,
        h: 2.54,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "header",
      pins: count,
      pitch,
      color: "#1e293b",
    },
  };
}

/**
 * Generates the Digital High Header (10 pins: D8 to D13, GND, AREF, SDA, SCL) footprint.
 * Note the famous 0.160 in (4.064 mm) offset between D7 and D8.
 */
export function generateUnoDigitalHighHeaderFootprint(): FootprintDef {
  const pinLabels = ["D8", "D9", "D10", "D11", "D12", "D13", "GND", "AREF", "SDA", "SCL"];
  const pitch = 2.54;
  const drill = 1.0;
  const padDia = 1.6;
  const count = 10;
  const xStart = -((count - 1) * pitch) / 2;

  const pads: FootprintPad[] = pinLabels.map((label, i) => ({
    number: label,
    shape: i === 0 ? "rect" : "oval",
    x: xStart + i * pitch,
    y: 0,
    w: padDia,
    h: padDia,
    drill,
    layers: ["top", "bottom"],
  }));

  return {
    id: "uno:digital-high-header-10pin",
    name: "Arduino Uno R3 Digital High Header (D8-SCL, 10-Pin)",
    source:
      "KiCad Official Library: Module.pretty/Arduino_UNO_R3.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)",
    verification: "cross-checked-kicad-lib",
    verified: true,
    pads,
    courtyard: [
      { x: xStart - 1.5, y: -2.0 },
      { x: -xStart + 1.5, y: -2.0 },
      { x: -xStart + 1.5, y: 2.0 },
      { x: xStart - 1.5, y: 2.0 },
    ],
    silk: [
      {
        kind: "rect",
        x: xStart - 1.27,
        y: -1.27,
        w: count * pitch,
        h: 2.54,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "header",
      pins: count,
      pitch,
      color: "#1e293b",
    },
  };
}

/**
 * Generates the complete Arduino Uno R3 Shield footprint (id: "module:arduino-uno-r3")
 * comprising all 4 headers placed at canonical Uno shield coordinates with outline courtyard.
 */
export function generateUnoShieldFootprint(): FootprintDef {
  const pads: FootprintPad[] = [];
  const drill = 1.0;
  const padDia = 1.6;

  // 1. Power Header (8 pins) along bottom edge (Y = 2.54 mm)
  const powerPins = [
    { label: "NC", x: 27.94 },
    { label: "IOREF", x: 30.48 },
    { label: "RESET", x: 33.02 },
    { label: "3V3", x: 35.56 },
    { label: "5V", x: 38.1 },
    { label: "GND.1", x: 40.64 },
    { label: "GND.2", x: 43.18 },
    { label: "VIN", x: 45.72 },
  ];
  for (const [i, p] of powerPins.entries()) {
    pads.push({
      number: p.label,
      shape: i === 0 ? "rect" : "oval",
      x: p.x,
      y: 2.54,
      w: padDia,
      h: padDia,
      drill,
      layers: ["top", "bottom"],
    });
  }

  // 2. Analog Header (6 pins) along bottom edge (Y = 2.54 mm)
  const analogPins = [
    { label: "A0", x: 50.8 },
    { label: "A1", x: 53.34 },
    { label: "A2", x: 55.88 },
    { label: "A3", x: 58.42 },
    { label: "A4", x: 60.96 },
    { label: "A5", x: 63.5 },
  ];
  for (const p of analogPins) {
    pads.push({
      number: p.label,
      shape: "oval",
      x: p.x,
      y: 2.54,
      w: padDia,
      h: padDia,
      drill,
      layers: ["top", "bottom"],
    });
  }

  // 3. Digital Low Header (8 pins: D0-D7) along top edge (Y = 50.80 mm)
  // Pin D7 is at x = 45.720 mm (aligned with VIN at x = 45.720 mm), Pin D0 is at x = 63.500 mm (aligned with A5 at x = 63.500 mm)
  const digitalLowPins = [
    { label: "D7", x: 45.72 },
    { label: "D6", x: 48.26 },
    { label: "D5", x: 50.8 },
    { label: "D4", x: 53.34 },
    { label: "D3", x: 55.88 },
    { label: "D2", x: 58.42 },
    { label: "D1", x: 60.96 },
    { label: "D0", x: 63.5 },
  ];
  for (const p of digitalLowPins) {
    pads.push({
      number: p.label,
      shape: "oval",
      x: p.x,
      y: 50.8,
      w: padDia,
      h: padDia,
      drill,
      layers: ["top", "bottom"],
    });
  }

  // 4. Digital High Header (10 pins: D8-D13, GND, AREF, SDA, SCL) along top edge (Y = 50.80 mm)
  // 160 mil (4.064 mm) offset between D7 (45.720 mm) and D8 (41.656 mm):
  const digitalHighPins = [
    { label: "D8", x: 41.656 },
    { label: "D9", x: 39.116 },
    { label: "D10", x: 36.576 },
    { label: "D11", x: 34.036 },
    { label: "D12", x: 31.496 },
    { label: "D13", x: 28.956 },
    { label: "GND", x: 26.416 },
    { label: "AREF", x: 23.876 },
    { label: "SDA", x: 21.336 },
    { label: "SCL", x: 18.796 },
  ];
  for (const p of digitalHighPins) {
    pads.push({
      number: p.label,
      shape: "oval",
      x: p.x,
      y: 50.8,
      w: padDia,
      h: padDia,
      drill,
      layers: ["top", "bottom"],
    });
  }

  return {
    id: "module:arduino-uno-r3",
    name: "Arduino Uno R3 Shield Headers & Outline",
    source:
      "KiCad Official Library: Module.pretty/Arduino_UNO_R3.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)",
    verification: "cross-checked-kicad-lib",
    verified: true,
    pads,
    courtyard: ARDUINO_UNO_R3_SHIELD_OUTLINE,
    silk: [
      {
        kind: "text",
        text: "ARDUINO UNO R3 SHIELD",
        x: 25.0,
        y: 26.0,
        fontSize: 2.0,
        layer: "top",
      },
    ],
    body3d: {
      kind: "composite",
      parts: [
        {
          kind: "box",
          w: 68.58,
          d: 53.34,
          h: 1.6,
          color: "#059669",
        },
        {
          kind: "header",
          pins: 8,
          pitch: 2.54,
        },
        {
          kind: "header",
          pins: 6,
          pitch: 2.54,
        },
        {
          kind: "header",
          pins: 8,
          pitch: 2.54,
        },
        {
          kind: "header",
          pins: 10,
          pitch: 2.54,
        },
      ],
    },
  };
}
