/**
 * @license Apache-2.0
 * Live SVG Schematic Viewer component powered by @s2c/render-schematic.
 */

import type { Circuit } from "@s2c/circuit-json";
import { renderSchematicSvg } from "@s2c/render-schematic";
import { Download, Grid, Moon, RefreshCw, Sun, ZoomIn, ZoomOut } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

interface SchematicViewerProps {
  circuit: Circuit;
  sketchName?: string;
}

export const SchematicViewer: React.FC<SchematicViewerProps> = ({
  circuit,
  sketchName = "synthesized_circuit",
}) => {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const renderResult = useMemo(() => {
    try {
      return renderSchematicSvg(circuit, {
        theme,
        showGrid,
        showTitleBlock: true,
        showNetLabels: true,
        showPinNumbers: true,
      });
    } catch (e: unknown) {
      return {
        svg: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><text x="20" y="50" fill="red">Render Error: ${
          (e as Error).message
        }</text></svg>`,
        width: 400,
        height: 200,
        viewBox: "0 0 400 200",
      };
    }
  }, [circuit, theme, showGrid]);

  const handleDownloadSvg = () => {
    const blob = new Blob([renderResult.svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sketchName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_schematic.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Schematic Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Schematic Canvas</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[11px]">
            {circuit.components.length} parts · {circuit.nets.length} nets
          </span>
          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono text-[11px]">
            Net-Label Mode (v1)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-900 rounded-lg border border-slate-800 p-0.5">
            <button
              type="button"
              onClick={() =>
                setZoomLevel((z) => Math.max(0.4, Number(((z ?? 1) - 0.15).toFixed(2))))
              }
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 font-mono text-[11px] text-slate-300 min-w-12 text-center">
              {Math.round((zoomLevel ?? 1) * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoomLevel((z) => Math.min(2.5, Number(((z ?? 1) + 0.15).toFixed(2))))
              }
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1.0)}
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
              title="Reset Zoom"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            className={`p-1.5 rounded-lg border transition flex items-center gap-1 ${
              showGrid
                ? "bg-slate-800 border-slate-700 text-indigo-400"
                : "border-slate-800 text-slate-400 hover:bg-slate-800"
            }`}
            title="Toggle CAD Grid"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Grid</span>
          </button>

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 flex items-center gap-1 transition"
            title="Toggle Schematic Theme"
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Blueprint</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Export SVG */}
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 transition shadow-sm"
            title="Download SVG Schematic"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className={`flex-1 relative overflow-auto p-4 flex items-center justify-center min-h-[460px] ${
          theme === "dark" ? "bg-slate-950" : "bg-[#f8fafc]"
        }`}
      >
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center center",
            transition: "transform 150ms ease-out",
          }}
          className="max-w-full drop-shadow-xl"
          dangerouslySetInnerHTML={{ __html: renderResult.svg }}
        />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
        <div>Design Rule Check: Net-label standard per Doc §10 · Canonical pin coordinates</div>
        <div className="font-mono">
          Canvas: {renderResult.width} × {renderResult.height}px
        </div>
      </div>
    </div>
  );
};
