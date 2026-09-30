/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Deterministic PCB component placer for Arduino Uno R3 Shields.
 */

import type { Circuit, Component } from "@s2c/circuit-json";
import {
  ARDUINO_UNO_R3_SHIELD_OUTLINE,
  FOOTPRINT_CATALOG,
  getFootprintDefinition,
} from "@s2c/footprints";
import { getPartDefinition } from "@s2c/parts";
import {
  DEFAULT_DESIGN_RULES,
  type DrcViolation,
  type FootprintDef,
  type PcbBoard,
  type PcbLayout,
  type Placement,
  type Point,
} from "@s2c/pcb-json";
import {
  distance,
  getBoundingBox,
  isPolygonContained,
  manhattanDistance,
  polygonsIntersect,
  transformPoint,
  transformPolygon,
} from "./geometry.js";
import { ARDUINO_UNO_R3_KEEPOUTS } from "./keepouts.js";
import { computeRatsnest } from "./ratsnest.js";
import type { PlacementOptions, PlacementResult } from "./types.js";

interface PlacedEntity {
  componentId: string;
  footprint: FootprintDef;
  placement: Placement;
  courtyardWorld: Point[];
}

/**
 * Expands a polygon outward from its centroid by a clearance margin.
 */
function expandPolygon(poly: Point[], margin: number): Point[] {
  if (margin <= 0 || poly.length < 3) return poly;
  const bb = getBoundingBox(poly);
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;

  return poly.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: p.x + margin, y: p.y + margin };
    return {
      x: p.x + (dx / len) * margin,
      y: p.y + (dy / len) * margin,
    };
  });
}

/**
 * Fallback courtyard rectangle from footprint pad bounds if no explicit courtyard is defined.
 */
function getFootprintCourtyard(fp: FootprintDef): Point[] {
  if (fp.courtyard && fp.courtyard.length >= 3) {
    return fp.courtyard;
  }
  const bb = getBoundingBox(fp.pads);
  const margin = 0.5;
  return [
    { x: bb.minX - margin, y: bb.minY - margin },
    { x: bb.maxX + margin, y: bb.minY - margin },
    { x: bb.maxX + margin, y: bb.maxY + margin },
    { x: bb.minX - margin, y: bb.maxY + margin },
  ];
}

/**
 * Hashes a circuit deterministically for layout metadata.
 */
function hashCircuit(circuit: Circuit): string {
  let hash = 0;
  const str = JSON.stringify({
    components: circuit.components.map((c) => ({ id: c.id, kind: c.kind })),
    nets: circuit.nets.map((n) => ({ id: n.id, portIds: n.portIds })),
  });
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, "0")}`;
}

/**
 * Resolves verified part definition, footprint ID, and pinMap for a circuit component.
 */
export function resolvePartAndFootprint(comp: Component): {
  partDef?: ReturnType<typeof getPartDefinition>;
  fpId?: string;
  pinMap?: Record<string, string>;
} {
  const partDef =
    (comp.partNumber ? getPartDefinition(comp.partNumber) : undefined) ??
    getPartDefinition(comp.id) ??
    getPartDefinition(comp.kind);

  let fpId =
    comp.properties?.footprint?.toString() ?? partDef?.footprintId ?? partDef?.defaultFootprint;

  let pinMap = partDef?.pinMap;

  if (!fpId) {
    if (comp.id === "C_DECOUPLING" || comp.properties?.type === "decoupling") {
      fpId = "capacitor:radial-0.1in";
      pinMap = pinMap ?? { "1": "1", "2": "2" };
    } else if (comp.kind === "resistor") {
      fpId = "resistor:axial-0.3in";
      pinMap = pinMap ?? { "1": "1", "2": "2" };
    } else if (comp.kind === "led") {
      fpId = "led:5mm";
      pinMap = pinMap ?? { A: "2", K: "1" };
    } else if (comp.kind === "capacitor") {
      fpId = comp.partNumber === "CAP-ELECTRO" ? "capacitor:radial-can" : "capacitor:radial-0.1in";
      pinMap =
        pinMap ??
        (fpId === "capacitor:radial-can" ? { "+": "+", "-": "-" } : { "1": "1", "2": "2" });
    } else if (comp.kind === "button") {
      fpId = "button:tact-6mm";
      pinMap = pinMap ?? { "1": "1", "2": "2" };
    } else if (comp.kind === "diode") {
      fpId = "diode:do-41";
      pinMap = pinMap ?? { A: "2", K: "1" };
    } else if (comp.kind === "transistor") {
      fpId = "transistor:to-92";
      pinMap = pinMap ?? { E: "1", B: "2", C: "3" };
    } else if (comp.kind === "potentiometer" || comp.id.startsWith("POT")) {
      fpId = "pot:3-pin-rotary";
      pinMap = pinMap ?? { "1": "1", "2": "2", "3": "3" };
    } else if (
      comp.kind === "buzzer" ||
      (comp.kind as string) === "piezo" ||
      comp.id.startsWith("SPK")
    ) {
      fpId = "buzzer:12mm";
      pinMap = pinMap ?? { "+": "+", "-": "-" };
    } else if (comp.partNumber === "HC-SR04" || comp.id === "SENSOR1") {
      fpId = "module:hc-sr04";
      pinMap = pinMap ?? { VCC: "VCC", TRIG: "TRIG", ECHO: "ECHO", GND: "GND" };
    } else if (comp.kind === "sensor" || comp.id.startsWith("LDR")) {
      fpId = "sensor:ldr-5mm";
      pinMap = pinMap ?? { "1": "1", "2": "2" };
    } else if (
      (comp.kind as string) === "servo" ||
      comp.partNumber === "SG90" ||
      comp.id.startsWith("SERVO")
    ) {
      fpId = "header:3-pin-0.1in";
      pinMap = pinMap ?? { PWM: "1", VCC: "2", GND: "3" };
    } else if (
      (comp.kind as string) === "motor" ||
      comp.partNumber?.includes("MOTOR") ||
      comp.id.startsWith("M")
    ) {
      fpId = "motor:dc-hobby";
      pinMap = pinMap ?? { "+": "1", "-": "2" };
    } else if (comp.kind === "mcu") {
      fpId = "module:arduino-uno-r3";
    }
  }

  if (!pinMap && partDef?.pinMap) {
    pinMap = partDef.pinMap;
  }

  return { partDef, fpId, pinMap };
}

/**
 * Deterministically places all components of a circuit on a PCB board.
 */
export function placeCircuit(
  circuit: Circuit,
  boardOutline: Point[] = ARDUINO_UNO_R3_SHIELD_OUTLINE,
  options?: PlacementOptions,
): PlacementResult {
  const gridMm = options?.gridMm ?? 2.54; // 0.1 inch standard engineering grid
  const edgeClearanceMm = options?.edgeClearanceMm ?? 2.0;
  const courtyardClearanceMm = options?.courtyardClearanceMm ?? 0.5;
  const keepouts = options?.keepouts ?? ARDUINO_UNO_R3_KEEPOUTS;

  const placedEntities: PlacedEntity[] = [];
  const unplacedIds: string[] = [];
  const drcViolations: DrcViolation[] = [];
  const footprintsUsed = new Map<string, FootprintDef>();
  const pinMaps = new Map<string, Record<string, string>>();

  // Board bounding box
  const boardBb = getBoundingBox(boardOutline);

  // 1. Separate fixed MCU boards / shields from discrete components
  const mcuComponents: Component[] = [];
  const discreteComponents: Component[] = [];

  for (const comp of circuit.components) {
    const { fpId, pinMap } = resolvePartAndFootprint(comp);

    if (pinMap) {
      pinMaps.set(comp.id, pinMap);
    }

    // Unknown part or missing footprint: MUST NEVER silently fall back to header:2-pin-0.1in!
    // Component goes to unplaced with a diagnostic naming the part and missing footprint.
    if (!fpId || (!getFootprintDefinition(fpId) && !FOOTPRINT_CATALOG[fpId])) {
      unplacedIds.push(comp.id);
      drcViolations.push({
        code: "ERR_UNPLACED_NO_FOOTPRINT",
        severity: "error",
        message: `Component '${comp.id}' (${comp.partNumber ?? comp.kind}): cannot be placed due to unknown part or missing footprint '${fpId ?? "none"}'`,
        componentId: comp.id,
      });
      continue;
    }

    const fpDef = getFootprintDefinition(fpId) ?? FOOTPRINT_CATALOG[fpId]!;
    footprintsUsed.set(fpDef.id, fpDef);

    if (comp.kind === "mcu" || fpId === "module:arduino-uno-r3") {
      mcuComponents.push(comp);
    } else {
      discreteComponents.push(comp);
    }
  }

  // 2. Fixed placement for MCU (Arduino Uno R3 Shield)
  for (const mcu of mcuComponents) {
    const fpId = "module:arduino-uno-r3";
    const fpDef = getFootprintDefinition(fpId) ?? FOOTPRINT_CATALOG[fpId];
    if (fpDef) {
      footprintsUsed.set(fpDef.id, fpDef);
      const placement: Placement = {
        componentId: mcu.id,
        footprintId: fpDef.id,
        x: 0,
        y: 0,
        rotation: 0,
        side: "top",
      };
      placedEntities.push({
        componentId: mcu.id,
        footprint: fpDef,
        placement,
        courtyardWorld: fpDef.courtyard,
      });
    }
  }

  // 3. Deterministic component ordering:
  // Decoupling capacitor placed first near power rails, followed by peripheral clusters
  const kindPriority: Record<string, number> = {
    capacitor: 1,
    resistor: 2,
    led: 3,
    sensor: 4,
    potentiometer: 5,
    servo: 6,
    module: 7,
    motor: 8,
    buzzer: 9,
    button: 10,
  };

  discreteComponents.sort((a, b) => {
    if (a.id === "C_DECOUPLING") return -1;
    if (b.id === "C_DECOUPLING") return 1;
    const prioA = kindPriority[a.kind] ?? 50;
    const prioB = kindPriority[b.kind] ?? 50;
    if (prioA !== prioB) return prioA - prioB;
    return a.id.localeCompare(b.id);
  });

  const isPowerNet = (id: string) =>
    id === "5V" || id === "3V3" || id === "VIN" || id === "GND" || id.startsWith("GND");

  // Helper: map a component's connected nets to already placed pad locations
  function getConnectedNets(comp: Component): {
    netId: string;
    isPower: boolean;
    points: Point[];
    peerCompIds: string[];
  }[] {
    const netTargets: {
      netId: string;
      isPower: boolean;
      points: Point[];
      peerCompIds: string[];
    }[] = [];

    for (const net of circuit.nets) {
      const portIds = net.portIds ?? [];
      const isConnected = portIds.some(
        (pid) => pid === comp.id || pid.startsWith(`${comp.id}.`) || pid.startsWith(`${comp.id}:`),
      );
      if (!isConnected) continue;

      const isPower = isPowerNet(net.id);
      const points: Point[] = [];
      const peerCompIds: string[] = [];

      for (const pid of portIds) {
        if (pid === comp.id || pid.startsWith(`${comp.id}.`) || pid.startsWith(`${comp.id}:`)) {
          continue;
        }

        const dotIdx = pid.indexOf(".") > 0 ? pid.indexOf(".") : pid.indexOf(":");
        if (dotIdx <= 0) continue;
        const otherCompId = pid.substring(0, dotIdx);
        const otherPortName = pid.substring(dotIdx + 1);
        peerCompIds.push(otherCompId);

        const placed = placedEntities.find((e) => e.componentId === otherCompId);
        if (!placed) continue;

        const compPinMap = pinMaps.get(otherCompId);
        let padNum = compPinMap ? compPinMap[otherPortName] : undefined;
        if (!padNum) padNum = otherPortName;

        const pad = placed.footprint.pads.find((p) => p.number === padNum);
        if (pad) {
          points.push(
            transformPoint(
              { x: pad.x, y: pad.y },
              placed.placement.x,
              placed.placement.y,
              placed.placement.rotation,
            ),
          );
        }
      }

      if (points.length > 0) {
        netTargets.push({ netId: net.id, isPower, points, peerCompIds });
      }
    }
    return netTargets;
  }

  // 4. Place discrete components sequentially
  // Candidate orientations to test
  const rotations = [0, 90, 180, 270];

  for (const comp of discreteComponents) {
    const { fpId } = resolvePartAndFootprint(comp);

    const fpDef = fpId ? (getFootprintDefinition(fpId) ?? FOOTPRINT_CATALOG[fpId]) : undefined;
    if (!fpDef) {
      unplacedIds.push(comp.id);
      continue;
    }
    footprintsUsed.set(fpDef.id, fpDef);

    const baseCourtyard = getFootprintCourtyard(fpDef);
    const connectedNets = getConnectedNets(comp);

    let bestPlacement: Placement | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
    let bestCourtyardWorld: Point[] = [];

    // Search grid inside board bounding box
    const startX = Math.ceil((boardBb.minX + edgeClearanceMm) / gridMm) * gridMm;
    const endX = Math.floor((boardBb.maxX - edgeClearanceMm) / gridMm) * gridMm;
    const startY = Math.ceil((boardBb.minY + edgeClearanceMm) / gridMm) * gridMm;
    const endY = Math.floor((boardBb.maxY - edgeClearanceMm) / gridMm) * gridMm;

    for (let x = startX; x <= endX; x += gridMm) {
      for (let y = startY; y <= endY; y += gridMm) {
        for (const rot of rotations) {
          const worldCourtyard = transformPolygon(baseCourtyard, x, y, rot);

          // Check 1: Must be completely contained in board outline
          if (!isPolygonContained(worldCourtyard, boardOutline)) {
            continue;
          }

          // Check 2: Must not intersect keepout areas
          let hitKeepout = false;
          for (const ko of keepouts) {
            if (polygonsIntersect(worldCourtyard, ko.polygon)) {
              hitKeepout = true;
              break;
            }
          }
          if (hitKeepout) continue;

          // Check 3: Must not overlap already placed components (with courtyard clearance)
          let overlapsPlaced = false;
          const expandedCand = expandPolygon(worldCourtyard, courtyardClearanceMm / 2);

          for (const placed of placedEntities) {
            // If placed entity is Arduino Uno module, skip full shield collision
            // but check collision against its individual header pads/courtyards
            if (placed.footprint.id === "module:arduino-uno-r3") {
              // Check collision against shield header pads
              const headerMargin = 1.0;
              for (const pad of placed.footprint.pads) {
                const padCenter = transformPoint(
                  { x: pad.x, y: pad.y },
                  placed.placement.x,
                  placed.placement.y,
                  0,
                );
                const padBox: Point[] = [
                  {
                    x: padCenter.x - pad.w / 2 - headerMargin,
                    y: padCenter.y - pad.h / 2 - headerMargin,
                  },
                  {
                    x: padCenter.x + pad.w / 2 + headerMargin,
                    y: padCenter.y - pad.h / 2 - headerMargin,
                  },
                  {
                    x: padCenter.x + pad.w / 2 + headerMargin,
                    y: padCenter.y + pad.h / 2 + headerMargin,
                  },
                  {
                    x: padCenter.x - pad.w / 2 - headerMargin,
                    y: padCenter.y + pad.h / 2 + headerMargin,
                  },
                ];
                if (polygonsIntersect(worldCourtyard, padBox)) {
                  overlapsPlaced = true;
                  break;
                }
              }
              if (overlapsPlaced) break;
              continue;
            }

            const expandedPlaced = expandPolygon(placed.courtyardWorld, courtyardClearanceMm / 2);
            if (polygonsIntersect(expandedCand, expandedPlaced)) {
              overlapsPlaced = true;
              break;
            }
          }
          if (overlapsPlaced) continue;

          // Check 4: Cost / Scoring function
          // 1) Minimum distance to connected nets (signal nets weighted 4.0, power nets 1.0)
          let wireCost = 0;
          if (connectedNets.length > 0) {
            for (const nt of connectedNets) {
              let minD = Number.POSITIVE_INFINITY;
              for (const pt of nt.points) {
                const d = distance({ x, y }, pt);
                if (d < minD) minD = d;
              }
              const weight = nt.isPower ? 1.0 : 4.0;
              wireCost += minD * weight;
            }
          } else {
            // Default center gravity pull if no connected pins are placed yet
            const boardCenter = {
              x: (boardBb.minX + boardBb.maxX) / 2,
              y: (boardBb.minY + boardBb.maxY) / 2,
            };
            wireCost = distance({ x, y }, boardCenter);
          }

          // 2) Cluster proximity pull: strongly keep discrete components of the same peripheral cluster adjacent
          let clusterCost = 0;
          for (const nt of connectedNets) {
            if (!nt.isPower) {
              for (const peerId of nt.peerCompIds) {
                const peerPl = placedEntities.find(
                  (e) => e.componentId === peerId && e.footprint.id !== "module:arduino-uno-r3",
                );
                if (peerPl) {
                  clusterCost +=
                    distance({ x, y }, { x: peerPl.placement.x, y: peerPl.placement.y }) * 2.0;
                }
              }
            }
          }

          // Small tie-breaking penalty for non-zero rotations and edge positions
          const rotPenalty = rot === 0 ? 0 : rot === 90 ? 0.05 : 0.1;
          const score = wireCost + clusterCost + rotPenalty;

          if (score < bestScore) {
            bestScore = score;
            bestPlacement = {
              componentId: comp.id,
              footprintId: fpDef.id,
              x: Number(x.toFixed(3)),
              y: Number(y.toFixed(3)),
              rotation: rot,
              side: "top",
            };
            bestCourtyardWorld = worldCourtyard;
          }
        }
      }
    }

    if (bestPlacement) {
      placedEntities.push({
        componentId: comp.id,
        footprint: fpDef,
        placement: bestPlacement,
        courtyardWorld: bestCourtyardWorld,
      });
    } else {
      unplacedIds.push(comp.id);
      drcViolations.push({
        code: "ERR_UNPLACED_NO_SPACE",
        severity: "error",
        message: `Component '${comp.id}' (${comp.partNumber ?? comp.kind}): cannot be placed due to board congestion or collision`,
        componentId: comp.id,
      });
    }
  }

  // 5. Compute Ratsnest & Wirelength
  const placements = placedEntities.map((e) => e.placement);
  const { metrics, unrouted } = computeRatsnest(circuit, placements, footprintsUsed, pinMaps);

  // 6. Build standard PcbLayout model
  const board: PcbBoard = {
    outline: boardOutline,
    thicknessMm: 1.6,
    layers: 2,
  };

  const layout: PcbLayout = {
    schemaVersion: "0.1.0",
    circuitHash: hashCircuit(circuit),
    board,
    rules: DEFAULT_DESIGN_RULES,
    footprints: Array.from(footprintsUsed.values()),
    placements,
    traces: [],
    vias: [],
    silkscreen: [
      {
        kind: "text",
        text: "SKETCH2CIRCUIT PCB SYNTHESIS",
        x: 20.0,
        y: 25.0,
        fontSize: 1.5,
        layer: "top",
      },
    ],
    unplaced: unplacedIds,
    unrouted,
    drc: drcViolations,
  };

  return {
    layout,
    placedCount: placements.length,
    unplacedCount: unplacedIds.length,
    totalComponents: circuit.components.length,
    metrics,
  };
}
