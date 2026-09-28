/**
 * @license Apache-2.0
 * sketch2circuit — Interactive Browser Playground & Synthesis IDE (Milestone 7).
 */

import { type SynthesisResult, synthesizeSketch } from "@s2c/arduino";
import {
  AlertTriangle,
  BookOpen,
  Boxes,
  Calculator,
  Code2,
  Cpu,
  Eye,
  Layers,
  Share2,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { useMemo, useState } from "react";
import { CalculatorsTab } from "./components/CalculatorsTab.js";
import { DocumentationTab } from "./components/DocumentationTab.js";
import { ErcDiagnostics } from "./components/ErcDiagnostics.js";
import { ExportArtifacts } from "./components/ExportArtifacts.js";
import { PartsCatalogBrowser } from "./components/PartsCatalogBrowser.js";
import { SchematicViewer } from "./components/SchematicViewer.js";
import { SAMPLE_SKETCHES } from "./components/sample-sketches.js";

export default function App() {
  // Theme state: "dark" (Oscilloscope) vs "light" (Drafting Sheet)
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // Main Tab Navigation
  const [activeMainTab, setActiveMainTab] = useState<
    "studio" | "erc" | "export" | "catalog" | "calculators" | "docs"
  >("studio");

  // Studio Sub-view: Schematic vs. Facts/Inference vs. Pin Graph
  const [studioRightView, setStudioRightView] = useState<"schematic" | "facts" | "pingraph">(
    "schematic",
  );

  // Synthesizer State
  const [selectedSketchId, setSelectedSketchId] = useState<string>("blink");
  const [sketchSource, setSketchSource] = useState<string>(SAMPLE_SKETCHES[0].code);
  const [targetBoard, setTargetBoard] = useState<string>("ARDUINO_UNO_R3");

  // Run Synthesis reactively
  const synthesis: SynthesisResult = useMemo(() => {
    try {
      return synthesizeSketch(sketchSource, {
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
  }, [sketchSource, targetBoard]);

  // Handle Preset Selection
  const handleSelectPreset = (id: string) => {
    setSelectedSketchId(id);
    const found = SAMPLE_SKETCHES.find((s) => s.id === id);
    if (found) {
      setSketchSource(found.code);
    }
  };

  // Add Annotation Helper
  const handleInsertAnnotation = (ann: string) => {
    setSketchSource((prev) => `${ann}\n${prev}`);
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
        className="border-b px-4 py-2.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40"
        style={{
          backgroundColor: "var(--bg-subpanel)",
          borderColor: "var(--border-app)",
        }}
      >
        {/* Zone 1: Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 flex items-center justify-center border rounded-[2px]"
            style={{
              borderColor: "var(--border-strong)",
              backgroundColor: "var(--bg-sunken)",
              color: "var(--text-main)",
            }}
          >
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-sm font-bold tracking-tight uppercase"
                style={{ color: "var(--text-main)" }}
              >
                sketch2circuit
              </span>
              <span
                className="text-[9px] px-1.5 py-0.2 border rounded-[1px] font-mono tracking-wider"
                style={{
                  borderColor: "var(--border-strong)",
                  color: "var(--text-main)",
                }}
              >
                SYNTHESIS ENGINE
              </span>
            </div>
            <p className="text-[10px] hidden sm:block" style={{ color: "var(--text-muted)" }}>
              CODE-TO-CIRCUIT COMPILER &amp; DETERMINISTIC ERC VALIDATION
            </p>
          </div>
        </div>

        {/* Zone 2: Navigation Folder Tabs */}
        <nav id="workbench-nav" className="flex items-end gap-1 text-[11px] overflow-x-auto">
          <button
            id="tab-studio"
            type="button"
            onClick={() => setActiveMainTab("studio")}
            className={`folder-tab ${activeMainTab === "studio" ? "active" : ""}`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>SKETCH STUDIO</span>
          </button>

          <button
            id="tab-erc"
            type="button"
            onClick={() => setActiveMainTab("erc")}
            className={`folder-tab ${activeMainTab === "erc" ? "active" : ""}`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>ERC DIAGNOSTICS</span>
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
            id="tab-export"
            type="button"
            onClick={() => setActiveMainTab("export")}
            className={`folder-tab ${activeMainTab === "export" ? "active" : ""}`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>EXPORT ARTIFACTS</span>
          </button>

          <button
            id="tab-catalog"
            type="button"
            onClick={() => setActiveMainTab("catalog")}
            className={`folder-tab ${activeMainTab === "catalog" ? "active" : ""}`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>PARTS CATALOG</span>
          </button>

          <button
            id="tab-calculators"
            type="button"
            onClick={() => setActiveMainTab("calculators")}
            className={`folder-tab ${activeMainTab === "calculators" ? "active" : ""}`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>CALCULATORS</span>
          </button>

          <button
            id="tab-docs"
            type="button"
            onClick={() => setActiveMainTab("docs")}
            className={`folder-tab ${activeMainTab === "docs" ? "active" : ""}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>DOCS &amp; VALIDATION</span>
          </button>
        </nav>

        {/* Zone 3: Theme Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="eng-btn"
            title="Toggle Visual Identity: Drafting Sheet (Light) / Oscilloscope (Dark)"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: theme === "dark" ? "#4ADE80" : "#B5432A",
              }}
            />
            <span className="text-[10px] font-bold tracking-wider uppercase">
              {theme === "dark" ? "THEME: OSCILLOSCOPE" : "THEME: DRAFTING SHEET"}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 max-w-[1800px] w-full mx-auto flex flex-col">
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

              {/* View 1: Vector Schematic */}
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
        {/* TAB 2: ELECTRICAL RULES CHECK (ERC) DIAGNOSTICS                            */}
        {/* ========================================================================= */}
        {activeMainTab === "erc" && (
          <div className="flex-1 min-h-[600px]">
            <ErcDiagnostics diagnostics={synthesis.diagnostics} />
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

      {/* Footer */}
      <footer
        className="border-t px-4 py-2 text-[10px] flex flex-wrap items-center justify-between gap-4"
        style={{
          backgroundColor: "var(--bg-subpanel)",
          borderColor: "var(--border-app)",
          color: "var(--text-muted)",
        }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold" style={{ color: "var(--text-main)" }}>
            sketch2circuit CAD WORKBENCH
          </span>
          <span>·</span>
          <span>DOC §12 SYNTHESIS</span>
          <span>·</span>
          <span>DOC §10 NET-LABEL SCHEMATIC</span>
          <span>·</span>
          <span>18-RULE ERC ENGINE</span>
        </div>
        <div>DETERMINISTIC COMPILATION · OUTPUT IR SCHEMA 0.1.0</div>
      </footer>
    </div>
  );
}
