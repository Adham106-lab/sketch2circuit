/**
 * @license Apache-2.0
 * @s2c/pcb-json — TypeScript type definitions for PCB layout data model (v0.1.0).
 */

export interface Point {
  x: number;
  y: number;
}

export type FootprintVerification =
  | "datasheet-checked"
  | "cross-checked-kicad-lib"
  | "convention"
  | "unverified";

export type PadShape = "circle" | "rect" | "oval";

export type PcbLayer = "top" | "bottom";

export interface FootprintPad {
  number: string;
  shape: PadShape;
  x: number;
  y: number;
  w: number;
  h: number;
  drill?: number;
  layers: PcbLayer[];
}

export type SilkItem =
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      strokeWidth?: number;
      layer?: PcbLayer;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      strokeWidth?: number;
      layer?: PcbLayer;
    }
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      strokeWidth?: number;
      layer?: PcbLayer;
    }
  | {
      kind: "arc";
      cx: number;
      cy: number;
      r: number;
      startAngle: number;
      endAngle: number;
      strokeWidth?: number;
      layer?: PcbLayer;
    }
  | {
      kind: "text";
      text: string;
      x: number;
      y: number;
      fontSize: number;
      rotation?: number;
      layer?: PcbLayer;
    };

export type Body3D =
  | {
      kind: "box";
      w: number;
      d: number;
      h: number;
      z?: number;
      color?: string;
    }
  | {
      kind: "cylinder";
      r: number;
      h: number;
      z?: number;
      color?: string;
    }
  | {
      kind: "led5mm";
      color?: string;
    }
  | {
      kind: "header";
      pins: number;
      pitch: number;
      color?: string;
    }
  | {
      kind: "composite";
      parts: Body3D[];
    };

export interface FootprintDef {
  id: string;
  name?: string;
  source: string;
  verification: FootprintVerification;
  verified: boolean;
  pads: FootprintPad[];
  courtyard: Point[];
  silk: SilkItem[];
  body3d: Body3D;
}

export interface Placement {
  componentId: string;
  footprintId: string;
  x: number;
  y: number;
  rotation: number; // In degrees: 0, 90, 180, 270
  side: PcbLayer;
}

export interface Trace {
  id?: string;
  netId: string;
  layer: PcbLayer;
  width: number; // In mm
  points: Point[];
}

export interface Via {
  id?: string;
  netId: string;
  x: number;
  y: number;
  drill: number; // In mm
  diameter: number; // In mm (annular ring + drill)
}

export interface DesignRules {
  minTraceWidthMm: number;
  minClearanceMm: number;
  minDrillDiameterMm: number;
  minAnnularRingMm: number;
  boardEdgeClearanceMm: number;
  source: string;
}

export interface DrcViolation {
  code: string;
  severity: "error" | "warning";
  message: string;
  location?: Point;
  netId?: string;
  componentId?: string;
}

export interface UnroutedConnection {
  netId: string;
  from: string; // RefDes.port, e.g. "R1.1"
  to: string; // RefDes.port, e.g. "D1.A"
}

export interface PcbBoard {
  outline: Point[];
  thicknessMm: number;
  layers: 2;
}

export interface PcbLayout {
  schemaVersion: "0.1.0";
  circuitHash: string; // Hash of the Circuit IR it was built from
  board: PcbBoard;
  rules: DesignRules; // Default rules with source attribution
  footprints: FootprintDef[]; // Resolved definitions used by this layout
  placements: Placement[]; // Placed components
  traces: Trace[]; // Routed copper tracks
  vias: Via[]; // Through-hole layer transitions
  silkscreen: SilkItem[]; // Reference designators, outlines, pin 1 markers
  unplaced: string[]; // Component IDs that could not be placed
  unrouted: UnroutedConnection[]; // Unrouted net connections (ratsnest)
  drc: DrcViolation[]; // Design rule check violations
}
