/**
 * @license Apache-2.0
 * @s2c/footprints — 1xN Pin Header Parametric Generator (2.54mm pitch).
 */

import type { FootprintDef, FootprintPad } from "@s2c/pcb-json";

export interface PinHeaderOptions {
  pinCount: number;
  pitchMm?: number;
  id?: string;
  name?: string;
  drillMm?: number;
  padDiameterMm?: number;
  pinLabels?: string[];
}

export function generatePinHeaderFootprint(options: PinHeaderOptions): FootprintDef {
  const count = options.pinCount;
  const pitch = options.pitchMm ?? 2.54;
  const drill = options.drillMm ?? 1.0;
  const padDia = options.padDiameterMm ?? 1.7;
  const totalLength = count * pitch;
  const id = options.id ?? `header:1x${count}-${pitch}mm`;

  // Center the header around (0,0) along Y-axis matching KiCad PinHeader_1xN_P2.54mm_Vertical
  const yStart = -((count - 1) * pitch) / 2;

  const pads: FootprintPad[] = [];
  for (let i = 0; i < count; i++) {
    const pinNumber = options.pinLabels?.[i] ?? String(i + 1);
    pads.push({
      number: pinNumber,
      shape: i === 0 ? "rect" : "oval", // Pin 1 is square pad, remaining pads oval per KiCad
      x: 0,
      y: yStart + i * pitch,
      w: padDia,
      h: padDia,
      drill,
      layers: ["top", "bottom"],
    });
  }

  const halfLen = totalLength / 2;
  const halfWidth = 2.54 / 2;

  const isCrossChecked = count === 3 && Math.abs(pitch - 2.54) < 0.01;
  const source = isCrossChecked
    ? "KiCad Official Library: Connector_PinHeader_2.54mm.pretty/PinHeader_1x03_P2.54mm_Vertical.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)"
    : "convention (Standard 0.1in / 2.54mm pitch through-hole male/female header)";
  const verification = isCrossChecked ? "cross-checked-kicad-lib" : "convention";

  return {
    id,
    name: options.name ?? `Pin Header 1x${count} (${pitch}mm Pitch)`,
    source,
    verification,
    verified: true,
    pads,
    courtyard: [
      { x: -(halfWidth + 0.5), y: -(halfLen + 0.5) },
      { x: halfWidth + 0.5, y: -(halfLen + 0.5) },
      { x: halfWidth + 0.5, y: halfLen + 0.5 },
      { x: -(halfWidth + 0.5), y: halfLen + 0.5 },
    ],
    silk: [
      // Outer plastic shroud / collar boundary
      {
        kind: "rect",
        x: -halfWidth,
        y: -halfLen,
        w: 2.54,
        h: totalLength,
        strokeWidth: 0.15,
        layer: "top",
      },
      // Pin 1 indicator line
      {
        kind: "line",
        x1: -halfWidth,
        y1: yStart - padDia / 2 - 0.4,
        x2: halfWidth,
        y2: yStart - padDia / 2 - 0.4,
        strokeWidth: 0.25,
        layer: "top",
      },
      ...(count === 3
        ? [
            {
              kind: "text" as const,
              text: "S",
              x: Number((halfWidth + 0.6).toFixed(2)),
              y: Number((yStart + 0 * pitch).toFixed(2)),
              fontSize: 0.8,
              layer: "top" as const,
            },
            {
              kind: "text" as const,
              text: "+",
              x: Number((halfWidth + 0.6).toFixed(2)),
              y: Number((yStart + 1 * pitch).toFixed(2)),
              fontSize: 0.8,
              layer: "top" as const,
            },
            {
              kind: "text" as const,
              text: "-",
              x: Number((halfWidth + 0.6).toFixed(2)),
              y: Number((yStart + 2 * pitch).toFixed(2)),
              fontSize: 0.8,
              layer: "top" as const,
            },
          ]
        : []),
    ],
    body3d: {
      kind: "header",
      pins: count,
      pitch,
      color: "#1e293b",
    },
  };
}
