/**
 * @license Apache-2.0
 * sketch2circuit — Interactive Browser Playground & Synthesis IDE (Milestone 7).
 */

import { type SynthesisResult, synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { placeCircuit, type RoutingResult, routeCircuit } from "@s2c/pcb-layout";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Boxes,
  Calculator,
  Code2,
  Cpu,
  Eye,
  FileSpreadsheet,
  Layers,
  Share2,
  ShieldAlert,
  Sparkles,
  Workflow,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BlockDiagramTab } from "./components/BlockDiagramTab.js";
import { BomViewerTab } from "./components/BomViewerTab.js";
import { CalculatorsTab } from "./components/CalculatorsTab.js";
import { DocumentationTab } from "./components/DocumentationTab.js";
import { ErcDiagnostics } from "./components/ErcDiagnostics.js";
import { ExportArtifacts } from "./components/ExportArtifacts.js";
import { PartsCatalogBrowser } from "./components/PartsCatalogBrowser.js";
import { Pcb3DViewer } from "./components/Pcb3DViewer.js";
import { PcbViewer } from "./components/PcbViewer.js";
import { SchematicViewer } from "./components/SchematicViewer.js";
import { SimulationTab } from "./components/SimulationTab.js";
import { SAMPLE_SKETCHES } from "./components/sample-sketches.js";

export default function App() {
  // Theme state: "dark" (Oscilloscope) vs "light" (Drafting Sheet)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Main Tab Navigation: Schematic (Studio) | PCB (2D) | 3D | BOM | ERC | Simulate | Export | Catalog | Calculators | Docs
  const [activeMainTab, setActiveMainTab] = useState<
    | "studio"
    | "pcb"
    | "pcb3d"
    | "bom"
    | "erc"
    | "simulate"
    | "blockdiagram"
    | "export"
    | "catalog"
    | "calculators"
    | "docs"
  >("studio");

  // Studio Sub-view: Schematic vs. PCB vs. PCB 3D vs. Facts/Inference vs. Pin Graph
  const [studioRightView, setStudioRightView] = useState<
    "schematic" | "pcb" | "pcb3d" | "facts" | "pingraph"
  >("schematic");

  // Synthesizer State — Default to verified user_multi_peripheral benchmark
  const defaultSketch =
    SAMPLE_SKETCHES.find((s) => s.id === "user_multi_peripheral") ?? SAMPLE_SKETCHES[0];
  const [selectedSketchId, setSelectedSketchId] = useState<string>("user_multi_peripheral");
  const [sketchSource, setSketchSource] = useState<string>(defaultSketch.code);
  const [debouncedSource, setDebouncedSource] = useState<string>(defaultSketch.code);
  const [targetBoard, setTargetBoard] = useState<string>("ARDUINO_UNO_R3");

  // Debounce sketch edits to avoid laggy AST parsing & layout re-routing on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSource(sketchSource);
    }, 250);
    return () => clearTimeout(handler);
  }, [sketchSource]);

  // Run Synthesis reactively from debounced sketch source
  const synthesis: SynthesisResult = useMemo(() => {
    try {
      return synthesizeSketch(debouncedSource, {
        boardId: targetBoard,
        timestamp: "2026-09-24T00:00:00.000Z",
      });
    } catch (e: unknown) {
      return {
        circuit: {
          schemaVersion: "0.1.0",
          name: "Syntax Error",
          components: [],
          nets: [],
        },
        peripherals: [],
        pinGraph: new Map(),
        diagnostics: [
          {
            ruleId: "erc.syntax-error",
            severity: "error",
            message: `Sketch synthesis error: ${(e as Error).message}`,
            explanation: "Could not parse or synthesize the Arduino sketch syntax.",
            target: { type: "circuit", id: "circuit" },
          },
        ],
        assumptions: [],
        unresolved: [`Error: ${(e as Error).message}`],
        unresolvedItems: [],
      };
    }
  }, [debouncedSource, targetBoard]);

  // Single shared 2-layer routed layout across Schematic, PCB 2D, 3D, and BOM
  const routedResult: RoutingResult | null = useMemo(() => {
    if (!synthesis.circuit || synthesis.circuit.components.length === 0) return null;
    try {
      const placed = placeCircuit(synthesis.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      const routed = routeCircuit(placed.layout, synthesis.circuit, { gridPitchMm: 0.635 });
      return routed;
    } catch (e) {
      console.warn("Auto-routing fallback:", e);
      try {
        const placed = placeCircuit(synthesis.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
        return {
          layout: placed.layout,
          totalConnections: 0,
          routedConnections: 0,
          unroutedConnections: 0,
          drcErrors: [],
          wirelengthMm: 0,
          totalVias: 0,
          totalTraces: 0,
        };
      } catch {
        return null;
      }
    }
  }, [synthesis.circuit]);

  // Routing & DRC status badge metrics
  const routingBadgeStats = useMemo(() => {
    if (!routedResult) {
      return {
        total: 0,
        routed: 0,
        unrouted: 0,
        pct: "0.0",
        drcErrors: 0,
      };
    }
    const routed = routedResult.routedConnections ?? 0;
    const unrouted = routedResult.unroutedConnections ?? 0;
    const total = routed + unrouted;
    const pct = total > 0 ? ((routed / total) * 100).toFixed(1) : "100.0";
    const drcErrors = routedResult.layout.drc?.filter((d) => d.severity === "error").length ?? 0;
    return {
      total,
      routed,
      unrouted,
      pct,
      drcErrors,
    };
  }, [routedResult]);

  // Handle Preset Selection (Immediate update without debounce delay)
  const handleSelectPreset = (id: string) => {
    setSelectedSketchId(id);
    const found = SAMPLE_SKETCHES.find((s) => s.id === id);
    if (found) {
      setSketchSource(found.code);
      setDebouncedSource(found.code);
    }
  };

  // Add Annotation Helper (Immediate update)
  const handleInsertAnnotation = (ann: string) => {
    const updated = `${ann}\n${sketchSource}`;
    setSketchSource(updated);
    setDebouncedSource(updated);
  };

  const currentSketchMeta = SAMPLE_SKETCHES.find((s) => s.id === selectedSketchId);

  const errorCount = synthesis.diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = synthesis.diagnostics.filter((d) => d.severity === "warning").length;

  return (
    <div
      id="workbench-root"
      data-theme={theme}
      className={`theme-${theme} min-h-screen flex flex-col font-mono text-[12px]`}
      style={{
        backgroundColor: "var(--bg-app)",
        color: "var(--text-main)",
      }}
    >
      {/* Top Application Header / Navigation Ribbon */}
      <header
        id="workbench-header"
        className="border-b sticky top-0 z-40"
        style={{
          backgroundColor: "var(--bg-subpanel)",
          borderColor: "var(--border-app)",
        }}
      >
        {/* Top Status Bar: Consolidated Title Block & Actionable Controls (No Badge Soup) */}
        <div className="px-4 pt-2 pb-1.5 flex flex-wrap items-center justify-between gap-3">
          {/* Zone 1: Brand & Plain-text Title Block */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-6 h-6 flex items-center justify-center border rounded-[2px]"
              style={{
                borderColor: "var(--border-strong)",
                backgroundColor: "var(--bg-sunken)",
                color: "var(--text-main)",
              }}
            >
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <div>
              <span
                className="text-xs font-bold tracking-tight uppercase block leading-none"
                style={{ color: "var(--text-main)" }}
              >
                sketch2circuit
              </span>
              <p
                id="header-target-desc"
                className="text-[10px] font-mono tracking-tight leading-normal mt-0.5"
                style={{ color: "var(--text-muted)" }}
              >
                Sheet 1 — Arduino Uno R3 target · Synthesis Engine
              </p>
            </div>
          </div>

          {/* Zone 3: Genuine Actionable Badges & Plain Theme Toggle */}
          <div className="flex items-center gap-3">
            {/* Real Actionable Warning Status Badge */}
            <button
              id="status-routing-badge"
              type="button"
              onClick={() => setActiveMainTab("pcb")}
              className="px-2 py-0.5 border rounded-[2px] font-bold text-[10px] tracking-wide flex items-center gap-1.5 transition hover:brightness-110 cursor-pointer"
              style={{
                backgroundColor:
                  routingBadgeStats.unrouted > 0
                    ? "rgba(234, 88, 12, 0.16)"
                    : "rgba(34, 197, 94, 0.16)",
                borderColor: routingBadgeStats.unrouted > 0 ? "#ea580c" : "#22c55e",
                color: routingBadgeStats.unrouted > 0 ? "#fdba74" : "#86efac",
              }}
              title="Click to switch to 2D PCB Layout and inspect routing & DRC details"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>
                {routingBadgeStats.routed}/{routingBadgeStats.total} routed ({routingBadgeStats.pct}%)
                · {routingBadgeStats.drcErrors} DRC
              </span>
            </button>

            {/* Plain Theme Toggle Switch (Setting control, not a bordered badge) */}
            <button
              id="theme-toggle-switch"
              type="button"
              role="switch"
              aria-checked={theme === "light"}
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex items-center gap-2 cursor-pointer text-[10px] font-mono transition focus:outline-none"
              style={{ color: "var(--text-muted)" }}
              title="Toggle Visual Identity: Drafting Sheet (Light) / Oscilloscope (Dark)"
            >
              <span className="uppercase tracking-wider font-semibold" style={{ color: "var(--text-main)" }}>
                {theme === "dark" ? "Oscilloscope" : "Drafting Sheet"}
              </span>
              <span
                className="w-6 h-3.5 rounded-full p-0.5 flex items-center transition-colors"
                style={{
                  backgroundColor: theme === "dark" ? "#1F3824" : "#D9D4C4",
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shadow-xs transition-transform transform"
                  style={{
                    backgroundColor: theme === "dark" ? "#4ADE80" : "#B5432A",
                    transform: theme === "dark" ? "translateX(0)" : "translateX(10px)",
                  }}
                />
              </span>
            </button>
          </div>
        </div>

        {/* Zone 2: Navigation Folder Tabs Bar (Attached to content panel) */}
        <div id="workbench-tab-bar" className="px-4 flex items-end overflow-x-auto">
          <nav id="workbench-nav" className="flex items-end gap-1 text-[11px] overflow-x-auto -mb-px">
            <button
              id="tab-studio"
              type="button"
              onClick={() => setActiveMainTab("studio")}
              className={`folder-tab ${activeMainTab === "studio" ? "active" : ""}`}
              title="Interactive Sketch Editor & Schematic Vector View"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>SCHEMATIC</span>
            </button>

            <button
              id="tab-pcb"
              type="button"
              onClick={() => setActiveMainTab("pcb")}
              className={`folder-tab ${activeMainTab === "pcb" ? "active" : ""}`}
              title="2D Vector PCB Layout Workbench & DRC Engine"
            >
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-bold">2D PCB</span>
            </button>

            <button
              id="tab-pcb3d"
              type="button"
              onClick={() => setActiveMainTab("pcb3d")}
              className={`folder-tab ${activeMainTab === "pcb3d" ? "active" : ""}`}
              title="3D WebGL CAD Viewer with View-Cube & Orbit Controls"
            >
              <Boxes className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold">3D VIEWER</span>
            </button>

            <button
              id="tab-bom"
              type="button"
              onClick={() => setActiveMainTab("bom")}
              className={`folder-tab ${activeMainTab === "bom" ? "active" : ""}`}
              title="Bill of Materials with Component Footprints, Costs & Coordinates"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">BOM</span>
            </button>

            <button
              id="tab-erc"
              type="button"
              onClick={() => setActiveMainTab("erc")}
              className={`folder-tab ${activeMainTab === "erc" ? "active" : ""}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>ERC</span>
              {(errorCount > 0 || warningCount > 0) && (
                <span
                  className="ml-1 px-1 py-0.2 text-[9px] font-bold border rounded-[1px]"
                  style={{
                    backgroundColor: "var(--accent-copper-bg)",
                    borderColor: "var(--accent-copper-border)",
                    color: "var(--accent-copper)",
                  }}
                >
                  {errorCount + warningCount}
                </span>
              )}
            </button>

            <button
              id="tab-simulate"
              type="button"
              onClick={() => setActiveMainTab("simulate")}
              className={`folder-tab ${activeMainTab === "simulate" ? "active" : ""}`}
              title="In-Browser Numerical Simulation Engine & Circuit Dynamics (M17)"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-bold">SIMULATE</span>
            </button>

            <button
              id="tab-blockdiagram"
              type="button"
              onClick={() => setActiveMainTab("blockdiagram")}
              className={`folder-tab ${activeMainTab === "blockdiagram" ? "active" : ""}`}
              title="General Block-Diagram Simulation Editor & Wiring Canvas (M18)"
            >
              <Workflow className="w-3.5 h-3.5 text-sky-400" />
              <span className="font-bold">BLOCK DIAGRAM</span>
            </button>

            <button
              id="tab-export"
              type="button"
              onClick={() => setActiveMainTab("export")}
              className={`folder-tab ${activeMainTab === "export" ? "active" : ""}`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>EXPORTS</span>
            </button>

            <button
              id="tab-catalog"
              type="button"
              onClick={() => setActiveMainTab("catalog")}
              className={`folder-tab ${activeMainTab === "catalog" ? "active" : ""}`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>CATALOG</span>
            </button>

            <button
              id="tab-calculators"
              type="button"
              onClick={() => setActiveMainTab("calculators")}
              className={`folder-tab ${activeMainTab === "calculators" ? "active" : ""}`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>CALCS</span>
            </button>

            <button
              id="tab-docs"
              type="button"
              onClick={() => setActiveMainTab("docs")}
              className={`folder-tab ${activeMainTab === "docs" ? "active" : ""}`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>DOCS</span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-[1800px] w-full mx-auto flex flex-col space-y-3">
        {/* Upfront Board-Target Scope Notice & Architecture Mismatch Alert */}
        {synthesis.diagnostics.some(
          (d) => d.ruleId === "synthesis.board-architecture-mismatch",
        ) && (
          <div
            className="p-3 border rounded-[2px] flex items-start gap-3 text-xs"
            style={{
              backgroundColor: "rgba(234, 88, 12, 0.14)",
              borderColor: "#ea580c",
              color: "var(--text-main)",
            }}
          >
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-amber-400 tracking-wide uppercase">
                  BOARD TARGET SCOPE NOTICE: Sketch appears to target ESP32, but target board is
                  Arduino Uno R3.
                </span>
                <span className="px-1.5 py-0.2 text-[9px] border rounded-[1px] bg-amber-950/40 border-amber-600/50 text-amber-300 font-mono">
                  v1 Scope: Uno Only
                </span>
              </div>
              <div className="text-[11px] opacity-90 leading-relaxed">
                {
                  synthesis.diagnostics.find(
                    (d) => d.ruleId === "synthesis.board-architecture-mismatch",
                  )?.explanation
                }
              </div>
              <div className="text-[10px] text-amber-300 font-mono mt-0.5">
                💡 Only Arduino Uno R3 is supported in v1. Out-of-range GPIOs (≥20) and network
                libraries cannot be synthesized to Uno shields without @s2c annotations.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 1: ARDUINO SKETCH STUDIO & LIVE SYNTHESIZER                           */}
        {/* ========================================================================= */}
        {activeMainTab === "studio" && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[600px]">
            {/* LEFT COLUMN: Arduino Sketch Code Editor */}
            <div
              className="lg:col-span-5 flex flex-col border rounded-[2px] overflow-hidden"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              {/* Preset Selector & Board Target */}
              <div
                className="p-3 border-b space-y-2.5"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor="corpus-preset-select"
                      className="text-[10px] uppercase tracking-wider block mb-1 font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      CORPUS PRESET SKETCH:
                    </label>
                    <select
                      id="corpus-preset-select"
                      value={selectedSketchId}
                      onChange={(e) => handleSelectPreset(e.target.value)}
                      className="w-full border rounded-[2px] px-2 py-1 text-xs focus:outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    >
                      {SAMPLE_SKETCHES.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="mcu-target-select"
                      className="text-[10px] uppercase tracking-wider block mb-1 font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      MCU TARGET:
                    </label>
                    <select
                      id="mcu-target-select"
                      value={targetBoard}
                      onChange={(e) => setTargetBoard(e.target.value)}
                      className="border rounded-[2px] px-2 py-1 text-xs focus:outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    >
                      <option value="ARDUINO_UNO_R3">Arduino Uno R3</option>
                      <option value="ARDUINO_NANO">Arduino Nano V3</option>
                    </select>
                  </div>
                </div>

                {currentSketchMeta && (
                  <p
                    className="text-[11px] leading-relaxed p-2 border rounded-[1px]"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {currentSketchMeta.description}
                  </p>
                )}

                {/* Quick Annotation Injectors */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span
                    className="text-[9px] uppercase font-bold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    INJECT ANNOTATION:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleInsertAnnotation("// @s2c: led(color=blue) on D9")}
                    className="eng-btn"
                  >
                    + @s2c: led on D9
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertAnnotation("// @s2c: button on D2")}
                    className="eng-btn"
                  >
                    + @s2c: button on D2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertAnnotation("// @s2c: ignore on D0")}
                    className="eng-btn"
                  >
                    + @s2c: ignore D0
                  </button>
                </div>
              </div>

              {/* Code Editor Area */}
              <div className="flex-1 relative flex flex-col min-h-[350px]">
                <div
                  className="flex items-center justify-between px-3 py-1.5 border-b text-[10px]"
                  style={{
                    backgroundColor: "var(--bg-subpanel)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-muted)",
                  }}
                >
                  <span className="font-bold">sketch.ino (C++ / Arduino)</span>
                  <span>TREE-SITTER C++ AST ACTIVE</span>
                </div>
                <textarea
                  value={sketchSource}
                  onChange={(e) => setSketchSource(e.target.value)}
                  className="flex-1 w-full text-xs p-3 leading-relaxed resize-none focus:outline-none"
                  style={{
                    backgroundColor: "var(--code-bg)",
                    color: "var(--code-text)",
                  }}
                  spellCheck={false}
                />
              </div>

              {/* Editor Footer / Synthesis Status */}
              <div
                className="p-2.5 border-t flex items-center justify-between text-[11px]"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: "var(--accent-valid)" }}
                  />
                  <span style={{ color: "var(--text-main)" }}>
                    {synthesis.peripherals.length} PERIPHERALS INFERRED
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {synthesis.unresolved.length > 0 && (
                    <span
                      className="text-[10px] font-bold flex items-center gap-1"
                      style={{ color: "var(--accent-copper)" }}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {synthesis.unresolved.length} UNRESOLVED
                    </span>
                  )}
                  <span style={{ color: "var(--text-muted)" }}>AUTO-SYNTHESIS ACTIVE</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Schematic & Synthesis Inspector */}
            <div className="lg:col-span-7 flex flex-col space-y-3">
              {/* Sub-view switcher */}
              <div
                className="flex items-center justify-between p-1 border rounded-[2px] text-xs"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStudioRightView("pcb")}
                    className="eng-btn"
                    style={{
                      borderColor:
                        studioRightView === "pcb" ? "var(--border-strong)" : "var(--border-app)",
                      backgroundColor:
                        studioRightView === "pcb" ? "var(--bg-panel)" : "transparent",
                      color: "var(--text-main)",
                      fontWeight: studioRightView === "pcb" ? 600 : 400,
                    }}
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="font-bold">2D PCB VIEW (M12)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudioRightView("pcb3d")}
                    className="eng-btn"
                    style={{
                      borderColor:
                        studioRightView === "pcb3d" ? "var(--border-strong)" : "var(--border-app)",
                      backgroundColor:
                        studioRightView === "pcb3d" ? "var(--bg-panel)" : "transparent",
                      color: "var(--text-main)",
                      fontWeight: studioRightView === "pcb3d" ? 600 : 400,
                    }}
                  >
                    <Boxes className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="font-bold">3D PCB VIEW (M13)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudioRightView("schematic")}
                    className="eng-btn"
                    style={{
                      borderColor:
                        studioRightView === "schematic"
                          ? "var(--border-strong)"
                          : "var(--border-app)",
                      backgroundColor:
                        studioRightView === "schematic" ? "var(--bg-panel)" : "transparent",
                      color: "var(--text-main)",
                      fontWeight: studioRightView === "schematic" ? 600 : 400,
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>LIVE SCHEMATIC</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudioRightView("facts")}
                    className="eng-btn"
                    style={{
                      borderColor:
                        studioRightView === "facts" ? "var(--border-strong)" : "var(--border-app)",
                      backgroundColor:
                        studioRightView === "facts" ? "var(--bg-panel)" : "transparent",
                      color: "var(--text-main)",
                      fontWeight: studioRightView === "facts" ? 600 : 400,
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>INFERRED PERIPHERALS ({synthesis.peripherals.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudioRightView("pingraph")}
                    className="eng-btn"
                    style={{
                      borderColor:
                        studioRightView === "pingraph"
                          ? "var(--border-strong)"
                          : "var(--border-app)",
                      backgroundColor:
                        studioRightView === "pingraph" ? "var(--bg-panel)" : "transparent",
                      color: "var(--text-main)",
                      fontWeight: studioRightView === "pingraph" ? 600 : 400,
                    }}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>PIN GRAPH &amp; UNRESOLVED</span>
                  </button>
                </div>

                {/* Quick ERC badge link */}
                <button
                  type="button"
                  onClick={() => setActiveMainTab("erc")}
                  className="px-2 py-0.5 border rounded-[1px] text-[10px] flex items-center gap-1 transition"
                  style={{
                    borderColor:
                      errorCount > 0 || warningCount > 0
                        ? "var(--accent-copper-border)"
                        : "var(--accent-valid-border)",
                    backgroundColor:
                      errorCount > 0 || warningCount > 0
                        ? "var(--accent-copper-bg)"
                        : "var(--accent-valid-bg)",
                    color:
                      errorCount > 0 || warningCount > 0
                        ? "var(--accent-copper)"
                        : "var(--accent-valid)",
                  }}
                >
                  <ShieldAlert className="w-3 h-3" />
                  <span>
                    ERC: {errorCount} ERR, {warningCount} WARN
                  </span>
                </button>
              </div>

              {/* View 1: 2D PCB Canvas (M12) */}
              {studioRightView === "pcb" && (
                <div className="flex-1 min-h-[500px]">
                  <PcbViewer
                    circuit={synthesis.circuit}
                    sketchName={currentSketchMeta?.name || "ArduinoCircuit"}
                    theme={theme}
                  />
                </div>
              )}

              {/* View 1b: 3D PCB Viewer (M13) */}
              {studioRightView === "pcb3d" && (
                <div className="flex-1 min-h-[500px]">
                  <Pcb3DViewer
                    circuit={synthesis.circuit}
                    sketchName={currentSketchMeta?.name || "ArduinoCircuit"}
                    theme={theme}
                  />
                </div>
              )}

              {/* View 2: Vector Schematic */}
              {studioRightView === "schematic" && (
                <div className="flex-1 min-h-[500px]">
                  <SchematicViewer
                    circuit={synthesis.circuit}
                    sketchName={currentSketchMeta?.name || "ArduinoSketch"}
                    theme={theme}
                  />
                </div>
              )}

              {/* View 2: Inferred Peripherals with Evidence & Confidence */}
              {studioRightView === "facts" && (
                <div
                  className="flex-1 border rounded-[2px] p-4 overflow-y-auto space-y-3"
                  style={{
                    backgroundColor: "var(--bg-panel)",
                    borderColor: "var(--border-app)",
                  }}
                >
                  <div>
                    <h3
                      className="text-xs font-bold uppercase flex items-center gap-2"
                      style={{ color: "var(--text-main)" }}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>EVIDENCE-BASED PERIPHERAL INFERENCE (DOC §12.4A)</span>
                    </h3>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Deterministic audit trail showing confidence scoring, pin bindings, and sketch
                      evidence.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {synthesis.peripherals.length === 0 ? (
                      <p
                        className="text-[11px] italic p-6 text-center"
                        style={{ color: "var(--text-muted)" }}
                      >
                        No peripherals inferred from sketch.
                      </p>
                    ) : (
                      synthesis.peripherals.map((p, pIdx) => (
                        <div
                          key={`${p.id}-${pIdx}`}
                          className="p-3 border rounded-[2px] space-y-2"
                          style={{
                            backgroundColor: "var(--bg-subpanel)",
                            borderColor: "var(--border-app)",
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="font-bold text-xs"
                                style={{ color: "var(--text-main)" }}
                              >
                                {p.id}
                              </span>
                              <span
                                className="text-[10px] px-1.5 py-0.2 border rounded-[1px] uppercase font-bold"
                                style={{
                                  borderColor: "var(--border-app)",
                                  backgroundColor: "var(--bg-sunken)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {p.kind}
                              </span>
                            </div>

                            {/* Confidence Score Meter */}
                            <div className="flex items-center gap-2">
                              <div
                                className="w-20 h-1.5 border rounded-[1px] overflow-hidden"
                                style={{
                                  borderColor: "var(--border-app)",
                                  backgroundColor: "var(--bg-sunken)",
                                }}
                              >
                                <div
                                  className="h-full"
                                  style={{
                                    width: `${p.confidence * 100}%`,
                                    backgroundColor:
                                      p.confidence >= 0.8
                                        ? "var(--accent-valid)"
                                        : "var(--accent-copper)",
                                  }}
                                />
                              </div>
                              <span
                                className="text-[10px] font-bold"
                                style={{ color: "var(--text-main)" }}
                              >
                                {Math.round(p.confidence * 100)}%
                              </span>
                            </div>
                          </div>

                          {/* Connected Pins */}
                          <div className="flex gap-2 text-[10px] items-center">
                            <span style={{ color: "var(--text-muted)" }}>PINS:</span>
                            {Object.entries(p.pins).map(([role, pin]) => (
                              <span
                                key={role}
                                className="px-1.5 py-0.2 border rounded-[1px]"
                                style={{
                                  borderColor: "var(--border-app)",
                                  backgroundColor: "var(--bg-sunken)",
                                  color: "var(--text-main)",
                                }}
                              >
                                {role}: {pin}
                              </span>
                            ))}
                          </div>

                          {/* Evidence list */}
                          <div className="space-y-1 text-[11px]">
                            <span
                              className="font-bold block text-[9px] uppercase"
                              style={{ color: "var(--text-muted)" }}
                            >
                              SKETCH EVIDENCE:
                            </span>
                            {p.evidence.map((ev, i) => (
                              <p
                                key={i}
                                className="font-mono text-[10px] p-1 border rounded-[1px]"
                                style={{
                                  backgroundColor: "var(--bg-sunken)",
                                  borderColor: "var(--border-subtle)",
                                  color: "var(--text-muted)",
                                }}
                              >
                                • {ev}
                              </p>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* View 3: Pin Usage Graph & Unresolved Items */}
              {studioRightView === "pingraph" && (
                <div
                  className="flex-1 border rounded-[2px] p-4 overflow-y-auto space-y-4"
                  style={{
                    backgroundColor: "var(--bg-panel)",
                    borderColor: "var(--border-app)",
                  }}
                >
                  <div>
                    <h3
                      className="text-xs font-bold uppercase flex items-center gap-2"
                      style={{ color: "var(--text-main)" }}
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>PIN USAGE GRAPH (DOC §12.3)</span>
                    </h3>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Static analysis tracking of pinMode configurations and operation semantics.
                    </p>
                  </div>

                  {/* Pin Graph Table */}
                  <div
                    className="overflow-x-auto border rounded-[2px]"
                    style={{ borderColor: "var(--border-app)" }}
                  >
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead
                        className="border-b uppercase text-[9px] tracking-wider"
                        style={{
                          backgroundColor: "var(--bg-subpanel)",
                          borderColor: "var(--border-app)",
                          color: "var(--text-muted)",
                        }}
                      >
                        <tr>
                          <th className="py-2 px-3">PIN</th>
                          <th className="py-2 px-3">CONFIGURED MODES</th>
                          <th className="py-2 px-3">OPERATIONS</th>
                          <th className="py-2 px-3">IDENTIFIERS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: "var(--border-app)" }}>
                        {Array.from(synthesis.pinGraph.values()).map((p) => (
                          <tr key={p.pin}>
                            <td
                              className="py-2 px-3 font-bold"
                              style={{ color: "var(--text-main)" }}
                            >
                              {p.pin}
                            </td>
                            <td className="py-2 px-3" style={{ color: "var(--accent-valid)" }}>
                              {Array.from(p.modes).join(", ") || "—"}
                            </td>
                            <td className="py-2 px-3">{Array.from(p.ops).join(", ") || "—"}</td>
                            <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>
                              {p.nameHints.join(", ") || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: 2D PCB LAYOUT WORKBENCH (M12)                                      */}
        {/* ========================================================================= */}
        {activeMainTab === "pcb" && (
          <div className="flex-1 flex flex-col space-y-3 min-h-[700px]">
            {/* Top PCB Sketch & Target Control Ribbon */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 p-2.5 border rounded-[2px] text-xs"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ACTIVE CIRCUIT / SKETCH:
                  </span>
                  <select
                    value={selectedSketchId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="border rounded-[2px] px-2 py-1 text-xs focus:outline-none font-mono"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    {SAMPLE_SKETCHES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    TARGET BOARD:
                  </span>
                  <select
                    value={targetBoard}
                    onChange={(e) => setTargetBoard(e.target.value)}
                    className="border rounded-[2px] px-2 py-1 text-xs focus:outline-none font-mono"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="ARDUINO_UNO_R3">Arduino Uno R3 Shield</option>
                    <option value="ARDUINO_NANO">Arduino Nano V3 Shield</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-2 py-0.5 border rounded-[1px] font-mono"
                  style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}
                >
                  {synthesis.circuit.components.length} COMPONENTS · {synthesis.circuit.nets.length}{" "}
                  NETS
                </span>
                {selectedSketchId !== "user_multi_peripheral" && (
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("user_multi_peripheral")}
                    className="eng-btn font-bold text-amber-400"
                    title="Load user_multi_peripheral benchmark"
                  >
                    ⚡ Load 12. User Multi-Peripheral Benchmark
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[650px]">
              <PcbViewer
                circuit={synthesis.circuit}
                layout={routedResult?.layout}
                sketchName={currentSketchMeta?.name || "ArduinoCircuit"}
                theme={theme}
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2b: 3D PCB VIEWER WORKBENCH (M13)                                     */}
        {/* ========================================================================= */}
        {activeMainTab === "pcb3d" && (
          <div className="flex-1 flex flex-col space-y-3 min-h-[700px]">
            {/* Top PCB Sketch & Target Control Ribbon */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 p-2.5 border rounded-[2px] text-xs"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ACTIVE CIRCUIT / SKETCH:
                  </span>
                  <select
                    value={selectedSketchId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="border rounded-[2px] px-2 py-1 text-xs focus:outline-none font-mono"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    {SAMPLE_SKETCHES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    TARGET BOARD:
                  </span>
                  <select
                    value={targetBoard}
                    onChange={(e) => setTargetBoard(e.target.value)}
                    className="border rounded-[2px] px-2 py-1 text-xs focus:outline-none font-mono"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="ARDUINO_UNO_R3">Arduino Uno R3 Shield</option>
                    <option value="ARDUINO_NANO">Arduino Nano V3 Shield</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-2 py-0.5 border rounded-[1px] font-mono"
                  style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}
                >
                  {synthesis.circuit.components.length} COMPONENTS · 3D WEBGL CAD
                </span>
                {selectedSketchId !== "user_multi_peripheral" && (
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("user_multi_peripheral")}
                    className="eng-btn font-bold text-amber-400"
                    title="Load user_multi_peripheral benchmark"
                  >
                    ⚡ Load 12. User Multi-Peripheral Benchmark
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[650px]">
              <Pcb3DViewer
                circuit={synthesis.circuit}
                layout={routedResult?.layout}
                sketchName={currentSketchMeta?.name || "ArduinoCircuit"}
                theme={theme}
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2c: BILL OF MATERIALS (BOM) WORKBENCH (M14)                           */}
        {/* ========================================================================= */}
        {activeMainTab === "bom" && (
          <div className="flex-1 flex flex-col space-y-3 min-h-[700px]">
            {/* Top PCB Sketch & Target Control Ribbon */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 p-2.5 border rounded-[2px] text-xs"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    ACTIVE CIRCUIT / SKETCH:
                  </span>
                  <select
                    value={selectedSketchId}
                    onChange={(e) => handleSelectPreset(e.target.value)}
                    className="border rounded-[2px] px-2 py-1 text-xs focus:outline-none font-mono"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    {SAMPLE_SKETCHES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] uppercase font-bold tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    TARGET BOARD:
                  </span>
                  <select
                    value={targetBoard}
                    onChange={(e) => setTargetBoard(e.target.value)}
                    className="border rounded-[2px] px-2 py-1 text-xs focus:outline-none font-mono"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="ARDUINO_UNO_R3">Arduino Uno R3 Shield</option>
                    <option value="ARDUINO_NANO">Arduino Nano V3 Shield</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className="text-[10px] px-2 py-0.5 border rounded-[1px] font-mono"
                  style={{ borderColor: "var(--border-strong)", color: "var(--text-muted)" }}
                >
                  {synthesis.circuit.components.length} COMPONENTS · BILL OF MATERIALS
                </span>
                {selectedSketchId !== "user_multi_peripheral" && (
                  <button
                    type="button"
                    onClick={() => handleSelectPreset("user_multi_peripheral")}
                    className="eng-btn font-bold text-amber-400"
                    title="Load user_multi_peripheral benchmark"
                  >
                    ⚡ Load 12. User Multi-Peripheral Benchmark
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-[650px]">
              <BomViewerTab
                circuit={synthesis.circuit}
                layout={routedResult?.layout}
                sketchName={currentSketchMeta?.name || "ArduinoCircuit"}
                theme={theme}
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ELECTRICAL RULES CHECK (ERC) DIAGNOSTICS                            */}
        {/* ========================================================================= */}
        {activeMainTab === "erc" && (
          <div className="flex-1 min-h-[600px]">
            <ErcDiagnostics diagnostics={synthesis.diagnostics} />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3b: IN-BROWSER SIMULATION ENGINE & ODE SOLVER (M17)                   */}
        {/* ========================================================================= */}
        {activeMainTab === "simulate" && (
          <div className="flex-1 min-h-[650px] flex flex-col">
            <SimulationTab
              circuit={synthesis.circuit}
              sketchName={currentSketchMeta?.name || "SynthesizedCircuit"}
              theme={theme}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3c: GENERAL BLOCK-DIAGRAM SIMULATION EDITOR & CANVAS (M18)            */}
        {/* ========================================================================= */}
        {activeMainTab === "blockdiagram" && (
          <div className="flex-1 min-h-[700px] flex flex-col">
            <BlockDiagramTab
              circuit={synthesis.circuit}
              sketchName={currentSketchMeta?.name || "SynthesizedCircuit"}
              theme={theme}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: MULTI-FORMAT ARTIFACT EXPORTS                                      */}
        {/* ========================================================================= */}
        {activeMainTab === "export" && (
          <div className="flex-1 min-h-[600px]">
            <ExportArtifacts
              circuit={synthesis.circuit}
              diagnostics={synthesis.diagnostics}
              sketchName={currentSketchMeta?.name || "SynthesizedCircuit"}
              sourceCode={sketchSource}
            />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PARTS CATALOG EXPLORER                                             */}
        {/* ========================================================================= */}
        {activeMainTab === "catalog" && (
          <div className="flex-1 min-h-[600px]">
            <PartsCatalogBrowser />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: ENGINEERING CALCULATORS                                            */}
        {/* ========================================================================= */}
        {activeMainTab === "calculators" && (
          <div className="flex-1 min-h-[600px]">
            <CalculatorsTab />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: DOCUMENTATION & PHYSICAL VALIDATION (M8)                           */}
        {/* ========================================================================= */}
        {activeMainTab === "docs" && (
          <div className="flex-1 min-h-[600px]">
            <DocumentationTab />
          </div>
        )}
      </main>
    </div>
  );
}
