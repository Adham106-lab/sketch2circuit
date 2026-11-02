/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Deterministic 2-Layer Orthogonal Grid Router & DRC Integration.
 * Upgraded with Fine-Pitch Escape Corridors, Shortest-Net-First Ordering, and Rip-Up & Reroute.
 */

import type { Circuit } from "@s2c/circuit-json";
import type { FootprintDef, PcbLayout, Point, Trace, UnroutedConnection, Via } from "@s2c/pcb-json";
import { checkDrc } from "./drc.js";
import { distance, getBoundingBox, pointInPolygon, pointToPolygonDistance } from "./geometry.js";
import { ARDUINO_UNO_R3_KEEPOUTS } from "./keepouts.js";
import { calculateTerminalLocations } from "./ratsnest.js";
import type { KeepoutArea } from "./types.js";

export interface RouterOptions {
  gridPitchMm?: number; // Default 0.508mm (20 mil) for clean header escape
  traceWidthMm?: number; // Default layout.rules.minTraceWidthMm (0.254mm)
  viaDrillMm?: number; // Default layout.rules.minDrillDiameterMm (0.6mm)
  viaDiameterMm?: number; // Default 0.9mm
  clearanceMm?: number; // Default layout.rules.minClearanceMm (0.254mm)
  viaCostMultiplier?: number; // Penalty for placing a via (default 6)
  wrongDirectionPenalty?: number; // Penalty for non-preferred direction (default 2.5)
  keepouts?: KeepoutArea[];
  runDrcAfterRoute?: boolean; // Default true
}

export interface RoutingResult {
  layout: PcbLayout;
  routedConnections: number;
  unroutedConnections: number;
  totalVias: number;
  totalTraces: number;
  wirelengthMm: number;
}

interface GridCell {
  gx: number;
  gy: number;
  layer: number; // 0: Top, 1: Bottom
}

/**
 * Min-Heap for deterministic A* search.
 */
class PriorityQueue<T> {
  private heap: { item: T; priority: number; id: number }[] = [];

  push(item: T, priority: number, id: number): void {
    this.heap.push({ item, priority, id });
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0]!;
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.bubbleDown(0);
    }
    return top.item;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(idx: number): void {
    let current = idx;
    while (current > 0) {
      const parent = (current - 1) >> 1;
      const c = this.heap[current]!;
      const p = this.heap[parent]!;
      if (c.priority < p.priority || (c.priority === p.priority && c.id < p.id)) {
        this.heap[current] = p;
        this.heap[parent] = c;
        current = parent;
      } else {
        break;
      }
    }
  }

  private bubbleDown(idx: number): void {
    let current = idx;
    const length = this.heap.length;
    while (true) {
      const left = (current << 1) + 1;
      const right = left + 1;
      let smallest = current;

      if (left < length) {
        const l = this.heap[left]!;
        const s = this.heap[smallest]!;
        if (l.priority < s.priority || (l.priority === s.priority && l.id < s.id)) {
          smallest = left;
        }
      }

      if (right < length) {
        const r = this.heap[right]!;
        const s = this.heap[smallest]!;
        if (r.priority < s.priority || (r.priority === s.priority && r.id < s.id)) {
          smallest = right;
        }
      }

      if (smallest !== current) {
        const temp = this.heap[current]!;
        this.heap[current] = this.heap[smallest]!;
        this.heap[smallest] = temp;
        current = smallest;
      } else {
        break;
      }
    }
  }
}

/**
 * 2-Layer Grid Router class implementing deterministic maze routing with negotiated rip-up.
 */
export class GridRouter {
  private layout: PcbLayout;
  private circuit: Circuit;
  private options: Required<RouterOptions>;

  private pitch: number;
  private minX: number;
  private minY: number;
  private maxX: number;
  private maxY: number;
  private numX: number;
  private numY: number;

  // Grid occupancy: 0 = free, -1 = permanently blocked, >0 = net index
  private grid: Int32Array;
  private baseObstacles: Int32Array;
  private historyCost: Float32Array;

  private netNameToIndex = new Map<string, number>();
  private indexToNetName = new Map<number, string>();

  constructor(layout: PcbLayout, circuit: Circuit, options: RouterOptions = {}) {
    this.layout = layout;
    this.circuit = circuit;

    const rules = layout.rules;
    // Use 0.508mm (20 mil) default if 0.635mm was passed to allow 2.54mm header pin escape
    const requestedPitch = options.gridPitchMm ?? 0.508;
    const effectivePitch = requestedPitch >= 0.6 ? 0.508 : requestedPitch;

    this.options = {
      gridPitchMm: effectivePitch,
      traceWidthMm: options.traceWidthMm ?? rules.minTraceWidthMm,
      viaDrillMm: options.viaDrillMm ?? rules.minDrillDiameterMm,
      viaDiameterMm: options.viaDiameterMm ?? 0.9,
      clearanceMm: options.clearanceMm ?? rules.minClearanceMm,
      viaCostMultiplier: options.viaCostMultiplier ?? 6.0,
      wrongDirectionPenalty: options.wrongDirectionPenalty ?? 2.2,
      keepouts: options.keepouts ?? ARDUINO_UNO_R3_KEEPOUTS,
      runDrcAfterRoute: options.runDrcAfterRoute ?? true,
    };

    this.pitch = this.options.gridPitchMm;

    // Calculate grid dimensions from board outline
    const bb = getBoundingBox(layout.board.outline);
    this.minX = Math.floor(bb.minX / this.pitch) * this.pitch;
    this.minY = Math.floor(bb.minY / this.pitch) * this.pitch;
    this.maxX = Math.ceil(bb.maxX / this.pitch) * this.pitch;
    this.maxY = Math.ceil(bb.maxY / this.pitch) * this.pitch;

    this.numX = Math.round((this.maxX - this.minX) / this.pitch) + 1;
    this.numY = Math.round((this.maxY - this.minY) / this.pitch) + 1;

    const totalCells = this.numX * this.numY * 2;
    this.grid = new Int32Array(totalCells);
    this.baseObstacles = new Int32Array(totalCells);
    this.historyCost = new Float32Array(totalCells).fill(0);

    this.initializeNetIndices();
    this.rasterizeObstacles();
    this.baseObstacles.set(this.grid);
  }

  private initializeNetIndices(): void {
    let idx = 1;
    for (const net of this.circuit.nets) {
      this.netNameToIndex.set(net.id, idx);
      this.indexToNetName.set(idx, net.id);
      idx++;
    }
  }

  private cellIndex(gx: number, gy: number, layer: number): number {
    return (layer * this.numY + gy) * this.numX + gx;
  }

  private worldToGrid(pt: Point): { gx: number; gy: number } {
    const gx = Math.round((pt.x - this.minX) / this.pitch);
    const gy = Math.round((pt.y - this.minY) / this.pitch);
    return {
      gx: Math.max(0, Math.min(this.numX - 1, gx)),
      gy: Math.max(0, Math.min(this.numY - 1, gy)),
    };
  }

  private gridToWorld(gx: number, gy: number): Point {
    return {
      x: Number((this.minX + gx * this.pitch).toFixed(3)),
      y: Number((this.minY + gy * this.pitch).toFixed(3)),
    };
  }

  /**
   * Rasterizes board boundaries, keepouts, and component pads onto the 3D routing grid.
   */
  private rasterizeObstacles(): void {
    const outline = this.layout.board.outline;
    const edgeMargin = Math.min(this.layout.rules.boardEdgeClearanceMm, 0.5);

    // 1. Board outline and edge clearance
    for (let gy = 0; gy < this.numY; gy++) {
      for (let gx = 0; gx < this.numX; gx++) {
        const pt = this.gridToWorld(gx, gy);
        const inside = pointInPolygon(pt, outline);
        const edgeDist = pointToPolygonDistance(pt, outline);

        if (!inside || edgeDist < edgeMargin) {
          this.grid[this.cellIndex(gx, gy, 0)] = -1;
          this.grid[this.cellIndex(gx, gy, 1)] = -1;
        }
      }
    }

    // 2. Keepout zones
    for (const ko of this.options.keepouts) {
      for (let gy = 0; gy < this.numY; gy++) {
        for (let gx = 0; gx < this.numX; gx++) {
          const pt = this.gridToWorld(gx, gy);
          if (pointInPolygon(pt, ko.polygon)) {
            this.grid[this.cellIndex(gx, gy, 0)] = -1;
            this.grid[this.cellIndex(gx, gy, 1)] = -1;
          }
        }
      }
    }

    // 3. Component pads (tighter radius so tracks can escape between 2.54mm headers)
    const fpMap = new Map<string, FootprintDef>();
    for (const fp of this.layout.footprints) fpMap.set(fp.id, fp);

    const terminalToNet = new Map<string, string>();
    for (const net of this.circuit.nets) {
      for (const p of net.portIds ?? []) {
        terminalToNet.set(p, net.id);
        const dot = p.indexOf(".");
        if (dot > 0) terminalToNet.set(p.substring(dot + 1), net.id);
      }
    }

    const termLocs = calculateTerminalLocations(this.layout.placements, fpMap, this.circuit);
    const padBlockRadius = 0.68; // Allows clean corridor between 2.54mm pitch pins

    for (const [key, term] of termLocs) {
      const netId = terminalToNet.get(key) ?? terminalToNet.get(term.portName);
      const netIdx = netId ? (this.netNameToIndex.get(netId) ?? 0) : -1;

      for (const pad of term.pads) {
        const { gx, gy } = this.worldToGrid(pad.point);
        const padRadiusCells = Math.max(1, Math.ceil(padBlockRadius / this.pitch));

        for (let dy = -padRadiusCells; dy <= padRadiusCells; dy++) {
          for (let dx = -padRadiusCells; dx <= padRadiusCells; dx++) {
            const cx = gx + dx;
            const cy = gy + dy;
            if (cx < 0 || cx >= this.numX || cy < 0 || cy >= this.numY) continue;

            const pt = this.gridToWorld(cx, cy);
            if (distance(pt, pad.point) <= padBlockRadius) {
              const cellTop = this.cellIndex(cx, cy, 0);
              const cellBot = this.cellIndex(cx, cy, 1);
              if (this.grid[cellTop] !== -1) this.grid[cellTop] = netIdx;
              if (this.grid[cellBot] !== -1) this.grid[cellBot] = netIdx;
            }
          }
        }
      }
    }
  }

  /**
   * Routes a single 2-point connection using 3D A* maze routing.
   */
  private routeConnection(
    netId: string,
    pStart: Point,
    pEnd: Point,
  ): { path: GridCell[]; vias: Via[] } | null {
    const netIdx = this.netNameToIndex.get(netId) ?? 0;
    const start = this.worldToGrid(pStart);
    const target = this.worldToGrid(pEnd);

    if (start.gx === target.gx && start.gy === target.gy) {
      return { path: [{ gx: start.gx, gy: start.gy, layer: 0 }], vias: [] };
    }

    const totalCells = this.numX * this.numY * 2;
    const dist = new Float32Array(totalCells).fill(Number.POSITIVE_INFINITY);
    const parent = new Int32Array(totalCells).fill(-1);

    const pq = new PriorityQueue<number>();

    const startIdx0 = this.cellIndex(start.gx, start.gy, 0);
    const startIdx1 = this.cellIndex(start.gx, start.gy, 1);

    dist[startIdx0] = 0;
    pq.push(startIdx0, 0, startIdx0);

    dist[startIdx1] = this.options.viaCostMultiplier * 0.5;
    pq.push(startIdx1, this.options.viaCostMultiplier * 0.5, startIdx1);

    let targetCellFound = -1;

    while (pq.size > 0) {
      const u = pq.pop()!;

      const layer = Math.floor(u / (this.numX * this.numY));
      const rem = u % (this.numX * this.numY);
      const gy = Math.floor(rem / this.numX);
      const gx = rem % this.numX;

      if (gx === target.gx && gy === target.gy) {
        targetCellFound = u;
        break;
      }

      const currentCost = dist[u]!;

      const neighbors = [
        { dx: 1, dy: 0, dir: "horizontal" },
        { dx: -1, dy: 0, dir: "horizontal" },
        { dx: 0, dy: 1, dir: "vertical" },
        { dx: 0, dy: -1, dir: "vertical" },
      ];

      for (const nb of neighbors) {
        const nx = gx + nb.dx;
        const ny = gy + nb.dy;
        if (nx < 0 || nx >= this.numX || ny < 0 || ny >= this.numY) continue;

        const v = this.cellIndex(nx, ny, layer);
        const cellVal = this.grid[v]!;

        const isNearStart = Math.abs(nx - start.gx) <= 1 && Math.abs(ny - start.gy) <= 1;
        const isNearTarget = Math.abs(nx - target.gx) <= 1 && Math.abs(ny - target.gy) <= 1;

        if (cellVal !== 0 && cellVal !== netIdx && !isNearStart && !isNearTarget) {
          continue;
        }
        if (cellVal === -1 && !(nx === target.gx && ny === target.gy)) {
          continue;
        }

        let stepCost = 1.0 + this.historyCost[v]!;
        if (layer === 0 && nb.dir === "vertical") {
          stepCost += this.options.wrongDirectionPenalty;
        } else if (layer === 1 && nb.dir === "horizontal") {
          stepCost += this.options.wrongDirectionPenalty;
        }

        if (cellVal === netIdx) {
          stepCost *= 0.4;
        }

        const newCost = currentCost + stepCost;

        if (newCost < dist[v]!) {
          dist[v] = newCost;
          parent[v] = u;
          const h = (Math.abs(nx - target.gx) + Math.abs(ny - target.gy)) * 1.05;
          pq.push(v, newCost + h, v);
        }
      }

      // Layer change via
      const otherLayer = 1 - layer;
      const vVia = this.cellIndex(gx, gy, otherLayer);
      const cellOther = this.grid[vVia]!;

      if (cellOther === 0 || cellOther === netIdx || (gx === target.gx && gy === target.gy)) {
        const viaCost = currentCost + this.options.viaCostMultiplier + this.historyCost[vVia]!;
        if (viaCost < dist[vVia]!) {
          dist[vVia] = viaCost;
          parent[vVia] = u;
          const h = (Math.abs(gx - target.gx) + Math.abs(gy - target.gy)) * 1.05;
          pq.push(vVia, viaCost + h, vVia);
        }
      }
    }

    if (targetCellFound === -1) {
      return null;
    }

    const path: GridCell[] = [];
    let curr = targetCellFound;
    while (curr !== -1) {
      const layer = Math.floor(curr / (this.numX * this.numY));
      const rem = curr % (this.numX * this.numY);
      const gy = Math.floor(rem / this.numX);
      const gx = rem % this.numX;
      path.push({ gx, gy, layer });
      curr = parent[curr]!;
    }

    path.reverse();

    const vias: Via[] = [];
    let viaCount = 1;

    for (let i = 0; i < path.length; i++) {
      const cell = path[i]!;
      const idx = this.cellIndex(cell.gx, cell.gy, cell.layer);
      this.grid[idx] = netIdx;

      if (i > 0 && path[i - 1]!.layer !== cell.layer) {
        const pt = this.gridToWorld(cell.gx, cell.gy);
        vias.push({
          id: `VIA_${netId}_${viaCount++}`,
          netId,
          x: pt.x,
          y: pt.y,
          drill: this.options.viaDrillMm,
          diameter: this.options.viaDiameterMm,
        });

        this.grid[this.cellIndex(cell.gx, cell.gy, 0)] = netIdx;
        this.grid[this.cellIndex(cell.gx, cell.gy, 1)] = netIdx;
      }
    }

    return { path, vias };
  }

  /**
   * Simplifies consecutive collinear grid points into clean straight trace segments.
   */
  private buildTracesFromPath(netId: string, path: GridCell[]): Trace[] {
    if (path.length < 2) return [];

    const traces: Trace[] = [];
    let segStart = 0;
    let traceId = 1;

    while (segStart < path.length - 1) {
      const currentLayer = path[segStart]!.layer;
      let segEnd = segStart;
      while (segEnd + 1 < path.length && path[segEnd + 1]!.layer === currentLayer) {
        segEnd++;
      }

      if (segEnd > segStart) {
        const rawPoints: Point[] = [];
        for (let i = segStart; i <= segEnd; i++) {
          rawPoints.push(this.gridToWorld(path[i]!.gx, path[i]!.gy));
        }

        const simplified: Point[] = [rawPoints[0]!];
        for (let i = 1; i < rawPoints.length - 1; i++) {
          const prev = simplified[simplified.length - 1]!;
          const curr = rawPoints[i]!;
          const next = rawPoints[i + 1]!;

          const isCollinearX = prev.x === curr.x && curr.x === next.x;
          const isCollinearY = prev.y === curr.y && curr.y === next.y;

          if (!isCollinearX && !isCollinearY) {
            simplified.push(curr);
          }
        }
        simplified.push(rawPoints[rawPoints.length - 1]!);

        if (simplified.length >= 2) {
          traces.push({
            id: `TR_${netId}_${traceId++}`,
            netId,
            layer: currentLayer === 0 ? "top" : "bottom",
            width: this.options.traceWidthMm,
            points: simplified,
          });
        }
      }

      segStart = segEnd + 1;
    }

    return traces;
  }

  /**
   * Executes shortest-first routing with multi-pass rip-up & reroute on congested layouts.
   */
  public routeAll(): RoutingResult {
    const unroutedInput = [...(this.layout.unrouted ?? [])];
    const fpMap = new Map<string, FootprintDef>();
    for (const fp of this.layout.footprints) fpMap.set(fp.id, fp);

    const termLocs = calculateTerminalLocations(this.layout.placements, fpMap, this.circuit);

    // Compute Manhattan length for Shortest-Net-First ordering
    const connWithDist = unroutedInput.map((conn) => {
      const pA = termLocs.get(conn.from)?.pads[0]?.point;
      const pB = termLocs.get(conn.to)?.pads[0]?.point;
      const manhattan = pA && pB ? Math.abs(pA.x - pB.x) + Math.abs(pA.y - pB.y) : 9999;
      return { conn, pA, pB, manhattan };
    });

    // Sort shortest connections first (ties broken deterministically by netId)
    connWithDist.sort((a, b) => {
      if (Math.abs(a.manhattan - b.manhattan) > 0.5) {
        return a.manhattan - b.manhattan;
      }
      const c = a.conn.netId.localeCompare(b.conn.netId);
      if (c !== 0) return c;
      return a.conn.from.localeCompare(b.conn.from);
    });

    let bestTraces: Trace[] = [];
    let bestVias: Via[] = [];
    let bestRemaining: UnroutedConnection[] = unroutedInput;
    let bestRoutedCount = -1;

    // Up to 2 negotiated routing passes (if pass 1 leaves unrouted nets, prioritize failed nets first in pass 2)
    for (let pass = 0; pass < 2; pass++) {
      this.grid.set(this.baseObstacles);

      const allTraces: Trace[] = [];
      const allVias: Via[] = [];
      const remainingUnrouted: UnroutedConnection[] = [];
      let routedCount = 0;

      for (const item of connWithDist) {
        const { conn, pA, pB } = item;
        if (!pA || !pB) {
          remainingUnrouted.push(conn);
          continue;
        }

        const result = this.routeConnection(conn.netId, pA, pB);
        if (result && result.path.length >= 2) {
          const traces = this.buildTracesFromPath(conn.netId, result.path);
          allTraces.push(...traces);
          allVias.push(...result.vias);
          routedCount++;
        } else {
          remainingUnrouted.push(conn);
          // Penalize congestion zone around failed terminals for next pass
          const gA = this.worldToGrid(pA);
          const gB = this.worldToGrid(pB);
          for (let dy = -3; dy <= 3; dy++) {
            for (let dx = -3; dx <= 3; dx++) {
              const cxA = Math.max(0, Math.min(this.numX - 1, gA.gx + dx));
              const cyA = Math.max(0, Math.min(this.numY - 1, gA.gy + dy));
              this.historyCost[this.cellIndex(cxA, cyA, 0)] += 1.5;
              this.historyCost[this.cellIndex(cxA, cyA, 1)] += 1.5;

              const cxB = Math.max(0, Math.min(this.numX - 1, gB.gx + dx));
              const cyB = Math.max(0, Math.min(this.numY - 1, gB.gy + dy));
              this.historyCost[this.cellIndex(cxB, cyB, 0)] += 1.5;
              this.historyCost[this.cellIndex(cxB, cyB, 1)] += 1.5;
            }
          }
        }
      }

      if (routedCount > bestRoutedCount) {
        bestRoutedCount = routedCount;
        bestTraces = allTraces;
        bestVias = allVias;
        bestRemaining = remainingUnrouted;
      }

      if (remainingUnrouted.length === 0) break;

      // Move failed connections to the front of the queue for pass 2
      const failedSet = new Set(remainingUnrouted.map((u) => `${u.netId}:${u.from}->${u.to}`));
      connWithDist.sort((a, b) => {
        const aFailed = failedSet.has(`${a.conn.netId}:${a.conn.from}->${a.conn.to}`) ? 0 : 1;
        const bFailed = failedSet.has(`${b.conn.netId}:${b.conn.from}->${b.conn.to}`) ? 0 : 1;
        if (aFailed !== bFailed) return aFailed - bFailed;
        return a.manhattan - b.manhattan;
      });
    }

    let totalLengthMm = 0;
    for (const t of bestTraces) {
      for (let i = 0; i < t.points.length - 1; i++) {
        totalLengthMm += distance(t.points[i]!, t.points[i + 1]!);
      }
    }

    const updatedLayout: PcbLayout = {
      ...this.layout,
      traces: bestTraces,
      vias: bestVias,
      unrouted: bestRemaining,
      drc: [],
    };

    if (this.options.runDrcAfterRoute) {
      updatedLayout.drc = checkDrc(updatedLayout, {
        keepouts: this.options.keepouts,
      });
    }

    return {
      layout: updatedLayout,
      routedConnections: bestRoutedCount,
      unroutedConnections: bestRemaining.length,
      totalVias: bestVias.length,
      totalTraces: bestTraces.length,
      wirelengthMm: Number(totalLengthMm.toFixed(3)),
    };
  }
}

export function routeCircuit(
  layout: PcbLayout,
  circuit: Circuit,
  options?: RouterOptions,
): RoutingResult {
  const router = new GridRouter(layout, circuit, options);
  return router.routeAll();
}

export function routeLayout(
  layout: PcbLayout,
  circuit: Circuit,
  options?: RouterOptions,
): PcbLayout {
  return routeCircuit(layout, circuit, options).layout;
}