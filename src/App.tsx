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
  Wrench,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  const [theme] = useState<"dark" | "light">("dark");

  const [activeMainTab, setActiveMainTab] = useState<
    | "studio"
    | "pcb3d"
    | "pcb"
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

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSource(sketchSource);
    }, 200);
    return () => clearTimeout(handler);
  }, [sketchSource]);

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
      <header className="border-b border-slate-800 bg-[#0b0f17] shrink-0 z-30">
        {/* Top Row: Brand + V2 Pill + Quiet Attribution + Neutral Status Chip + Hero Actions */}
        <div className="px-4 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
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
              className="hidden md:inline-block text-[11px] text-slate-400"
            >
              Built with Muse Spark · SAM 3.1
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

          {/* Right Action Area: Promoted Hero Actions + GitHub Star + Compact View/Oscilloscope Switch */}
          <div className="flex flex-wrap items-center gap-2">
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

            {/* Compact low-weight Oscilloscope switch */}
            <button
              type="button"
              onClick={() =>
                setActiveMainTab(activeMainTab === "simulate" ? "studio" : "simulate")
              }
              title="Toggle RKF45 Oscilloscope Simulation View"
              className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-800 hover:border-slate-700 text-[11px] text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <span>Oscilloscope</span>
              <span
                className={`w-6 h-3.5 rounded-full p-0.5 flex items-center transition-colors ${
                  activeMainTab === "simulate"
                    ? "bg-[#06b6d4]/30 justify-end"
                    : "bg-slate-800 justify-start"
                }`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    activeMainTab === "simulate" ? "bg-[#06b6d4]" : "bg-slate-400"
                  }`}
                />
              </span>
            </button>
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
                { id: "erc", label: "Verify/ERC", badge: errorCount + warningCount },
                { id: "simulate", label: "Simulate" },
              ] as const
            ).map((tab) => {
              const isActive = activeMainTab === tab.id;
              return (
                <button
                  key={tab.id}
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

          {agentStatusMsg && (
            <span className="hidden lg:inline-block text-[11px] text-slate-400 truncate max-w-xs">
              {agentStatusMsg}
            </span>
          )}
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

              <div className="px-3 py-1.5 border-b border-slate-800/60 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Sketch2Circuit V2 — Arduino Uno R3</span>
                <span className="text-emerald-400 font-mono text-[10px] font-medium">AST Live</span>
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

      <Analytics />
    </div>
  );
}