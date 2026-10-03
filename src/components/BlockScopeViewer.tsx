/**
 * @license Apache-2.0
 * @s2c/apps/playground — Interactive Scope Waveform Viewer for Block Diagram Simulations.
 * Uses vector SVG rendering matching M17's oscilloscope aesthetic with time cursor & readouts.
 */

import { Download, Maximize2, Minimize2, X } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

export interface ScopeSignalData {
  scopeId?: string;
  blockId?: string;
  title: string;
  points: { x: number; y: number }[];
}

interface BlockScopeViewerProps {
  signals: Record<string, ScopeSignalData>;
  tEnd: number;
  solverMethod: "rk4" | "rkf45";
  onClose?: () => void;
}

export const BlockScopeViewer: React.FC<BlockScopeViewerProps> = ({
  signals,
  tEnd: _tEnd,
  solverMethod,
  onClose,
}) => {
  const signalKeys = Object.keys(signals);
  const [activeScopeId, setActiveScopeId] = useState<string>(signalKeys[0] || "");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Keep activeScopeId valid if signals change
  const currentSignal = useMemo(() => {
    if (activeScopeId && signals[activeScopeId]) {
      return signals[activeScopeId];
    }
    return signalKeys[0] ? signals[signalKeys[0]] : null;
  }, [signals, activeScopeId, signalKeys]);

  const points = currentSignal?.points ?? [];

  // Compute metrics (min, max, peak, final, overshoot)
  const metrics = useMemo(() => {
    if (points.length === 0) return null;
    const xVals = points.map((p) => p.x);
    const yVals = points.map((p) => p.y);

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);

    const spanX = maxX - minX || 1.0;
    const spanY = maxY - minY || 1.0;

    const finalVal = points[points.length - 1]?.y ?? 0.0;
    const peakVal = maxY;

    return {
      minX,
      maxX,
      minY,
      maxY,
      spanX,
      spanY,
      finalVal,
      peakVal,
      count: points.length,
    };
  }, [points]);

  // CSV Export
  const handleExportCsv = () => {
    if (!currentSignal || points.length === 0) return;
    const lines = ["time_s,signal_val"];
    for (const pt of points) {
      lines.push(`${pt.x},${pt.y}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentSignal.title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_scope.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Convert points to SVG polyline coordinates
  const svgPath = useMemo(() => {
    if (!metrics || points.length === 0) return "";
    const w = 700;
    const h = 260;
    const xOff = 60;
    const yOff = 30;

    return points
      .map((pt, idx) => {
        const normX = (pt.x - metrics.minX) / metrics.spanX;
        const normY = (pt.y - metrics.minY) / metrics.spanY;
        const cx = xOff + normX * w;
        const cy = yOff + (1.0 - normY) * h;
        return `${idx === 0 ? "M" : "L"} ${cx.toFixed(1)} ${cy.toFixed(1)}`;
      })
      .join(" ");
  }, [metrics, points]);

  // Hover point info
  const hoveredPoint = hoveredIndex !== null && points[hoveredIndex] ? points[hoveredIndex] : null;

  return (
    <div
      className={`border-t flex flex-col transition-all duration-200 select-none ${
        isExpanded ? "h-[450px]" : "h-[300px]"
      }`}
      style={{
        borderColor: "var(--border-strong)",
        backgroundColor: "#080c14",
      }}
    >
      {/* Scope Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800 bg-neutral-900/80 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold font-mono text-[11px] text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>
              Scope Display ({signalKeys.length} sink{signalKeys.length === 1 ? "" : "s"})
            </span>
          </span>

          {/* Scope Selector Tabs */}
          {signalKeys.length > 1 && (
            <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded-[2px] border border-neutral-800">
              {signalKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveScopeId(key)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded-[1px] transition ${
                    activeScopeId === key
                      ? "bg-sky-600 text-white font-bold"
                      : "text-neutral-400 hover:text-neutral-200"
                  }`}
                >
                  {signals[key]?.title || key}
                </button>
              ))}
            </div>
          )}

          <span className="text-[10px] text-neutral-400 font-mono">
            {currentSignal?.title} • {metrics?.count ?? 0} samples • Method:{" "}
            <span className="text-emerald-400 font-bold uppercase">{solverMethod}</span>
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {hoveredPoint && (
            <div className="px-2 py-0.5 rounded-[1px] bg-sky-950 border border-sky-800 text-sky-300 font-mono text-[10px]">
              Cursor: t = {hoveredPoint.x.toFixed(4)}s, y = {hoveredPoint.y.toFixed(4)}
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={points.length === 0}
            className="px-2 py-0.5 text-[10px] font-mono rounded-[2px] border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition flex items-center gap-1 disabled:opacity-40"
            title="Export Scope Data to CSV"
          >
            <Download className="w-3 h-3" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-[2px] hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
            title={isExpanded ? "Collapse Scope View" : "Expand Scope View"}
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-[2px] hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              title="Close Scope View"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Scope Plot Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {metrics && points.length > 0 ? (
          <div className="flex-1 relative flex items-center justify-center p-2">
            <svg
              className="w-full h-full"
              viewBox="0 0 800 320"
              preserveAspectRatio="none"
              role="img"
              aria-label={currentSignal?.title || "Scope Waveform"}
              onMouseLeave={() => setHoveredIndex(null)}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const frac = Math.max(0, Math.min(1, (mouseX - 60) / (rect.width * (700 / 800))));
                const targetIdx = Math.round(frac * (points.length - 1));
                setHoveredIndex(targetIdx);
              }}
            >
              <title>{currentSignal?.title || "Scope Waveform"}</title>
              <defs>
                {/* Background Grid Pattern */}
                <pattern id="scope-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#172554"
                    strokeWidth="0.8"
                    opacity="0.4"
                  />
                </pattern>
                <linearGradient id="scope-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Background */}
              <rect x="60" y="30" width="700" height="260" fill="url(#scope-grid)" />

              {/* Axes */}
              <line x1="60" y1="290" x2="760" y2="290" stroke="#334155" strokeWidth="1.5" />
              <line x1="60" y1="30" x2="60" y2="290" stroke="#334155" strokeWidth="1.5" />

              {/* X-Axis Ticks & Labels */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                const val = metrics.minX + frac * metrics.spanX;
                const xPos = 60 + frac * 700;
                return (
                  <g key={frac}>
                    <line x1={xPos} y1="290" x2={xPos} y2="295" stroke="#475569" strokeWidth="1" />
                    <text
                      x={xPos}
                      y="310"
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {val.toFixed(2)}s
                    </text>
                  </g>
                );
              })}

              {/* Y-Axis Ticks & Labels */}
              {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                const val = metrics.minY + frac * metrics.spanY;
                const yPos = 290 - frac * 260;
                return (
                  <g key={frac}>
                    <line x1="55" y1={yPos} x2="60" y2={yPos} stroke="#475569" strokeWidth="1" />
                    <text
                      x="50"
                      y={yPos + 3}
                      textAnchor="end"
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                    >
                      {Math.abs(val) >= 100 ? val.toFixed(0) : val.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Waveform Trace */}
              <path
                d={svgPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.0"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Active Hover Cursor */}
              {hoveredPoint && (
                <g>
                  {(() => {
                    const normX = (hoveredPoint.x - metrics.minX) / metrics.spanX;
                    const normY = (hoveredPoint.y - metrics.minY) / metrics.spanY;
                    const cx = 60 + normX * 700;
                    const cy = 30 + (1.0 - normY) * 260;
                    return (
                      <>
                        <line
                          x1={cx}
                          y1="30"
                          x2={cx}
                          y2="290"
                          stroke="#fbbf24"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r="4"
                          fill="#fbbf24"
                          stroke="#000"
                          strokeWidth="1.5"
                        />
                      </>
                    );
                  })()}
                </g>
              )}
            </svg>

            {/* Quick Metrics Overlay Badge */}
            <div className="absolute top-4 right-4 pointer-events-none bg-neutral-900/90 border border-neutral-800 rounded-[2px] p-2 text-[10px] font-mono space-y-0.5 shadow-md">
              <div className="text-neutral-400">
                Peak: <span className="text-sky-300 font-bold">{metrics.peakVal.toFixed(2)}</span>
              </div>
              <div className="text-neutral-400">
                Final:{" "}
                <span className="text-emerald-300 font-bold">{metrics.finalVal.toFixed(2)}</span>
              </div>
              <div className="text-neutral-400">
                Time Span:{" "}
                <span className="text-neutral-200">
                  {metrics.minX.toFixed(2)}s - {metrics.maxX.toFixed(2)}s
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500 font-mono text-xs">
            Awaiting simulation run to display Scope waveform...
          </div>
        )}
      </div>
    </div>
  );
};
