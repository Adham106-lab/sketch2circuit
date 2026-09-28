/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Ratsnest generator & Minimum Spanning Tree wirelength metrics.
 */

import type { Circuit } from "@s2c/circuit-json";
import type { FootprintDef, Placement, Point, UnroutedConnection } from "@s2c/pcb-json";
import { distance, transformPoint } from "./geometry.js";
import type { RatsnestEdge, RatsnestMetrics } from "./types.js";

export interface PlacedPadLocation {
  padKey: string; // e.g. "R1.1" or "UNO1.D13"
  componentId: string;
  portName: string;
  padNumber: string;
  point: Point;
}

export interface PhysicalPadInstance {
  padNumber: string;
  padKey: string; // e.g. "SW1.1" or "SW1.1#1"
  point: Point;
}

export interface PlacedTerminal {
  terminalKey: string; // e.g. "SW1.1", "U1.D13"
  componentId: string;
  portName: string;
  padNumber: string;
  pads: PhysicalPadInstance[];
}

/**
 * Calculates absolute board coordinates for all component terminals and their physical pads.
 * Multi-pad terminals (such as tactile switch pins where multiple pads share a terminal number)
 * have all physical pad positions recorded under the terminal.
 */
export function calculateTerminalLocations(
  placements: Placement[],
  footprintsMap: Map<string, FootprintDef>,
  circuit: Circuit,
  pinMaps?: Map<string, Record<string, string>>,
): Map<string, PlacedTerminal> {
  const terminalMap = new Map<string, PlacedTerminal>();

  const placementMap = new Map<string, Placement>();
  for (const pl of placements) {
    placementMap.set(pl.componentId, pl);
  }

  for (const comp of circuit.components) {
    const pl = placementMap.get(comp.id);
    if (!pl) continue;

    const fp = footprintsMap.get(pl.footprintId);
    if (!fp) continue;

    const compPinMap = pinMaps?.get(comp.id);

    for (const port of comp.ports ?? []) {
      let padNumber = compPinMap ? compPinMap[port.name] : undefined;
      if (!padNumber) {
        padNumber = port.name;
      }

      // Find ALL pads matching this padNumber (e.g. tactile switch has two pads for '1' and two for '2')
      const matchingPads = fp.pads.filter((p) => p.number === padNumber);
      if (matchingPads.length === 0) continue;

      const physicalPads: PhysicalPadInstance[] = matchingPads.map((padDef, idx) => {
        const absPoint = transformPoint({ x: padDef.x, y: padDef.y }, pl.x, pl.y, pl.rotation);
        const padKey =
          matchingPads.length === 1
            ? `${comp.id}.${port.name}`
            : `${comp.id}.${port.name}#${idx + 1}`;
        return {
          padNumber,
          padKey,
          point: absPoint,
        };
      });

      const terminalKey = `${comp.id}.${port.name}`;
      terminalMap.set(terminalKey, {
        terminalKey,
        componentId: comp.id,
        portName: port.name,
        padNumber,
        pads: physicalPads,
      });
    }
  }

  return terminalMap;
}

/**
 * Calculates absolute board coordinates for all pads of placed components.
 */
export function calculatePadLocations(
  placements: Placement[],
  footprintsMap: Map<string, FootprintDef>,
  circuit: Circuit,
  pinMaps?: Map<string, Record<string, string>>,
): Map<string, PlacedPadLocation> {
  const terminalMap = calculateTerminalLocations(placements, footprintsMap, circuit, pinMaps);
  const padMap = new Map<string, PlacedPadLocation>();

  for (const [key, term] of terminalMap) {
    const primary = term.pads[0];
    if (primary) {
      padMap.set(key, {
        padKey: `${term.componentId}.${term.portName}`,
        componentId: term.componentId,
        portName: term.portName,
        padNumber: term.padNumber,
        point: primary.point,
      });
    }
  }

  return padMap;
}

/**
 * Computes Minimum Spanning Tree (MST) for a multi-pin net using Prim's algorithm.
 * Multi-pad terminals on the same component are treated as ONE terminal:
 * - NO MST edge is created between pads of the same terminal.
 * - When connecting to another terminal, the edge connects the nearest pad pair.
 */
function computeNetMst(netId: string, terminals: PlacedTerminal[]): RatsnestEdge[] {
  const n = terminals.length;
  if (n < 2) return [];

  function bestConnection(
    uIdx: number,
    vIdx: number,
  ): { dist: number; p: PhysicalPadInstance; q: PhysicalPadInstance } {
    const termU = terminals[uIdx];
    const termV = terminals[vIdx];
    if (!termU || !termV) {
      throw new Error(`Invalid terminal index ${uIdx} or ${vIdx}`);
    }
    let minD = Number.POSITIVE_INFINITY;
    let bestP = termU.pads[0]!;
    let bestQ = termV.pads[0]!;

    for (const p of termU.pads) {
      for (const q of termV.pads) {
        const d = distance(p.point, q.point);
        if (d < minD) {
          minD = d;
          bestP = p;
          bestQ = q;
        }
      }
    }
    return { dist: minD, p: bestP, q: bestQ };
  }

  if (n === 2) {
    const conn = bestConnection(0, 1);
    return [
      {
        netId,
        fromPad: conn.p.padKey,
        toPad: conn.q.padKey,
        fromPoint: conn.p.point,
        toPoint: conn.q.point,
        lengthMm: Number(conn.dist.toFixed(3)),
      },
    ];
  }

  // Prim's algorithm on terminals
  const edges: RatsnestEdge[] = [];
  const inMst = new Array<boolean>(n).fill(false);
  const minCost = new Array<number>(n).fill(Number.POSITIVE_INFINITY);
  const parent = new Array<number>(n).fill(-1);
  const bestEdgePad = new Array<{
    p: PhysicalPadInstance;
    q: PhysicalPadInstance;
  } | null>(n).fill(null);

  minCost[0] = 0;

  for (let step = 0; step < n; step++) {
    let u = -1;
    let bestCost = Number.POSITIVE_INFINITY;
    for (let i = 0; i < n; i++) {
      const cost = minCost[i] ?? Number.POSITIVE_INFINITY;
      if (!inMst[i] && cost < bestCost) {
        bestCost = cost;
        u = i;
      }
    }

    if (u === -1) break;
    inMst[u] = true;

    if (parent[u] !== -1 && bestEdgePad[u]) {
      const edgePads = bestEdgePad[u]!;
      edges.push({
        netId,
        fromPad: edgePads.p.padKey,
        toPad: edgePads.q.padKey,
        fromPoint: edgePads.p.point,
        toPoint: edgePads.q.point,
        lengthMm: Number(bestCost.toFixed(3)),
      });
    }

    // Update neighbors
    for (let v = 0; v < n; v++) {
      if (!inMst[v]) {
        const conn = bestConnection(u, v);
        const costV = minCost[v] ?? Number.POSITIVE_INFINITY;
        if (conn.dist < costV) {
          minCost[v] = conn.dist;
          parent[v] = u;
          bestEdgePad[v] = { p: conn.p, q: conn.q };
        }
      }
    }
  }

  return edges;
}

/**
 * Computes all ratsnest edges and total wirelength metric for a placed circuit.
 */
export function computeRatsnest(
  circuit: Circuit,
  placements: Placement[],
  footprintsMap: Map<string, FootprintDef>,
  pinMaps?: Map<string, Record<string, string>>,
): { metrics: RatsnestMetrics; unrouted: UnroutedConnection[] } {
  const terminalMap = calculateTerminalLocations(placements, footprintsMap, circuit, pinMaps);

  const allEdges: RatsnestEdge[] = [];
  const unroutedList: UnroutedConnection[] = [];

  for (const net of circuit.nets) {
    const netTerminals: PlacedTerminal[] = [];

    for (const portId of net.portIds ?? []) {
      const loc = terminalMap.get(portId);
      if (loc) {
        netTerminals.push(loc);
      } else {
        const dotIdx = portId.indexOf(".");
        if (dotIdx > 0) {
          const compId = portId.substring(0, dotIdx);
          const portName = portId.substring(dotIdx + 1);
          const l = terminalMap.get(`${compId}.${portName}`);
          if (l) netTerminals.push(l);
        }
      }
    }

    if (netTerminals.length < 2) continue;

    // Sort deterministically before MST
    netTerminals.sort((a, b) => a.terminalKey.localeCompare(b.terminalKey));

    const netEdges = computeNetMst(net.id, netTerminals);
    for (const e of netEdges) {
      allEdges.push(e);
      unroutedList.push({
        netId: net.id,
        from: e.fromPad,
        to: e.toPad,
      });
    }
  }

  // Sort edges deterministically
  allEdges.sort((a, b) => {
    const c = a.netId.localeCompare(b.netId);
    if (c !== 0) return c;
    return a.fromPad.localeCompare(b.fromPad);
  });

  const totalWirelengthMm = Number(allEdges.reduce((sum, e) => sum + e.lengthMm, 0).toFixed(3));

  return {
    metrics: {
      totalWirelengthMm,
      edgeCount: allEdges.length,
      edges: allEdges,
    },
    unrouted: unroutedList,
  };
}
