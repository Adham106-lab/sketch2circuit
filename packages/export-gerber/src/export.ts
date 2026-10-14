/**
 * @license Apache-2.0
 * @s2c/export-gerber — Main Gerber RS-274X and Excellon export pipeline.
 */

import type { FootprintDef, PcbLayout, Point, SilkItem } from "@s2c/pcb-json";
import { ExcellonBuilder } from "./excellon-writer.js";
import { GerberLayerBuilder } from "./gerber-writer.js";
import { renderTextToStrokes } from "./stroke-font.js";
import type { GerberExportMetrics, GerberExportOptions, GerberFileSet } from "./types.js";

function transformPoint(p: Point, tx: number, ty: number, rotDeg = 0): Point {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: p.x * cos - p.y * sin + tx,
    y: p.x * sin + p.y * cos + ty,
  };
}

/**
 * Exports a PcbLayout into a standard 2-layer RS-274X Gerber and Excellon drill file set.
 */
export function exportGerber(layout: PcbLayout, options: GerberExportOptions = {}): GerberFileSet {
  const boardName = options.boardName ?? "board";
  const maskExpansion = options.soldermaskExpansionMm ?? 0.05;
  const silkLineWidth = options.silkscreenLineWidthMm ?? 0.15;
  const outlineLineWidth = options.outlineLineWidthMm ?? 0.15;

  // Initialize Layer Builders
  const topCopper = new GerberLayerBuilder("Top Copper (GTL)");
  const bottomCopper = new GerberLayerBuilder("Bottom Copper (GBL)");
  const topSoldermask = new GerberLayerBuilder("Top Soldermask (GTS)");
  const bottomSoldermask = new GerberLayerBuilder("Bottom Soldermask (GBS)");
  const topSilkscreen = new GerberLayerBuilder("Top Silkscreen (GTO)");
  const bottomSilkscreen = new GerberLayerBuilder("Bottom Silkscreen (GBO)");
  const boardOutline = new GerberLayerBuilder("Board Outline (GKO)");
  const drillBuilder = new ExcellonBuilder(boardName);

  // Map footprints by ID
  const fpMap = new Map<string, FootprintDef>();
  for (const fp of layout.footprints) {
    fpMap.set(fp.id, fp);
  }

  let topPadCount = 0;
  let bottomPadCount = 0;
  let drillHoleCount = 0;

  // 1. Process Placements (Pads, Footprint Silk, Drills)
  // Sort placements deterministically by componentId
  const sortedPlacements = [...layout.placements].sort((a, b) =>
    a.componentId.localeCompare(b.componentId),
  );

  for (const pl of sortedPlacements) {
    const fp = fpMap.get(pl.footprintId);
    if (!fp) continue;

    const isFlipped = pl.side === "bottom";

    // A. Pads
    // Sort pads deterministically by pad number
    const sortedPads = [...fp.pads].sort((a, b) => a.number.localeCompare(b.number));

    for (const pad of sortedPads) {
      const pt = transformPoint({ x: pad.x, y: pad.y }, pl.x, pl.y, pl.rotation);

      // Account for 90 / 270 degree rotation swapping width & height
      const isQuarterRot = pl.rotation === 90 || pl.rotation === 270;
      const padW = isQuarterRot ? pad.h : pad.w;
      const padH = isQuarterRot ? pad.w : pad.h;

      // Drill holes for through-hole pads
      if (pad.drill && pad.drill > 0) {
        drillBuilder.addHole(pad.drill, pt.x, pt.y);
        drillHoleCount++;
      }

      // Check pad layers
      const onTop = pad.layers.includes("top");
      const onBottom = pad.layers.includes("bottom");

      // Top Copper & Soldermask
      if (onTop && !isFlipped) {
        topPadCount++;
        if (pad.shape === "rect") {
          const apKey = topCopper.addRectAperture(padW, padH);
          topCopper.flashPad(apKey, pt.x, pt.y);

          const maskKey = topSoldermask.addRectAperture(
            padW + maskExpansion * 2,
            padH + maskExpansion * 2,
          );
          topSoldermask.flashPad(maskKey, pt.x, pt.y);
        } else if (pad.shape === "oval") {
          const apKey = topCopper.addObroundAperture(padW, padH);
          topCopper.flashPad(apKey, pt.x, pt.y);

          const maskKey = topSoldermask.addObroundAperture(
            padW + maskExpansion * 2,
            padH + maskExpansion * 2,
          );
          topSoldermask.flashPad(maskKey, pt.x, pt.y);
        } else {
          // Circle
          const dia = Math.max(padW, padH);
          const apKey = topCopper.addCircleAperture(dia);
          topCopper.flashPad(apKey, pt.x, pt.y);

          const maskKey = topSoldermask.addCircleAperture(dia + maskExpansion * 2);
          topSoldermask.flashPad(maskKey, pt.x, pt.y);
        }
      }

      // Bottom Copper & Soldermask
      if (onBottom || (isFlipped && onTop)) {
        bottomPadCount++;
        if (pad.shape === "rect") {
          const apKey = bottomCopper.addRectAperture(padW, padH);
          bottomCopper.flashPad(apKey, pt.x, pt.y);

          const maskKey = bottomSoldermask.addRectAperture(
            padW + maskExpansion * 2,
            padH + maskExpansion * 2,
          );
          bottomSoldermask.flashPad(maskKey, pt.x, pt.y);
        } else if (pad.shape === "oval") {
          const apKey = bottomCopper.addObroundAperture(padW, padH);
          bottomCopper.flashPad(apKey, pt.x, pt.y);

          const maskKey = bottomSoldermask.addObroundAperture(
            padW + maskExpansion * 2,
            padH + maskExpansion * 2,
          );
          bottomSoldermask.flashPad(maskKey, pt.x, pt.y);
        } else {
          // Circle
          const dia = Math.max(padW, padH);
          const apKey = bottomCopper.addCircleAperture(dia);
          bottomCopper.flashPad(apKey, pt.x, pt.y);

          const maskKey = bottomSoldermask.addCircleAperture(dia + maskExpansion * 2);
          bottomSoldermask.flashPad(maskKey, pt.x, pt.y);
        }
      }
    }

    // B. Silkscreen from Footprint
    const silkTarget = isFlipped ? bottomSilkscreen : topSilkscreen;
    const silkAperture = silkTarget.addCircleAperture(silkLineWidth);

    // Courtyard outline
    if (fp.courtyard && fp.courtyard.length >= 3) {
      const courtPts = fp.courtyard.map((p) => transformPoint(p, pl.x, pl.y, pl.rotation));
      const firstCourt = courtPts[0];
      if (firstCourt) {
        courtPts.push({ x: firstCourt.x, y: firstCourt.y });
        silkTarget.drawTrack(silkAperture, courtPts);
      }
    }

    // Footprint silk primitives
    for (const item of fp.silk ?? []) {
      renderSilkItem(item, silkTarget, pl.x, pl.y, pl.rotation, silkLineWidth);
    }

    // Component RefDes Text Label
    const textStrokes = renderTextToStrokes(pl.componentId, pl.x - 2.0, pl.y + 2.5, 1.2, 0);
    for (const stroke of textStrokes) {
      silkTarget.drawLine(silkAperture, stroke.x1, stroke.y1, stroke.x2, stroke.y2);
    }
  }

  // 2. Process Vias
  // Sort vias deterministically by x, then y
  const sortedVias = [...layout.vias].sort((a, b) => (a.x !== b.x ? a.x - b.x : a.y - b.y));

  for (const via of sortedVias) {
    const topViaAp = topCopper.addCircleAperture(via.diameter);
    topCopper.flashPad(topViaAp, via.x, via.y);

    const botViaAp = bottomCopper.addCircleAperture(via.diameter);
    bottomCopper.flashPad(botViaAp, via.x, via.y);

    if (via.drill > 0) {
      drillBuilder.addHole(via.drill, via.x, via.y);
      drillHoleCount++;
    }
  }

  // 3. Process Traces
  let topCopperTraceCount = 0;
  let bottomCopperTraceCount = 0;

  // Sort traces deterministically by layer, then netId, then start coordinate
  const sortedTraces = [...layout.traces].sort((a, b) => {
    if (a.layer !== b.layer) return a.layer.localeCompare(b.layer);
    if (a.netId !== b.netId) return a.netId.localeCompare(b.netId);
    const ax = a.points[0]?.x ?? 0;
    const bx = b.points[0]?.x ?? 0;
    return ax - bx;
  });

  for (const trace of sortedTraces) {
    if (trace.points.length < 2) continue;

    if (trace.layer === "top") {
      topCopperTraceCount++;
      const apKey = topCopper.addCircleAperture(trace.width);
      topCopper.drawTrack(apKey, trace.points);
    } else if (trace.layer === "bottom") {
      bottomCopperTraceCount++;
      const apKey = bottomCopper.addCircleAperture(trace.width);
      bottomCopper.drawTrack(apKey, trace.points);
    }
  }

  // 4. Process Board-Level Silkscreen
  for (const item of layout.silkscreen ?? []) {
    const target = item.layer === "bottom" ? bottomSilkscreen : topSilkscreen;
    renderSilkItem(item, target, 0, 0, 0, silkLineWidth);
  }

  // 5. Process Board Outline (GKO)
  const outline = layout.board.outline;
  if (outline.length >= 3) {
    const outlineAp = boardOutline.addCircleAperture(outlineLineWidth);
    const firstOutline = outline[0];
    const closedOutline = firstOutline
      ? [...outline, { x: firstOutline.x, y: firstOutline.y }]
      : outline;
    boardOutline.drawTrack(outlineAp, closedOutline);
  }

  // 6. Assemble Final Output Files
  const gtlContent = topCopper.build();
  const gblContent = bottomCopper.build();
  const gtoContent = topSilkscreen.build();
  const gboContent = bottomSilkscreen.build();
  const gtsContent = topSoldermask.build();
  const gbsContent = bottomSoldermask.build();
  const gkoContent = boardOutline.build();
  const drlContent = drillBuilder.build();

  const files: Record<string, string> = {
    [`${boardName}.gtl`]: gtlContent,
    [`${boardName}.gbl`]: gblContent,
    [`${boardName}.gto`]: gtoContent,
    [`${boardName}.gbo`]: gboContent,
    [`${boardName}.gts`]: gtsContent,
    [`${boardName}.gbs`]: gbsContent,
    [`${boardName}.gko`]: gkoContent,
    [`${boardName}.drl`]: drlContent,
  };

  const metrics: GerberExportMetrics = {
    topCopperTraceCount,
    bottomCopperTraceCount,
    topPadCount,
    bottomPadCount,
    viaCount: layout.vias.length,
    drillHoleCount,
    toolsUsedCount: 0, // Computed below from excellon lines
    aperturesDefinedTopCopper: topCopper.getApertureCount(),
    aperturesDefinedBottomCopper: bottomCopper.getApertureCount(),
  };

  return {
    boardName,
    topCopper: gtlContent,
    bottomCopper: gblContent,
    topSilkscreen: gtoContent,
    bottomSilkscreen: gboContent,
    topSoldermask: gtsContent,
    bottomSoldermask: gbsContent,
    boardOutline: gkoContent,
    drill: drlContent,
    files,
    metrics,
  };
}

function renderSilkItem(
  item: SilkItem,
  builder: GerberLayerBuilder,
  tx: number,
  ty: number,
  rotDeg: number,
  defaultLineWidth: number,
): void {
  const strokeW =
    "strokeWidth" in item && typeof item.strokeWidth === "number"
      ? item.strokeWidth
      : defaultLineWidth;
  const ap = builder.addCircleAperture(strokeW);

  if (item.kind === "line") {
    const p1 = transformPoint({ x: item.x1, y: item.y1 }, tx, ty, rotDeg);
    const p2 = transformPoint({ x: item.x2, y: item.y2 }, tx, ty, rotDeg);
    builder.drawLine(ap, p1.x, p1.y, p2.x, p2.y);
  } else if (item.kind === "rect") {
    const p1 = transformPoint({ x: item.x, y: item.y }, tx, ty, rotDeg);
    const p2 = transformPoint({ x: item.x + item.w, y: item.y }, tx, ty, rotDeg);
    const p3 = transformPoint({ x: item.x + item.w, y: item.y + item.h }, tx, ty, rotDeg);
    const p4 = transformPoint({ x: item.x, y: item.y + item.h }, tx, ty, rotDeg);
    builder.drawTrack(ap, [p1, p2, p3, p4, p1]);
  } else if (item.kind === "circle") {
    // Approximate circle with 24 polygon segments
    const pts: Point[] = [];
    const segments = 24;
    for (let i = 0; i <= segments; i++) {
      const angle = (i * 2 * Math.PI) / segments;
      const lx = item.cx + item.r * Math.cos(angle);
      const ly = item.cy + item.r * Math.sin(angle);
      pts.push(transformPoint({ x: lx, y: ly }, tx, ty, rotDeg));
    }
    builder.drawTrack(ap, pts);
  } else if (item.kind === "text") {
    const p = transformPoint({ x: item.x, y: item.y }, tx, ty, rotDeg);
    const strokes = renderTextToStrokes(
      item.text,
      p.x,
      p.y,
      item.fontSize,
      (item.rotation ?? 0) + rotDeg,
    );
    for (const stroke of strokes) {
      builder.drawLine(ap, stroke.x1, stroke.y1, stroke.x2, stroke.y2);
    }
  }
}
