/**
 * @license Apache-2.0
 * @s2c/footprints — 5mm Through-Hole LED Footprint Generator.
 */

import type { FootprintDef } from "@s2c/pcb-json";

export interface Led5mmOptions {
  id?: string;
  name?: string;
  pitchMm?: number;
  rimDiameterMm?: number;
  color?: string;
  leadDrillMm?: number;
  padDiameterMm?: number;
}

export function generateLed5mmFootprint(options?: Led5mmOptions): FootprintDef {
  const pitch = options?.pitchMm ?? 2.54; // Standard 0.1 in pitch
  const rimDia = options?.rimDiameterMm ?? 5.8;
  const drill = options?.leadDrillMm ?? 0.9;
  const padDia = options?.padDiameterMm ?? 1.8;
  const halfPitch = pitch / 2;
  const radius = rimDia / 2;
  const id = options?.id ?? "led:5mm-th";

  return {
    id,
    name: options?.name ?? "5mm Through-Hole LED (T-1 3/4)",
    source:
      "KiCad Official Library: LED_THT.pretty/LED_D5.0mm.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)",
    verification: "cross-checked-kicad-lib",
    verified: true,
    pads: [
      {
        number: "1", // Cathode (-) matching KiCad pad 1 rect
        shape: "rect",
        x: -halfPitch,
        y: 0,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "2", // Anode (+) matching KiCad pad 2 circle
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
      // Circular rim outline
      {
        kind: "circle",
        cx: 0,
        cy: 0,
        r: radius,
        strokeWidth: 0.15,
        layer: "top",
      },
      // Cathode flat chord mark on left side (negative X, adjacent to Cathode Pad 1)
      {
        kind: "line",
        x1: -(radius - 0.5),
        y1: -radius * 0.7,
        x2: -(radius - 0.5),
        y2: radius * 0.7,
        strokeWidth: 0.25,
        layer: "top",
      },
    ],
    body3d: {
      kind: "led5mm",
      color: options?.color ?? "#ef4444",
    },
  };
}
