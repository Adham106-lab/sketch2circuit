/**
 * @license Apache-2.0
 * @s2c/footprints — DO-41 Rectifier Diode (1N4007) Footprint Generator.
 */

import type { FootprintDef } from "@s2c/pcb-json";

export interface Do41Options {
  id?: string;
  name?: string;
  pitchMm?: number; // 10.16mm (0.4in) standard horizontal bend
  bodyLengthMm?: number;
  bodyDiameterMm?: number;
  leadDrillMm?: number;
  padDiameterMm?: number;
}

export function generateDo41Footprint(options?: Do41Options): FootprintDef {
  const pitch = options?.pitchMm ?? 10.16; // Standard 0.4 inch horizontal axial bend
  const bodyLen = options?.bodyLengthMm ?? 5.2; // ON Semi Case 59-10 max body length
  const bodyDia = options?.bodyDiameterMm ?? 2.7; // ON Semi Case 59-10 max body diameter
  const drill = options?.leadDrillMm ?? 1.1;
  const padDia = options?.padDiameterMm ?? 2.2;
  const halfPitch = pitch / 2;
  const id = options?.id ?? `diode:do-41-${pitch}mm`;

  const isStd10_16 = Math.abs(pitch - 10.16) < 0.01;
  const source = isStd10_16
    ? "KiCad Official Library: Diode_THT.pretty/D_DO-41_SOD81_P10.16mm_Horizontal.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)"
    : "DO-41 diode horizontal mounting (unverified geometry)";
  const verification = isStd10_16 ? "cross-checked-kicad-lib" : "unverified";

  return {
    id,
    name: options?.name ?? `DO-41 Diode 1N4007 (Pitch ${pitch}mm)`,
    source,
    verification,
    verified: isStd10_16,
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
        number: "2", // Anode (+) matching KiCad pad 2 oval
        shape: "oval",
        x: halfPitch,
        y: 0,
        w: padDia,
        h: padDia,
        drill,
        layers: ["top", "bottom"],
      },
    ],
    courtyard: [
      { x: -(halfPitch + padDia / 2 + 0.5), y: -(bodyDia / 2 + 0.5) },
      { x: halfPitch + padDia / 2 + 0.5, y: -(bodyDia / 2 + 0.5) },
      { x: halfPitch + padDia / 2 + 0.5, y: bodyDia / 2 + 0.5 },
      { x: -(halfPitch + padDia / 2 + 0.5), y: bodyDia / 2 + 0.5 },
    ],
    silk: [
      // Body rectangular outline
      {
        kind: "rect",
        x: -bodyLen / 2,
        y: -bodyDia / 2,
        w: bodyLen,
        h: bodyDia,
        strokeWidth: 0.15,
        layer: "top",
      },
      // Cathode band marking inside body near cathode pin (negative X)
      {
        kind: "line",
        x1: -(bodyLen / 2 - 1.0),
        y1: -bodyDia / 2,
        x2: -(bodyLen / 2 - 1.0),
        y2: bodyDia / 2,
        strokeWidth: 0.35,
        layer: "top",
      },
      // Axial lead silk lines
      {
        kind: "line",
        x1: -halfPitch + padDia / 2 + 0.2,
        y1: 0,
        x2: -bodyLen / 2,
        y2: 0,
        strokeWidth: 0.15,
        layer: "top",
      },
      {
        kind: "line",
        x1: bodyLen / 2,
        y1: 0,
        x2: halfPitch - padDia / 2 - 0.2,
        y2: 0,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "cylinder",
      r: bodyDia / 2,
      h: bodyLen,
      color: "#0f172a", // Dark charcoal / black body
    },
  };
}
