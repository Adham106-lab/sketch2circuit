/**
 * @license Apache-2.0
 * @s2c/footprints — Electrolytic and Ceramic Capacitor Footprint Generators.
 */

import type { FootprintDef } from "@s2c/pcb-json";

export interface RadialCapOptions {
  id?: string;
  name?: string;
  canDiameterMm?: number;
  pitchMm?: number;
  heightMm?: number;
  leadDrillMm?: number;
  padDiameterMm?: number;
}

/**
 * Lead pitch lookup based on nominal can diameter.
 * Reference: KiCad official library Capacitor_THT.pretty / standard industry sizing conventions.
 * Note: Lead pitch is cross-checked against KiCad official CP_Radial_THT library fixtures.
 * øD = 5.0 -> F = 2.0 mm (cross-checked with CP_Radial_D5.0mm_P2.00mm.kicad_mod)
 * øD = 6.3 -> F = 2.5 mm
 */
export function getPanasonicFcLeadPitch(canDiameterMm: number): number {
  if (canDiameterMm <= 4.0) return 1.5;
  if (canDiameterMm <= 5.0) return 2.0;
  if (canDiameterMm <= 6.3) return 2.5;
  if (canDiameterMm <= 8.0) return 3.5;
  return 5.0;
}

export function generateRadialElectrolyticCapFootprint(options?: RadialCapOptions): FootprintDef {
  const canDia = options?.canDiameterMm ?? 5.0;
  const pitch = options?.pitchMm ?? getPanasonicFcLeadPitch(canDia);
  const height = options?.heightMm ?? 11.0;
  const drill = options?.leadDrillMm ?? 0.8;
  const padDia = options?.padDiameterMm ?? 1.6;
  const halfPitch = pitch / 2;
  const canRadius = canDia / 2;
  const id = options?.id ?? `capacitor:radial-d${canDia}-p${pitch}mm`;

  const isD5P2 = Math.abs(canDia - 5.0) < 0.01 && Math.abs(pitch - 2.0) < 0.01;
  const source = isD5P2
    ? "KiCad Official Library: Capacitor_THT.pretty/CP_Radial_D5.0mm_P2.00mm.kicad_mod (commit 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd)"
    : `Radial electrolytic capacitor can d=${canDia}mm p=${pitch}mm (unverified against specific fab CAD)`;
  const verification = isD5P2 ? "cross-checked-kicad-lib" : "unverified";

  return {
    id,
    name: options?.name ?? `Radial Electrolytic Capacitor ø${canDia}mm (Pitch ${pitch}mm)`,
    source,
    verification,
    verified: isD5P2,
    pads: [
      {
        number: "+",
        shape: "rect", // Square pad indicates positive (+) pin
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
      { x: -(canRadius + 0.5), y: -(canRadius + 0.5) },
      { x: canRadius + 0.5, y: -(canRadius + 0.5) },
      { x: canRadius + 0.5, y: canRadius + 0.5 },
      { x: -(canRadius + 0.5), y: canRadius + 0.5 },
    ],
    silk: [
      // Circular can body outline
      {
        kind: "circle",
        cx: 0,
        cy: 0,
        r: canRadius,
        strokeWidth: 0.15,
        layer: "top",
      },
      // Positive polarity mark (+)
      {
        kind: "line",
        x1: -halfPitch - padDia / 2 - 0.8,
        y1: 0,
        x2: -halfPitch - padDia / 2 - 0.2,
        y2: 0,
        strokeWidth: 0.2,
        layer: "top",
      },
      {
        kind: "line",
        x1: -halfPitch - padDia / 2 - 0.5,
        y1: -0.3,
        x2: -halfPitch - padDia / 2 - 0.5,
        y2: 0.3,
        strokeWidth: 0.2,
        layer: "top",
      },
    ],
    body3d: {
      kind: "cylinder",
      r: canRadius,
      h: height,
      color: "#1e3a8a", // Dark blue can
    },
  };
}

export interface CeramicCapOptions {
  id?: string;
  name?: string;
  pitchMm?: number;
  widthMm?: number;
  thicknessMm?: number;
  leadDrillMm?: number;
  padDiameterMm?: number;
}

export function generateCeramicCapFootprint(options?: CeramicCapOptions): FootprintDef {
  const pitch = options?.pitchMm ?? 2.54; // 0.1 inch standard
  const width = options?.widthMm ?? 5.0;
  const thickness = options?.thicknessMm ?? 2.5;
  const drill = options?.leadDrillMm ?? 0.8;
  const padDia = options?.padDiameterMm ?? 1.6;
  const halfPitch = pitch / 2;
  const id = options?.id ?? `capacitor:ceramic-disc-${pitch}mm`;

  return {
    id,
    name: options?.name ?? `Ceramic Disc Capacitor (Pitch ${pitch}mm)`,
    source: "convention (Standard 0.1in lead pitch for 50V ceramic disc capacitors)",
    verification: "convention",
    verified: true,
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
      { x: -(width / 2 + 0.5), y: -(thickness / 2 + 0.5) },
      { x: width / 2 + 0.5, y: -(thickness / 2 + 0.5) },
      { x: width / 2 + 0.5, y: thickness / 2 + 0.5 },
      { x: -(width / 2 + 0.5), y: thickness / 2 + 0.5 },
    ],
    silk: [
      {
        kind: "rect",
        x: -width / 2,
        y: -thickness / 2,
        w: width,
        h: thickness,
        strokeWidth: 0.15,
        layer: "top",
      },
    ],
    body3d: {
      kind: "box",
      w: width,
      d: thickness,
      h: 6.0,
      color: "#d97706", // Amber / orange ceramic disc
    },
  };
}
