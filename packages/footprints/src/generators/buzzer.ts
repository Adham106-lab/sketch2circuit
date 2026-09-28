/**
 * @license Apache-2.0
 * @s2c/footprints — 12mm Piezo Buzzer Footprint Generator.
 */

import type { FootprintDef } from "@s2c/pcb-json";

export interface BuzzerOptions {
  id?: string;
  name?: string;
  diameterMm?: number;
  pitchMm?: number;
  leadDrillMm?: number;
  padDiameterMm?: number;
}

export function generateBuzzerFootprint(options?: BuzzerOptions): FootprintDef {
  const dia = options?.diameterMm ?? 12.0;
  const pitch = options?.pitchMm ?? 7.62; // Standard 0.3in lead spacing
  const drill = options?.leadDrillMm ?? 0.9;
  const padDia = options?.padDiameterMm ?? 1.8;
  const halfPitch = pitch / 2;
  const radius = dia / 2;
  const id = options?.id ?? "buzzer:12mm";

  return {
    id,
    name: options?.name ?? "Passive Piezo Buzzer 12mm",
    source: "generic catalog reference (unverified against specific buzzer drawing)",
    verification: "unverified",
    verified: false,
    pads: [
      {
        number: "+",
        shape: "rect", // Square pad for positive terminal
        x: -halfPitch,
        y: 0,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "-",
        shape: "circle",
        x: halfPitch,
        y: 0,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
    ],
    courtyard: [
      { x: -(radius + 0.5), y: -(radius + 0.5) },
      { x: radius + 0.5, y: -(radius + 0.5) },
      { x: radius + 0.5, y: radius + 0.5 },
      { x: -(radius + 0.5), y: radius + 0.5 },
    ],
    silk: [
      // Outer circular body
      {
        kind: "circle",
        cx: 0,
        cy: 0,
        r: radius,
        strokeWidth: 0.15,
        layer: "top",
      },
      // Positive (+) mark near pin 1
      {
        kind: "line",
        x1: -halfPitch - padDia / 2 - 0.7,
        y1: 0,
        x2: -halfPitch - padDia / 2 - 0.2,
        y2: 0,
        strokeWidth: 0.2,
        layer: "top",
      },
      {
        kind: "line",
        x1: -halfPitch - padDia / 2 - 0.45,
        y1: -0.25,
        x2: -halfPitch - padDia / 2 - 0.45,
        y2: 0.25,
        strokeWidth: 0.2,
        layer: "top",
      },
    ],
    body3d: {
      kind: "cylinder",
      r: radius,
      h: 9.5,
      color: "#0f172a", // Black plastic cylinder
    },
  };
}
