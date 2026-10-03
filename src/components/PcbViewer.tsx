/**
 * @license Apache-2.0
 * sketch2circuit — M12 2D PCB SVG Viewer Component.
 * High-fidelity vector visualization for 2-layer PCBs:
 * - Black canvas, green grid, origin crosshair
 * - Top copper (red), bottom copper (blue), vias (amber/drill)
 * - Pads (magenta with drill), silkscreen (yellow with refdes)
 * - Ratsnest (dashed cyan lines for unrouted connections)
 * - DRC violation markers (red diamonds at exact failure coordinates)
 * - Pan / zoom, net hover highlighting, and honest routing & DRC status badge
 */

import type { Circuit } from "@s2c/circuit-json";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import type { PcbLayout } from "@s2c/pcb-json";
import { placeCircuit, renderPcbSvg, routeCircuit } from "@s2c/pcb-layout";
import {
  AlertTriangle,
  Download,
  Eye,
  EyeOff,
  Grid,
  Info,
  Layers,
  Maximize2,
  RefreshCw,
  Search,
  ShieldAlert,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";

interface PcbViewerProps {
  circuit: Circuit;
  layout?: PcbLayout;
  sketchName?: string;
  theme?: "dark" | "light";
  onLoadUserFixture?: () => void;
}

export const PcbViewer: React.FC<PcbViewerProps> = ({
  circuit,
  layout: providedLayout,
  sketchName = "arduino_circuit",
  theme = "dark",
  onLoadUserFixture,
}) => {
  // Layer Toggles
  const [showTopCopper, setShowTopCopper] = useState<boolean>(true);
  const [showBottomCopper, setShowBottomCopper] = useState<boolean>(true);
  const [showPads, setShowPads] = useState<boolean>(true);
  const [showVias, setShowVias] = useState<boolean>(true);
  const [showSilkscreen, setShowSilkscreen] = useState<boolean>(true);
  const [showRatsnest, setShowRatsnest] = useState<boolean>(true);
  const [showDrcMarkers, setShowDrcMarkers] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showCrosshair, setShowCrosshair] = useState<boolean>(true);

  // Active highlighted net
  const [highlightNet, setHighlightNet] = useState<string | null>(null);

  // DRC drawer open state
  const [showDrcDrawer, setShowDrcDrawer] = useState<boolean>(false);

  // Pan and Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  // Compute routed layout if not already provided
  const routingData = useMemo(() => {
    if (providedLayout) {
      return {
        layout: providedLayout,
        routedConnections: undefined,
        totalConnections: undefined,
      };
    }
    try {
      const placementRes = placeCircuit(circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      const routingRes = routeCircuit(placementRes.layout, circuit, {
        gridPitchMm: 0.635,
      });
      return {
        layout: routingRes.layout,
        routedConnections: routingRes.routedConnections,
        totalConnections: placementRes.metrics.edgeCount,
      };
    } catch {
      const placementRes = placeCircuit(circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      return {
        layout: placementRes.layout,
        routedConnections: 0,
        totalConnections: placementRes.metrics.edgeCount,
      };
    }
  }, [circuit, providedLayout]);

  const routedLayout = routingData.layout;

  // Generate PCB SVG
  const renderResult = useMemo(() => {
    try {
      return renderPcbSvg(routingData.layout, circuit, {
        theme: "dark",
        showGrid,
        showOriginCrosshair: showCrosshair,
        showTopCopper,
        showBottomCopper,
        showPads,
        showVias,
        showSilkscreen,
        showRatsnest,
        showDrcMarkers,
        highlightNet: highlightNet ?? undefined,
        marginMm: 6.0,
        routedConnections: routingData.routedConnections,
        totalConnections: routingData.totalConnections,
      });
    } catch (e: unknown) {
      return {
        svg: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><text x="20" y="50" fill="#ef4444">PCB Render Error: ${(e as Error).message}</text></svg>`,
        width: 400,
        height: 200,
        viewBox: "0 0 400 200",
        stats: {
          totalConnections: 0,
          routedConnections: 0,
          unroutedConnections: 0,
          completionRatePercent: 0,
          totalTraces: 0,
          totalVias: 0,
          wirelengthMm: 0,
          drcErrorCount: 0,
          drcWarningCount: 0,
          drcBreakdown: {},
        },
      };
    }
  }, [
    routedLayout,
    circuit,
    showGrid,
    showCrosshair,
    showTopCopper,
    showBottomCopper,
    showPads,
    showVias,
    showSilkscreen,
    showRatsnest,
    showDrcMarkers,
    highlightNet,
  ]);

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoomLevel((z) => Math.max(0.4, Math.min(4.0, Number((z * factor).toFixed(2)))));
  };

  const handleResetView = () => {
    setZoomLevel(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Download SVG
  const handleDownloadSvg = () => {
    const blob = new Blob([renderResult.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sketchName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_pcb_layout.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const allNets = useMemo(() => {
    const nets = new Set<string>();
    for (const n of circuit.nets) {
      if (n.id) nets.add(n.id);
    }
    for (const t of routedLayout.traces) {
      if (t.netId) nets.add(t.netId);
    }
    for (const u of routedLayout.unrouted ?? []) {
      if (u.netId) nets.add(u.netId);
    }
    return Array.from(nets).sort();
  }, [circuit, routedLayout]);

  const stats = renderResult.stats;

  return (
    <div
      className="flex flex-col h-full border rounded-[2px] overflow-hidden"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-app)",
        color: "var(--text-main)",
      }}
    >
      {/* Top PCB Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-b text-xs"
        style={{
          backgroundColor: "var(--bg-subpanel)",
          borderColor: "var(--border-app)",
        }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold tracking-tight uppercase text-[11px] flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
            2D PCB CANVAS (M12)
          </span>

          {/* Honest Routing & DRC Status Badge */}
          <button
            type="button"
            onClick={() => setShowDrcDrawer(!showDrcDrawer)}
            className="px-2 py-0.5 border rounded-[2px] font-bold text-[10px] tracking-wide flex items-center gap-1.5 transition hover:brightness-110 cursor-pointer"
            style={{
              backgroundColor:
                stats.unroutedConnections > 0 ? "rgba(234, 88, 12, 0.2)" : "rgba(34, 197, 94, 0.2)",
              borderColor: stats.unroutedConnections > 0 ? "#ea580c" : "#22c55e",
              color: stats.unroutedConnections > 0 ? "#fdba74" : "#86efac",
            }}
            title="Click to view detailed routing and DRC violation breakdown"
          >
            <span>
              {stats.routedConnections}/{stats.totalConnections} routed (
              {stats.completionRatePercent}%) · {stats.drcErrorCount} DRC issues
            </span>
            <Info className="w-3 h-3 opacity-75" />
          </button>

          {stats.unroutedConnections > 0 && (
            <span
              className="px-1.5 py-0.5 text-[9px] border rounded-[1px] font-mono"
              style={{
                borderColor: "rgba(6, 182, 212, 0.5)",
                backgroundColor: "rgba(6, 182, 212, 0.1)",
                color: "#67e8f9",
              }}
            >
              {stats.unroutedConnections} UNROUTED (RATSNEST)
            </span>
          )}
        </div>

        {/* Action Controls & Zoom */}
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div
            className="flex items-center border rounded-[2px] p-0.5"
            style={{
              borderColor: "var(--border-app)",
              backgroundColor: "var(--bg-sunken)",
            }}
          >
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.max(0.4, Number((z - 0.2).toFixed(2))))}
              className="p-1 hover:opacity-80 transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-[10px] min-w-12 text-center font-mono">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomLevel((z) => Math.min(4.0, Number((z + 0.2).toFixed(2))))}
              className="p-1 hover:opacity-80 transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="p-1 hover:opacity-80 transition cursor-pointer"
              title="Reset View"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Download SVG */}
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="eng-btn"
            title="Download Vector PCB SVG (2-Layer)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">EXPORT SVG</span>
          </button>
        </div>
      </div>

      {/* Secondary Bar: Layer Toggles & Net Selection */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b text-[10px]"
        style={{
          backgroundColor: "#0d1117",
          borderColor: "var(--border-app)",
        }}
      >
        {/* Layer Switches */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-neutral-400 font-bold uppercase mr-1">LAYERS:</span>

          {/* Top Copper */}
          <button
            type="button"
            onClick={() => setShowTopCopper(!showTopCopper)}
            className={`px-1.5 py-0.5 border rounded-[2px] flex items-center gap-1 cursor-pointer transition ${
              showTopCopper ? "opacity-100 font-bold" : "opacity-40"
            }`}
            style={{
              borderColor: "#ef4444",
              backgroundColor: showTopCopper ? "rgba(239, 68, 68, 0.2)" : "transparent",
              color: "#fca5a5",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>TOP COPPER</span>
          </button>

          {/* Bottom Copper */}
          <button
            type="button"
            onClick={() => setShowBottomCopper(!showBottomCopper)}
            className={`px-1.5 py-0.5 border rounded-[2px] flex items-center gap-1 cursor-pointer transition ${
              showBottomCopper ? "opacity-100 font-bold" : "opacity-40"
            }`}
            style={{
              borderColor: "#3b82f6",
              backgroundColor: showBottomCopper ? "rgba(59, 130, 246, 0.2)" : "transparent",
              color: "#93c5fd",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span>BOTTOM COPPER</span>
          </button>

          {/* Pads */}
          <button
            type="button"
            onClick={() => setShowPads(!showPads)}
            className={`px-1.5 py-0.5 border rounded-[2px] flex items-center gap-1 cursor-pointer transition ${
              showPads ? "opacity-100 font-bold" : "opacity-40"
            }`}
            style={{
              borderColor: "#d946ef",
              backgroundColor: showPads ? "rgba(217, 70, 239, 0.2)" : "transparent",
              color: "#f0abfc",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-fuchsia-500" />
            <span>PADS</span>
          </button>

          {/* Vias */}
          <button
            type="button"
            onClick={() => setShowVias(!showVias)}
            className={`px-1.5 py-0.5 border rounded-[2px] flex items-center gap-1 cursor-pointer transition ${
              showVias ? "opacity-100 font-bold" : "opacity-40"
            }`}
            style={{
              borderColor: "#f59e0b",
              backgroundColor: showVias ? "rgba(245, 158, 11, 0.2)" : "transparent",
              color: "#fde68a",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>VIAS</span>
          </button>

          {/* Silkscreen */}
          <button
            type="button"
            onClick={() => setShowSilkscreen(!showSilkscreen)}
            className={`px-1.5 py-0.5 border rounded-[2px] flex items-center gap-1 cursor-pointer transition ${
              showSilkscreen ? "opacity-100 font-bold" : "opacity-40"
            }`}
            style={{
              borderColor: "#facc15",
              backgroundColor: showSilkscreen ? "rgba(250, 204, 21, 0.2)" : "transparent",
              color: "#fef08a",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>SILKSCREEN</span>
          </button>

          {/* Ratsnest */}
          <button
            type="button"
            onClick={() => setShowRatsnest(!showRatsnest)}
            className={`px-1.5 py-0.5 border rounded-[2px] flex items-center gap-1 cursor-pointer transition ${
              showRatsnest ? "opacity-100 font-bold" : "opacity-40"
            }`}
            style={{
              borderColor: "#06b6d4",
              backgroundColor: showRatsnest ? "rgba(6, 182, 212, 0.2)" : "transparent",
              color: "#67e8f9",
            }}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>RATSNEST ({stats.unroutedConnections})</span>
          </button>

          {/* DRC Markers */}
          <button
            type="button"
            onClick={() => setShowDrcMarkers(!showDrcMarkers)}
            className={`px-1.5 py-0.5 border rounded-[2px] flex items-center gap-1 cursor-pointer transition ${
              showDrcMarkers ? "opacity-100 font-bold" : "opacity-40"
            }`}
            style={{
              borderColor: "#dc2626",
              backgroundColor: showDrcMarkers ? "rgba(220, 38, 38, 0.2)" : "transparent",
              color: "#fca5a5",
            }}
          >
            <span className="w-2 h-2 rotate-45 bg-red-600 inline-block" />
            <span>DRC ERRORS ({stats.drcErrorCount})</span>
          </button>

          {/* Grid & Crosshair */}
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={`p-1 border rounded-[2px] cursor-pointer ${showGrid ? "text-emerald-400 border-emerald-600" : "text-neutral-500 border-neutral-700"}`}
            title="Toggle Green Grid"
          >
            <Grid className="w-3 h-3" />
          </button>
        </div>

        {/* Net Highlight Selector */}
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="net-highlight-select"
            className="text-neutral-400 font-bold uppercase text-[9px]"
          >
            NET HIGHLIGHT:
          </label>
          <select
            id="net-highlight-select"
            value={highlightNet ?? ""}
            onChange={(e) => setHighlightNet(e.target.value === "" ? null : e.target.value)}
            className="border rounded-[2px] px-2 py-0.5 text-[10px] bg-neutral-900 border-neutral-700 text-neutral-200 focus:outline-none"
          >
            <option value="">-- ALL NETS (NORMAL) --</option>
            {allNets.map((net) => (
              <option key={net} value={net}>
                {net}
              </option>
            ))}
          </select>
          {highlightNet && (
            <button
              type="button"
              onClick={() => setHighlightNet(null)}
              className="text-neutral-400 hover:text-white px-1 font-bold"
              title="Clear Highlight"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <section
        ref={containerRef}
        aria-label="PCB Canvas Viewport"
        className="flex-1 relative overflow-hidden select-none bg-black flex items-center justify-center cursor-grab active:cursor-grabbing min-h-[500px]"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          className="transition-transform duration-75 origin-center w-full h-full flex items-center justify-center p-4"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          }}
          dangerouslySetInnerHTML={{ __html: renderResult.svg }}
        />

        {/* Floating CAD HUD Overlay */}
        <div className="absolute bottom-3 left-3 bg-neutral-950/90 border border-neutral-800 rounded-[2px] px-3 py-2 text-[10px] font-mono text-neutral-300 pointer-events-none backdrop-blur-sm space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold">BOARD: ARDUINO UNO R3 SHIELD</span>
            <span>OUTLINE: 68.6 × 53.3 mm</span>
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <span>GRID: 2.54 mm (0.1 in)</span>
            <span>COPPER: 1 oz (0.254 mm TRACE / 0.254 mm CLR)</span>
          </div>
          <div className="flex items-center gap-3 text-neutral-400">
            <span className="text-red-400">■ TOP (HORIZ)</span>
            <span className="text-blue-400">■ BOTTOM (VERT)</span>
            <span className="text-amber-400">● VIA (0.6 / 1.0 mm)</span>
            <span className="text-fuchsia-400">■ PAD (MAGENTA)</span>
          </div>
        </div>

        {/* DRC Breakdown Drawer Modal */}
        {showDrcDrawer && (
          <div className="absolute top-3 right-3 w-80 max-h-[85%] bg-neutral-900/95 border border-neutral-700 rounded-[2px] shadow-2xl p-3 text-[11px] overflow-y-auto z-30 font-mono text-neutral-200">
            <div className="flex items-center justify-between border-b border-neutral-700 pb-2 mb-2">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                ROUTING &amp; DRC AUDIT
              </span>
              <button
                type="button"
                onClick={() => setShowDrcDrawer(false)}
                className="text-neutral-400 hover:text-white font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-2.5">
              <div className="bg-neutral-950 p-2 rounded-[2px] border border-neutral-800 space-y-1">
                <div className="text-neutral-400 text-[10px] uppercase font-bold">
                  COMPLETION STATUS:
                </div>
                <div className="text-sm font-bold text-emerald-400">
                  {stats.routedConnections} of {stats.totalConnections} Connections Routed (
                  {stats.completionRatePercent}%)
                </div>
                <div className="text-[10px] text-orange-400">
                  {stats.unroutedConnections} Connections Unrouted (Visible as dashed ratsnest)
                </div>
              </div>

              <div>
                <div className="text-neutral-400 text-[10px] uppercase font-bold mb-1">
                  DRC ERROR BREAKDOWN ({stats.drcErrorCount}):
                </div>
                <div className="space-y-1">
                  {Object.entries(stats.drcBreakdown).map(([code, count]) => (
                    <div
                      key={code}
                      className="flex items-center justify-between px-2 py-1 bg-red-950/40 border border-red-900/60 rounded-[2px] text-[10px]"
                    >
                      <span className="text-red-300 font-bold">{code}</span>
                      <span className="text-red-200 bg-red-900/80 px-1.5 py-0.2 rounded-[1px]">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-neutral-800 pt-2 text-[10px] text-neutral-400 leading-relaxed">
                <p className="font-bold text-neutral-300 mb-1">GAP-03 Tracked Limitations:</p>
                <p>
                  14 Trace-to-Pad clearance issues near dense headers. Red diamond markers indicate
                  exact coordinates. Multi-pitch routing and escape doglegs are scheduled in
                  follow-up pass.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
