/**
 * @license Apache-2.0
 * @s2c/footprints — 5mm Photoresistor (LDR GL5528) Footprint Generator.
 */

import type { FootprintDef } from "@s2c/pcb-json";

export interface LdrOptions {
  id?: string;
  name?: string;
  pitchMm?: number;
  headDiameterMm?: number;
  leadDrillMm?: number;
  padDiameterMm?: number;
}

export function generateLdrFootprint(options?: LdrOptions): FootprintDef {
  const pitch = options?.pitchMm ?? 3.4; // Typical GL5528 lead pitch (approx 3.4 - 3.5mm)
  const headDia = options?.headDiameterMm ?? 5.0;
  const drill = options?.leadDrillMm ?? 0.8;
  const padDia = options?.padDiameterMm ?? 1.6;
  const halfPitch = pitch / 2;
  const id = options?.id ?? "sensor:ldr-5mm";

  return {
    id,
    name: options?.name ?? "Photoresistor LDR 5mm (GL5528)",
    source: "generic catalog reference (unverified against specific fabricator drawing)",
    verification: "unverified",
    verified: false,
    pads: [
      {
        number: "1",
        shape: "circle",
        x: -halfPitch,
        y: 0,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "2",
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
      { x: -(headDia / 2 + 0.5), y: -(headDia / 2 + 0.5) },
      { x: headDia / 2 + 0.5, y: -(headDia / 2 + 0.5) },
      { x: headDia / 2 + 0.5, y: headDia / 2 + 0.5 },
      { x: -(headDia / 2 + 0.5), y: headDia / 2 + 0.5 },
    ],
    silk: [
      // Circular head outline
      {
        kind: "circle",
        cx: 0,
        cy: 0,
        r: headDia / 2,
        strokeWidth: 0.15,
        layer: "top",
      },
      // Silkscreen zigzag / wavy sensor face
      {
        kind: "line",
        x1: -1.2,
        y1: -0.8,
        x2: -0.4,
        y2: 0.8,
        strokeWidth: 0.15,
        layer: "top",
      },
      {
        kind: "line",
        x1: -0.4,
        y1: 0.8,
        x2: 0.4,
        y2: -0.8,
        strokeWidth: 0.15,
        layer: "top",
      },
      {
        kind: "line",
        x1: 0.4,
        y1: -0.8,
        x2: 1.2,
        y2: 0.8,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "cylinder",
      r: headDia / 2,
      h: 2.0,
      color: "#b45309",
    },
  };
}
