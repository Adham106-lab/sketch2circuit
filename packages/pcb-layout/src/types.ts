/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Types and options for PCB placement and ratsnest generation.
 */

import type { Circuit } from "@s2c/circuit-json";
import type { PcbLayout, Point } from "@s2c/pcb-json";

export interface KeepoutArea {
  id: string;
  name: string;
  polygon: Point[];
  verification?: "unverified" | "cross-checked-kicad-lib" | "convention";
  source?: string;
  boundsMm?:
    | { minX: number; maxX: number; minY: number; maxY: number }
    | { cx: number; cy: number; radius: number };
}

export interface PlacementOptions {
  gridMm?: number; // Default 2.54mm (0.1 in)
  edgeClearanceMm?: number; // Default 2.0mm
  courtyardClearanceMm?: number; // Default 0.5mm
  seed?: number; // Deterministic PRNG seed if stochastic tie-breaking used
  keepouts?: KeepoutArea[];
}

export interface RatsnestEdge {
  netId: string;
  fromPad: string; // "R1.1"
  toPad: string; // "LED1.A"
  fromPoint: Point;
  toPoint: Point;
  lengthMm: number;
}

export interface RatsnestMetrics {
  totalWirelengthMm: number;
  edgeCount: number;
  edges: RatsnestEdge[];
}

export interface PlacementResult {
  layout: PcbLayout;
  placedCount: number;
  unplacedCount: number;
  totalComponents: number;
  metrics: RatsnestMetrics;
}
