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
  // Main Tab Navigation
  const [activeMainTab, setActiveMainTab] = useState<
    "studio" | "erc" | "export" | "catalog" | "calculators" | "docs"
  >("studio");

  // Studio Sub-view: Schematic vs. Facts/Inference
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
      // In case of syntax error during typing, provide a graceful fallback with diagnostic
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
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white"
    >
      {/* Top Application Header */}
      <header
        id="workbench-header"
        className="border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">sketch2circuit</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Evidence-Based Synthesizer
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Electronics-as-Code Compiler &amp; 18-Rule Electrical Verification
            </p>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <nav
          id="workbench-nav"
          className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-xs"
        >
          <button
            id="tab-studio"
            type="button"
            onClick={() => setActiveMainTab("studio")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeMainTab === "studio"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Sketch Studio</span>
          </button>

          <button
            id="tab-erc"
            type="button"
            onClick={() => setActiveMainTab("erc")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeMainTab === "erc"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>ERC Diagnostics</span>
            {(errorCount > 0 || warningCount > 0) && (
              <span
                className={`ml-0.5 px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                  errorCount > 0
                    ? "bg-rose-500 text-white"
                    : "bg-amber-500 text-slate-950 font-bold"
                }`}
              >
                {errorCount || warningCount}
              </span>
            )}
          </button>

          <button
            id="tab-export"
            type="button"
            onClick={() => setActiveMainTab("export")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeMainTab === "export"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Export Artifacts</span>
          </button>

          <button
            id="tab-catalog"
            type="button"
            onClick={() => setActiveMainTab("catalog")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeMainTab === "catalog"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>Parts Catalog</span>
          </button>

          <button
            id="tab-calculators"
            type="button"
            onClick={() => setActiveMainTab("calculators")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeMainTab === "calculators"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Calculators</span>
          </button>

          <button
            id="tab-docs"
            type="button"
            onClick={() => setActiveMainTab("docs")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeMainTab === "docs"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-400" />
            <span>Docs &amp; Validation</span>
          </button>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 lg:p-6 max-w-[1700px] w-full mx-auto flex flex-col">
        {/* ========================================================================= */}
        {/* TAB 1: ARDUINO SKETCH STUDIO & LIVE SYNTHESIZER                           */}
        {/* ========================================================================= */}
        {activeMainTab === "studio" && (
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[600px]">
            {/* LEFT COLUMN: Arduino Sketch Code Editor */}
            <div className="lg:col-span-5 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
              {/* Preset Selector & Board Target */}
              <div className="p-3.5 bg-slate-950/80 border-b border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor="corpus-preset-select"
                      className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1"
                    >
                      Corpus Preset Sketch:
                    </label>
                    <select
                      id="corpus-preset-select"
                      value={selectedSketchId}
                      onChange={(e) => handleSelectPreset(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-medium focus:outline-none focus:border-indigo-500"
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
                      className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1"
                    >
                      MCU Target:
                    </label>
                    <select
                      id="mcu-target-select"
                      value={targetBoard}
                      onChange={(e) => setTargetBoard(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500"
                    >
                      <option value="ARDUINO_UNO_R3">Arduino Uno R3</option>
                      <option value="ARDUINO_NANO">Arduino Nano V3</option>
                    </select>
                  </div>
                </div>

                {currentSketchMeta && (
                  <p className="text-xs text-slate-400 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                    {currentSketchMeta.description}
                  </p>
                )}

                {/* Quick Annotation Injectors */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">
                    Insert Annotation:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleInsertAnnotation("// @s2c: led(color=blue) on D9")}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-[10px] transition"
                  >
                    + @s2c: led on D9
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertAnnotation("// @s2c: button on D2")}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 font-mono text-[10px] transition"
                  >
                    + @s2c: button on D2
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertAnnotation("// @s2c: ignore on D0")}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono text-[10px] transition"
                  >
                    + @s2c: ignore D0
                  </button>
                </div>
              </div>

              {/* Code Editor Area */}
              <div className="flex-1 relative flex flex-col min-h-[350px]">
                <div className="flex items-center justify-between px-3 py-1.5 bg-slate-950 border-b border-slate-800 text-[11px] font-mono text-slate-400">
                  <span>sketch.ino (C++ / Arduino)</span>
                  <span className="text-slate-500">Tree-sitter C++ AST active</span>
                </div>
                <textarea
                  value={sketchSource}
                  onChange={(e) => setSketchSource(e.target.value)}
                  className="flex-1 w-full bg-slate-950/90 text-slate-100 font-mono text-xs p-4 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  spellCheck={false}
                />
              </div>

              {/* Editor Footer / Synthesis Status */}
              <div className="p-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="font-mono text-slate-300">
                    {synthesis.peripherals.length} peripherals inferred
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {synthesis.unresolved.length > 0 && (
                    <span className="text-amber-400 font-mono text-[11px] flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {synthesis.unresolved.length} Unresolved
                    </span>
                  )}
                  <span className="text-slate-500 font-mono text-[11px]">
                    Auto-synthesizing live
                  </span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Interactive Schematic & Synthesis Inspector */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              {/* Sub-view switcher */}
              <div className="flex items-center justify-between bg-slate-900/60 p-1.5 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setStudioRightView("schematic")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      studioRightView === "schematic"
                        ? "bg-indigo-600 text-white font-medium"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Live Schematic</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudioRightView("facts")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      studioRightView === "facts"
                        ? "bg-indigo-600 text-white font-medium"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Inferred Peripherals ({synthesis.peripherals.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStudioRightView("pingraph")}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                      studioRightView === "pingraph"
                        ? "bg-indigo-600 text-white font-medium"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>Pin Graph &amp; Unresolved</span>
                  </button>
                </div>

                {/* Quick ERC badge link */}
                <button
                  type="button"
                  onClick={() => setActiveMainTab("erc")}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 text-[11px] font-mono border transition ${
                    errorCount > 0
                      ? "bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20"
                      : warningCount > 0
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>
                    ERC: {errorCount} Err, {warningCount} Warn
                  </span>
                </button>
              </div>

              {/* View 1: Vector Schematic */}
              {studioRightView === "schematic" && (
                <div className="flex-1 min-h-[500px]">
                  <SchematicViewer
                    circuit={synthesis.circuit}
                    sketchName={currentSketchMeta?.name || "ArduinoSketch"}
                  />
                </div>
              )}

              {/* View 2: Inferred Peripherals with Evidence & Confidence */}
              {studioRightView === "facts" && (
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-5 overflow-y-auto space-y-4 shadow-2xl">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>Evidence-Based Peripheral Inference (Doc §12.4a)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Every peripheral component is synthesized with an audit trail showing
                      confidence scoring and code evidence.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {synthesis.peripherals.length === 0 ? (
                      <p className="text-xs text-slate-500 italic p-6 text-center">
                        No peripherals inferred from current sketch. Add pin operations or @s2c
                        annotations.
                      </p>
                    ) : (
                      synthesis.peripherals.map((p) => (
                        <div
                          key={p.id}
                          className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-indigo-400">
                                {p.id}
                              </span>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono capitalize">
                                {p.kind}
                              </span>
                            </div>

                            {/* Confidence Score Meter */}
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    p.confidence >= 0.9
                                      ? "bg-emerald-400"
                                      : p.confidence >= 0.7
                                        ? "bg-amber-400"
                                        : "bg-rose-400"
                                  }`}
                                  style={{ width: `${p.confidence * 100}%` }}
                                />
                              </div>
                              <span className="font-mono text-xs text-slate-200">
                                {Math.round(p.confidence * 100)}%
                              </span>
                            </div>
                          </div>

                          {/* Connected Pins */}
                          <div className="flex gap-2 text-xs font-mono">
                            <span className="text-slate-500">Connected Pins:</span>
                            {Object.entries(p.pins).map(([role, pin]) => (
                              <span
                                key={role}
                                className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-amber-300"
                              >
                                {role}: {pin}
                              </span>
                            ))}
                          </div>

                          {/* Evidence list */}
                          <div className="space-y-1 text-xs">
                            <span className="text-slate-500 font-semibold block text-[11px]">
                              Evidence from Sketch:
                            </span>
                            {p.evidence.map((ev, i) => (
                              <p
                                key={i}
                                className="text-slate-300 font-mono text-[11px] bg-slate-900/60 p-1.5 rounded border border-slate-800/80"
                              >
                                • {ev}
                              </p>
                            ))}
                          </div>

                          {/* Assumptions */}
                          {p.assumptions.length > 0 && (
                            <div className="text-xs bg-slate-900/40 p-2 rounded border border-slate-800 text-slate-400">
                              <strong className="text-slate-300 text-[11px]">
                                Hardware Assumptions:
                              </strong>{" "}
                              {p.assumptions.join("; ")}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* View 3: Pin Usage Graph & Unresolved Items */}
              {studioRightView === "pingraph" && (
                <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-5 overflow-y-auto space-y-5 shadow-2xl">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span>Pin Usage Graph (Doc §12.3)</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Tracks pinMode configurations, operations (digitalWrite, analogRead, tone),
                      and dynamic expression resolution.
                    </p>
                  </div>

                  {/* Pin Graph Table */}
                  <div className="overflow-x-auto border border-slate-800 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-950 text-slate-300 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3">Pin</th>
                          <th className="py-2.5 px-3">Configured Modes</th>
                          <th className="py-2.5 px-3">Operations</th>
                          <th className="py-2.5 px-3">Variable Identifiers</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                        {Array.from(synthesis.pinGraph.values()).map((p) => (
                          <tr key={p.pin} className="hover:bg-slate-800/40 transition">
                            <td className="py-2 px-3 font-bold text-indigo-400">{p.pin}</td>
                            <td className="py-2 px-3 text-emerald-400">
                              {Array.from(p.modes).join(", ") || "—"}
                            </td>
                            <td className="py-2 px-3 text-amber-300">
                              {Array.from(p.ops).join(", ") || "—"}
                            </td>
                            <td className="py-2 px-3 text-slate-400">
                              {p.nameHints.join(", ") || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Unresolved items panel */}
                  <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/30 space-y-2">
                    <h4 className="text-xs font-semibold text-amber-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Unresolved Dynamic Pin Expressions (Doc §12.8)</span>
                    </h4>
                    {synthesis.unresolvedItems.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        All pin references in the sketch are statically resolved constants or
                        macros. No dynamic runtime indexes detected.
                      </p>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {synthesis.unresolvedItems.map((u, i) => (
                          <div
                            key={i}
                            className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 text-xs font-mono space-y-1"
                          >
                            <div className="text-rose-400 font-bold">
                              Expression: {u.expression}
                            </div>
                            <div className="text-slate-300 text-[11px] font-sans">{u.reason}</div>
                            <div className="text-slate-500 text-[10px]">
                              Rule: System strictly refuses to guess dynamic pins at compile time.
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
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
      <footer className="border-t border-slate-800 px-6 py-3 bg-slate-950 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-400">sketch2circuit v0.1.0</span>
          <span>·</span>
          <span>Doc §12 Arduino Synthesis Pipeline</span>
          <span>·</span>
          <span>Doc §10 Net-Label Schematic Renderer</span>
          <span>·</span>
          <span>18-Rule Electrical Check Engine</span>
        </div>
        <div className="font-mono text-[11px]">Deterministic Pipeline · Output IR Schema 0.1.0</div>
      </footer>
    </div>
  );
}
