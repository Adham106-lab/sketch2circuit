/**
 * @license Apache-2.0
 * @s2c/pcb-layout — M12 2D PCB SVG Renderer.
 * High-fidelity vector visualization for 2-layer PCBs:
 * - Black canvas, green grid, origin crosshair
 * - Top copper (red), bottom copper (blue), vias (amber/drill)
 * - Pads (magenta with drill), silkscreen (yellow with refdes)
 * - Ratsnest (dashed lines for unrouted connections)
 * - DRC violation markers (red diamonds at exact failure coordinates)
 * - Net highlighting & interactive metadata
 */

import type { Circuit } from "@s2c/circuit-json";
import type { FootprintDef, PcbLayout, Point, Trace, Via } from "@s2c/pcb-json";
import { distance, getBoundingBox, transformPoint, transformPolygon } from "./geometry.js";
import { ARDUINO_UNO_R3_KEEPOUTS } from "./keepouts.js";
import { calculateTerminalLocations, computeRatsnest } from "./ratsnest.js";
import type { KeepoutArea } from "./types.js";

export interface PcbRenderOptions {
  theme?: "dark" | "light"; // Default "dark" (authentic PCB CAD black canvas)
  showGrid?: boolean; // Default true
  gridPitchMm?: number; // Default 2.54mm (0.1 in)
  showOriginCrosshair?: boolean; // Default true
  showBoardOutline?: boolean; // Default true
  showTopCopper?: boolean; // Default true (Red)
  showBottomCopper?: boolean; // Default true (Blue)
  showPads?: boolean; // Default true (Magenta)
  showVias?: boolean; // Default true (Amber)
  showSilkscreen?: boolean; // Default true (Yellow)
  showRatsnest?: boolean; // Default true (Dashed cyan)
  showDrcMarkers?: boolean; // Default true (Red diamonds)
  showKeepouts?: boolean; // Default true (Hatched orange)
  highlightNet?: string; // If set, highlights this net and dims others
  activeLayer?: "all" | "top" | "bottom"; // Layer filtering
  marginMm?: number; // Default 6.0 mm padding around board
  routedConnections?: number; // Optional explicit count from router
  totalConnections?: number; // Optional explicit count from placement
}

export interface PcbRenderResult {
  svg: string;
  width: number;
  height: number;
  viewBox: string;
  stats: {
    totalConnections: number;
    routedConnections: number;
    unroutedConnections: number;
    completionRatePercent: number;
    totalTraces: number;
    totalVias: number;
    wirelengthMm: number;
    drcErrorCount: number;
    drcWarningCount: number;
    drcBreakdown: Record<string, number>;
  };
}

function buildDefaultPinMaps(circuit: Circuit): Map<string, Record<string, string>> {
  const pinMaps = new Map<string, Record<string, string>>();
  for (const comp of circuit.components) {
    if (comp.kind === "led" || comp.kind === "diode") {
      pinMaps.set(comp.id, { A: "2", K: "1" });
    } else if (comp.kind === "capacitor") {
      if (comp.partNumber === "CAP-ELECTRO") pinMaps.set(comp.id, { "+": "+", "-": "-" });
      else pinMaps.set(comp.id, { "1": "1", "2": "2" });
    } else if (comp.kind === "button" || comp.id.startsWith("SW")) {
      pinMaps.set(comp.id, { "1": "1", "2": "2" });
    } else if (comp.kind === "transistor") {
      pinMaps.set(comp.id, { E: "1", B: "2", C: "3" });
    } else if (comp.kind === "potentiometer" || comp.id.startsWith("POT")) {
      pinMaps.set(comp.id, { "1": "1", "2": "2", "3": "3" });
    } else if (
      comp.kind === "buzzer" ||
      (comp.kind as string) === "piezo" ||
      comp.id.startsWith("SPK")
    ) {
      pinMaps.set(comp.id, { "+": "+", "-": "-" });
    } else if (comp.partNumber === "HC-SR04" || comp.id === "SENSOR1") {
      pinMaps.set(comp.id, { VCC: "VCC", TRIG: "TRIG", ECHO: "ECHO", GND: "GND" });
    } else if (comp.kind === "sensor" || comp.id.startsWith("LDR")) {
      pinMaps.set(comp.id, { "1": "1", "2": "2" });
    } else if (
      (comp.kind as string) === "servo" ||
      comp.partNumber === "SG90" ||
      comp.id.startsWith("SERVO")
    ) {
      pinMaps.set(comp.id, { PWM: "1", VCC: "2", GND: "3" });
    } else if ((comp.kind as string) === "motor" || comp.id.startsWith("M")) {
      pinMaps.set(comp.id, { "+": "1", "-": "2" });
    }
  }
  return pinMaps;
}

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function renderPcbSvg(
  layout: PcbLayout,
  circuit?: Circuit,
  options: PcbRenderOptions = {},
): PcbRenderResult {
  const showGrid = options.showGrid ?? true;
  const gridPitch = options.gridPitchMm ?? 2.54;
  const showOriginCrosshair = options.showOriginCrosshair ?? true;
  const showBoardOutline = options.showBoardOutline ?? true;
  const showTopCopper = options.showTopCopper ?? true;
  const showBottomCopper = options.showBottomCopper ?? true;
  const showPads = options.showPads ?? true;
  const showVias = options.showVias ?? true;
  const showSilkscreen = options.showSilkscreen ?? true;
  const showRatsnest = options.showRatsnest ?? true;
  const showDrcMarkers = options.showDrcMarkers ?? true;
  const showKeepouts = options.showKeepouts ?? true;
  const highlightNet = options.highlightNet;
  const margin = options.marginMm ?? 6.0;

  // Board outline bounding box
  const outline = layout.board.outline;
  const bb = getBoundingBox(outline);
  const minX = Math.min(-margin, bb.minX - margin);
  const minY = Math.min(-margin, bb.minY - margin);
  const maxX = Math.max(bb.maxX + margin, 10);
  const maxY = Math.max(bb.maxY + margin, 10);

  const viewWidth = Number((maxX - minX).toFixed(2));
  const viewHeight = Number((maxY - minY).toFixed(2));
  const viewBox = `${minX.toFixed(2)} ${minY.toFixed(2)} ${viewWidth} ${viewHeight}`;

  // Color Palette per specification:
  // - Black canvas
  // - Green grid
  // - Origin crosshair green/cyan
  // - Top copper: Red (#ef4444)
  // - Bottom copper: Blue (#3b82f6)
  // - Pads: Magenta (#d946ef)
  // - Vias: Amber ring (#f59e0b) with dark drill
  // - Silkscreen: Yellow (#eab308)
  // - Ratsnest: Dashed Cyan (#06b6d4)
  // - DRC Markers: Red diamonds (#dc2626)
  const colors = {
    canvasBg: "#050505",
    boardSubstrate: "#0a110a",
    boardEdge: "#15803d",
    gridDot: "#166534",
    gridLine: "#14532d",
    crosshair: "#22c55e",
    topCopper: "#ef4444",
    bottomCopper: "#3b82f6",
    padMagenta: "#d946ef",
    padDrill: "#050505",
    viaRing: "#f59e0b",
    viaDrill: "#050505",
    silkscreen: "#facc15",
    ratsnest: "#06b6d4",
    drcMarker: "#dc2626",
    drcBorder: "#ffffff",
    keepoutFill: "rgba(234, 88, 12, 0.15)",
    keepoutStroke: "#ea580c",
  };

  // Footprints Map and Placements Map
  const fpMap = new Map<string, FootprintDef>();
  for (const fp of layout.footprints) {
    fpMap.set(fp.id, fp);
  }

  const plMap = new Map<string, Placement>();
  for (const pl of layout.placements) {
    plMap.set(pl.componentId, pl);
  }

  // Pre-calculate terminal points for ratsnest lines with full pin alias support
  const resolveTerminalPoint = (termStr: string): Point | undefined => {
    const dot = termStr.indexOf(".");
    if (dot === -1) return undefined;
    const compId = termStr.substring(0, dot);
    let pinPort = termStr.substring(dot + 1);
    const hashIdx = pinPort.indexOf("#");
    let padIndex = 0;
    if (hashIdx !== -1) {
      padIndex = Math.max(0, Number.parseInt(pinPort.substring(hashIdx + 1), 10) - 1);
      pinPort = pinPort.substring(0, hashIdx);
    }
    const pl = plMap.get(compId);
    if (!pl) return undefined;
    const fp = fpMap.get(pl.footprintId);
    if (!fp) return undefined;

    let targetPadNum = pinPort;
    const hasExact = fp.pads.some((p) => p.number === targetPadNum);
    if (!hasExact) {
      if (targetPadNum === "A") targetPadNum = "2";
      else if (targetPadNum === "K") targetPadNum = "1";
      else if (targetPadNum === "PWM") targetPadNum = "1";
      else if (targetPadNum === "VCC") targetPadNum = "2";
      else if (targetPadNum === "GND") targetPadNum = "3";
      else if (targetPadNum === "+") targetPadNum = fp.pads.some((p) => p.number === "+") ? "+" : "1";
      else if (targetPadNum === "-") targetPadNum = fp.pads.some((p) => p.number === "-") ? "-" : "2";
    }

    const matchingPads = fp.pads.filter((p) => p.number === targetPadNum);
    const pad = matchingPads[padIndex] ?? matchingPads[0];
    if (!pad) return undefined;
    return transformPoint({ x: pad.x, y: pad.y }, pl.x, pl.y, pl.rotation);
  };

  // Statistics calculation
  const totalTraces = layout.traces.length;
  const totalVias = layout.vias.length;
  const unroutedList = layout.unrouted ?? [];
  const unroutedConnections = unroutedList.length;

  let totalLengthMm = 0;
  for (const t of layout.traces) {
    for (let i = 0; i < t.points.length - 1; i++) {
      totalLengthMm += distance(t.points[i]!, t.points[i + 1]!);
    }
  }

  // Dynamic routed connection count calculation
  let totalConnections = options.totalConnections;
  let routedConnections = options.routedConnections;

  if (totalConnections === undefined || routedConnections === undefined) {
    if (circuit) {
      try {
        const pinMaps = buildDefaultPinMaps(circuit);
        const { metrics } = computeRatsnest(circuit, layout.placements, fpMap, pinMaps);
        totalConnections = metrics.edgeCount;
        routedConnections = Math.max(0, totalConnections - unroutedConnections);
      } catch {
        const routedNets = new Set(layout.traces.map((t) => t.netId));
        routedConnections = layout.traces.length > 0 ? routedNets.size : 0;
        totalConnections = routedConnections + unroutedConnections;
      }
    } else {
      const routedNets = new Set(layout.traces.map((t) => t.netId));
      routedConnections = layout.traces.length > 0 ? routedNets.size : 0;
      totalConnections = routedConnections + unroutedConnections;
    }
  }

  const completionRatePercent =
    totalConnections > 0
      ? Number(((routedConnections / totalConnections) * 100).toFixed(1))
      : 100.0;

  // DRC breakdown
  const drcBreakdown: Record<string, number> = {};
  let drcErrorCount = 0;
  let drcWarningCount = 0;

  for (const d of layout.drc ?? []) {
    if (d.code === "DRC_UNROUTED_CONNECTION") continue;
    drcBreakdown[d.code] = (drcBreakdown[d.code] || 0) + 1;
    if (d.severity === "error") drcErrorCount++;
    else drcWarningCount++;
  }

  // SVG Assembly
  const svgParts: string[] = [];

  // Root SVG
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%" class="pcb-svg" style="background-color: ${colors.canvasBg};">`,
  );

  // Defs: Grid pattern, filters, markers
  svgParts.push(`<defs>`);
  if (showGrid) {
    svgParts.push(`
      <pattern id="pcb-grid" width="${gridPitch}" height="${gridPitch}" patternUnits="userSpaceOnUse">
        <circle cx="${gridPitch / 2}" cy="${gridPitch / 2}" r="0.12" fill="${colors.gridDot}" opacity="0.65" />
      </pattern>
    `);
  }
  svgParts.push(`
    <filter id="net-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="0.4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  `);
  svgParts.push(`</defs>`);

  // Layer 1: Background Canvas
  svgParts.push(
    `<rect x="${minX}" y="${minY}" width="${viewWidth}" height="${viewHeight}" fill="${colors.canvasBg}" />`,
  );

  // Layer 2: Grid
  if (showGrid) {
    svgParts.push(
      `<rect x="${minX}" y="${minY}" width="${viewWidth}" height="${viewHeight}" fill="url(#pcb-grid)" pointer-events="none" />`,
    );
  }

  // Layer 3: Origin Crosshair at (0, 0)
  if (showOriginCrosshair) {
    svgParts.push(`
      <g id="origin-crosshair" class="origin-crosshair" stroke="${colors.crosshair}" stroke-width="0.18" pointer-events="none">
        <line x1="-3" y1="0" x2="3" y2="0" />
        <line x1="0" y1="-3" x2="0" y2="3" />
        <circle cx="0" cy="0" r="1.2" fill="none" stroke="${colors.crosshair}" stroke-width="0.15" />
        <circle cx="0" cy="0" r="0.3" fill="${colors.crosshair}" />
        <text x="1.5" y="-1.5" fill="${colors.crosshair}" font-size="1.1" font-family="monospace" font-weight="bold">(0,0)</text>
      </g>
    `);
  }

  // Layer 4: Board Substrate & Outline
  if (showBoardOutline && outline.length >= 3) {
    const pointsStr = outline.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ");
    svgParts.push(`
      <polygon id="board-substrate" points="${pointsStr}" fill="${colors.boardSubstrate}" stroke="${colors.boardEdge}" stroke-width="0.4" />
    `);
  }

  // Layer 5: Keepouts
  if (showKeepouts) {
    const keepouts = ARDUINO_UNO_R3_KEEPOUTS;
    svgParts.push(`<g id="pcb-keepouts" class="pcb-keepouts" pointer-events="none">`);
    for (const ko of keepouts) {
      if (ko.polygon.length >= 3) {
        const polyStr = ko.polygon.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ");
        svgParts.push(`
          <polygon points="${polyStr}" fill="${colors.keepoutFill}" stroke="${colors.keepoutStroke}" stroke-width="0.2" stroke-dasharray="1,1">
            <title>Keepout: ${escapeXml(ko.name)}</title>
          </polygon>
        `);
      }
    }
    svgParts.push(`</g>`);
  }

  // Helper for net highlighting
  const getNetOpacity = (netId: string): number => {
    if (!highlightNet) return 1.0;
    return netId === highlightNet ? 1.0 : 0.2;
  };

  const getNetFilter = (netId: string): string => {
    if (highlightNet && netId === highlightNet) return `filter="url(#net-glow)"`;
    return "";
  };

  // Layer 6: Bottom Copper (Blue)
  if (showBottomCopper && (options.activeLayer === undefined || options.activeLayer === "all" || options.activeLayer === "bottom")) {
    svgParts.push(`<g id="layer-copper-bottom" class="layer-copper-bottom">`);
    for (const trace of layout.traces) {
      if (trace.layer !== "bottom") continue;
      if (trace.points.length < 2) continue;

      const d = trace.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
        .join(" ");

      const opacity = getNetOpacity(trace.netId);
      const filter = getNetFilter(trace.netId);

      svgParts.push(`
        <path d="${d}" fill="none" stroke="${colors.bottomCopper}" stroke-width="${trace.width.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" ${filter} data-net="${escapeXml(trace.netId)}" class="pcb-trace trace-bottom">
          <title>Trace [Bottom]: Net ${escapeXml(trace.netId)} (Width: ${trace.width}mm)</title>
        </path>
      `);
    }
    svgParts.push(`</g>`);
  }

  // Layer 7: Top Copper (Red)
  if (showTopCopper && (options.activeLayer === undefined || options.activeLayer === "all" || options.activeLayer === "top")) {
    svgParts.push(`<g id="layer-copper-top" class="layer-copper-top">`);
    for (const trace of layout.traces) {
      if (trace.layer !== "top") continue;
      if (trace.points.length < 2) continue;

      const d = trace.points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(3)} ${p.y.toFixed(3)}`)
        .join(" ");

      const opacity = getNetOpacity(trace.netId);
      const filter = getNetFilter(trace.netId);

      svgParts.push(`
        <path d="${d}" fill="none" stroke="${colors.topCopper}" stroke-width="${trace.width.toFixed(3)}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" ${filter} data-net="${escapeXml(trace.netId)}" class="pcb-trace trace-top">
          <title>Trace [Top]: Net ${escapeXml(trace.netId)} (Width: ${trace.width}mm)</title>
        </path>
      `);
    }
    svgParts.push(`</g>`);
  }

  // Layer 8: Vias (Amber copper ring + dark drill hole)
  if (showVias) {
    svgParts.push(`<g id="layer-vias" class="layer-vias">`);
    for (const via of layout.vias) {
      const opacity = getNetOpacity(via.netId);
      const filter = getNetFilter(via.netId);
      const rOuter = via.diameter / 2;
      const rInner = via.drill / 2;

      svgParts.push(`
        <g class="pcb-via" opacity="${opacity}" ${filter} data-net="${escapeXml(via.netId)}">
          <circle cx="${via.x.toFixed(3)}" cy="${via.y.toFixed(3)}" r="${rOuter.toFixed(3)}" fill="${colors.viaRing}" stroke="#ffffff" stroke-width="0.08" />
          <circle cx="${via.x.toFixed(3)}" cy="${via.y.toFixed(3)}" r="${rInner.toFixed(3)}" fill="${colors.viaDrill}" />
          <title>Via: Net ${escapeXml(via.netId)} (Dia: ${via.diameter}mm, Drill: ${via.drill}mm) at (${via.x.toFixed(2)}, ${via.y.toFixed(2)})</title>
        </g>
      `);
    }
    svgParts.push(`</g>`);
  }

  // Layer 9: Pads (Magenta with drill holes)
  if (showPads) {
    svgParts.push(`<g id="layer-pads" class="layer-pads">`);
    for (const pl of layout.placements) {
      const fp = fpMap.get(pl.footprintId);
      if (!fp) continue;

      for (const pad of fp.pads) {
        const pt = transformPoint({ x: pad.x, y: pad.y }, pl.x, pl.y, pl.rotation);
        const padKey = `${pl.componentId}.${pad.number}`;
        const padRadius = Math.max(pad.w, pad.h) / 2;
        const drillRadius = pad.drill ? pad.drill / 2 : undefined;

        svgParts.push(`
          <g class="pcb-pad" data-component="${escapeXml(pl.componentId)}" data-pad="${escapeXml(pad.number)}">
        `);

        if (pad.shape === "rect") {
          const rx = pt.x - pad.w / 2;
          const ry = pt.y - pad.h / 2;
          svgParts.push(`
            <rect x="${rx.toFixed(3)}" y="${ry.toFixed(3)}" width="${pad.w.toFixed(3)}" height="${pad.h.toFixed(3)}" fill="${colors.padMagenta}" stroke="#ffffff" stroke-width="0.1" rx="0.1" />
          `);
        } else {
          // Circle or Oval
          svgParts.push(`
            <circle cx="${pt.x.toFixed(3)}" cy="${pt.y.toFixed(3)}" r="${padRadius.toFixed(3)}" fill="${colors.padMagenta}" stroke="#ffffff" stroke-width="0.1" />
          `);
        }

        if (drillRadius) {
          svgParts.push(`
            <circle cx="${pt.x.toFixed(3)}" cy="${pt.y.toFixed(3)}" r="${drillRadius.toFixed(3)}" fill="${colors.padDrill}" />
          `);
        }

        svgParts.push(`
            <title>Pad: ${escapeXml(padKey)} (${pad.shape}, ${pad.w}x${pad.h}mm) at (${pt.x.toFixed(2)}, ${pt.y.toFixed(2)})</title>
          </g>
        `);
      }
    }
    svgParts.push(`</g>`);
  }

  // Layer 10: Silkscreen (Yellow outlines and refdes text)
  if (showSilkscreen) {
    svgParts.push(`<g id="layer-silkscreen" class="layer-silkscreen" pointer-events="none">`);
    for (const pl of layout.placements) {
      const fp = fpMap.get(pl.footprintId);
      if (!fp) continue;

      // Courtyard or bounding box outline
      if (fp.courtyard && fp.courtyard.length >= 3) {
        const poly = transformPolygon(fp.courtyard, pl.x, pl.y, pl.rotation);
        const polyStr = poly.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join(" ");
        svgParts.push(`
          <polygon points="${polyStr}" fill="none" stroke="${colors.silkscreen}" stroke-width="0.15" opacity="0.75" />
        `);
      }

      // Footprint Silk lines/circles
      for (const silk of fp.silk ?? []) {
        if (silk.kind === "line") {
          const p1 = transformPoint({ x: silk.x1, y: silk.y1 }, pl.x, pl.y, pl.rotation);
          const p2 = transformPoint({ x: silk.x2, y: silk.y2 }, pl.x, pl.y, pl.rotation);
          svgParts.push(`
            <line x1="${p1.x.toFixed(3)}" y1="${p1.y.toFixed(3)}" x2="${p2.x.toFixed(3)}" y2="${p2.y.toFixed(3)}" stroke="${colors.silkscreen}" stroke-width="${silk.strokeWidth ?? 0.15}" />
          `);
        } else if (silk.kind === "rect") {
          const p = transformPoint({ x: silk.x, y: silk.y }, pl.x, pl.y, pl.rotation);
          svgParts.push(`
            <rect x="${p.x.toFixed(3)}" y="${p.y.toFixed(3)}" width="${silk.w.toFixed(3)}" height="${silk.h.toFixed(3)}" fill="none" stroke="${colors.silkscreen}" stroke-width="${silk.strokeWidth ?? 0.15}" />
          `);
        } else if (silk.kind === "circle") {
          const c = transformPoint({ x: silk.cx, y: silk.cy }, pl.x, pl.y, pl.rotation);
          svgParts.push(`
            <circle cx="${c.x.toFixed(3)}" cy="${c.y.toFixed(3)}" r="${silk.r.toFixed(3)}" fill="none" stroke="${colors.silkscreen}" stroke-width="${silk.strokeWidth ?? 0.15}" />
          `);
        }
      }

      // Refdes Text
      const textX = pl.x;
      const textY = pl.y - 0.2;
      svgParts.push(`
        <text x="${textX.toFixed(3)}" y="${textY.toFixed(3)}" fill="${colors.silkscreen}" font-size="1.4" font-family="monospace" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${escapeXml(pl.componentId)}</text>
      `);
    }
    svgParts.push(`</g>`);
  }

  // Layer 11: Ratsnest (Dashed Lines for Unrouted Connections)
  if (showRatsnest && unroutedList.length > 0) {
    svgParts.push(`<g id="layer-ratsnest" class="layer-ratsnest">`);
    for (const un of unroutedList) {
      const pFrom = resolveTerminalPoint(un.from);
      const pTo = resolveTerminalPoint(un.to);

      if (pFrom && pTo) {
        const opacity = getNetOpacity(un.netId);
        svgParts.push(`
          <line x1="${pFrom.x.toFixed(3)}" y1="${pFrom.y.toFixed(3)}" x2="${pTo.x.toFixed(3)}" y2="${pTo.y.toFixed(3)}" stroke="${colors.ratsnest}" stroke-width="0.22" stroke-dasharray="1.5,1.0" opacity="${opacity}" class="pcb-ratsnest" data-net="${escapeXml(un.netId)}">
            <title>Unrouted Net '${escapeXml(un.netId)}': ${escapeXml(un.from)} -> ${escapeXml(un.to)}</title>
          </line>
        `);
      }
    }
    svgParts.push(`</g>`);
  }

  // Layer 12: DRC Violation Markers (Red Diamonds at exact coordinates)
  if (showDrcMarkers && layout.drc && layout.drc.length > 0) {
    svgParts.push(`<g id="layer-drc-violations" class="layer-drc-violations">`);
    for (const v of layout.drc) {
      if (v.code === "DRC_UNROUTED_CONNECTION") continue;
      if (!v.location) continue;

      const vx = v.location.x;
      const vy = v.location.y;
      const s = 1.2; // Diamond half-span in mm

      // Diamond polygon points
      const points = `${vx.toFixed(3)},${(vy - s).toFixed(3)} ${(vx + s).toFixed(3)},${vy.toFixed(3)} ${vx.toFixed(3)},${(vy + s).toFixed(3)} ${(vx - s).toFixed(3)},${vy.toFixed(3)}`;

      svgParts.push(`
        <g class="pcb-drc-marker" data-code="${escapeXml(v.code)}">
          <polygon points="${points}" fill="${colors.drcMarker}" stroke="${colors.drcBorder}" stroke-width="0.2" filter="url(#net-glow)">
            <title>[${escapeXml(v.code)}] ${escapeXml(v.message)} at (${vx.toFixed(3)}, ${vy.toFixed(3)})</title>
          </polygon>
          <circle cx="${vx.toFixed(3)}" cy="${vy.toFixed(3)}" r="0.25" fill="#ffffff" />
        </g>
      `);
    }
    svgParts.push(`</g>`);
  }

  svgParts.push(`</svg>`);

  return {
    svg: svgParts.join("\n"),
    width: viewWidth,
    height: viewHeight,
    viewBox,
    stats: {
      totalConnections,
      routedConnections,
      unroutedConnections,
      completionRatePercent,
      totalTraces,
      totalVias,
      wirelengthMm: Number(totalLengthMm.toFixed(3)),
      drcErrorCount,
      drcWarningCount,
      drcBreakdown,
    },
  };
}
