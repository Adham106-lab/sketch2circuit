/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Standard keepout zones for Arduino Uno R3 Shield.
 */

import type { Point } from "@s2c/pcb-json";
import type { KeepoutArea } from "./types.js";

/**
 * Creates a rectangular keepout polygon from min/max coordinates.
 */
export function createBoxKeepout(
  id: string,
  name: string,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  source?: string,
): KeepoutArea {
  return {
    id,
    name,
    verification: "unverified",
    source:
      source ??
      "Estimated physical clearance bounding box (unverified against manufacturer 3D STEP model)",
    boundsMm: { minX, maxX, minY, maxY },
    polygon: [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: maxX, y: maxY },
      { x: minX, y: maxY },
    ],
  };
}

/**
 * Creates an octagonal circular keepout polygon around a center point.
 */
export function createCircularKeepout(
  id: string,
  name: string,
  cx: number,
  cy: number,
  radius: number,
  source?: string,
): KeepoutArea {
  const points: Point[] = [];
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    points.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return {
    id,
    name,
    verification: "unverified",
    source:
      source ??
      "Estimated screw head and washer land clearance (unverified against DIN 912 / ISO 7045 standard)",
    boundsMm: { cx, cy, radius },
    polygon: points,
  };
}

/**
 * Standard keepout areas on an Arduino Uno R3 board:
 * 1. USB Type-B receptacle: metal shell clearance [0.0, 18.0] x [31.0, 47.0] mm (Width 18.0mm, Height 16.0mm) — unverified
 * 2. DC 2.1mm power barrel jack: metal shell clearance [0.0, 16.0] x [3.0, 17.0] mm (Width 16.0mm, Height 14.0mm) — unverified
 * 3. 4 x M3 mounting hole keepouts (3.2mm hole + 3.5mm annular screw head clearance radius) — unverified
 */
export const ARDUINO_UNO_R3_KEEPOUTS: KeepoutArea[] = [
  createBoxKeepout(
    "keepout:usb-jack",
    "USB Type-B Receptacle Metal Shell Keepout",
    0.0,
    18.0,
    31.0,
    47.0,
    "USB Type-B metal shell envelope [0..18, 31..47]mm (unverified in sandbox)",
  ),
  createBoxKeepout(
    "keepout:dc-barrel-jack",
    "DC Barrel Power Jack Metal Shell Keepout",
    0.0,
    16.0,
    3.0,
    17.0,
    "DC Barrel Jack body envelope [0..16, 3..17]mm (unverified in sandbox)",
  ),
  createCircularKeepout(
    "keepout:mount-hole-1",
    "Mounting Hole 1 Clearance",
    13.97,
    2.54,
    3.5,
    "M3 screw-head clearance r=3.5mm around hole (13.97, 2.54) (unverified in sandbox)",
  ),
  createCircularKeepout(
    "keepout:mount-hole-2",
    "Mounting Hole 2 Clearance",
    15.24,
    50.8,
    3.5,
    "M3 screw-head clearance r=3.5mm around hole (15.24, 50.80) (unverified in sandbox)",
  ),
  createCircularKeepout(
    "keepout:mount-hole-3",
    "Mounting Hole 3 Clearance",
    66.04,
    7.62,
    3.5,
    "M3 screw-head clearance r=3.5mm around hole (66.04, 7.62) (unverified in sandbox)",
  ),
  createCircularKeepout(
    "keepout:mount-hole-4",
    "Mounting Hole 4 Clearance",
    66.04,
    35.56,
    3.5,
    "M3 screw-head clearance r=3.5mm around hole (66.04, 35.56) (unverified in sandbox)",
  ),
];
