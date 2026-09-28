/**
 * @license Apache-2.0
 * @s2c/footprints — TO-92 Transistor Footprint Generator.
 */

import type { FootprintDef } from "@s2c/pcb-json";

export interface To92Options {
  id?: string;
  name?: string;
  pinPitchMm?: number; // 1.27mm straight or 2.54mm inline formed
  leadDrillMm?: number;
  padDiameterMm?: number;
}

export function generateTo92Footprint(options?: To92Options): FootprintDef {
  const pitch = options?.pinPitchMm ?? 1.27; // Standard ON Semi TO-92 straight lead pitch
  const drill = options?.leadDrillMm ?? 0.75;
  const padW = 1.05;
  const padH = options?.padDiameterMm ?? 1.5;
  const id = options?.id ?? `transistor:to-92-p${pitch}mm`;

  const isStd1_27 = Math.abs(pitch - 1.27) < 0.01;
  const source = isStd1_27
    ? "KiCad Official Library: Package_TO_SOT_THT.pretty/TO-92_Inline.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)"
    : "TO-92 transistor inline (unverified geometry)";
  const verification = isStd1_27 ? "cross-checked-kicad-lib" : "unverified";

  return {
    id,
    name: options?.name ?? `TO-92 Transistor (Pitch ${pitch}mm)`,
    source,
    verification,
    verified: isStd1_27,
    pads: [
      {
        number: "1", // Pin 1 (KiCad pad 1 rect)
        shape: "rect",
        x: -pitch,
        y: 0,
        w: padW,
        h: padH,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "2", // Pin 2 (KiCad pad 2 oval)
        shape: "oval",
        x: 0,
        y: 0,
        w: padW,
        h: padH,
        drill,
        layers: ["top", "bottom"],
      },
      {
        number: "3", // Pin 3 (KiCad pad 3 oval)
        shape: "oval",
        x: pitch,
        y: 0,
        w: padW,
        h: padH,
        drill,
        layers: ["top", "bottom"],
      },
    ],
    courtyard: [
      { x: -3.0, y: -2.5 },
      { x: 3.0, y: -2.5 },
      { x: 3.0, y: 2.5 },
      { x: -3.0, y: 2.5 },
    ],
    silk: [
      // Flat face on front (y = -1.2)
      {
        kind: "line",
        x1: -2.3,
        y1: -1.2,
        x2: 2.3,
        y2: -1.2,
        strokeWidth: 0.15,
        layer: "top",
      },
      // Curved rear arc
      {
        kind: "arc",
        cx: 0,
        cy: -0.2,
        r: 2.3,
        startAngle: 0,
        endAngle: 180,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "cylinder",
      r: 2.3,
      h: 4.8,
      color: "#1e293b", // Black epoxy body
    },
  };
}
