/**
 * @license Apache-2.0
 * @s2c/circuit2d — Interactive 2D Schematic & Half-Size Breadboard Vector Companion Viewer.
 * Deterministic Manhattan orthogonal router, E24 resistor color coding, net-highlighting,
 * cursor-centered zoom/pan, SVG serializer export, and step-by-step wiring checklist.
 */

import type { Circuit } from "@s2c/circuit-json";
import {
  Box,
  CheckSquare,
  Cpu,
  Download,
  Grid,
  Layers,
  Maximize2,
  Minus,
  Moon,
  Plus,
  Sun,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allocateBreadboard,
  type BreadboardAllocation,
  type BreadboardRow,
  buildCircuitModel,
  type CircuitModel,
  type NormalizedPart,
  netInstruction,
  pinInstruction,
  resistorBands,
  WIRE_COLORS,
} from "./circuit2d/circuitModel.js";
import {
  getSymbolObstacleBounds,
  getSymbolPinAnchors,
  type PinAnchor,
  SchematicSymbol,
} from "./circuit2d/symbols.js";

// ============================================================================
// PUBLIC COMPONENT PROPS
// ============================================================================

export interface Schematic2DViewerProps {
  circuit: Circuit;
  sketchName?: string;
  theme?: "light" | "dark";
  onSwitchTo3D?: () => void;
  onSelectPinOrNet?: (netId: string) => void;
}

// ============================================================================
// DETERMINISTIC SCHEMATIC LAYOUT & MANHATTAN ORTHOGONAL ROUTER
// ============================================================================

interface McuPortSlot {
  pinName: string;
  displayLabel: string;
  group: "power" | "digital" | "analog" | "gnd";
  isPwm: boolean;
  x: number;
  y: number;
  netId: string | null;
  color: string;
}

interface McuGroupHeader {
  group: "power" | "digital" | "analog" | "gnd";
  label: string;
  y: number;
}

interface PlacedSchematicPart {
  part: NormalizedPart;
  colIndex: number; // 0 = first peripheral column, 1 = second series column
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  anchors: PinAnchor[];
  obstacle: { minX: number; minY: number; maxX: number; maxY: number };
}

interface RoutedWirePolyline {
  id: string;
  netId: string;
  color: string;
  points: ReadonlyArray<{ x: number; y: number }>;
  pathD: string;
  fromPinId: string;
  toPinId: string;
}

interface RoutedJunctionDot {
  id: string;
  netId: string;
  color: string;
  x: number;
  y: number;
}

interface SchematicLayout {
  width: number;
  height: number;
  mcuBox: { x: number; y: number; width: number; height: number };
  mcuGroupHeaders: McuGroupHeader[];
  mcuPorts: McuPortSlot[];
  placedParts: PlacedSchematicPart[];
  wires: RoutedWirePolyline[];
  junctions: RoutedJunctionDot[];
}

const PWM_DIGITAL_PINS = new Set(["D3", "D5", "D6", "D9", "D10", "D11"]);

const DIGITAL_PIN_ORDER: ReadonlyArray<string> = [
  "D0",
  "D1",
  "D2",
  "D3",
  "D4",
  "D5",
  "D6",
  "D7",
  "D8",
  "D9",
  "D10",
  "D11",
  "D12",
  "D13",
];

const ANALOG_PIN_ORDER: ReadonlyArray<string> = ["A0", "A1", "A2", "A3", "A4", "A5", "SDA", "SCL"];

const POWER_TOP_PIN_ORDER: ReadonlyArray<string> = ["5V", "3.3V", "VIN"];
const GND_BOTTOM_PIN_ORDER: ReadonlyArray<string> = ["GND"];

/**
 * Checks whether a horizontal segment [x1..x2] at y intersects any symbol obstacle box.
 */
function hitsObstacleHoriz(
  x1: number,
  x2: number,
  y: number,
  obstacles: ReadonlyArray<{ minX: number; minY: number; maxX: number; maxY: number }>,
): boolean {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  for (const ob of obstacles) {
    if (y >= ob.minY && y <= ob.maxY && maxX > ob.minX && minX < ob.maxX) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a vertical segment [y1..y2] at x intersects any symbol obstacle box.
 */
function hitsObstacleVert(
  x: number,
  y1: number,
  y2: number,
  obstacles: ReadonlyArray<{ minX: number; minY: number; maxX: number; maxY: number }>,
): boolean {
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  for (const ob of obstacles) {
    if (x >= ob.minX && x <= ob.maxX && maxY > ob.minY && minY < ob.maxY) {
      return true;
    }
  }
  return false;
}

interface OrthoSegment {
  netId: string;
  color: string;
  orient: "H" | "V";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Builds an SVG path string (`d`) for a routed polyline, inserting small semicircular hop arcs
 * where any horizontal segment crosses a vertical segment belonging to a DIFFERENT net.
 */
function buildWirePathWithHops(
  points: ReadonlyArray<{ x: number; y: number }>,
  netId: string,
  allVertSegments: ReadonlyArray<OrthoSegment>,
): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  let d = `M ${first.x} ${first.y}`;
  const hopRadius = 4.5;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    if (p1.x === p2.x && p1.y === p2.y) continue;

    // Horizontal segment: check for crossings with vertical segments of OTHER nets
    if (Math.abs(p1.y - p2.y) < 0.5 && Math.abs(p2.x - p1.x) > hopRadius * 2.5) {
      const y = p1.y;
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const dir = p2.x > p1.x ? 1 : -1;

      const crossXs: number[] = [];
      for (const vs of allVertSegments) {
        if (vs.netId === netId) continue;
        const vx = vs.x1;
        const vMinY = Math.min(vs.y1, vs.y2);
        const vMaxY = Math.max(vs.y1, vs.y2);
        if (
          vx > minX + hopRadius + 1 &&
          vx < maxX - hopRadius - 1 &&
          y > vMinY + 1 &&
          y < vMaxY - 1
        ) {
          if (!crossXs.some((cx) => Math.abs(cx - vx) < hopRadius * 2.1)) {
            crossXs.push(vx);
          }
        }
      }

      crossXs.sort((a, b) => (dir > 0 ? a - b : b - a));
      for (const cx of crossXs) {
        const startHopX = cx - dir * hopRadius;
        const endHopX = cx + dir * hopRadius;
        const sweepFlag = dir > 0 ? 1 : 0;
        d += ` L ${startHopX} ${y} A ${hopRadius} ${hopRadius} 0 0 ${sweepFlag} ${endHopX} ${y}`;
      }
      d += ` L ${p2.x} ${p2.y}`;
    } else {
      d += ` L ${p2.x} ${p2.y}`;
    }
  }

  return d;
}

/**
 * Computes true solder junction dots for a net ONLY at coordinates where 3 or more
 * orthogonal wire directions (North, South, East, West) of the SAME net truly meet.
 * Never places a dot at 2-segment L-bends or where a vertical wire merely passes a pin row.
 */
function computeTrueNetJunctions(
  netId: string,
  color: string,
  netSegments: ReadonlyArray<OrthoSegment>,
): RoutedJunctionDot[] {
  const horiz = netSegments.filter((s) => s.orient === "H" && Math.abs(s.x2 - s.x1) > 0.5);
  const vert = netSegments.filter((s) => s.orient === "V" && Math.abs(s.y2 - s.y1) > 0.5);

  const candidatePoints = new Map<string, { x: number; y: number }>();
  const addCandidate = (x: number, y: number) => {
    const rx = Math.round(x * 2) / 2;
    const ry = Math.round(y * 2) / 2;
    candidatePoints.set(`${rx},${ry}`, { x: rx, y: ry });
  };

  for (const s of netSegments) {
    addCandidate(s.x1, s.y1);
    addCandidate(s.x2, s.y2);
  }
  for (const h of horiz) {
    const hMinX = Math.min(h.x1, h.x2);
    const hMaxX = Math.max(h.x1, h.x2);
    for (const v of vert) {
      const vMinY = Math.min(v.y1, v.y2);
      const vMaxY = Math.max(v.y1, v.y2);
      if (v.x1 >= hMinX - 0.5 && v.x1 <= hMaxX + 0.5 && h.y1 >= vMinY - 0.5 && h.y1 <= vMaxY + 0.5) {
        addCandidate(v.x1, h.y1);
      }
    }
  }

  const dots: RoutedJunctionDot[] = [];
  let dotIdx = 0;
  for (const pt of candidatePoints.values()) {
    let hasWest = false;
    let hasEast = false;
    let hasNorth = false;
    let hasSouth = false;

    for (const h of horiz) {
      if (Math.abs(h.y1 - pt.y) <= 0.5) {
        const minX = Math.min(h.x1, h.x2);
        const maxX = Math.max(h.x1, h.x2);
        if (pt.x >= minX - 0.5 && pt.x <= maxX + 0.5) {
          if (minX < pt.x - 0.5) hasWest = true;
          if (maxX > pt.x + 0.5) hasEast = true;
        }
      }
    }

    for (const v of vert) {
      if (Math.abs(v.x1 - pt.x) <= 0.5) {
        const minY = Math.min(v.y1, v.y2);
        const maxY = Math.max(v.y1, v.y2);
        if (pt.y >= minY - 0.5 && pt.y <= maxY + 0.5) {
          if (minY < pt.y - 0.5) hasNorth = true;
          if (maxY > pt.y + 0.5) hasSouth = true;
        }
      }
    }

    const degree =
      (hasNorth ? 1 : 0) + (hasSouth ? 1 : 0) + (hasWest ? 1 : 0) + (hasEast ? 1 : 0);
    if (degree >= 3) {
      dots.push({
        id: `junc-${netId}-${dotIdx++}`,
        netId,
        color,
        x: pt.x,
        y: pt.y,
      });
    }
  }

  return dots;
}

/**
 * Builds a 100% deterministic 2D schematic layout and Manhattan orthogonal wire routing
 * for a normalized `CircuitModel`.
 */
function computeSchematicLayout(
  model: CircuitModel,
  showAllPins: boolean,
  theme: "light" | "dark",
): SchematicLayout {
  const mcuX = 52;
  const mcuY = 64;
  const mcuWidth = 232;

  // Map MCU pin names -> netId & wire color
  const mcuPinToNet = new Map<string, { netId: string; color: string }>();
  for (const net of model.nets) {
    for (const mp of net.mcuPins) {
      const key = mp === "3V3" ? "3.3V" : mp;
      if (!mcuPinToNet.has(key)) {
        mcuPinToNet.set(key, { netId: net.id, color: net.color });
      }
    }
  }

  const portEdgeX = mcuX + mcuWidth;
  const mcuPorts: McuPortSlot[] = [];
  const mcuGroupHeaders: McuGroupHeader[] = [];
  let cursorY = mcuY + 56;

  const appendPinGroup = (
    group: "power" | "digital" | "analog" | "gnd",
    headerLabel: string,
    pins: ReadonlyArray<string>,
  ) => {
    const visiblePins = showAllPins
      ? pins.filter((p) => (p === "SDA" || p === "SCL" ? mcuPinToNet.has(p) : true))
      : pins.filter((p) => mcuPinToNet.has(p));

    mcuGroupHeaders.push({
      group,
      label: headerLabel,
      y: cursorY,
    });
    cursorY += 16;

    if (visiblePins.length === 0) {
      // Keep compact space under header when all pins in this group are unused & collapsed
      cursorY += 10;
      return;
    }

    for (const pinName of visiblePins) {
      const netInfo = mcuPinToNet.get(pinName);
      const isPwm = group === "digital" && PWM_DIGITAL_PINS.has(pinName);
      const num = pinName.slice(1);
      const displayLabel =
        isPwm
          ? `~D${num}`
          : pinName === "A4"
            ? "A4 / SDA"
            : pinName === "A5"
              ? "A5 / SCL"
              : pinName;

      const fallbackColor =
        pinName === "5V" || pinName === "VIN"
          ? WIRE_COLORS["5V"]
          : pinName === "3.3V"
            ? WIRE_COLORS["3V3"]
            : pinName === "GND"
              ? theme === "dark"
                ? WIRE_COLORS.GND_DARK
                : WIRE_COLORS.GND
              : "#64748b";

      mcuPorts.push({
        pinName,
        displayLabel,
        group,
        isPwm,
        x: portEdgeX,
        y: cursorY,
        netId: netInfo?.netId ?? null,
        color: netInfo?.color ?? fallbackColor,
      });
      cursorY += 22;
    }

    cursorY += 10;
  };

  // Task A3 Pin Order: Top POWER (5V, 3.3V, VIN), then DIGITAL (D0–D13), then ANALOG (A0–A5), then GND at bottom
  appendPinGroup("power", "POWER", POWER_TOP_PIN_ORDER);
  appendPinGroup("digital", "DIGITAL (PWM ~)", DIGITAL_PIN_ORDER);
  appendPinGroup("analog", "ANALOG", ANALOG_PIN_ORDER);
  appendPinGroup("gnd", "GND", GND_BOTTOM_PIN_ORDER);

  const mcuHeight = Math.max(220, cursorY - mcuY + 12);

  // Separate peripheral parts into Column 0 (primary parts connected to MCU pins)
  // and Column 1 (downstream series loads connected after a Column 0 series passive)
  const col0Parts: NormalizedPart[] = [];
  const col1Parts: NormalizedPart[] = [];

  const interPartSignalNets = new Set<string>();
  for (const net of model.nets) {
    if (net.kind === "signal" && net.mcuPins.length === 0 && net.portIds.length >= 2) {
      interPartSignalNets.add(net.id);
    }
  }

  // First identify series passives (e.g., R1 between MCU pin and LED1)
  const seriesPassives = new Set<string>();
  for (const part of model.parts) {
    const isSeriesFirstHop =
      (part.symbolKind === "resistor" || part.symbolKind === "ldr") &&
      part.netIds.some((nid) => interPartSignalNets.has(nid)) &&
      part.netIds.some((nid) => !interPartSignalNets.has(nid));
    if (isSeriesFirstHop) {
      seriesPassives.add(part.id);
    }
  }

  // Only place parts in Column 1 if they actually share an inter-part series net with a Column 0 passive!
  // All direct MCU-connected parts (like SW1 on D2, sensors, servos) stay in Column 0 so their MCU wires
  // never have to cross or loop around Column 0 symbols.
  for (const part of model.parts) {
    if (seriesPassives.has(part.id)) {
      col0Parts.push(part);
    } else if (part.netIds.some((nid) => interPartSignalNets.has(nid))) {
      col1Parts.push(part);
    } else {
      col0Parts.push(part);
    }
  }

  const mcuPortByPin = new Map<string, McuPortSlot>();
  for (const slot of mcuPorts) {
    mcuPortByPin.set(slot.pinName, slot);
  }

  const getDesiredY = (part: NormalizedPart): number => {
    for (const mp of part.mcuPins) {
      const norm = mp === "3V3" ? "3.3V" : mp;
      const slot = mcuPortByPin.get(norm);
      if (slot && slot.group !== "power" && slot.group !== "gnd") {
        return slot.y;
      }
    }
    for (const mp of part.mcuPins) {
      const norm = mp === "3V3" ? "3.3V" : mp;
      const slot = mcuPortByPin.get(norm);
      if (slot) return slot.y;
    }
    return mcuY + 110;
  };

  col0Parts.sort((a, b) => getDesiredY(a) - getDesiredY(b) || a.id.localeCompare(b.id));
  col1Parts.sort((a, b) => getDesiredY(a) - getDesiredY(b) || a.id.localeCompare(b.id));

  const placedParts: PlacedSchematicPart[] = [];
  // Leave generous channel space between MCU right edge (284) and Column 0 (520) for dedicated per-net vertical channels
  const colX = [520, 780] as const;

  const placeColumn = (colParts: NormalizedPart[], colIdx: 0 | 1) => {
    const x = colX[colIdx];
    let minNextY = mcuY + 56;
    for (const part of colParts) {
      const desiredY = getDesiredY(part);
      const minSpacing =
        part.symbolKind === "hc-sr04" || part.symbolKind === "oled"
          ? 112
          : part.symbolKind === "servo" || part.symbolKind === "potentiometer"
            ? 94
            : 80;

      const y = Math.max(minNextY, desiredY);
      minNextY = y + minSpacing;

      const anchors = getSymbolPinAnchors(part.symbolKind, part.id, x, y, 0, part.pins);
      const obstacle = getSymbolObstacleBounds(part.symbolKind, x, y);
      placedParts.push({
        part,
        colIndex: colIdx,
        x,
        y,
        rotation: 0,
        anchors,
        obstacle,
      });
    }
  };

  placeColumn(col0Parts, 0);
  placeColumn(col1Parts, 1);

  // Align Column 1 series loads vertically with their upstream Column 0 series resistor
  for (const placed1 of placedParts) {
    if (placed1.colIndex !== 1) continue;
    for (const nid of placed1.part.netIds) {
      if (!interPartSignalNets.has(nid)) continue;
      const upstream = placedParts.find(
        (p0) => p0.colIndex === 0 && p0.part.netIds.includes(nid),
      );
      if (upstream) {
        const conflict = placedParts.some(
          (other) =>
            other.part.id !== placed1.part.id &&
            other.colIndex === 1 &&
            Math.abs(other.y - upstream.y) < 72,
        );
        if (!conflict) {
          placed1.y = upstream.y;
          placed1.anchors = getSymbolPinAnchors(
            placed1.part.symbolKind,
            placed1.part.id,
            placed1.x,
            placed1.y,
            0,
            placed1.part.pins,
          );
          placed1.obstacle = getSymbolObstacleBounds(
            placed1.part.symbolKind,
            placed1.x,
            placed1.y,
          );
        }
      }
    }
  }

  const obstacles = placedParts.map((p) => p.obstacle);
  const rawWires: Array<{
    id: string;
    netId: string;
    color: string;
    points: Array<{ x: number; y: number }>;
    fromPinId: string;
    toPinId: string;
  }> = [];
  const allOrthoSegments: OrthoSegment[] = [];
  const segmentsByNet = new Map<string, OrthoSegment[]>();

  const recordPolylineSegments = (
    netId: string,
    color: string,
    pts: ReadonlyArray<{ x: number; y: number }>,
  ) => {
    const list = segmentsByNet.get(netId) ?? [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5) continue;
      const orient: "H" | "V" = Math.abs(a.y - b.y) < 0.5 ? "H" : "V";
      const seg: OrthoSegment = {
        netId,
        color,
        orient,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
      };
      list.push(seg);
      allOrthoSegments.push(seg);
    }
    segmentsByNet.set(netId, list);
  };

  const mcuId = model.mcu?.id ?? "U1";

  // Dedicated vertical channel index per net so vertical wires NEVER overlap
  // MCU right edge is at portEdgeX (284), pin badge ends at 284 + 28 = 312.
  // Channels start at portEdgeX + 42 (326) with 12px spacing per net.
  let leftChannelIdx = 0;
  let midChannelIdx = 0;
  let rightChannelIdx = 0;

  for (const net of model.nets) {
    const endpoints: Array<{ id: string; x: number; y: number; side: "mcu" | "left" | "right" }> =
      [];

    for (const mp of net.mcuPins) {
      const norm = mp === "3V3" ? "3.3V" : mp;
      const slot = mcuPortByPin.get(norm);
      if (slot) {
        endpoints.push({
          id: `${mcuId}.${slot.pinName}`,
          x: slot.x + 28,
          y: slot.y,
          side: "mcu",
        });
      }
    }

    for (const placed of placedParts) {
      for (const anchor of placed.anchors) {
        if (anchor.netId === net.id || net.portIds.includes(anchor.pinId)) {
          endpoints.push({
            id: anchor.pinId,
            x: anchor.x,
            y: anchor.y,
            side: anchor.side === "right" ? "right" : "left",
          });
        }
      }
    }

    if (endpoints.length < 2) continue;

    const isGnd = net.kind === "ground" || net.id.toUpperCase().startsWith("GND");

    // Assign a strictly unique vertical channel X to this net
    let trunkX: number;
    const allNonMcuRightSide =
      endpoints.filter((ep) => ep.side !== "mcu").every((ep) => ep.side === "right") &&
      endpoints.some((ep) => ep.side === "right");

    if (isGnd && net.mcuPins.length === 0 && allNonMcuRightSide) {
      trunkX = 872 + rightChannelIdx++ * 12;
    } else if (net.mcuPins.length === 0) {
      trunkX = 594 + midChannelIdx++ * 12;
    } else {
      trunkX = portEdgeX + 42 + leftChannelIdx++ * 12;
    }

    // Direct 0-bend horizontal wire if 2 endpoints share exact Y and have clear line of sight
    if (endpoints.length === 2 && Math.abs(endpoints[0]!.y - endpoints[1]!.y) < 0.5) {
      const ep0 = endpoints[0]!;
      const ep1 = endpoints[1]!;
      if (!hitsObstacleHoriz(ep0.x, ep1.x, ep0.y, obstacles)) {
        const pts = [
          { x: ep0.x, y: ep0.y },
          { x: ep1.x, y: ep1.y },
        ];
        recordPolylineSegments(net.id, net.color, pts);
        rawWires.push({
          id: `wire-${net.id}-direct`,
          netId: net.id,
          color: net.color,
          points: pts,
          fromPinId: ep0.id,
          toPinId: ep1.id,
        });
        continue;
      }
    }

    // Route each endpoint to trunkX using the shortest orthogonal path (minimize bends first, then length)
    const trunkAttachYs: number[] = [];

    for (let i = 0; i < endpoints.length; i++) {
      const ep = endpoints[i]!;
      // 1-segment horizontal path directly to trunkX if unobstructed (0 bends on branch)
      if (!hitsObstacleHoriz(ep.x, trunkX, ep.y, obstacles)) {
        const pts = [
          { x: ep.x, y: ep.y },
          { x: trunkX, y: ep.y },
        ];
        trunkAttachYs.push(ep.y);
        recordPolylineSegments(net.id, net.color, pts);
        rawWires.push({
          id: `wire-${net.id}-branch-${i}`,
          netId: net.id,
          color: net.color,
          points: pts,
          fromPinId: ep.id,
          toPinId: endpoints[0]!.id,
        });
        continue;
      }

      // Otherwise find the nearest free horizontal channel between component rows
      const leadOutX =
        ep.side === "right" ? ep.x + 14 : ep.side === "left" ? ep.x - 14 : ep.x + 12;
      const candidateOffsets = isGnd
        ? [32, -32, 46, -46, 62, -62, 78, -78]
        : [-32, 32, -46, 46, -62, 62, -78, 78];

      let bestY = ep.y + (isGnd ? 34 : -34);
      for (const dy of candidateOffsets) {
        const candY = ep.y + dy;
        if (
          !hitsObstacleVert(leadOutX, ep.y, candY, obstacles) &&
          !hitsObstacleHoriz(leadOutX, trunkX, candY, obstacles)
        ) {
          bestY = candY;
          break;
        }
      }

      const pts = [
        { x: ep.x, y: ep.y },
        { x: leadOutX, y: ep.y },
        { x: leadOutX, y: bestY },
        { x: trunkX, y: bestY },
      ];
      trunkAttachYs.push(bestY);
      recordPolylineSegments(net.id, net.color, pts);
      rawWires.push({
        id: `wire-${net.id}-branch-${i}`,
        netId: net.id,
        color: net.color,
        points: pts,
        fromPinId: ep.id,
        toPinId: endpoints[0]!.id,
      });
    }

    if (trunkAttachYs.length >= 2) {
      const minY = Math.min(...trunkAttachYs);
      const maxY = Math.max(...trunkAttachYs);
      if (maxY > minY) {
        const trunkPts = [
          { x: trunkX, y: minY },
          { x: trunkX, y: maxY },
        ];
        recordPolylineSegments(net.id, net.color, trunkPts);
        rawWires.push({
          id: `wire-${net.id}-trunk`,
          netId: net.id,
          color: net.color,
          points: trunkPts,
          fromPinId: endpoints[0]!.id,
          toPinId: endpoints[endpoints.length - 1]!.id,
        });
      }
    }
  }

  // Build final wires with hop arcs at non-connecting crossings
  const allVertSegments = allOrthoSegments.filter((s) => s.orient === "V");
  const wires: RoutedWirePolyline[] = rawWires.map((rw) => ({
    ...rw,
    pathD: buildWirePathWithHops(rw.points, rw.netId, allVertSegments),
  }));

  // Compute junctions strictly where 3+ segments of the same net meet
  const junctions: RoutedJunctionDot[] = [];
  for (const net of model.nets) {
    const netSegs = segmentsByNet.get(net.id) ?? [];
    if (netSegs.length > 0) {
      junctions.push(...computeTrueNetJunctions(net.id, net.color, netSegs));
    }
  }

  const maxPartY = placedParts.reduce((acc, p) => Math.max(acc, p.y + 80), mcuY + mcuHeight);
  const canvasHeight = Math.max(420, mcuY + mcuHeight + 64, maxPartY + 64);

  return {
    width: 980,
    height: canvasHeight,
    mcuBox: { x: mcuX, y: mcuY, width: mcuWidth, height: mcuHeight },
    mcuGroupHeaders,
    mcuPorts,
    placedParts,
    wires,
    junctions,
  };
}

// ============================================================================
// BREADBOARD COORDINATE MAPPER
// ============================================================================

const BREADBOARD_GEOMETRY = {
  boardX: 250,
  boardY: 56,
  boardWidth: 676,
  boardHeight: 410,
  colStartX: 294,
  colPitch: 20.5,
} as const;

function getBreadboardRowY(row: BreadboardRow): number {
  const base = BREADBOARD_GEOMETRY.boardY;
  switch (row) {
    case "+top":
      return base + 30;
    case "-top":
      return base + 50;
    case "a":
      return base + 92;
    case "b":
      return base + 114;
    case "c":
      return base + 136;
    case "d":
      return base + 158;
    case "e":
      return base + 180;
    // Center DIP channel is between y = base+180 and base+230
    case "f":
      return base + 232;
    case "g":
      return base + 254;
    case "h":
      return base + 276;
    case "i":
      return base + 298;
    case "j":
      return base + 320;
    case "+bot":
      return base + 360;
    case "-bot":
      return base + 380;
  }
}

function getBreadboardColX(col: number): number {
  const clamped = Math.max(1, Math.min(30, col));
  return Math.round(BREADBOARD_GEOMETRY.colStartX + (clamped - 1) * BREADBOARD_GEOMETRY.colPitch);
}

// ============================================================================
// MAIN COMPONENT: Schematic2DViewer
// ============================================================================

export function Schematic2DViewer({
  circuit,
  sketchName = "arduino_circuit",
  theme: propTheme = "light",
  onSwitchTo3D,
  onSelectPinOrNet,
}: Schematic2DViewerProps): React.ReactElement {
  // Respect `theme` prop and also allow toggling inside the component
  const [internalTheme, setInternalTheme] = useState<"light" | "dark">(propTheme);
  useEffect(() => {
    setInternalTheme(propTheme);
  }, [propTheme]);

  const [viewMode, setViewMode] = useState<"schematic" | "breadboard">("schematic");
  // Collapse unused MCU pins by default (Task A4)
  const [showAllPins, setShowAllPins] = useState<boolean>(false);

  // Selection & hover states kept small so pan/zoom/hover never trigger full re-layout
  const [selectedNetId, setSelectedNetId] = useState<string | null>(null);
  const [hoveredNetId, setHoveredNetId] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<{
    title: string;
    body: string;
    color: string;
  } | null>(null);

  // Interactive checklist state (React state only, zero localStorage)
  const [checkedSteps, setCheckedSteps] = useState<Record<string, boolean>>({});

  // Pan & Zoom state (clamped 0.3x - 4x)
  const [transform, setTransform] = useState<{ scale: number; tx: number; ty: number }>({
    scale: 1,
    tx: 0,
    ty: 0,
  });
  const isPanningRef = useRef(false);
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number }>({
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
  });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Memoize normalized model, schematic layout, and breadboard allocation
  const model: CircuitModel = useMemo(
    () => buildCircuitModel(circuit, internalTheme),
    [circuit, internalTheme],
  );
  const schematicLayout: SchematicLayout = useMemo(
    () => computeSchematicLayout(model, showAllPins, internalTheme),
    [model, showAllPins, internalTheme],
  );
  const breadboard: BreadboardAllocation = useMemo(
    () => allocateBreadboard(model),
    [model],
  );

  const activeNetId = hoveredNetId ?? selectedNetId;

  // Clear selection on Escape key
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedNetId(null);
        setHoveredNetId(null);
        setTooltipInfo(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Theme palette ("blueprint paper" light vs "obsidian" dark)
  const palette = useMemo(() => {
    if (internalTheme === "dark") {
      return {
        bg: "#0b0f17",
        grid: "#161f30",
        card: "#0f172a",
        cardAlt: "#131c2e",
        ink: "#e2e8f0",
        muted: "#94a3b8",
        faint: "#334155",
        border: "#1e293b",
        cyan: "#06b6d4",
        gold: "#f5b83d",
      };
    }
    return {
      bg: "#f5efe6",
      grid: "#e5dccb",
      card: "#faf6ee",
      cardAlt: "#efe7d6",
      ink: "#1e293b",
      muted: "#475569",
      faint: "#cbd5e1",
      border: "#d6cbb5",
      cyan: "#06b6d4",
      gold: "#d97706",
    };
  }, [internalTheme]);

  // Handlers for selecting and hovering nets/pins/components
  const handleSelectNet = useCallback(
    (netId: string | null, pinIdForInstruction?: string) => {
      setSelectedNetId(netId);
      if (netId) {
        onSelectPinOrNet?.(netId);
        const netObj = model.nets.find((n) => n.id === netId);
        setTooltipInfo({
          title: pinIdForInstruction ? `${pinIdForInstruction} · Net ${netId}` : `Net ${netId}`,
          body: pinIdForInstruction
            ? pinInstruction(pinIdForInstruction, model)
            : netInstruction(netId, model),
          color: netObj?.color ?? palette.cyan,
        });
      } else {
        setTooltipInfo(null);
      }
    },
    [model, onSelectPinOrNet, palette.cyan],
  );

  const handleHoverNet = useCallback(
    (netId: string | null, pinIdForInstruction?: string) => {
      setHoveredNetId(netId);
      if (netId) {
        const netObj = model.nets.find((n) => n.id === netId);
        setTooltipInfo({
          title: pinIdForInstruction ? `${pinIdForInstruction} · Net ${netId}` : `Net ${netId}`,
          body: pinIdForInstruction
            ? pinInstruction(pinIdForInstruction, model)
            : netInstruction(netId, model),
          color: netObj?.color ?? palette.cyan,
        });
      } else if (!selectedNetId) {
        setTooltipInfo(null);
      }
    },
    [model, palette.cyan, selectedNetId],
  );

  // Wheel zoom toward cursor (clamped 0.3x - 4x)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;

    setTransform((prev) => {
      const nextScale = Math.max(0.3, Math.min(4.0, Number((prev.scale * zoomFactor).toFixed(3))));
      const ratio = nextScale / prev.scale;
      const nextTx = cursorX - (cursorX - prev.tx) * ratio;
      const nextTy = cursorY - (cursorY - prev.ty) * ratio;
      return { scale: nextScale, tx: nextTx, ty: nextTy };
    });
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      isPanningRef.current = true;
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        tx: transform.tx,
        ty: transform.ty,
      };
    },
    [transform.tx, transform.ty],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setTransform((prev) => ({
      ...prev,
      tx: panStartRef.current.tx + dx,
      ty: panStartRef.current.ty + dy,
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    isPanningRef.current = false;
  }, []);

  const handleFitToView = useCallback(() => {
    setTransform({ scale: 1, tx: 0, ty: 0 });
  }, []);

  const handleZoomStep = useCallback((factor: number) => {
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.3, Math.min(4.0, Number((prev.scale * factor).toFixed(2)))),
    }));
  }, []);

  // Serialize SVG with inlined styles + background and download as `${sketchName}_schematic.svg`
  const handleExportSvg = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("style", `background-color: ${palette.bg}; font-family: monospace;`);

    const serializer = new XMLSerializer();
    const rawSvg = serializer.serializeToString(clone);
    const svgBlob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${rawSvg}`], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(svgBlob);
    const cleanName = (sketchName || "circuit")
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .toLowerCase();
    const link = document.createElement("a");
    link.href = url;
    link.download = `${cleanName}_schematic.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [palette.bg, sketchName]);

  const toggleStepChecked = useCallback((stepId: string) => {
    setCheckedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  }, []);

  const completedStepsCount = useMemo(
    () => breadboard.steps.filter((s) => Boolean(checkedSteps[s.id])).length,
    [breadboard.steps, checkedSteps],
  );

  const isEmptyCircuit = model.parts.length === 0 && model.nets.length === 0;

  return (
    <div
      style={{
        backgroundColor: palette.bg,
        color: palette.ink,
      }}
      className="w-full h-full flex flex-col select-none overflow-hidden font-sans"
    >
      {/* ===================================================================== */}
      {/* TOP BAR: TITLE, CONTROLS, AND VIEW SWITCHER PILL                      */}
      {/* ===================================================================== */}
      <div
        style={{
          backgroundColor: palette.card,
          borderBottom: `1px solid ${palette.border}`,
        }}
        className="px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0 z-20"
      >
        {/* Left: Board Title & Net Summary */}
        <div className="flex items-center gap-3">
          <div
            style={{
              backgroundColor: internalTheme === "dark" ? "#162033" : "#efe7d6",
              border: `1px solid ${palette.border}`,
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
          >
            <Cpu className="w-4 h-4" style={{ color: palette.cyan }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{model.boardName}</span>
              <span
                style={{
                  backgroundColor: internalTheme === "dark" ? "#1e293b" : "#e5dccb",
                  color: palette.ink,
                }}
                className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium"
              >
                {model.parts.length} parts · {model.nets.length} nets
              </span>
            </div>
            <p style={{ color: palette.muted }} className="text-[11px]">
              {sketchName} — Orthogonal schematic &amp; half-size breadboard
            </p>
          </div>
        </div>

        {/* Center: Zoom, Fit to View, Show All Pins, Export SVG, Theme Toggle */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label="Zoom out"
            onClick={() => handleZoomStep(0.85)}
            style={{
              backgroundColor: palette.cardAlt,
              border: `1px solid ${palette.border}`,
              color: palette.ink,
            }}
            className="p-1.5 rounded-lg hover:opacity-80 transition cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span
            style={{ color: palette.muted }}
            className="text-[11px] font-mono font-medium min-w-[46px] text-center"
          >
            {Math.round(transform.scale * 100)}%
          </span>
          <button
            type="button"
            aria-label="Zoom in"
            onClick={() => handleZoomStep(1.18)}
            style={{
              backgroundColor: palette.cardAlt,
              border: `1px solid ${palette.border}`,
              color: palette.ink,
            }}
            className="p-1.5 rounded-lg hover:opacity-80 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {viewMode === "schematic" && (
            <button
              type="button"
              onClick={() => setShowAllPins((prev) => !prev)}
              style={{
                backgroundColor: palette.cardAlt,
                border: `1px solid ${palette.border}`,
                color: palette.ink,
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium hover:opacity-85 transition cursor-pointer"
            >
              {showAllPins ? "Hide unused" : "Show all pins"}
            </button>
          )}

          <button
            type="button"
            aria-label="Fit schematic to view"
            onClick={handleFitToView}
            style={{
              backgroundColor: palette.cardAlt,
              border: `1px solid ${palette.border}`,
              color: palette.ink,
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 hover:opacity-85 transition cursor-pointer"
          >
            <Maximize2 className="w-3 h-3" />
            <span>Fit to view</span>
          </button>

          <button
            type="button"
            aria-label="Export vector schematic as SVG"
            onClick={handleExportSvg}
            disabled={isEmptyCircuit}
            style={{
              backgroundColor: palette.cardAlt,
              border: `1px solid ${palette.border}`,
              color: palette.ink,
              opacity: isEmptyCircuit ? 0.5 : 1,
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 hover:opacity-85 transition cursor-pointer"
          >
            <Download className="w-3 h-3" style={{ color: palette.cyan }} />
            <span>Export SVG</span>
          </button>

          <button
            type="button"
            aria-label={`Switch to ${internalTheme === "light" ? "dark" : "light"} theme`}
            onClick={() => setInternalTheme((t) => (t === "light" ? "dark" : "light"))}
            style={{
              backgroundColor: palette.cardAlt,
              border: `1px solid ${palette.border}`,
              color: palette.ink,
            }}
            className="p-1.5 rounded-lg hover:opacity-85 transition cursor-pointer"
          >
            {internalTheme === "light" ? (
              <Moon className="w-3.5 h-3.5" />
            ) : (
              <Sun className="w-3.5 h-3.5" style={{ color: palette.gold }} />
            )}
          </button>
        </div>

        {/* Right: View Switcher (2D Schematic | 2D Breadboard | 3D Digital Twin) */}
        <div
          style={{
            backgroundColor: palette.cardAlt,
            border: `1px solid ${palette.border}`,
          }}
          className="p-1 rounded-lg flex items-center gap-1"
        >
          <button
            type="button"
            aria-label="Switch to 2D Schematic view"
            onClick={() => setViewMode("schematic")}
            style={{
              backgroundColor: viewMode === "schematic" ? palette.ink : "transparent",
              color: viewMode === "schematic" ? palette.card : palette.ink,
            }}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>2D Schematic</span>
          </button>

          <button
            type="button"
            aria-label="Switch to 2D Breadboard view"
            onClick={() => setViewMode("breadboard")}
            style={{
              backgroundColor: viewMode === "breadboard" ? palette.ink : "transparent",
              color: viewMode === "breadboard" ? palette.card : palette.ink,
            }}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>2D Breadboard</span>
          </button>

          {onSwitchTo3D && (
            <button
              type="button"
              aria-label="Switch to 3D Digital Twin view"
              onClick={onSwitchTo3D}
              style={{
                backgroundColor: "transparent",
                color: palette.cyan,
              }}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center gap-1.5 hover:opacity-80 transition cursor-pointer"
            >
              <span>3D Digital Twin</span>
            </button>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* INTERACTIVE VECTOR CANVAS AREA                                        */}
      {/* ===================================================================== */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={() => handleSelectNet(null)}
        style={{ backgroundColor: palette.bg }}
        className="flex-1 min-h-[340px] relative overflow-hidden cursor-grab active:cursor-grabbing"
      >
        {isEmptyCircuit ? (
          /* Friendly Empty State Card */
          <div className="w-full h-full flex items-center justify-center p-6">
            <div
              style={{
                backgroundColor: palette.card,
                border: `2px solid ${palette.ink}`,
                borderRadius: 12,
              }}
              className="max-w-md w-full p-6 text-center shadow-lg"
            >
              <div
                style={{
                  backgroundColor: palette.cardAlt,
                  border: `1.5px solid ${palette.border}`,
                }}
                className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
              >
                <Zap className="w-6 h-6" style={{ color: palette.cyan }} />
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wide mb-1">
                No Synthesized Peripherals Yet
              </h3>
              <p style={{ color: palette.muted }} className="text-xs leading-relaxed">
                This circuit currently has no peripheral components or nets. Add{" "}
                <code>pinMode()</code>, <code>digitalWrite()</code>, <code>analogRead()</code>, or{" "}
                <code>Servo</code> calls to your Arduino sketch to generate a live 2D schematic and
                breadboard layout.
              </p>
            </div>
          </div>
        ) : (
          <svg
            ref={svgRef}
            role="img"
            aria-label={`${sketchName} ${viewMode === "schematic" ? "2D Schematic" : "2D Breadboard"} Diagram`}
            viewBox={`0 0 ${schematicLayout.width} ${viewMode === "schematic" ? schematicLayout.height : 520}`}
            className="w-full h-full block"
          >
            <title>{`${sketchName} — ${viewMode === "schematic" ? "2D Electronic Schematic" : "2D Half-Size Breadboard Layout"}`}</title>

            <defs>
              <pattern
                id="s2c-blueprint-grid"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 20 0 L 0 0 0 20"
                  fill="none"
                  stroke={palette.grid}
                  strokeWidth="1"
                />
              </pattern>
            </defs>

            {/* Blueprint Background + Grid */}
            <rect
              x="0"
              y="0"
              width={schematicLayout.width}
              height={viewMode === "schematic" ? schematicLayout.height : 520}
              fill={palette.bg}
            />
            <rect
              x="0"
              y="0"
              width={schematicLayout.width}
              height={viewMode === "schematic" ? schematicLayout.height : 520}
              fill="url(#s2c-blueprint-grid)"
            />

            {/* Zoom & Pan Transform Group */}
            <g
              transform={`translate(${transform.tx}, ${transform.ty}) scale(${transform.scale})`}
              strokeLinejoin="round"
              strokeLinecap="round"
            >
              {viewMode === "schematic" ? (
                /* ============================================================= */
                /* VIEW 1: 2D ORTHOGONAL SCHEMATIC                               */
                /* ============================================================= */
                <g>
                  {/* 1. Left MCU Block: ARDUINO UNO R3 · ATmega328P */}
                  <g>
                    <rect
                      x={schematicLayout.mcuBox.x}
                      y={schematicLayout.mcuBox.y}
                      width={schematicLayout.mcuBox.width}
                      height={schematicLayout.mcuBox.height}
                      rx={12}
                      fill={palette.card}
                      stroke={palette.ink}
                      strokeWidth={2.2}
                    />

                    {/* MCU Header Banner + Show all pins / Hide unused toggle */}
                    <rect
                      x={schematicLayout.mcuBox.x}
                      y={schematicLayout.mcuBox.y}
                      width={schematicLayout.mcuBox.width}
                      height={38}
                      rx={12}
                      fill={internalTheme === "dark" ? "#1e293b" : "#e5dccb"}
                      stroke={palette.ink}
                      strokeWidth={2}
                    />
                    <text
                      x={schematicLayout.mcuBox.x + 12}
                      y={schematicLayout.mcuBox.y + 16}
                      fill={palette.ink}
                      fontSize={10}
                      fontWeight={700}
                    >
                      Arduino Uno R3
                    </text>
                    <text
                      x={schematicLayout.mcuBox.x + 12}
                      y={schematicLayout.mcuBox.y + 29}
                      fill={palette.muted}
                      fontSize={8.5}
                      fontWeight={600}
                      className="font-mono"
                    >
                      ATmega328P · U1
                    </text>

                    {/* Toggle Button in MCU Block Header: "Show all pins" / "Hide unused" */}
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={showAllPins ? "Hide unused" : "Show all pins"}
                      style={{ cursor: "pointer" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowAllPins((prev) => !prev);
                      }}
                    >
                      <rect
                        x={schematicLayout.mcuBox.x + schematicLayout.mcuBox.width - 84}
                        y={schematicLayout.mcuBox.y + 10}
                        width={74}
                        height={18}
                        rx={6}
                        fill={internalTheme === "dark" ? "#0f172a" : "#faf6ee"}
                        stroke={palette.border}
                        strokeWidth={1}
                      />
                      <text
                        x={schematicLayout.mcuBox.x + schematicLayout.mcuBox.width - 47}
                        y={schematicLayout.mcuBox.y + 22}
                        textAnchor="middle"
                        fill={palette.cyan}
                        fontSize={8}
                        fontWeight={600}
                      >
                        {showAllPins ? "Hide unused" : "Show all pins"}
                      </text>
                    </g>

                    {/* Dynamic Group Divider Labels inside MCU Block */}
                    {schematicLayout.mcuGroupHeaders.map((hdr) => (
                      <text
                        key={hdr.group}
                        x={schematicLayout.mcuBox.x + 14}
                        y={hdr.y}
                        fill={palette.cyan}
                        fontSize={8}
                        fontWeight={700}
                      >
                        {hdr.label}
                      </text>
                    ))}

                    {/* MCU Port Rows: Active Pins as Colored Pill Badges, Unused as Faint Ticks */}
                    {schematicLayout.mcuPorts.map((slot) => {
                      const isUsed = slot.netId !== null;
                      const isHighlighted = isUsed && activeNetId === slot.netId;
                      const isDimmed =
                        activeNetId !== null && (!isUsed || slot.netId !== activeNetId);
                      const fullPinId = `${model.mcu?.id ?? "U1"}.${slot.pinName}`;

                      return (
                        <g
                          key={slot.pinName}
                          style={{
                            opacity: isDimmed ? 0.3 : 1,
                            cursor: isUsed ? "pointer" : "default",
                            transition: "opacity 150ms ease",
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (slot.netId) {
                              handleSelectNet(slot.netId, fullPinId);
                            }
                          }}
                          onMouseEnter={() => {
                            if (slot.netId) {
                              handleHoverNet(slot.netId, fullPinId);
                            }
                          }}
                          onMouseLeave={() => {
                            if (slot.netId) {
                              handleHoverNet(null);
                            }
                          }}
                        >
                          <text
                            x={slot.x - 10}
                            y={slot.y + 3.5}
                            textAnchor="end"
                            fill={isUsed ? palette.ink : palette.muted}
                            opacity={isUsed ? 1 : 0.45}
                            fontSize={9.5}
                            fontWeight={isUsed ? 700 : 500}
                            className="font-mono"
                          >
                            {slot.displayLabel}
                          </text>

                          {isUsed ? (
                            <g>
                              <line
                                x1={slot.x}
                                y1={slot.y}
                                x2={slot.x + 28}
                                y2={slot.y}
                                stroke={isHighlighted ? palette.cyan : slot.color}
                                strokeWidth={isHighlighted ? 3 : 2}
                              />
                              <rect
                                x={slot.x + 4}
                                y={slot.y - 7.5}
                                width={24}
                                height={15}
                                rx={7.5}
                                fill={isHighlighted ? palette.cyan : slot.color}
                                stroke={palette.card}
                                strokeWidth={1.2}
                              />
                              <text
                                x={slot.x + 16}
                                y={slot.y + 3}
                                textAnchor="middle"
                                fill="#ffffff"
                                fontSize={7.5}
                                fontWeight={800}
                                className="font-mono"
                              >
                                {slot.pinName}
                              </text>
                            </g>
                          ) : (
                            /* Unused pin stays as a faint tick */
                            <line
                              x1={slot.x - 3}
                              y1={slot.y}
                              x2={slot.x + 5}
                              y2={slot.y}
                              stroke={palette.faint}
                              strokeWidth={1.5}
                              opacity={0.5}
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>

                  {/* 2. Manhattan Orthogonal Routed Wires (with hop arcs over crossings) */}
                  {schematicLayout.wires.map((wire) => {
                    const isHighlighted = activeNetId === wire.netId;
                    const isDimmed = activeNetId !== null && activeNetId !== wire.netId;

                    return (
                      <g
                        key={wire.id}
                        style={{
                          opacity: isDimmed ? 0.3 : 1,
                          cursor: "pointer",
                          transition: "opacity 150ms ease",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectNet(wire.netId, wire.fromPinId);
                        }}
                        onMouseEnter={() => handleHoverNet(wire.netId, wire.fromPinId)}
                        onMouseLeave={() => handleHoverNet(null)}
                      >
                        {isHighlighted && (
                          <path
                            d={wire.pathD}
                            fill="none"
                            stroke={palette.cyan}
                            strokeWidth={6}
                            opacity={0.25}
                          />
                        )}
                        <path
                          d={wire.pathD}
                          fill="none"
                          stroke={isHighlighted ? palette.cyan : wire.color}
                          strokeWidth={isHighlighted ? 3 : 2.2}
                        />
                      </g>
                    );
                  })}

                  {/* 3. T-Junction Solder Dots */}
                  {schematicLayout.junctions.map((junc) => {
                    const isHighlighted = activeNetId === junc.netId;
                    const isDimmed = activeNetId !== null && activeNetId !== junc.netId;
                    return (
                      <circle
                        key={junc.id}
                        cx={junc.x}
                        cy={junc.y}
                        r={isHighlighted ? 4.5 : 3.5}
                        fill={isHighlighted ? palette.cyan : junc.color}
                        stroke={palette.card}
                        strokeWidth={1}
                        style={{ opacity: isDimmed ? 0.3 : 1 }}
                      />
                    );
                  })}

                  {/* 4. Peripheral Schematic Symbols in Columns */}
                  {schematicLayout.placedParts.map((placed) => {
                    const primaryNetId =
                      placed.part.netIds.find(
                        (nid) => nid !== "GND" && nid !== "5V" && nid !== "3V3",
                      ) ??
                      placed.part.netIds[0] ??
                      null;
                    const isHighlighted =
                      activeNetId !== null && placed.part.netIds.includes(activeNetId);
                    const isDimmed =
                      activeNetId !== null && !placed.part.netIds.includes(activeNetId);
                    const netColor =
                      (primaryNetId ? model.netColors[primaryNetId] : undefined) ?? palette.ink;

                    return (
                      <SchematicSymbol
                        key={placed.part.id}
                        symbolKind={placed.part.symbolKind}
                        partId={placed.part.id}
                        x={placed.x}
                        y={placed.y}
                        rotation={placed.rotation}
                        active={isHighlighted}
                        dimmed={isDimmed}
                        color={netColor}
                        label={placed.part.id}
                        value={placed.part.value}
                        theme={internalTheme}
                        {...(placed.part.inputPullup !== undefined
                          ? { inputPullup: placed.part.inputPullup }
                          : {})}
                        {...(placed.part.ledColorHex !== undefined
                          ? { ledColorHex: placed.part.ledColorHex }
                          : {})}
                        pins={placed.part.pins}
                        onSelect={() => {
                          if (primaryNetId) {
                            handleSelectNet(primaryNetId, placed.part.pins[0]?.id);
                          }
                        }}
                        onHoverChange={(hovered) => {
                          handleHoverNet(hovered ? primaryNetId : null, placed.part.pins[0]?.id);
                        }}
                      />
                    );
                  })}
                </g>
              ) : (
                /* ============================================================= */
                /* VIEW 2: TOP-DOWN HALF-SIZE BREADBOARD VIEW                    */
                /* ============================================================= */
                <g>
                  {/* Left Arduino Header Strip Reference Block */}
                  <rect
                    x={36}
                    y={56}
                    width={176}
                    height={410}
                    rx={12}
                    fill={palette.card}
                    stroke={palette.ink}
                    strokeWidth={2.2}
                  />
                  <text
                    x={124}
                    y={82}
                    textAnchor="middle"
                    fill={palette.ink}
                    fontSize={10.5}
                    fontWeight={800}
                  >
                    ARDUINO UNO HEADERS
                  </text>
                  <text
                    x={124}
                    y={96}
                    textAnchor="middle"
                    fill={palette.muted}
                    fontSize={8.5}
                  >
                    Jumper Origin Pins
                  </text>

                  {/* Half-Size 30-Column Breadboard Body */}
                  <rect
                    x={BREADBOARD_GEOMETRY.boardX}
                    y={BREADBOARD_GEOMETRY.boardY}
                    width={BREADBOARD_GEOMETRY.boardWidth}
                    height={BREADBOARD_GEOMETRY.boardHeight}
                    rx={12}
                    fill={palette.card}
                    stroke={palette.ink}
                    strokeWidth={2.2}
                  />

                  {/* Center DIP Ravine Channel */}
                  <rect
                    x={BREADBOARD_GEOMETRY.boardX + 16}
                    y={BREADBOARD_GEOMETRY.boardY + 196}
                    width={BREADBOARD_GEOMETRY.boardWidth - 32}
                    height={20}
                    rx={4}
                    fill={palette.cardAlt}
                    stroke={palette.border}
                    strokeWidth={1.2}
                  />

                  {/* Power Rail Distribution Lines (+5V Red, GND Slate) */}
                  <line
                    x1={BREADBOARD_GEOMETRY.colStartX - 10}
                    y1={getBreadboardRowY("+top") - 8}
                    x2={getBreadboardColX(30) + 10}
                    y2={getBreadboardRowY("+top") - 8}
                    stroke={WIRE_COLORS["5V"]}
                    strokeWidth={2}
                  />
                  <line
                    x1={BREADBOARD_GEOMETRY.colStartX - 10}
                    y1={getBreadboardRowY("-top") + 8}
                    x2={getBreadboardColX(30) + 10}
                    y2={getBreadboardRowY("-top") + 8}
                    stroke={WIRE_COLORS.GND}
                    strokeWidth={2}
                  />
                  <line
                    x1={BREADBOARD_GEOMETRY.colStartX - 10}
                    y1={getBreadboardRowY("+bot") - 8}
                    x2={getBreadboardColX(30) + 10}
                    y2={getBreadboardRowY("+bot") - 8}
                    stroke={WIRE_COLORS["5V"]}
                    strokeWidth={2}
                  />
                  <line
                    x1={BREADBOARD_GEOMETRY.colStartX - 10}
                    y1={getBreadboardRowY("-bot") + 8}
                    x2={getBreadboardColX(30) + 10}
                    y2={getBreadboardRowY("-bot") + 8}
                    stroke={WIRE_COLORS.GND}
                    strokeWidth={2}
                  />

                  {/* Column Labels (1..30) and Tie-Point Holes */}
                  {Array.from({ length: 30 }, (_, idx) => {
                    const col = idx + 1;
                    const cx = getBreadboardColX(col);
                    const rows: ReadonlyArray<BreadboardRow> = [
                      "+top",
                      "-top",
                      "a",
                      "b",
                      "c",
                      "d",
                      "e",
                      "f",
                      "g",
                      "h",
                      "i",
                      "j",
                      "+bot",
                      "-bot",
                    ];

                    return (
                      <g key={`bb-col-${col}`}>
                        {(col === 1 || col % 5 === 0) && (
                          <>
                            <text
                              x={cx}
                              y={BREADBOARD_GEOMETRY.boardY + 74}
                              textAnchor="middle"
                              fill={palette.muted}
                              fontSize={8.5}
                              fontWeight={700}
                            >
                              {col}
                            </text>
                            <text
                              x={cx}
                              y={BREADBOARD_GEOMETRY.boardY + 340}
                              textAnchor="middle"
                              fill={palette.muted}
                              fontSize={8.5}
                              fontWeight={700}
                            >
                              {col}
                            </text>
                          </>
                        )}

                        {rows.map((r) => {
                          const cy = getBreadboardRowY(r);
                          return (
                            <rect
                              key={`hole-${col}-${r}`}
                              x={cx - 2.6}
                              y={cy - 2.6}
                              width={5.2}
                              height={5.2}
                              rx={1.2}
                              fill={internalTheme === "dark" ? "#1e293b" : "#d6cbb5"}
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Row Labels (a–e, f–j, +, −) */}
                  {(
                    [
                      { r: "+top", label: "+", color: WIRE_COLORS["5V"] },
                      { r: "-top", label: "−", color: WIRE_COLORS.GND },
                      { r: "a", label: "a", color: palette.muted },
                      { r: "b", label: "b", color: palette.muted },
                      { r: "c", label: "c", color: palette.muted },
                      { r: "d", label: "d", color: palette.muted },
                      { r: "e", label: "e", color: palette.muted },
                      { r: "f", label: "f", color: palette.muted },
                      { r: "g", label: "g", color: palette.muted },
                      { r: "h", label: "h", color: palette.muted },
                      { r: "i", label: "i", color: palette.muted },
                      { r: "j", label: "j", color: palette.muted },
                      { r: "+bot", label: "+", color: WIRE_COLORS["5V"] },
                      { r: "-bot", label: "−", color: WIRE_COLORS.GND },
                    ] as const
                  ).map((item) => {
                    const ry = getBreadboardRowY(item.r);
                    return (
                      <g key={`row-lbl-${item.r}`}>
                        <text
                          x={BREADBOARD_GEOMETRY.colStartX - 18}
                          y={ry + 3.5}
                          textAnchor="middle"
                          fill={item.color}
                          fontSize={9.5}
                          fontWeight={800}
                        >
                          {item.label}
                        </text>
                        <text
                          x={getBreadboardColX(30) + 18}
                          y={ry + 3.5}
                          textAnchor="middle"
                          fill={item.color}
                          fontSize={9.5}
                          fontWeight={800}
                        >
                          {item.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Placed Breadboard Components at {col, row} */}
                  {breadboard.placements.map((pl) => {
                    const p0 = pl.pins[0];
                    const pLast = pl.pins[pl.pins.length - 1];
                    if (!p0 || !pLast) return null;

                    const x1 = getBreadboardColX(p0.col);
                    const y1 = getBreadboardRowY(p0.row);
                    const x2 = getBreadboardColX(pLast.col);
                    const y2 = getBreadboardRowY(pLast.row);
                    const midX = (x1 + x2) / 2;
                    const midY = (y1 + y2) / 2;

                    const partNets = pl.pins
                      .map((p) => p.netId)
                      .filter((nid): nid is string => nid !== null);
                    const primaryNet =
                      partNets.find((n) => n !== "GND" && n !== "5V") ?? partNets[0] ?? null;
                    const isHighlighted =
                      activeNetId !== null && partNets.includes(activeNetId);
                    const isDimmed =
                      activeNetId !== null && !partNets.includes(activeNetId);
                    const bands =
                      pl.symbolKind === "resistor" ? resistorBands(pl.value).bands : null;

                    return (
                      <g
                        key={`bb-part-${pl.partId}`}
                        style={{
                          opacity: isDimmed ? 0.3 : 1,
                          cursor: "pointer",
                          transition: "opacity 150ms ease",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (primaryNet) handleSelectNet(primaryNet, p0.pinId);
                        }}
                        onMouseEnter={() => {
                          if (primaryNet) handleHoverNet(primaryNet, p0.pinId);
                        }}
                        onMouseLeave={() => handleHoverNet(null)}
                      >
                        {/* Component Pin Leads plugged into {col, row} */}
                        {pl.pins.map((pin) => {
                          const px = getBreadboardColX(pin.col);
                          const py = getBreadboardRowY(pin.row);
                          return (
                            <circle
                              key={pin.pinId}
                              cx={px}
                              cy={py}
                              r={4}
                              fill={isHighlighted ? palette.cyan : "#94a3b8"}
                              stroke={palette.ink}
                              strokeWidth={1.5}
                            />
                          );
                        })}

                        {pl.symbolKind === "resistor" && bands ? (
                          <g>
                            <line
                              x1={x1}
                              y1={y1}
                              x2={x2}
                              y2={y2}
                              stroke="#94a3b8"
                              strokeWidth={2.5}
                            />
                            <rect
                              x={midX - 16}
                              y={midY - 7}
                              width={32}
                              height={14}
                              rx={4}
                              fill="#dfbe99"
                              stroke={isHighlighted ? palette.cyan : palette.ink}
                              strokeWidth={1.8}
                            />
                            {bands.map((b, bi) => (
                              <rect
                                key={`${pl.partId}-band-${bi}`}
                                x={midX - 11 + bi * 6.5}
                                y={midY - 6}
                                width={3.5}
                                height={12}
                                fill={b.hex}
                              />
                            ))}
                            <text
                              x={midX}
                              y={midY - 11}
                              textAnchor="middle"
                              fill={palette.ink}
                              fontSize={8.5}
                              fontWeight={800}
                            >
                              {pl.partId} ({pl.value})
                            </text>
                          </g>
                        ) : pl.symbolKind === "led" ? (
                          <g>
                            <circle
                              cx={midX}
                              cy={midY - 8}
                              r={isHighlighted ? 14 : 10}
                              fill="#ef4444"
                              opacity={isHighlighted ? 0.35 : 0.2}
                            />
                            <circle
                              cx={midX}
                              cy={midY - 8}
                              r={8}
                              fill="#ef4444"
                              stroke={isHighlighted ? palette.cyan : palette.ink}
                              strokeWidth={1.8}
                            />
                            <text
                              x={midX}
                              y={midY - 20}
                              textAnchor="middle"
                              fill={palette.ink}
                              fontSize={8.5}
                              fontWeight={800}
                            >
                              {pl.partId}
                            </text>
                          </g>
                        ) : (
                          <g>
                            <rect
                              x={Math.min(x1, x2) - 8}
                              y={midY - 18}
                              width={Math.max(28, Math.abs(x2 - x1) + 16)}
                              height={28}
                              rx={6}
                              fill={palette.cardAlt}
                              stroke={isHighlighted ? palette.cyan : palette.ink}
                              strokeWidth={1.8}
                            />
                            <text
                              x={midX}
                              y={midY - 2}
                              textAnchor="middle"
                              fill={palette.ink}
                              fontSize={8.5}
                              fontWeight={800}
                            >
                              {pl.partId}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}

                  {/* Breadboard Jumper Wires */}
                  {breadboard.jumpers.map((jmp, idx) => {
                    const isHighlighted = activeNetId === jmp.netId;
                    const isDimmed = activeNetId !== null && activeNetId !== jmp.netId;

                    const toX = getBreadboardColX(jmp.to.col);
                    const toY = getBreadboardRowY(jmp.to.row);

                    let fromX = getBreadboardColX(jmp.from.col);
                    let fromY = getBreadboardRowY(jmp.from.row);

                    if (jmp.from.kind === "mcu") {
                      fromX = 196;
                      fromY = 122 + idx * 24;
                    }

                    const midX = (fromX + toX) / 2;
                    const archY = Math.min(fromY, toY) - 18;
                    const pathD =
                      jmp.from.kind === "mcu"
                        ? `M ${fromX} ${fromY} L ${fromX + 26} ${fromY} L ${fromX + 26} ${toY} L ${toX} ${toY}`
                        : `M ${fromX} ${fromY} Q ${midX} ${archY} ${toX} ${toY}`;

                    return (
                      <g
                        key={jmp.id}
                        style={{
                          opacity: isDimmed ? 0.3 : 1,
                          cursor: "pointer",
                          transition: "opacity 150ms ease",
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectNet(jmp.netId, jmp.from.mcuPin ?? jmp.to.label);
                        }}
                        onMouseEnter={() =>
                          handleHoverNet(jmp.netId, jmp.from.mcuPin ?? jmp.to.label)
                        }
                        onMouseLeave={() => handleHoverNet(null)}
                      >
                        {jmp.from.kind === "mcu" && (
                          <g>
                            <rect
                              x={54}
                              y={fromY - 8}
                              width={142}
                              height={16}
                              rx={8}
                              fill={isHighlighted ? palette.cyan : jmp.color}
                            />
                            <text
                              x={125}
                              y={fromY + 3}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize={8.5}
                              fontWeight={800}
                            >
                              {jmp.from.label} → col {jmp.to.col}
                            </text>
                          </g>
                        )}
                        {isHighlighted && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke={palette.cyan}
                            strokeWidth={6.5}
                            opacity={0.3}
                          />
                        )}
                        <path
                          d={pathD}
                          fill="none"
                          stroke={isHighlighted ? palette.cyan : jmp.color}
                          strokeWidth={isHighlighted ? 3.2 : 2.3}
                        />
                        <circle
                          cx={toX}
                          cy={toY}
                          r={3.2}
                          fill={isHighlighted ? palette.cyan : jmp.color}
                        />
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          </svg>
        )}

        {/* Floating Pin / Net Instruction Tooltip */}
        {tooltipInfo && (
          <div
            style={{
              backgroundColor: palette.card,
              border: `2px solid ${palette.cyan}`,
              color: palette.ink,
              borderRadius: 12,
            }}
            className="absolute bottom-3 left-3 max-w-md px-3.5 py-2.5 shadow-xl pointer-events-none z-20"
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                style={{ backgroundColor: tooltipInfo.color }}
                className="w-2.5 h-2.5 rounded-full inline-block"
              />
              <span className="text-[11px] font-bold uppercase tracking-wide">
                {tooltipInfo.title}
              </span>
            </div>
            <p style={{ color: palette.muted }} className="text-[10.5px] leading-relaxed">
              {tooltipInfo.body}
            </p>
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* BOTTOM PANEL: STEP-BY-STEP WIRING CHECKLIST                           */}
      {/* ===================================================================== */}
      <div
        style={{
          backgroundColor: palette.card,
          borderTop: `1.5px solid ${palette.border}`,
        }}
        className="px-4 py-3 max-h-56 overflow-y-auto shrink-0"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4" style={{ color: palette.cyan }} />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              Step-by-Step Wiring Checklist
            </h4>
          </div>
          <span
            style={{
              backgroundColor: palette.cardAlt,
              border: `1px solid ${palette.border}`,
              color: palette.ink,
            }}
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
          >
            {completedStepsCount} / {breadboard.steps.length}
          </span>
        </div>

        {breadboard.steps.length === 0 ? (
          <p style={{ color: palette.muted }} className="text-xs">
            No wiring steps required for an empty circuit.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {breadboard.steps.map((step) => {
              const isChecked = Boolean(checkedSteps[step.id]);
              const isSelected = activeNetId === step.netId;

              return (
                <div
                  key={step.id}
                  onClick={() => handleSelectNet(step.netId)}
                  style={{
                    backgroundColor: isSelected ? palette.cardAlt : palette.bg,
                    border: `1.5px solid ${isSelected ? palette.cyan : palette.border}`,
                    opacity: isChecked ? 0.5 : 1,
                    borderRadius: 10,
                  }}
                  className="px-3 py-2 flex items-start gap-2.5 cursor-pointer transition"
                >
                  <input
                    type="checkbox"
                    aria-label={`Mark step ${step.stepNumber}: ${step.text} as complete`}
                    checked={isChecked}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleStepChecked(step.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5 cursor-pointer accent-cyan-500"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        style={{ backgroundColor: step.netColor }}
                        className="w-2 h-2 rounded-full shrink-0"
                      />
                      <span
                        className={`text-[11px] font-bold truncate ${
                          isChecked ? "line-through" : ""
                        }`}
                      >
                        {step.stepNumber}. {step.text}
                      </span>
                    </div>
                    <p style={{ color: palette.muted }} className="text-[10px] truncate mt-0.5">
                      {step.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default Schematic2DViewer;
