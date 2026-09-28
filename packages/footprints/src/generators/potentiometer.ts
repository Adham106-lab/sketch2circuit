/**
 * @license Apache-2.0
 * @s2c/footprints — 3-Terminal Rotary Potentiometer Footprint Generator.
 */

import type { FootprintDef } from "@s2c/pcb-json";

export interface PotentiometerOptions {
  id?: string;
  name?: string;
  pinPitchMm?: number;
  bodyDiameterMm?: number;
  leadDrillMm?: number;
  padDiameterMm?: number;
}

export function generatePotentiometerFootprint(options?: PotentiometerOptions): FootprintDef {
  const pitch = options?.pinPitchMm ?? 5.0; // Standard 5mm pin spacing for WH148 rotary pots
  const bodyDia = options?.bodyDiameterMm ?? 16.0;
  const drill = options?.leadDrillMm ?? 1.2;
  const padDia = options?.padDiameterMm ?? 2.2;
  const id = options?.id ?? "pot:3-pin-rotary";

  return {
    id,
    name: options?.name ?? "Rotary Potentiometer 3-Terminal (WH148)",
    source: "generic catalog reference (unverified against manufacturer mechanical drawing)",
    verification: "unverified",
    verified: false,
    pads: [
      {
        number: "1",
        shape: "circle",
        x: -pitch,
        y: 0,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "2",
        shape: "rect", // Center wiper pin
        x: 0,
        y: 0,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "3",
        shape: "circle",
        x: pitch,
        y: 0,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
    ],
    courtyard: [
      { x: -(bodyDia / 2 + 1.0), y: -2.0 },
      { x: bodyDia / 2 + 1.0, y: -2.0 },
      { x: bodyDia / 2 + 1.0, y: bodyDia + 1.0 },
      { x: -(bodyDia / 2 + 1.0), y: bodyDia + 1.0 },
    ],
    silk: [
      // Circular body behind the mounting pins
      {
        kind: "circle",
        cx: 0,
        cy: bodyDia / 2,
        r: bodyDia / 2,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "composite",
      parts: [
        {
          kind: "cylinder",
          r: bodyDia / 2,
          h: 8.0,
          color: "#94a3b8",
        },
        {
          kind: "cylinder",
          r: 3.0,
          h: 15.0,
          z: 8.0,
          color: "#cbd5e1", // Metal shaft
        },
      ],
    },
  };
}
