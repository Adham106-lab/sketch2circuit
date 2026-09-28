/**
 * @license Apache-2.0
 * @s2c/footprints — 2-pos and 3-pos Screw Terminal Footprint Generators (5.08mm pitch).
 */

import type { FootprintDef, FootprintPad } from "@s2c/pcb-json";

export interface ScrewTerminalOptions {
  positions: 2 | 3;
  pitchMm?: number;
  id?: string;
  name?: string;
  drillMm?: number;
  padDiameterMm?: number;
}

export function generateScrewTerminalFootprint(options: ScrewTerminalOptions): FootprintDef {
  const count = options.positions;
  const pitch = options.pitchMm ?? 5.08; // Standard 0.2 inch pitch
  const drill = options.drillMm ?? 1.3;
  const padDia = options.padDiameterMm ?? 2.4;
  const id = options.id ?? `terminal:screw-${count}pos-${pitch}mm`;
  const totalLength = count * pitch + 2.0;
  const depth = 8.0;

  const xStart = -((count - 1) * pitch) / 2;
  const pads: FootprintPad[] = [];

  for (let i = 0; i < count; i++) {
    pads.push({
      number: String(i + 1),
      shape: i === 0 ? "rect" : "circle",
      x: xStart + i * pitch,
      y: 0,
      w: padDia,
      h: padDia,
      drill,
      layers: ["top", "bottom"],
    });
  }

  const halfLen = totalLength / 2;
  const halfDepth = depth / 2;

  return {
    id,
    name: options.name ?? `Screw Terminal ${count}-Position (${pitch}mm Pitch)`,
    source: "convention (Standard 5.08mm / 0.2in Eurostyle screw terminal block)",
    verification: "convention",
    verified: true,
    pads,
    courtyard: [
      { x: -(halfLen + 0.5), y: -(halfDepth + 0.5) },
      { x: halfLen + 0.5, y: -(halfDepth + 0.5) },
      { x: halfLen + 0.5, y: halfDepth + 0.5 },
      { x: -(halfLen + 0.5), y: halfDepth + 0.5 },
    ],
    silk: [
      {
        kind: "rect",
        x: -halfLen,
        y: -halfDepth,
        w: totalLength,
        h: depth,
        strokeWidth: 0.2,
        layer: "top",
      },
    ],
    body3d: {
      kind: "box",
      w: totalLength,
      d: depth,
      h: 10.0,
      color: "#166534", // Industrial green terminal block
    },
  };
}
