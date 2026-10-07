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
  theme?: "dark" | "light";
}

export const SchematicViewer: React.FC<SchematicViewerProps> = ({
  circuit,
  sketchName = "synthesized_circuit",
  theme: controlledTheme,
}) => {
  const [internalTheme, setInternalTheme] = useState<"dark" | "light">("dark");
  const theme = controlledTheme ?? internalTheme;
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  const renderResult = useMemo(() => {
    try {
      return renderSchematicSvg(circuit, {
        theme,
        showGrid,
        showTitleBlock: false, // We render the authentic CAD sheet title block in HTML below
        showNetLabels: true,
        showPinNumbers: true,
      });
    } catch (e: unknown) {
      return {
        svg: `<svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg"><text x="20" y="50" fill="var(--accent-copper)">Render Error: ${
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
    <div
      className="flex flex-col h-full border rounded-[2px] overflow-hidden"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-app)",
        color: "var(--text-main)",
      }}
    >
      {/* Schematic Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 border-b text-xs"
        style={{
          backgroundColor: "var(--bg-subpanel)",
          borderColor: "var(--border-app)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-bold tracking-tight uppercase text-[11px]"
            style={{ color: "var(--text-main)" }}
          >
            SCHEMATIC CANVAS
          </span>
          <span
            className="px-1.5 py-0.5 text-[10px] border rounded-[1px]"
            style={{
              borderColor: "var(--border-app)",
              backgroundColor: "var(--bg-sunken)",
              color: "var(--text-muted)",
            }}
          >
            {circuit.components.length} PARTS · {circuit.nets.length} NETS
          </span>
          <span
            className="px-1.5 py-0.5 text-[10px] border rounded-[1px]"
            style={{
              borderColor: "var(--border-strong)",
              color: "var(--text-main)",
            }}
          >
            DOC §10 NET-LABEL
          </span>
        </div>

        <div className="flex items-center gap-1.5">
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
              onClick={() =>
                setZoomLevel((z) => Math.max(0.4, Number(((z ?? 1) - 0.15).toFixed(2))))
              }
              className="p-1 hover:opacity-80 transition"
              style={{ color: "var(--text-muted)" }}
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span
              className="px-2 text-[10px] min-w-12 text-center"
              style={{ color: "var(--text-main)" }}
            >
              {Math.round((zoomLevel ?? 1) * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoomLevel((z) => Math.min(2.5, Number(((z ?? 1) + 0.15).toFixed(2))))
              }
              className="p-1 hover:opacity-80 transition"
              style={{ color: "var(--text-muted)" }}
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(1.0)}
              className="p-1 hover:opacity-80 transition"
              style={{ color: "var(--text-muted)" }}
              title="Reset Zoom"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Grid Toggle */}
          <button
            type="button"
            onClick={() => setShowGrid((g) => !g)}
            className="eng-btn"
            title="Toggle Reticle / CAD Grid"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GRID</span>
          </button>

          {/* Theme Toggle if uncontrolled */}
          {!controlledTheme && (
            <button
              type="button"
              onClick={() => setInternalTheme((t) => (t === "dark" ? "light" : "dark"))}
              className="eng-btn"
              title="Toggle Schematic Theme"
            >
              {theme === "dark" ? (
                <>
                  <Sun className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">DRAFTING</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">OSCILLOSCOPE</span>
                </>
              )}
            </button>
          )}

          {/* Export SVG */}
          <button
            type="button"
            onClick={handleDownloadSvg}
            className="eng-btn primary"
            title="Export Schematic as Vector SVG"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT SVG</span>
          </button>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div
        className="flex-1 relative overflow-auto p-4 flex items-center justify-center min-h-[460px] canvas-grid-pattern"
        style={{
          backgroundColor: "var(--canvas-bg)",
        }}
      >
        <div
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center center",
            transition: "transform 150ms ease-out",
          }}
          className="max-w-full"
          dangerouslySetInnerHTML={{ __html: renderResult.svg }}
        />
      </div>

      {/* Real Engineering Title Block (Bordered Box per ANSI/ISO CAD drawing standard) */}
      <div
        id="schematic-canvas-title-block"
        className="border-t text-[10px]"
        style={{
          borderColor: "var(--border-strong)",
          backgroundColor: "var(--bg-panel)",
          color: "var(--text-main)",
        }}
      >
        <div
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-b"
          style={{ borderColor: "var(--border-app)" }}
        >
          <div className="p-2 border-r" style={{ borderColor: "var(--border-app)" }}>
            <span className="text-[9px] block uppercase" style={{ color: "var(--text-muted)" }}>
              PROJECT / SYS
            </span>
            <span className="font-bold truncate block">sketch2circuit</span>
          </div>
          <div className="p-2 border-r" style={{ borderColor: "var(--border-app)" }}>
            <span className="text-[9px] block uppercase" style={{ color: "var(--text-muted)" }}>
              DRAWING TITLE
            </span>
            <span className="font-bold truncate block">{sketchName.toUpperCase()}</span>
          </div>
          <div className="p-2 border-r" style={{ borderColor: "var(--border-app)" }}>
            <span className="text-[9px] block uppercase" style={{ color: "var(--text-muted)" }}>
              DWG NUMBER
            </span>
            <span className="block">S2C-SCH-{circuit.components.length}P</span>
          </div>
          <div className="p-2 border-r" style={{ borderColor: "var(--border-app)" }}>
            <span className="text-[9px] block uppercase" style={{ color: "var(--text-muted)" }}>
              REV / SPEC
            </span>
            <span className="block">REV 1.0 · DOC §10</span>
          </div>
          <div className="p-2 border-r" style={{ borderColor: "var(--border-app)" }}>
            <span className="text-[9px] block uppercase" style={{ color: "var(--text-muted)" }}>
              GENERATOR
            </span>
            <span className="truncate block">S2C-COMPILER-V1</span>
          </div>
          <div className="p-2 flex flex-col justify-center">
            <div className="flex items-center justify-between text-[9px]">
              <span style={{ color: "var(--text-muted)" }}>SHEET:</span>
              <span className="font-bold">1 OF 1</span>
            </div>
            <div className="flex items-center justify-between text-[9px]">
              <span style={{ color: "var(--text-muted)" }}>NET COUNT:</span>
              <span className="font-bold">{circuit.nets.length} NETS</span>
            </div>
          </div>
        </div>
        <div
          className="px-3 py-1 flex items-center justify-between text-[9px]"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            color: "var(--text-muted)",
          }}
        >
          <span>STANDARD: NET-LABEL-ONLY CAD · FORMULA VERIFIED · 100 MIL CANONICAL PIN GRID</span>
          <span>
            CANVAS: {renderResult.width} × {renderResult.height} PX
          </span>
        </div>
      </div>
    </div>
  );
};
