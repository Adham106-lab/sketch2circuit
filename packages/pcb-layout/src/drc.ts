/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Design Rule Check (DRC) Engine for 2-Layer PCBs.
 */

import type { DrcViolation, FootprintDef, PcbLayout, Point } from "@s2c/pcb-json";
import {
  distance,
  pointInPolygon,
  pointToPolygonDistance,
  pointToSegmentDistance,
  segmentToSegmentDistance,
  transformPoint,
} from "./geometry.js";
import { ARDUINO_UNO_R3_KEEPOUTS } from "./keepouts.js";
import type { KeepoutArea } from "./types.js";

export interface DrcOptions {
  keepouts?: KeepoutArea[];
  ignoreUnrouted?: boolean;
}

export interface PlacedPadInfo {
  componentId: string;
  padNumber: string;
  netId?: string;
  center: Point;
  shape: "circle" | "rect" | "oval";
  width: number;
  height: number;
  layers: ("top" | "bottom")[];
  drill?: number;
}

/**
 * Extracts all placed pads with their absolute board positions and net associations.
 */
export function extractPlacedPads(layout: PcbLayout): PlacedPadInfo[] {
  const fpMap = new Map<string, FootprintDef>();
  for (const fp of layout.footprints) {
    fpMap.set(fp.id, fp);
  }

  // Pre-build terminal -> net mapping from traces/vias or layout connections
  const padToNetMap = new Map<string, string>();
  for (const t of layout.traces) {
    for (const p of t.points) {
      padToNetMap.set(`${p.x.toFixed(3)},${p.y.toFixed(3)}`, t.netId);
    }
  }

  const pads: PlacedPadInfo[] = [];

  for (const pl of layout.placements) {
    const fp = fpMap.get(pl.footprintId);
    if (!fp) continue;

    for (const padDef of fp.pads) {
      const absCenter = transformPoint({ x: padDef.x, y: padDef.y }, pl.x, pl.y, pl.rotation);
      const key = `${absCenter.x.toFixed(3)},${absCenter.y.toFixed(3)}`;
      const netId = padToNetMap.get(key);

      pads.push({
        componentId: pl.componentId,
        padNumber: padDef.number,
        netId,
        center: absCenter,
        shape: padDef.shape,
        width: padDef.w,
        height: padDef.h,
        layers: padDef.layers,
        drill: padDef.drill,
      });
    }
  }

  return pads;
}

/**
 * Runs complete Design Rule Check (DRC) against a PcbLayout.
 * Checks trace widths, clearances, keepouts, board edge margins, vias, and unrouted nets.
 */
export function checkDrc(layout: PcbLayout, options: DrcOptions = {}): DrcViolation[] {
  const violations: DrcViolation[] = [];
  const rules = layout.rules;
  const keepouts = options.keepouts ?? ARDUINO_UNO_R3_KEEPOUTS;
  const outline = layout.board.outline;
  const tolerance = 1e-4;

  const pads = extractPlacedPads(layout);

  // 1. Trace Width Check
  for (const trace of layout.traces) {
    if (trace.width < rules.minTraceWidthMm - tolerance) {
      violations.push({
        code: "DRC_TRACE_WIDTH",
        severity: "error",
        message: `Trace width ${trace.width.toFixed(3)}mm on net '${trace.netId}' is below minimum ${rules.minTraceWidthMm.toFixed(3)}mm`,
        location: trace.points[0],
        netId: trace.netId,
      });
    }
  }

  // 2. Trace-to-Trace Clearance Check (same layer, different nets)
  for (let i = 0; i < layout.traces.length; i++) {
    const t1 = layout.traces[i]!;
    for (let j = i + 1; j < layout.traces.length; j++) {
      const t2 = layout.traces[j]!;
      if (t1.layer !== t2.layer) continue;
      if (t1.netId === t2.netId) continue;

      let minClearanceFound = Number.POSITIVE_INFINITY;
      let conflictPoint: Point | undefined;

      for (let s1 = 0; s1 < t1.points.length - 1; s1++) {
        const a1 = t1.points[s1]!;
        const a2 = t1.points[s1 + 1]!;
        for (let s2 = 0; s2 < t2.points.length - 1; s2++) {
          const b1 = t2.points[s2]!;
          const b2 = t2.points[s2 + 1]!;

          const segDist = segmentToSegmentDistance(a1, a2, b1, b2);
          const clearance = segDist - (t1.width + t2.width) / 2;

          if (clearance < minClearanceFound) {
            minClearanceFound = clearance;
            conflictPoint = a1;
          }
        }
      }

      if (minClearanceFound < rules.minClearanceMm - tolerance) {
        violations.push({
          code: "DRC_CLEARANCE_TRACE_TRACE",
          severity: "error",
          message: `Clearance violation (${Math.max(0, minClearanceFound).toFixed(3)}mm < ${rules.minClearanceMm.toFixed(3)}mm) between net '${t1.netId}' and net '${t2.netId}' on ${t1.layer} layer`,
          location: conflictPoint,
          netId: t1.netId,
        });
      }
    }
  }

  // 3. Trace-to-Pad Clearance Check (different nets, matching layer)
  for (const trace of layout.traces) {
    for (const pad of pads) {
      if (pad.netId && pad.netId === trace.netId) continue;
      if (!pad.layers.includes(trace.layer)) continue;

      const padRadius = Math.max(pad.width, pad.height) / 2;

      for (let s = 0; s < trace.points.length - 1; s++) {
        const p1 = trace.points[s]!;
        const p2 = trace.points[s + 1]!;

        // If the trace endpoint terminates directly at this pad, it's a valid connection
        if (
          (distance(p1, pad.center) < 0.1 && pad.netId === trace.netId) ||
          (distance(p2, pad.center) < 0.1 && pad.netId === trace.netId)
        ) {
          continue;
        }

        const dist = pointToSegmentDistance(pad.center, p1, p2);
        const clearance = dist - (trace.width / 2 + padRadius);

        if (clearance < rules.minClearanceMm - tolerance) {
          violations.push({
            code: "DRC_CLEARANCE_TRACE_PAD",
            severity: "error",
            message: `Clearance violation (${Math.max(0, clearance).toFixed(3)}mm < ${rules.minClearanceMm.toFixed(3)}mm) between trace '${trace.netId}' and pad ${pad.componentId}.${pad.padNumber}`,
            location: pad.center,
            netId: trace.netId,
            componentId: pad.componentId,
          });
          break;
        }
      }
    }
  }

  // 4. Via Clearance Checks
  for (let i = 0; i < layout.vias.length; i++) {
    const v1 = layout.vias[i]!;

    // Via drill check
    if (v1.drill < rules.minDrillDiameterMm - tolerance) {
      violations.push({
        code: "DRC_VIA_DRILL",
        severity: "error",
        message: `Via drill diameter ${v1.drill.toFixed(3)}mm is below minimum ${rules.minDrillDiameterMm.toFixed(3)}mm on net '${v1.netId}'`,
        location: { x: v1.x, y: v1.y },
        netId: v1.netId,
      });
    }

    // Via annular ring check
    const annularRing = (v1.diameter - v1.drill) / 2;
    if (annularRing < rules.minAnnularRingMm - tolerance) {
      violations.push({
        code: "DRC_VIA_ANNULAR_RING",
        severity: "error",
        message: `Via annular ring ${annularRing.toFixed(3)}mm is below minimum ${rules.minAnnularRingMm.toFixed(3)}mm on net '${v1.netId}'`,
        location: { x: v1.x, y: v1.y },
        netId: v1.netId,
      });
    }

    // Via-to-Via clearance
    for (let j = i + 1; j < layout.vias.length; j++) {
      const v2 = layout.vias[j]!;
      if (v1.netId === v2.netId) continue;
      const centerDist = Math.hypot(v1.x - v2.x, v1.y - v2.y);
      const clearance = centerDist - (v1.diameter + v2.diameter) / 2;
      if (clearance < rules.minClearanceMm - tolerance) {
        violations.push({
          code: "DRC_CLEARANCE_VIA_VIA",
          severity: "error",
          message: `Via-to-via clearance violation (${Math.max(0, clearance).toFixed(3)}mm < ${rules.minClearanceMm.toFixed(3)}mm) between '${v1.netId}' and '${v2.netId}'`,
          location: { x: v1.x, y: v1.y },
          netId: v1.netId,
        });
      }
    }

    // Via-to-Trace clearance
    for (const trace of layout.traces) {
      if (trace.netId === v1.netId) continue;
      for (let s = 0; s < trace.points.length - 1; s++) {
        const p1 = trace.points[s]!;
        const p2 = trace.points[s + 1]!;
        const dist = pointToSegmentDistance({ x: v1.x, y: v1.y }, p1, p2);
        const clearance = dist - (v1.diameter / 2 + trace.width / 2);
        if (clearance < rules.minClearanceMm - tolerance) {
          violations.push({
            code: "DRC_CLEARANCE_VIA_TRACE",
            severity: "error",
            message: `Via-to-trace clearance violation (${Math.max(0, clearance).toFixed(3)}mm < ${rules.minClearanceMm.toFixed(3)}mm) between via '${v1.netId}' and trace '${trace.netId}' on ${trace.layer}`,
            location: { x: v1.x, y: v1.y },
            netId: v1.netId,
          });
          break;
        }
      }
    }
  }

  // 5. Board Edge Clearance Check
  for (const trace of layout.traces) {
    for (const pt of trace.points) {
      if (!pointInPolygon(pt, outline)) {
        violations.push({
          code: "DRC_BOARD_EDGE",
          severity: "error",
          message: `Trace point (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}) on net '${trace.netId}' is outside board outline`,
          location: pt,
          netId: trace.netId,
        });
        continue;
      }

      const edgeDist = pointToPolygonDistance(pt, outline);
      const clearance = edgeDist - trace.width / 2;
      if (clearance < rules.boardEdgeClearanceMm - tolerance) {
        violations.push({
          code: "DRC_BOARD_EDGE",
          severity: "error",
          message: `Trace clearance to board edge (${clearance.toFixed(3)}mm) is below required ${rules.boardEdgeClearanceMm.toFixed(3)}mm on net '${trace.netId}'`,
          location: pt,
          netId: trace.netId,
        });
      }
    }
  }

  for (const via of layout.vias) {
    const pt = { x: via.x, y: via.y };
    if (!pointInPolygon(pt, outline)) {
      violations.push({
        code: "DRC_BOARD_EDGE",
        severity: "error",
        message: `Via at (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)}) on net '${via.netId}' is outside board outline`,
        location: pt,
        netId: via.netId,
      });
      continue;
    }

    const edgeDist = pointToPolygonDistance(pt, outline);
    const clearance = edgeDist - via.diameter / 2;
    if (clearance < rules.boardEdgeClearanceMm - tolerance) {
      violations.push({
        code: "DRC_BOARD_EDGE",
        severity: "error",
        message: `Via clearance to board edge (${clearance.toFixed(3)}mm) is below required ${rules.boardEdgeClearanceMm.toFixed(3)}mm on net '${via.netId}'`,
        location: pt,
        netId: via.netId,
      });
    }
  }

  // 6. Keepout Zone Violations
  for (const ko of keepouts) {
    // Check traces
    for (const trace of layout.traces) {
      for (let s = 0; s < trace.points.length - 1; s++) {
        const p1 = trace.points[s]!;
        const p2 = trace.points[s + 1]!;
        if (pointInPolygon(p1, ko.polygon) || pointInPolygon(p2, ko.polygon)) {
          violations.push({
            code: "DRC_KEEPOUT_HIT",
            severity: "error",
            message: `Trace on net '${trace.netId}' enters keepout area '${ko.name}'`,
            location: p1,
            netId: trace.netId,
          });
          break;
        }
      }
    }

    // Check vias
    for (const via of layout.vias) {
      if (pointInPolygon({ x: via.x, y: via.y }, ko.polygon)) {
        violations.push({
          code: "DRC_KEEPOUT_HIT",
          severity: "error",
          message: `Via on net '${via.netId}' located inside keepout area '${ko.name}'`,
          location: { x: via.x, y: via.y },
          netId: via.netId,
        });
      }
    }
  }

  // 7. Unrouted Net Warning
  if (!options.ignoreUnrouted && layout.unrouted && layout.unrouted.length > 0) {
    for (const un of layout.unrouted) {
      violations.push({
        code: "DRC_UNROUTED_CONNECTION",
        severity: "warning",
        message: `Unrouted connection on net '${un.netId}' between ${un.from} and ${un.to}`,
        netId: un.netId,
      });
    }
  }

  // Sort violations deterministically
  violations.sort((a, b) => {
    const c = a.code.localeCompare(b.code);
    if (c !== 0) return c;
    const n = (a.netId ?? "").localeCompare(b.netId ?? "");
    if (n !== 0) return n;
    return a.message.localeCompare(b.message);
  });

  return violations;
}
