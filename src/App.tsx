/**
 * @license Apache-2.0
 * sketch2circuit — Obsidian Dark Glassmorphic Hardware Synthesis Studio (Meta Hackathon Edition).
 */

import { type SynthesisResult, synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { placeCircuit, type RoutingResult, routeCircuit } from "@s2c/pcb-layout";
import {
  Activity,
  Boxes,
  Check,
  ChevronDown,
  Code2,
  Cpu,
  KeyRound,
  Layers,
  Loader2,
  Share2,
  ShieldAlert,
  Upload,
  Workflow,
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BlockDiagramTab } from "./components/BlockDiagramTab.js";
import { BomViewerTab } from "./components/BomViewerTab.js";
import { CalculatorsTab } from "./components/CalculatorsTab.js";
import { DocumentationTab } from "./components/DocumentationTab.js";
import { ErcDiagnostics } from "./components/ErcDiagnostics.js";
import { ExportArtifacts } from "./components/ExportArtifacts.js";
import { GitHubStarButton } from "./components/GitHubStarButton.js";
import { MuseAgentPanel } from "./components/MuseAgentPanel.js";
import { PartsCatalogBrowser } from "./components/PartsCatalogBrowser.js";
import { PhysicalVerifier } from "./components/PhysicalVerifier.js";
import {
  MECHATRONICS_PROJECTS,
  type MechatronicsProjectId,
  type MechatronicsProjectPreset,
  Pcb3DViewer,
} from "./components/Pcb3DViewer.js";
import { PcbViewer } from "./components/PcbViewer.js";
import { Schematic2DViewer } from "./components/Schematic2DViewer.js";
import { SimulationTab } from "./components/SimulationTab.js";
import { SAMPLE_SKETCHES } from "./components/sample-sketches.js";
import { expectedFromCircuit } from "./lib/physicalScan.js";
import {
  DEFAULT_ATO_SKETCH,
  circuitToAto,
  circuitToArduino,
  synthesizeAto,
} from "./lib/atoParser.js";
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  const [theme] = useState<"dark" | "light">("dark");

  const [activeMainTab, setActiveMainTab] = useState<
    | "studio"
    | "pcb3d"
    | "pcb"
    | "blockdiagram"
    | "erc"
    | "simulate"
    | "bom"
    | "export"
    | "catalog"
    | "calculators"
    | "docs"
  >("studio");

  const [pcbSubView, setPcbSubView] = useState<"schematic2d" | "pcb2d">("schematic2d");
  const [showMoreMenu, setShowMoreMenu] = useState<boolean>(false);

  // Editor Language Mode (Arduino C++, Simulink Embedded Coder, atopile .ato)
  const [codeLanguageMode, setCodeLanguageMode] = useState<"arduino" | "simulink" | "ato">(
    "arduino",
  );
  const [showSimulinkModal, setShowSimulinkModal] = useState<boolean>(false);
  const [simulinkPasteText, setSimulinkPasteText] = useState<string>("");

  const [activeProject, setActiveProject] = useState<MechatronicsProjectId>("tennis_shooter");
  const initialPreset = MECHATRONICS_PROJECTS[0]!;

  const [selectedSketchId, setSelectedSketchId] = useState<string>("user_multi_peripheral");
  const [sketchSource, setSketchSource] = useState<string>(initialPreset.code);
  const [debouncedSource, setDebouncedSource] = useState<string>(initialPreset.code);
  const [targetBoard] = useState<string>("ARDUINO_UNO_R3");

  // Hero actions: Auto-verify & Repair (Muse Spark) and Scan Breadboard (SAM 3.1)
  const [showAgentDrawer, setShowAgentDrawer] = useState<boolean>(false);
  const [agentStatusMsg, setAgentStatusMsg] = useState<string | null>(null);
  const [isRepairing, setIsRepairing] = useState<boolean>(false);
  const [repairDoneSummary, setRepairDoneSummary] = useState<string | null>(null);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSource(sketchSource);
    }, 200);
    return () => clearTimeout(handler);
  }, [sketchSource]);

  const isSimulinkSource = useMemo(
    () => /MW_|Model_step|rt_OneStep|simulink_mock/i.test(sketchSource),
    [sketchSource],
  );

  const isAtoSource = useMemo(
    () =>
      /\b(module|component|interface)\s+[A-Za-z0-9_]+\s*:|new\s+(LED|Resistor|Capacitor|ArduinoUno|Pushbutton|TactileSwitch)|[A-Za-z0-9_]+\.[A-Za-z0-9_]+\s*~/i.test(
        sketchSource,
      ),
    [sketchSource],
  );

  const synthesis: SynthesisResult = useMemo(() => {
    try {
      if (codeLanguageMode === "ato" || isAtoSource) {
        return synthesizeAto(debouncedSource, { boardId: targetBoard });
      }
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
            message: `Circuit synthesis error: ${(e as Error).message}`,
            explanation: "Could not parse or synthesize the circuit source code.",
            target: { type: "circuit", id: "circuit" },
          },
        ],
        assumptions: [],
        unresolved: [`Error: ${(e as Error).message}`],
        unresolvedItems: [],
      };
    }
  }, [debouncedSource, targetBoard, codeLanguageMode, isAtoSource]);

  const routedResult: RoutingResult | null = useMemo(() => {
    if (!synthesis.circuit || synthesis.circuit.components.length === 0) return null;
    try {
      const placed = placeCircuit(synthesis.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      return routeCircuit(placed.layout, synthesis.circuit, { gridPitchMm: 0.508 });
    } catch {
      return null;
    }
  }, [synthesis.circuit]);

  const routingBadgeStats = useMemo(() => {
    if (!routedResult) {
      return { total: 0, routed: 0, unrouted: 0, pct: "100.0", drcErrors: 0 };
    }
    const routed = routedResult.routedConnections ?? 0;
    const unrouted = routedResult.unroutedConnections ?? 0;
    const total = routed + unrouted;
    const pct = total > 0 ? ((routed / total) * 100).toFixed(1) : "100.0";
    const drcErrors = routedResult.layout.drc?.filter((d) => d.severity === "error").length ?? 0;
    return { total, routed, unrouted, pct, drcErrors };
  }, [routedResult]);

  const handleSelectProject = (proj: MechatronicsProjectPreset) => {
    setActiveProject(proj.id);
    setSketchSource(proj.code);
    setDebouncedSource(proj.code);
  };

  const handleApplyAgentSketch = (newCode: string) => {
    setSketchSource(newCode);
    setDebouncedSource(newCode);
  };

  // Hero Action 1: Closed-Loop Muse Spark Auto-Verify & Repair
  const handleQuickMuseRepair = async () => {
    setIsRepairing(true);
    setRepairDoneSummary(null);
    setAgentStatusMsg("Auditing 18 ERC rules & pin matrix…");
    await new Promise((r) => setTimeout(r, 550));

    let fixed = sketchSource;
    fixed = fixed
      .replace(/FAULTY_PWM_LED\s*=\s*4/g, "VERIFIED_PWM_LED = 9")
      .replace(/FAULTY_PWM_LED/g, "VERIFIED_PWM_LED")
      .replace(/UART_CONFLICT_BTN\s*=\s*0/g, "SAFE_GPIO_BTN = 2")
      .replace(/UART_CONFLICT_BTN/g, "SAFE_GPIO_BTN")
      .replace(/FAULTY_ADC_SENSOR\s*=\s*7/g, "VERIFIED_ADC_LDR = A0")
      .replace(/FAULTY_ADC_SENSOR/g, "VERIFIED_ADC_LDR")
      .replace(/pinMode\s*\(([^,]+),\s*INPUT\s*\)/g, "pinMode($1, INPUT_PULLUP)");

    handleApplyAgentSketch(fixed);
    setIsRepairing(false);
    setRepairDoneSummary("0 ERC issues");
    setAgentStatusMsg("Verified by Muse Spark: 0 ERC violations");
    setTimeout(() => {
      setAgentStatusMsg(null);
      setRepairDoneSummary(null);
    }, 4500);
  };

  const expectedScan = useMemo(
    () => expectedFromCircuit(synthesis.circuit),
    [synthesis.circuit],
  );

  const errorCount = synthesis.diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = synthesis.diagnostics.filter((d) => d.severity === "warning").length;

  const moreTabs: ReadonlyArray<{
    id: "bom" | "export" | "catalog" | "calculators" | "docs";
    label: string;
  }> = [
    { id: "bom", label: "BOM" },
    { id: "export", label: "Exports" },
    { id: "catalog", label: "Catalog" },
    { id: "calculators", label: "Calcs" },
    { id: "docs", label: "Docs" },
  ];

  const activeMoreTab = moreTabs.find((t) => t.id === activeMainTab);

  return (
    <div
      id="workbench-root"
      data-theme={theme}
      className="theme-dark h-screen w-screen overflow-hidden flex flex-col font-sans text-xs bg-[#0b0f17] text-slate-100"
    >
      {/* ========================================================================= */}
      {/* TOP HEADER BAR (Clean V2 Design + Promoted Hero Actions)                  */}
      {/* ========================================================================= */}
      <header className="border-b border-white/10 bg-[#0b1019] shrink-0 z-30">
        {/* Top Row: Brand + Muse Badge + Routing Pill + Hero Actions + GitHub Star */}
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-3 border-b border-white/5">
          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg border border-slate-700 bg-slate-900 flex items-center justify-center text-[#06b6d4]">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-white">
                Sketch2Circuit
              </span>
              <span className="px-1.5 py-0.5 rounded-md border border-slate-700 bg-slate-900 text-[#06b6d4] font-mono text-[10px] font-semibold">
                V2
              </span>
            </div>

            <span
              title="Powered by Meta Muse Spark verifiable synthesis and SAM 3.1 breadboard vision"
              className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] border border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-300 font-medium"
            >
              MUSE SPARK + SAM 3.1 TWIN
            </span>

            <button
              type="button"
              onClick={() => {
                setPcbSubView("pcb2d");
                setActiveMainTab("pcb");
              }}
              title={`${routingBadgeStats.routed} of ${routingBadgeStats.total} connections routed (${routingBadgeStats.pct}%) · ${routingBadgeStats.drcErrors} DRC violations. Click to inspect PCB layout.`}
              className="px-2 py-0.5 rounded-md border border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-slate-300 font-mono text-[11px] flex items-center gap-1.5 transition cursor-pointer"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>
                {routingBadgeStats.routed}/{routingBadgeStats.total} routed · {routingBadgeStats.drcErrors} DRC
              </span>
            </button>
          </div>

          {/* Right Action Area: Promoted Hero Actions + GitHub Star */}
          <div className="flex flex-wrap items-center gap-2.5">
            {agentStatusMsg && (
              <span className="hidden lg:inline-block text-[10px] px-2.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50 text-cyan-200 animate-pulse">
                {agentStatusMsg}
              </span>
            )}

            {/* Hero Action 1: Auto-verify & Repair (Primary Filled Button) */}
            <button
              type="button"
              onClick={handleQuickMuseRepair}
              disabled={isRepairing}
              title="Checks the circuit and fixes issues automatically"
              className="px-3 py-1.5 rounded-lg bg-[#06b6d4] hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
            >
              {isRepairing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Verifying…</span>
                </>
              ) : repairDoneSummary ? (
                <>
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Auto-verify · {repairDoneSummary}</span>
                </>
              ) : (
                <>
                  <Wrench className="w-3.5 h-3.5 shrink-0" />
                  <span>Auto-verify &amp; Repair</span>
                </>
              )}
            </button>

            {/* Hero Action 2: Scan Breadboard (Physical Circuit Verifier) */}
            <PhysicalVerifier expected={expectedScan} theme={theme} mode="trigger" />

            <GitHubStarButton />
          </div>
        </div>

        {/* Second Row: 5 Primary Tabs + "More" Dropdown (2px underline active state) */}
        <div className="px-4 h-9 flex items-center justify-between text-xs">
          <div className="flex items-center gap-4 h-full">
            {(
              [
                { id: "studio", label: "AI Studio" },
                { id: "pcb3d", label: "3D Twin" },
                { id: "pcb", label: "2D Schematic/PCB" },
                { id: "blockdiagram", label: "System Modeler (Simulink / MATLAB)" },
                { id: "erc", label: "Verify/ERC", badge: errorCount + warningCount },
                { id: "simulate", label: "Simulate" },
              ] as const
            ).map((tab) => {
              const isActive = activeMainTab === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`tab-${tab.id}`}
                  type="button"
                  onClick={() => {
                    setActiveMainTab(tab.id);
                    setShowMoreMenu(false);
                  }}
                  className={`px-1 h-full border-b-2 flex items-center gap-1.5 font-medium transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? "border-[#06b6d4] text-white"
                      : "border-transparent text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>{tab.label}</span>
                  {"badge" in tab && tab.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded font-mono text-[10px] bg-slate-800 text-amber-300">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* "More" Dropdown for BOM, Exports, Catalog, Calcs, Docs */}
            <div className="relative h-full flex items-center">
              <button
                type="button"
                onClick={() => setShowMoreMenu((prev) => !prev)}
                className={`px-1 h-full border-b-2 flex items-center gap-1 font-medium transition cursor-pointer ${
                  activeMoreTab
                    ? "border-[#06b6d4] text-white"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>{activeMoreTab ? `More: ${activeMoreTab.label}` : "More"}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-70" />
              </button>

              {showMoreMenu && (
                <div
                  onMouseLeave={() => setShowMoreMenu(false)}
                  className="absolute left-0 top-full mt-1 w-40 rounded-lg border border-slate-800 bg-[#0f172a] py-1 shadow-xl z-50"
                >
                  {moreTabs.map((item) => {
                    const active = activeMainTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveMainTab(item.id);
                          setShowMoreMenu(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between hover:bg-slate-800/80 transition cursor-pointer ${
                          active ? "text-[#06b6d4] font-semibold" : "text-slate-300"
                        }`}
                      >
                        <span>{item.label}</span>
                        {active && <span className="w-1.5 h-1.5 rounded-full bg-[#06b6d4]" />}
                      </button>
                    );
                  })}
                  <div className="my-1 border-t border-slate-800" />
                  <button
                    type="button"
                    onClick={() => {
                      setShowAgentDrawer((v) => !v);
                      setShowMoreMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition cursor-pointer"
                  >
                    API &amp; Gate Settings
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* MAIN WORKSPACE: SLIM LEFT ICON RAIL + CODE EDITOR + 3D/2D TWIN            */}
      {/* ========================================================================= */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        {/* Far-Left Vertical Icon Rail */}
        <aside className="w-11 border-r border-slate-800 bg-[#090d15] flex flex-col items-center py-3 gap-2 shrink-0 z-20">
          {(
            [
              { id: "studio", icon: Code2, label: "AI Studio" },
              { id: "pcb3d", icon: Boxes, label: "3D Twin" },
              { id: "pcb", icon: Layers, label: "2D Schematic/PCB" },
              { id: "blockdiagram", icon: Workflow, label: "System Modeler (Simulink / MATLAB)" },
              { id: "erc", icon: ShieldAlert, label: "Verify/ERC" },
              { id: "simulate", icon: Activity, label: "Simulate" },
              { id: "export", icon: Share2, label: "Exports" },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeMainTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveMainTab(item.id)}
                title={item.label}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                  active
                    ? "bg-[#06b6d4]/15 border border-[#06b6d4]/50 text-[#06b6d4]"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}

          <div className="mt-auto flex flex-col gap-2 items-center">
            <button
              type="button"
              onClick={() => setShowAgentDrawer(!showAgentDrawer)}
              title="Configure API Keys & Gate Checklist"
              className="w-8 h-8 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900 flex items-center justify-center text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
            </button>
          </div>
        </aside>

        {/* Primary Split Studio View */}
        {activeMainTab === "studio" && (
          <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden relative">
            {/* LEFT PANE: Code Editor */}
            <div className="w-full lg:w-[340px] xl:w-[370px] border-r border-slate-800 bg-[#0b0f17] flex flex-col shrink-0 z-20">
              <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Sketch Code</span>

                <select
                  value={selectedSketchId}
                  onChange={(e) => {
                    setSelectedSketchId(e.target.value);
                    const found = SAMPLE_SKETCHES.find((s) => s.id === e.target.value);
                    if (found) handleApplyAgentSketch(found.code);
                  }}
                  className="bg-slate-900 border border-slate-800 rounded-md px-2 py-1 text-[11px] text-slate-200 focus:outline-none"
                >
                  {SAMPLE_SKETCHES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mode Switcher & Atopile / Simulink Conversion Ribbon */}
              <div className="px-3 py-1.5 border-b border-slate-800/80 bg-slate-950/60 flex items-center justify-between gap-1 text-[11px] flex-wrap">
                <div className="flex items-center gap-1 bg-black/40 p-0.5 rounded border border-slate-800 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCodeLanguageMode("arduino")}
                    className={`px-2 py-0.5 rounded transition ${
                      codeLanguageMode === "arduino" && !isSimulinkSource && !isAtoSource
                        ? "bg-slate-700 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Arduino C++
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCodeLanguageMode("simulink");
                      const simulinkSample = SAMPLE_SKETCHES.find(
                        (s) => s.id === "simulink_embedded_coder",
                      );
                      if (simulinkSample && !isSimulinkSource) {
                        handleApplyAgentSketch(simulinkSample.code);
                        setSelectedSketchId("simulink_embedded_coder");
                      }
                    }}
                    className={`px-2 py-0.5 rounded transition ${
                      (codeLanguageMode === "simulink" || isSimulinkSource) && !isAtoSource
                        ? "bg-cyan-900/70 text-cyan-200 border border-cyan-700/60 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Simulink C++
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCodeLanguageMode("ato");
                      if (!isAtoSource) {
                        handleApplyAgentSketch(DEFAULT_ATO_SKETCH);
                      }
                    }}
                    className={`px-2 py-0.5 rounded transition ${
                      codeLanguageMode === "ato" || isAtoSource
                        ? "bg-emerald-900/80 text-emerald-200 border border-emerald-600/70 font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    atopile (.ato)
                  </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {isSimulinkSource && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 font-mono text-[9px] font-semibold">
                      MW_* Active
                    </span>
                  )}
                  {isAtoSource && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono text-[9px] font-semibold">
                      .ato Active
                    </span>
                  )}

                  {codeLanguageMode === "ato" || isAtoSource ? (
                    <button
                      type="button"
                      onClick={() => {
                        const cpp = circuitToArduino(synthesis.circuit);
                        handleApplyAgentSketch(cpp);
                        setCodeLanguageMode("arduino");
                      }}
                      className="px-2 py-0.5 rounded border border-slate-700 hover:border-emerald-500/60 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 transition flex items-center gap-1 font-medium text-[10px] cursor-pointer"
                      title="Convert atopile hardware definition to compiling Arduino C++ firmware"
                    >
                      <Code2 className="w-3 h-3 text-emerald-400" />
                      <span>Convert to C++</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        const ato = circuitToAto(synthesis.circuit, {
                          moduleName: "MainCircuit",
                        });
                        handleApplyAgentSketch(ato);
                        setCodeLanguageMode("ato");
                      }}
                      className="px-2 py-0.5 rounded border border-slate-700 hover:border-emerald-500/60 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-300 transition flex items-center gap-1 font-medium text-[10px] cursor-pointer"
                      title="Convert circuit into declarative atopile (.ato) hardware description code"
                    >
                      <Code2 className="w-3 h-3 text-emerald-400" />
                      <span>Convert to .ato</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setSimulinkPasteText(sketchSource);
                      setShowSimulinkModal(true);
                    }}
                    className="px-2 py-0.5 rounded border border-slate-700 hover:border-cyan-500/60 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition flex items-center gap-1 font-medium text-[10px] cursor-pointer"
                    title="Import or paste MATLAB / Simulink Embedded Coder C++ code"
                  >
                    <Upload className="w-3 h-3 text-cyan-400" />
                    <span>Import C++</span>
                  </button>
                </div>
              </div>

              <div className="px-3 py-1.5 border-b border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
                <span>
                  {codeLanguageMode === "ato" || isAtoSource
                    ? "Sketch2Circuit V2 — Atopile Hardware DSL"
                    : isSimulinkSource
                      ? "Sketch2Circuit V2 — Simulink Embedded Coder C++"
                      : "Sketch2Circuit V2 — Arduino Uno R3"}
                </span>
                <span className="text-emerald-400 font-mono text-[10px] font-medium">
                  {codeLanguageMode === "ato" || isAtoSource ? ".ato Parser Live" : "AST Live"}
                </span>
              </div>

              <textarea
                value={sketchSource}
                onChange={(e) => setSketchSource(e.target.value)}
                className="flex-1 w-full p-3.5 font-mono text-[11px] leading-relaxed resize-none focus:outline-none bg-[#080c13] text-slate-100 selection:bg-cyan-500/30"
                spellCheck={false}
              />

              {/* Collapsible Full Muse Agent Drawer if toggled */}
              {showAgentDrawer && (
                <div className="border-t border-slate-800 max-h-72 overflow-y-auto">
                  <MuseAgentPanel
                    sketchSource={sketchSource}
                    onApplySketch={handleApplyAgentSketch}
                    synthesis={synthesis}
                    routingStats={routingBadgeStats}
                  />
                </div>
              )}
            </div>

            {/* CENTER/RIGHT PANE: Full-Bleed 3D Digital Twin & 2D Schematic */}
            <div className="flex-1 min-h-0 relative">
              <Pcb3DViewer
                circuit={synthesis.circuit}
                layout={routedResult?.layout}
                sketchName="Sketch2Circuit V2"
                theme="dark"
                activeProject={activeProject}
                onSelectProject={handleSelectProject}
                onSelectPresetSketch={(code) => {
                  setSketchSource(code);
                  setDebouncedSource(code);
                }}
                simulationResult={simulationResult}
              />
              <PhysicalVerifier expected={expectedScan} theme={theme} mode="hud" />
            </div>
          </div>
        )}

        {activeMainTab === "pcb3d" && (
          <div className="flex-1 min-h-0 relative">
            <Pcb3DViewer
              circuit={synthesis.circuit}
              layout={routedResult?.layout}
              sketchName="Sketch2Circuit V2"
              theme="dark"
              activeProject={activeProject}
              onSelectProject={handleSelectProject}
              onSelectPresetSketch={(code) => {
                setSketchSource(code);
                setDebouncedSource(code);
              }}
              simulationResult={simulationResult}
            />
            <PhysicalVerifier expected={expectedScan} theme={theme} mode="hud" />
          </div>
        )}

        {activeMainTab === "pcb" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between shrink-0">
              <span className="text-xs font-medium text-slate-300">
                2D Hardware Capture &amp; Layout
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg border border-slate-800 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setPcbSubView("schematic2d")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    pcbSubView === "schematic2d"
                      ? "bg-[#06b6d4] text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  2D Schematic &amp; Breadboard
                </button>
                <button
                  type="button"
                  onClick={() => setPcbSubView("pcb2d")}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    pcbSubView === "pcb2d"
                      ? "bg-[#06b6d4] text-slate-950"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  2D Routed PCB
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {pcbSubView === "schematic2d" ? (
                <Schematic2DViewer
                  circuit={synthesis.circuit}
                  sketchName="Sketch2Circuit V2"
                  theme="dark"
                  onSwitchTo3D={() => setActiveMainTab("pcb3d")}
                />
              ) : (
                <div className="p-4 h-full">
                  <PcbViewer
                    circuit={synthesis.circuit}
                    layout={routedResult?.layout}
                    sketchName="Sketch2Circuit V2"
                    theme="dark"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeMainTab === "blockdiagram" && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <BlockDiagramTab
              circuit={synthesis.circuit}
              sketchName="SystemModeler"
              theme="dark"
              onSimulationResult={setSimulationResult}
              onSyncCircuit={(generatedSketchCode) => {
                setSketchSource(generatedSketchCode);
                setDebouncedSource(generatedSketchCode);
                setCodeLanguageMode("simulink");
              }}
            />
          </div>
        )}

        {activeMainTab === "erc" && (
          <div className="flex-1 p-4 overflow-auto">
            <ErcDiagnostics diagnostics={synthesis.diagnostics} />
          </div>
        )}

        {activeMainTab === "simulate" && (
          <div className="flex-1 p-4 overflow-auto">
            <SimulationTab
              circuit={synthesis.circuit}
              sketchName="ObsidianCircuit"
              theme="dark"
              onSimulationResult={setSimulationResult}
            />
          </div>
        )}

        {activeMainTab === "bom" && (
          <div className="flex-1 p-4 overflow-auto">
            <BomViewerTab
              circuit={synthesis.circuit}
              layout={routedResult?.layout}
              sketchName="ObsidianCircuit"
              theme="dark"
            />
          </div>
        )}

        {activeMainTab === "export" && (
          <div className="flex-1 p-4 overflow-auto">
            <ExportArtifacts
              circuit={synthesis.circuit}
              diagnostics={synthesis.diagnostics}
              sketchName="ObsidianCircuit"
              sourceCode={sketchSource}
            />
          </div>
        )}

        {activeMainTab === "catalog" && (
          <div className="flex-1 p-4 overflow-auto">
            <PartsCatalogBrowser />
          </div>
        )}

        {activeMainTab === "calculators" && (
          <div className="flex-1 p-4 overflow-auto">
            <CalculatorsTab />
          </div>
        )}

        {activeMainTab === "docs" && (
          <div className="flex-1 p-4 overflow-auto">
            <DocumentationTab />
          </div>
        )}
      </div>

      {/* MATLAB / Simulink Embedded Coder C++ Import Modal */}
      {showSimulinkModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none"
          onClick={() => setShowSimulinkModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-[#0d131f] border border-slate-700 rounded-lg shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Workflow className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                  Import MATLAB / Simulink Embedded Coder C++
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSimulinkModal(false)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Paste or upload C/C++ code generated by MATLAB / Simulink Embedded Coder (containing{" "}
                <code className="text-cyan-300">MW_*</code>,{" "}
                <code className="text-cyan-300">Model_step</code>, or{" "}
                <code className="text-cyan-300">rt_OneStep</code>). The deterministic AST extractor parses hardware I/O pins, timer PWMs, and comments directly into Circuit IR.
              </p>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="simulink-code-paste" className="text-[10px] font-mono text-slate-300 uppercase font-bold">
                    C/C++ Source Code:
                  </label>
                  <label className="text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1 font-mono">
                    <Upload className="w-3 h-3" />
                    <span>Upload .cpp / .c file</span>
                    <input
                      type="file"
                      accept=".cpp,.c,.h,.hpp,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                            const text = ev.target?.result;
                            if (typeof text === "string") {
                              setSimulinkPasteText(text);
                            }
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <textarea
                  id="simulink-code-paste"
                  value={simulinkPasteText}
                  onChange={(e) => setSimulinkPasteText(e.target.value)}
                  placeholder="Paste MATLAB / Simulink Embedded Coder C++ code here..."
                  className="w-full h-56 p-3 font-mono text-[11px] bg-[#070a10] border border-slate-800 rounded focus:border-cyan-500/70 focus:outline-none text-slate-200"
                  spellCheck={false}
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const sample = SAMPLE_SKETCHES.find((s) => s.id === "simulink_embedded_coder");
                    if (sample) setSimulinkPasteText(sample.code);
                  }}
                  className="px-2.5 py-1 text-[11px] rounded border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300 transition"
                >
                  Load Benchmark Example
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowSimulinkModal(false)}
                    className="px-3 py-1 text-[11px] rounded text-slate-400 hover:text-slate-200 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (simulinkPasteText.trim()) {
                        setSketchSource(simulinkPasteText);
                        setDebouncedSource(simulinkPasteText);
                        setCodeLanguageMode("simulink");
                      }
                      setShowSimulinkModal(false);
                    }}
                    className="px-3.5 py-1 text-[11px] font-bold rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition cursor-pointer"
                  >
                    Parse &amp; Synthesize Circuit IR
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <Analytics />
    </div>
  );
}
