/**
 * @license Apache-2.0
 * @s2c/playground — In-Browser Simulation Engine Workbench Tab (M17).
 * Pure in-browser numerical simulation & circuit behavior modeling (no MATLAB/Octave).
 */

import type { Circuit } from "@s2c/circuit-json";
import {
  evaluateAlgebraicRange,
  getAvailableCircuitPresets,
  type OdePoint,
  type PresetModelResult,
  parseExpression,
  solveRk4,
  solveRkf45,
} from "@s2c/sim-engine";
import { Activity, AlertCircle, AlertTriangle, Cpu, Download, Variable, Zap } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

export interface SimulationTabProps {
  circuit: Circuit;
  sketchName?: string;
  theme?: "dark" | "light";
}

type SimMode = "presets" | "custom_algebraic" | "custom_ode";

export const SimulationTab: React.FC<SimulationTabProps> = ({
  circuit,
  sketchName = "SynthesizedCircuit",
  theme: _theme = "dark",
}) => {
  const [activeMode, setActiveMode] = useState<SimMode>("presets");

  // -------------------------------------------------------------
  // Preset Mode State
  // -------------------------------------------------------------
  const availablePresets = useMemo(() => {
    return getAvailableCircuitPresets(circuit);
  }, [circuit]);

  const [selectedPresetId, setSelectedPresetId] = useState<string>("");

  // Keep selected preset in sync if circuit changes
  const activePreset: PresetModelResult | null = useMemo(() => {
    if (availablePresets.length === 0) return null;
    const found = availablePresets.find((p: PresetModelResult) => p.id === selectedPresetId);
    return found ?? availablePresets[0] ?? null;
  }, [availablePresets, selectedPresetId]);

  // -------------------------------------------------------------
  // Custom Mode State
  // -------------------------------------------------------------
  // Algebraic Function Mode
  const [algExpr, setAlgExpr] = useState<string>("5 * sin(2 * pi * 50 * x) * exp(-10 * x)");
  const [algXMin, setAlgXMin] = useState<number>(0);
  const [algXMax, setAlgXMax] = useState<number>(0.2);
  const [algPointsCount, setAlgPointsCount] = useState<number>(200);

  // ODE Mode
  const [odeSystemType, setOdeSystemType] = useState<"scalar" | "coupled">("scalar");
  const [odeEq1, setOdeEq1] = useState<string>("(5.0 - y1) / 0.05"); // RC charge
  const [odeEq2, setOdeEq2] = useState<string>("-16 * y1 - 0.8 * y2"); // Damped harmonic
  const [odeY1_0, setOdeY1_0] = useState<number>(0.0);
  const [odeY2_0, setOdeY2_0] = useState<number>(1.0);
  const [odeTEnd, setOdeTEnd] = useState<number>(0.25);
  const [odeDt, setOdeDt] = useState<number>(0.001);
  const [odeSolverMethod, setOdeSolverMethod] = useState<"rk4" | "rkf45">("rk4");

  // -------------------------------------------------------------
  // Compute Custom Simulation Results
  // -------------------------------------------------------------
  const customAlgResult = useMemo(() => {
    if (activeMode !== "custom_algebraic") return null;
    try {
      const pts = evaluateAlgebraicRange(algExpr, algXMin, algXMax, algPointsCount, "x");
      return { success: true as const, points: pts, error: null };
    } catch (err: unknown) {
      return {
        success: false as const,
        points: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }, [activeMode, algExpr, algXMin, algXMax, algPointsCount]);

  const customOdeResult = useMemo(() => {
    if (activeMode !== "custom_ode") return null;

    // Validate inputs
    const p1 = parseExpression(odeEq1);
    if (!p1.success || !p1.expr) {
      return {
        success: false as const,
        points: [],
        error: `Equation 1 Error: ${p1.error}`,
      };
    }

    if (odeSystemType === "coupled") {
      const p2 = parseExpression(odeEq2);
      if (!p2.success || !p2.expr) {
        return {
          success: false as const,
          points: [],
          error: `Equation 2 Error: ${p2.error}`,
        };
      }
    }

    try {
      const f = (t: number, y: number[]): number[] => {
        const y1 = y[0] ?? 0;
        const y2 = y[1] ?? 0;
        const dy1 = p1.expr?.evaluate({ t, y1, y2, x: y1, v: y2 }) ?? 0;
        if (odeSystemType === "coupled") {
          const p2 = parseExpression(odeEq2);
          const dy2 = p2.expr?.evaluate({ t, y1, y2, x: y1, v: y2 }) ?? 0;
          return [dy1, dy2];
        }
        return [dy1];
      };

      const y0 = odeSystemType === "coupled" ? [odeY1_0, odeY2_0] : [odeY1_0];
      const sol =
        odeSolverMethod === "rkf45"
          ? solveRkf45(f, y0, { t0: 0, tEnd: odeTEnd, dt: odeDt, relTol: 1e-4, absTol: 1e-6 })
          : solveRk4(f, y0, { t0: 0, tEnd: odeTEnd, dt: odeDt });

      return {
        success: true as const,
        points: sol.points,
        error: null,
        method: sol.method,
        totalSteps: sol.totalSteps,
      };
    } catch (err: unknown) {
      return {
        success: false as const,
        points: [],
        error: `Numerical Integration Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }, [
    activeMode,
    odeSystemType,
    odeEq1,
    odeEq2,
    odeY1_0,
    odeY2_0,
    odeTEnd,
    odeDt,
    odeSolverMethod,
  ]);

  // -------------------------------------------------------------
  // Active Data Stream for Chart Renderer
  // -------------------------------------------------------------
  const chartData = useMemo(() => {
    if (activeMode === "presets") {
      if (!activePreset) return null;
      return {
        title: activePreset.name,
        xAxisLabel: `${activePreset.xAxisLabel} [${activePreset.xAxisUnit}]`,
        yAxisLabel: `${activePreset.yAxisLabel} [${activePreset.yAxisUnit}]`,
        points: activePreset.points.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })),
        isIllustrative: activePreset.isIllustrative,
        disclaimer: activePreset.disclaimer,
      };
    }

    if (activeMode === "custom_algebraic") {
      if (!customAlgResult?.success) return null;
      return {
        title: `y(x) = ${algExpr}`,
        xAxisLabel: "Variable x",
        yAxisLabel: "Output y(x)",
        points: customAlgResult.points,
        isIllustrative: false,
      };
    }

    if (activeMode === "custom_ode") {
      if (!customOdeResult?.success) return null;
      return {
        title:
          odeSystemType === "coupled"
            ? `Coupled ODE: dy1/dt, dy2/dt (${customOdeResult.method.toUpperCase()}, ${customOdeResult.totalSteps} steps)`
            : `ODE: dy1/dt = ${odeEq1} (${customOdeResult.method.toUpperCase()})`,
        xAxisLabel: "Time t [s]",
        yAxisLabel: odeSystemType === "coupled" ? "State Values (y1, y2)" : "State Value y1",
        points: customOdeResult.points.map((p: OdePoint) => ({ x: p.t, y: p.y[0] ?? 0 })),
        secondaryPoints:
          odeSystemType === "coupled"
            ? customOdeResult.points.map((p: OdePoint) => ({ x: p.t, y: p.y[1] ?? 0 }))
            : undefined,
        isIllustrative: false,
      };
    }

    return null;
  }, [activeMode, activePreset, customAlgResult, customOdeResult, algExpr, odeSystemType, odeEq1]);

  // Chart bounds & scaling calculation
  const chartMetrics = useMemo(() => {
    if (!chartData || chartData.points.length === 0) return null;
    const pts = chartData.points;
    const xVals = pts.map((p: { x: number; y: number }) => p.x);
    const yVals = pts.map((p: { x: number; y: number }) => p.y);
    if (chartData.secondaryPoints) {
      yVals.push(...chartData.secondaryPoints.map((p: { x: number; y: number }) => p.y));
    }

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);

    // Padding to avoid clipping on bounds
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;

    return {
      minX,
      maxX,
      minY,
      maxY,
      spanX,
      spanY,
      count: pts.length,
    };
  }, [chartData]);

  // CSV Export Handler
  const handleExportCsv = () => {
    if (!chartData || chartData.points.length === 0) return;
    const headers = ["x", "y1"];
    if (chartData.secondaryPoints) headers.push("y2");

    const lines = [headers.join(",")];
    for (let i = 0; i < chartData.points.length; i++) {
      const p1 = chartData.points[i];
      if (!p1) continue;
      const row = [p1.x, p1.y];
      if (chartData.secondaryPoints) {
        row.push(chartData.secondaryPoints[i]?.y ?? "");
      }
      lines.push(row.join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sketchName}_simulation.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-main)",
      }}
    >
      {/* Top Control Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b select-none shrink-0"
        style={{
          borderColor: "var(--border-strong)",
          backgroundColor: "var(--bg-panel)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 flex items-center justify-center border rounded-[2px]"
            style={{
              borderColor: "var(--border-strong)",
              backgroundColor: "var(--bg-sunken)",
              color: "#38bdf8",
            }}
          >
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                In-Browser Simulation Engine
              </span>
              <span
                className="text-[9px] px-1.5 py-0.2 border rounded-[1px] font-mono tracking-wider font-semibold"
                style={{
                  borderColor: "rgba(56, 189, 248, 0.4)",
                  backgroundColor: "rgba(56, 189, 248, 0.1)",
                  color: "#38bdf8",
                }}
              >
                M17 NUMERIC SOLVER (RK4 & RKF45)
              </span>
              <span
                className="text-[9px] px-1.5 py-0.2 border rounded-[1px] font-mono tracking-wider"
                style={{
                  borderColor: "var(--border-subtle)",
                  backgroundColor: "var(--bg-sunken)",
                  color: "var(--text-muted)",
                }}
              >
                MATHJS @15.2.0
              </span>
            </div>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              Theoretical circuit behavior &amp; ODE dynamics • Zero MATLAB/Octave or server
              dependency
            </p>
          </div>
        </div>

        {/* Mode Selector Buttons */}
        <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-[3px] border border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveMode("presets")}
            className={`px-3 py-1 rounded-[2px] font-medium transition flex items-center gap-1.5 ${
              activeMode === "presets"
                ? "bg-sky-600 text-white font-bold shadow-sm"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Circuit Presets ({availablePresets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("custom_algebraic")}
            className={`px-3 py-1 rounded-[2px] font-medium transition flex items-center gap-1.5 ${
              activeMode === "custom_algebraic"
                ? "bg-sky-600 text-white font-bold shadow-sm"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
            }`}
          >
            <Variable className="w-3.5 h-3.5" />
            <span>Algebraic y = f(x)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("custom_ode")}
            className={`px-3 py-1 rounded-[2px] font-medium transition flex items-center gap-1.5 ${
              activeMode === "custom_ode"
                ? "bg-sky-600 text-white font-bold shadow-sm"
                : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>ODE Solvers (RK4 / RKF45)</span>
          </button>
        </div>
      </div>

      {/* Main Simulation Viewport (Split Panel) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Parameters & Configuration Panel */}
        <div
          className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r flex flex-col shrink-0 overflow-y-auto"
          style={{
            borderColor: "var(--border-strong)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          {/* Preset Mode Controls */}
          {activeMode === "presets" && (
            <div className="p-4 space-y-4">
              <div>
                <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1.5">
                  Available Synthesized Circuit Presets
                </div>
                {availablePresets.length === 0 ? (
                  <div className="p-3 rounded-[2px] border border-neutral-800 bg-neutral-900/50 text-xs text-neutral-400 space-y-1">
                    <p className="font-semibold text-neutral-300">No Analog Peripherals Found</p>
                    <p className="text-[11px]">
                      The current sketch does not contain known modelable peripherals
                      (potentiometer, LDR divider, bulk capacitor, servo, or DC motor).
                    </p>
                    <p className="text-[10px] text-sky-400 mt-2">
                      Try selecting the &quot;12. User Multi-Peripheral Sketch&quot; or &quot;04.
                      Servo Motor Sweep&quot; preset sketch!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {availablePresets.map((preset: PresetModelResult) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedPresetId(preset.id)}
                        className={`w-full text-left p-2.5 rounded-[2px] border transition flex items-start justify-between ${
                          activePreset?.id === preset.id
                            ? "border-sky-500 bg-sky-950/30 text-sky-200"
                            : "border-neutral-800 bg-neutral-900/30 hover:border-neutral-700 text-neutral-300"
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>{preset.name}</span>
                          </div>
                          <p className="text-[10px] text-neutral-400 line-clamp-1">
                            {preset.description}
                          </p>
                        </div>
                        {preset.isIllustrative ? (
                          <span
                            className="px-1.5 py-0.5 text-[9px] font-bold rounded-[2px] bg-amber-950 border border-amber-800 text-amber-300 uppercase shrink-0 ml-1.5"
                            title="Illustrative model — not derived from a verified datasheet transfer function"
                          >
                            Illustrative
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-[2px] bg-emerald-950 border border-emerald-800 text-emerald-300 uppercase shrink-0 ml-1.5">
                            Theoretical
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Extracted Parameters Card */}
              {activePreset && (
                <div className="space-y-3 pt-2 border-t border-neutral-800">
                  <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                    Real Circuit IR Parameters Extracted
                  </div>
                  <div className="bg-neutral-950 p-2.5 rounded-[2px] border border-neutral-800 space-y-1.5 text-xs font-mono">
                    {Object.entries(activePreset.extractedParameters).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-2">
                        <span className="text-neutral-400 text-[11px]">{k}:</span>
                        <span className="text-sky-300 font-bold">{String(v)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Mandatory Illustrative Model Disclaimer */}
                  {activePreset.isIllustrative && (
                    <div className="p-2.5 rounded-[2px] border border-amber-700/60 bg-amber-950/40 text-amber-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px] text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Mandatory Transparency Notice</span>
                      </div>
                      <p className="text-[11px] leading-relaxed">{activePreset.disclaimer}</p>
                    </div>
                  )}

                  {/* Model Assumptions */}
                  <div className="space-y-1">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                      Physical Model Assumptions
                    </div>
                    <ul className="list-disc list-inside text-[10px] text-neutral-400 space-y-1">
                      {activePreset.assumptions.map((asm: string) => (
                        <li key={asm}>{asm}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Algebraic Mode Controls */}
          {activeMode === "custom_algebraic" && (
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="alg-expr-input"
                  className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block"
                >
                  Algebraic Function y = f(x)
                </label>
                <input
                  id="alg-expr-input"
                  type="text"
                  value={algExpr}
                  onChange={(e) => setAlgExpr(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2.5 py-1.5 font-mono text-xs text-sky-300 focus:outline-none focus:border-sky-500"
                  placeholder="e.g. 5 * sin(2*pi*x) + cos(x)"
                />
                <p className="text-[10px] text-neutral-400">
                  Standard math syntax supported:{" "}
                  <code>sin, cos, exp, log, sqrt, abs, pow, pi</code>.
                </p>
              </div>

              {/* Range controls */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="alg-xmin-input"
                    className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                  >
                    x Min
                  </label>
                  <input
                    id="alg-xmin-input"
                    type="number"
                    step="any"
                    value={algXMin}
                    onChange={(e) => setAlgXMin(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2 py-1 font-mono text-xs text-neutral-200"
                  />
                </div>
                <div>
                  <label
                    htmlFor="alg-xmax-input"
                    className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                  >
                    x Max
                  </label>
                  <input
                    id="alg-xmax-input"
                    type="number"
                    step="any"
                    value={algXMax}
                    onChange={(e) => setAlgXMax(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2 py-1 font-mono text-xs text-neutral-200"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="alg-points-input"
                  className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                >
                  Plot Resolution (Points)
                </label>
                <input
                  id="alg-points-input"
                  type="number"
                  min="10"
                  max="1000"
                  value={algPointsCount}
                  onChange={(e) => setAlgPointsCount(Number(e.target.value))}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2 py-1 font-mono text-xs text-neutral-200"
                />
              </div>

              {/* Quick Preset Buttons for Custom Mode */}
              <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  Try Sample Equations
                </div>
                <div className="grid grid-cols-1 gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setAlgExpr("5 * (1 - exp(-x / 0.05))");
                      setAlgXMin(0);
                      setAlgXMax(0.25);
                      setAlgPointsCount(150);
                    }}
                    className="p-1.5 text-left border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 rounded-[2px] font-mono text-sky-400"
                  >
                    1. First-Order RC Step: 5*(1 - exp(-x/0.05))
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAlgExpr("5 * exp(-5 * x) * cos(40 * pi * x)");
                      setAlgXMin(0);
                      setAlgXMax(0.5);
                      setAlgPointsCount(250);
                    }}
                    className="p-1.5 text-left border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 rounded-[2px] font-mono text-sky-400"
                  >
                    2. Damped RLC Ringing: 5*exp(-5*x)*cos(40*pi*x)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAlgExpr("5 * (10000 / (x + 10000))");
                      setAlgXMin(500);
                      setAlgXMax(50000);
                      setAlgPointsCount(200);
                    }}
                    className="p-1.5 text-left border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 rounded-[2px] font-mono text-sky-400"
                  >
                    3. Sensor Voltage Divider: 5*(10k / (x + 10k))
                  </button>
                </div>
              </div>

              {/* Error Callout if any */}
              {!customAlgResult?.success && (
                <div className="p-2.5 rounded-[2px] border border-red-800 bg-red-950/60 text-red-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Equation Syntax Error</span>
                  </div>
                  <p className="font-mono text-[11px]">{customAlgResult?.error}</p>
                </div>
              )}
            </div>
          )}

          {/* Custom ODE Mode Controls */}
          {activeMode === "custom_ode" && (
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                  ODE System Architecture
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setOdeSystemType("scalar")}
                    className={`p-1.5 border rounded-[2px] text-center transition ${
                      odeSystemType === "scalar"
                        ? "border-sky-500 bg-sky-950 text-white font-bold"
                        : "border-neutral-800 bg-neutral-900/40 text-neutral-400"
                    }`}
                  >
                    Single Variable dy1/dt
                  </button>
                  <button
                    type="button"
                    onClick={() => setOdeSystemType("coupled")}
                    className={`p-1.5 border rounded-[2px] text-center transition ${
                      odeSystemType === "coupled"
                        ? "border-sky-500 bg-sky-950 text-white font-bold"
                        : "border-neutral-800 bg-neutral-900/40 text-neutral-400"
                    }`}
                  >
                    Coupled Pair (y1, y2)
                  </button>
                </div>
              </div>

              {/* Differential Equations */}
              <div className="space-y-2">
                <div>
                  <label
                    htmlFor="ode-eq1-input"
                    className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                  >
                    dy1/dt = f1(t, y1, y2)
                  </label>
                  <input
                    id="ode-eq1-input"
                    type="text"
                    value={odeEq1}
                    onChange={(e) => setOdeEq1(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2.5 py-1.5 font-mono text-xs text-sky-300 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {odeSystemType === "coupled" && (
                  <div>
                    <label
                      htmlFor="ode-eq2-input"
                      className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                    >
                      dy2/dt = f2(t, y1, y2)
                    </label>
                    <input
                      id="ode-eq2-input"
                      type="text"
                      value={odeEq2}
                      onChange={(e) => setOdeEq2(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2.5 py-1.5 font-mono text-xs text-cyan-300 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                )}
              </div>

              {/* Initial Conditions & Solvers */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="ode-y1-input"
                    className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                  >
                    Initial y1(0)
                  </label>
                  <input
                    id="ode-y1-input"
                    type="number"
                    step="any"
                    value={odeY1_0}
                    onChange={(e) => setOdeY1_0(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2 py-1 font-mono text-xs text-neutral-200"
                  />
                </div>
                {odeSystemType === "coupled" ? (
                  <div>
                    <label
                      htmlFor="ode-y2-input"
                      className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                    >
                      Initial y2(0)
                    </label>
                    <input
                      id="ode-y2-input"
                      type="number"
                      step="any"
                      value={odeY2_0}
                      onChange={(e) => setOdeY2_0(Number(e.target.value))}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2 py-1 font-mono text-xs text-neutral-200"
                    />
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor="ode-solver-select"
                      className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                    >
                      Solver Algorithm
                    </label>
                    <select
                      id="ode-solver-select"
                      value={odeSolverMethod}
                      onChange={(e) => setOdeSolverMethod(e.target.value as "rk4" | "rkf45")}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2 py-1 font-mono text-xs text-neutral-200"
                    >
                      <option value="rk4">Fixed RK4</option>
                      <option value="rkf45">Adaptive RKF45</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="ode-tend-input"
                    className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                  >
                    End Time tEnd [s]
                  </label>
                  <input
                    id="ode-tend-input"
                    type="number"
                    step="any"
                    value={odeTEnd}
                    onChange={(e) => setOdeTEnd(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2 py-1 font-mono text-xs text-neutral-200"
                  />
                </div>
                <div>
                  <label
                    htmlFor="ode-dt-input"
                    className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1"
                  >
                    Step dt [s]
                  </label>
                  <input
                    id="ode-dt-input"
                    type="number"
                    step="any"
                    value={odeDt}
                    onChange={(e) => setOdeDt(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-[2px] px-2 py-1 font-mono text-xs text-neutral-200"
                  />
                </div>
              </div>

              {/* Sample ODE Presets */}
              <div className="space-y-1.5 pt-2 border-t border-neutral-800">
                <div className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                  Load Classic ODE Benchmark
                </div>
                <div className="grid grid-cols-1 gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setOdeSystemType("scalar");
                      setOdeEq1("(5.0 - y1) / 0.05");
                      setOdeY1_0(0.0);
                      setOdeTEnd(0.25);
                      setOdeDt(0.001);
                    }}
                    className="p-1.5 text-left border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 rounded-[2px] font-mono text-sky-400"
                  >
                    RC Low-Pass Step: dy1/dt = (5 - y1)/0.05
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOdeSystemType("coupled");
                      setOdeEq1("y2");
                      setOdeEq2("-16 * y1 - 0.8 * y2");
                      setOdeY1_0(1.0);
                      setOdeY2_0(0.0);
                      setOdeTEnd(3.0);
                      setOdeDt(0.01);
                    }}
                    className="p-1.5 text-left border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 rounded-[2px] font-mono text-cyan-400"
                  >
                    Damped Harmonic Oscillator (Coupled Pair)
                  </button>
                </div>
              </div>

              {/* Error Callout if any */}
              {!customOdeResult?.success && (
                <div className="p-2.5 rounded-[2px] border border-red-800 bg-red-950/60 text-red-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-red-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>ODE Solver Error</span>
                  </div>
                  <p className="font-mono text-[11px]">{customOdeResult?.error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Side: Interactive Oscilloscope & Vector Curve Plotter */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Header & Metrics Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-neutral-200">
                  {chartData?.title ?? "Oscilloscope Waveform Display"}
                </span>
                {chartData?.isIllustrative ? (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-[2px] bg-amber-950 border border-amber-800 text-amber-300 uppercase">
                    Illustrative Model
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-[2px] bg-sky-950 border border-sky-800 text-sky-300 uppercase">
                    Theoretical Expected Curve
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                {chartMetrics
                  ? `${chartMetrics.count} calculated discrete solution coordinates • Range: [${chartMetrics.minX.toFixed(2)}, ${chartMetrics.maxX.toFixed(2)}]`
                  : "Awaiting simulation input parameters"}
              </p>
            </div>

            {/* Export Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!chartData || chartData.points.length === 0}
                className="px-2.5 py-1 text-xs font-semibold rounded-[2px] border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer"
                title="Download computed simulation coordinates to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          {/* Prominent Disclaimer Banner for Illustrative Models */}
          {chartData?.isIllustrative && (
            <div className="mb-3 p-2.5 rounded-[2px] border border-amber-600/70 bg-amber-950/70 text-amber-200 text-xs flex items-center gap-2.5 shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300 mr-2 uppercase tracking-wider text-[10px]">
                  Illustrative Simulation Model:
                </span>
                <span className="text-amber-100 font-medium">
                  {chartData.disclaimer ||
                    "Illustrative model — not derived from a verified datasheet transfer function."}
                </span>
              </div>
            </div>
          )}

          {/* SVG Vector Chart Area */}
          <div
            className="flex-1 border rounded-[2px] relative flex flex-col items-center justify-center select-none overflow-hidden"
            style={{
              backgroundColor: "#0a0e14",
              borderColor: "var(--border-strong)",
            }}
          >
            {chartMetrics && chartData ? (
              <svg
                className="w-full h-full p-6"
                viewBox="0 0 800 450"
                preserveAspectRatio="none"
                role="img"
                aria-label={chartData.title}
              >
                <title>{chartData.title}</title>
                <defs>
                  {/* Grid Pattern */}
                  <pattern id="grid-sim" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" />
                  </pattern>
                  <linearGradient id="curve-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Grid Background */}
                <rect width="800" height="450" fill="url(#grid-sim)" />

                {/* Axes */}
                <line x1="60" y1="400" x2="760" y2="400" stroke="#475569" strokeWidth="1.5" />
                <line x1="60" y1="40" x2="60" y2="400" stroke="#475569" strokeWidth="1.5" />

                {/* X-Axis Tick Labels */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                  const val = chartMetrics.minX + frac * chartMetrics.spanX;
                  const xPos = 60 + frac * 700;
                  return (
                    <g key={frac}>
                      <line
                        x1={xPos}
                        y1="400"
                        x2={xPos}
                        y2="406"
                        stroke="#64748b"
                        strokeWidth="1"
                      />
                      <text
                        x={xPos}
                        y="422"
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {val < 1 && val > -1 ? val.toFixed(3) : val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* Y-Axis Tick Labels */}
                {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                  const val = chartMetrics.minY + frac * chartMetrics.spanY;
                  const yPos = 400 - frac * 360;
                  return (
                    <g key={frac}>
                      <line x1="54" y1={yPos} x2="60" y2={yPos} stroke="#64748b" strokeWidth="1" />
                      <text
                        x="50"
                        y={yPos + 3}
                        textAnchor="end"
                        fill="#94a3b8"
                        fontSize="10"
                        fontFamily="monospace"
                      >
                        {val < 1 && val > -1 ? val.toFixed(3) : val.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {/* Axis Titles */}
                <text
                  x="410"
                  y="442"
                  textAnchor="middle"
                  fill="#cbd5e1"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {chartData.xAxisLabel}
                </text>
                <text
                  x="-220"
                  y="20"
                  textAnchor="middle"
                  transform="rotate(-90)"
                  fill="#cbd5e1"
                  fontSize="11"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  {chartData.yAxisLabel}
                </text>

                {/* Plot Primary Curve */}
                {(() => {
                  const pathCommands = chartData.points.map(
                    (pt: { x: number; y: number }, idx: number) => {
                      const normX = (pt.x - chartMetrics.minX) / chartMetrics.spanX;
                      const normY = (pt.y - chartMetrics.minY) / chartMetrics.spanY;
                      const px = 60 + normX * 700;
                      const py = 400 - normY * 360;
                      return `${idx === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
                    },
                  );
                  return (
                    <path
                      d={pathCommands.join(" ")}
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  );
                })()}

                {/* Plot Secondary Curve (Coupled ODE y2) if present */}
                {chartData.secondaryPoints &&
                  (() => {
                    const pathCommands2 = chartData.secondaryPoints.map(
                      (pt: { x: number; y: number }, idx: number) => {
                        const normX = (pt.x - chartMetrics.minX) / chartMetrics.spanX;
                        const normY = (pt.y - chartMetrics.minY) / chartMetrics.spanY;
                        const px = 60 + normX * 700;
                        const py = 400 - normY * 360;
                        return `${idx === 0 ? "M" : "L"} ${px.toFixed(1)} ${py.toFixed(1)}`;
                      },
                    );
                    return (
                      <path
                        d={pathCommands2.join(" ")}
                        fill="none"
                        stroke="#f43f5e"
                        strokeWidth="2.0"
                        strokeDasharray="4 2"
                        strokeLinecap="round"
                      />
                    );
                  })()}

                {/* Legend */}
                <g transform="translate(620, 50)">
                  <rect width="140" height="50" rx="3" fill="#0f172a" stroke="#334155" />
                  <line x1="12" y1="18" x2="35" y2="18" stroke="#38bdf8" strokeWidth="2.5" />
                  <text x="42" y="21" fill="#e2e8f0" fontSize="10" fontFamily="sans-serif">
                    {chartData.secondaryPoints ? "State Variable y1" : "Waveform V(t) / y"}
                  </text>
                  {chartData.secondaryPoints && (
                    <>
                      <line
                        x1="12"
                        y1="36"
                        x2="35"
                        y2="36"
                        stroke="#f43f5e"
                        strokeWidth="2.0"
                        strokeDasharray="4 2"
                      />
                      <text x="42" y="39" fill="#e2e8f0" fontSize="10" fontFamily="sans-serif">
                        State Variable y2
                      </text>
                    </>
                  )}
                </g>
              </svg>
            ) : (
              <div className="text-center p-6 space-y-2 text-neutral-400">
                <Activity className="w-8 h-8 mx-auto text-neutral-600 animate-pulse" />
                <p className="text-sm font-semibold">No Waveform Rendered</p>
                <p className="text-xs max-w-sm">
                  Please choose a valid circuit peripheral preset or configure a valid mathematical
                  equation.
                </p>
              </div>
            )}

            {/* Persistent Transparency Watermark Banner */}
            <div className="absolute bottom-2 right-3 pointer-events-none text-[10px] font-mono text-neutral-500 bg-neutral-950/80 px-2 py-0.5 border border-neutral-800 rounded-[2px]">
              {chartData?.isIllustrative
                ? "Illustrative model — not derived from verified hardware transfer function"
                : "Theoretical / numerical simulation — not hardware measured"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
