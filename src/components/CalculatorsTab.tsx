/**
 * @license Apache-2.0
 * Engineering Calculators Component powered by @s2c/units.
 * Fully styled for CAD Workbench visual identity: Drafting Sheet (Light) & Oscilloscope (Dark).
 */

import {
  calculateLedResistor,
  calculateVoltageDivider,
  formatEngineering,
  type LedResistorResult,
  parseEngineering,
  type VoltageDividerResult,
} from "@s2c/units";
import { AlertTriangle, Calculator, Check, ClipboardCopy, Info, Sliders, Zap } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

export type CalculationResult<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: string };

export interface ExtendedVoltageDividerResult extends VoltageDividerResult {
  ratio: number;
  powerR1: number;
  powerR2: number;
}

/**
 * Calculates standard 4-band resistor color code for a given resistance.
 */
function getResistorColorBands(
  resistance: number,
  series: "E12" | "E24" | "E96",
): {
  bands: Array<{ color: string; label: string; textColor: string }>;
  toleranceBand: { color: string; label: string; textColor: string };
} | null {
  if (resistance <= 0 || !Number.isFinite(resistance)) return null;

  const colorMap: Record<number, { color: string; label: string; textColor: string }> = {
    0: { color: "#111111", label: "Black (0)", textColor: "#FFFFFF" },
    1: { color: "#8D4925", label: "Brown (1)", textColor: "#FFFFFF" },
    2: { color: "#D32F2F", label: "Red (2)", textColor: "#FFFFFF" },
    3: { color: "#F57C00", label: "Orange (3)", textColor: "#000000" },
    4: { color: "#FBC02D", label: "Yellow (4)", textColor: "#000000" },
    5: { color: "#388E3C", label: "Green (5)", textColor: "#FFFFFF" },
    6: { color: "#1976D2", label: "Blue (6)", textColor: "#FFFFFF" },
    7: { color: "#7B1FA2", label: "Violet (7)", textColor: "#FFFFFF" },
    8: { color: "#757575", label: "Gray (8)", textColor: "#FFFFFF" },
    9: { color: "#EEEEEE", label: "White (9)", textColor: "#000000" },
  };

  const toleranceMap = {
    E12: { color: "#B0B0B0", label: "Silver (±10%)", textColor: "#000000" },
    E24: { color: "#CFB53B", label: "Gold (±5%)", textColor: "#000000" },
    E96: { color: "#8D4925", label: "Brown (±1%)", textColor: "#FFFFFF" },
  };

  const exponent = Math.floor(Math.log10(resistance));
  const norm = resistance / 10 ** exponent;
  const roundedNorm = Math.round(norm * 10);
  const d1 = Math.floor(roundedNorm / 10);
  const d2 = roundedNorm % 10;
  const multExp = exponent - 1;

  if (d1 < 1 || d1 > 9 || d2 < 0 || d2 > 9 || multExp < -2 || multExp > 8) {
    return null;
  }

  const multiplierMap: Record<number, { color: string; label: string; textColor: string }> = {
    [-2]: { color: "#B0B0B0", label: "Silver (x0.01)", textColor: "#000000" },
    [-1]: { color: "#CFB53B", label: "Gold (x0.1)", textColor: "#000000" },
    0: { color: "#111111", label: "Black (x1)", textColor: "#FFFFFF" },
    1: { color: "#8D4925", label: "Brown (x10)", textColor: "#FFFFFF" },
    2: { color: "#D32F2F", label: "Red (x100)", textColor: "#FFFFFF" },
    3: { color: "#F57C00", label: "Orange (x1k)", textColor: "#000000" },
    4: { color: "#FBC02D", label: "Yellow (x10k)", textColor: "#000000" },
    5: { color: "#388E3C", label: "Green (x100k)", textColor: "#FFFFFF" },
    6: { color: "#1976D2", label: "Blue (x1M)", textColor: "#FFFFFF" },
    7: { color: "#7B1FA2", label: "Violet (x10M)", textColor: "#FFFFFF" },
    8: { color: "#757575", label: "Gray (x100M)", textColor: "#FFFFFF" },
  };

  const multColor = multiplierMap[multExp];
  if (!multColor || !colorMap[d1] || !colorMap[d2]) return null;

  return {
    bands: [colorMap[d1], colorMap[d2], multColor],
    toleranceBand: toleranceMap[series],
  };
}

export const CalculatorsTab: React.FC = () => {
  const [subTab, setSubTab] = useState<"led" | "divider" | "units">("led");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // =========================================================================
  // 1. Engineering Units State
  // =========================================================================
  const [engInput, setEngInput] = useState("4k7");
  const [rNotationToggle, setRNotationToggle] = useState(true);
  const [engUnitType, setEngUnitType] = useState("Ω");

  const parsedEngineering = useMemo(() => {
    try {
      const val = parseEngineering(engInput);
      const formatted = formatEngineering(val, {
        unit: engUnitType,
        rNotation: rNotationToggle,
        precision: 2,
      });
      const formattedStandard = formatEngineering(val, {
        unit: engUnitType,
        rNotation: false,
        precision: 3,
      });
      return { success: true, value: val, formatted, formattedStandard, error: null };
    } catch (e: unknown) {
      return {
        success: false,
        value: null,
        formatted: "",
        formattedStandard: "",
        error: (e as Error).message,
      };
    }
  }, [engInput, engUnitType, rNotationToggle]);

  // =========================================================================
  // 2. LED Resistor State
  // =========================================================================
  const [ledVSource, setLedVSource] = useState<number>(5.0);
  const [ledVForward, setLedVForward] = useState<number>(2.0);
  const [ledCurrentMa, setLedCurrentMa] = useState<number>(15);
  const [ledSeries, setLedSeries] = useState<"E12" | "E24" | "E96">("E24");

  const ledPresets: Record<string, { vf: number; name: string; color: string }> = {
    red: { vf: 2.0, name: "Red (2.0V)", color: "#D32F2F" },
    green: { vf: 2.2, name: "Green (2.2V)", color: "#388E3C" },
    yellow: { vf: 2.1, name: "Yellow (2.1V)", color: "#FBC02D" },
    blue: { vf: 3.2, name: "Blue (3.2V)", color: "#1976D2" },
    white: { vf: 3.3, name: "White (3.3V)", color: "#E0E0E0" },
    ir: { vf: 1.2, name: "Infrared (1.2V)", color: "#7B1FA2" },
  };

  const ledResult: CalculationResult<LedResistorResult> = useMemo(() => {
    try {
      return {
        success: true,
        data: calculateLedResistor(ledVSource, ledVForward, ledCurrentMa / 1000, ledSeries),
        error: null,
      };
    } catch (e: unknown) {
      return { success: false, data: null, error: (e as Error).message };
    }
  }, [ledVSource, ledVForward, ledCurrentMa, ledSeries]);

  const ledColorBands = useMemo(() => {
    if (!ledResult.success || !ledResult.data) return null;
    return getResistorColorBands(ledResult.data.recommendedResistance, ledSeries);
  }, [ledResult, ledSeries]);

  // =========================================================================
  // 3. Voltage Divider State
  // =========================================================================
  const [divVin, setDivVin] = useState<number>(5.0);
  const [divR1, setDivR1] = useState<number>(10000);
  const [divR2, setDivR2] = useState<number>(20000);

  const dividerResult: CalculationResult<ExtendedVoltageDividerResult> = useMemo(() => {
    try {
      const data = calculateVoltageDivider(divVin, divR1, divR2);
      const ratio = divVin !== 0 ? data.vOut / divVin : 0;
      const powerR1 = data.quiescentCurrent * data.quiescentCurrent * divR1;
      const powerR2 = data.quiescentCurrent * data.quiescentCurrent * divR2;
      return {
        success: true,
        data: {
          ...data,
          ratio,
          powerR1,
          powerR2,
        },
        error: null,
      };
    } catch (e: unknown) {
      return { success: false, data: null, error: (e as Error).message };
    }
  }, [divVin, divR1, divR2]);

  return (
    <div
      className="flex flex-col h-full border rounded-none overflow-hidden font-mono text-xs"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-app)",
        color: "var(--text-main)",
      }}
    >
      {/* Sub-bar / Ribbon */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b"
        style={{
          borderColor: "var(--border-app)",
          backgroundColor: "var(--bg-subpanel)",
        }}
      >
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setSubTab("led")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: subTab === "led" ? "var(--bg-panel)" : "transparent",
              borderColor: subTab === "led" ? "var(--border-strong)" : "var(--border-app)",
              color: subTab === "led" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <Zap
              className="w-3.5 h-3.5"
              style={{ color: subTab === "led" ? "var(--border-strong)" : "inherit" }}
            />
            <span>LED CURRENT LIMITER</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("divider")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: subTab === "divider" ? "var(--bg-panel)" : "transparent",
              borderColor: subTab === "divider" ? "var(--border-strong)" : "var(--border-app)",
              color: subTab === "divider" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <Sliders
              className="w-3.5 h-3.5"
              style={{ color: subTab === "divider" ? "var(--border-strong)" : "inherit" }}
            />
            <span>VOLTAGE DIVIDER</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab("units")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: subTab === "units" ? "var(--bg-panel)" : "transparent",
              borderColor: subTab === "units" ? "var(--border-strong)" : "var(--border-app)",
              color: subTab === "units" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <Calculator
              className="w-3.5 h-3.5"
              style={{ color: subTab === "units" ? "var(--border-strong)" : "inherit" }}
            />
            <span>ENGINEERING UNITS (BS 1852)</span>
          </button>
        </div>

        <div
          className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          <span>CAD PARAMETRIC CALCULATORS (§14)</span>
        </div>
      </div>

      {/* Main Tab Content */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-6"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        {/* ========================================================================= */}
        {/* 1. LED CURRENT-LIMITING RESISTOR                                         */}
        {/* ========================================================================= */}
        {subTab === "led" && (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Header info card */}
            <div
              className="p-4 border rounded-none"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-main)" }}
                  >
                    LED Current-Limiting Series Resistor (Doc §14.1)
                  </h3>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Calculates exact series resistance to protect both the diode junction and MCU
                    GPIO driver pin, snapping upward to standard E-series (E12 / E24 / E96) values.
                  </p>
                </div>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase shrink-0"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-main)",
                  }}
                >
                  OHM'S LAW
                </span>
              </div>

              {/* Formula display */}
              <div
                className="mt-3 p-2.5 border rounded-none text-[11px] font-mono"
                style={{
                  backgroundColor: "var(--bg-sunken)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                <span>FORMULA: </span>
                <span className="font-bold">R_exact = (V_source - V_forward) / I_forward</span>
                <span className="mx-2" style={{ color: "var(--text-subtle)" }}>
                  |
                </span>
                <span>R_standard = ceil_E(R_exact)</span>
                <span className="mx-2" style={{ color: "var(--text-subtle)" }}>
                  |
                </span>
                <span>P_res = I_op² * R_standard</span>
              </div>
            </div>

            {/* Input Grid */}
            <div
              className="p-4 border rounded-none space-y-4"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Source Voltage */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="led-vsource-input"
                      className="text-[11px] font-bold uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Supply Voltage (V_source)
                    </label>
                    <div className="flex gap-1">
                      {[5.0, 3.3, 12.0, 9.0].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setLedVSource(v)}
                          className="px-1.5 py-0.5 text-[9px] border rounded-none uppercase transition"
                          style={{
                            backgroundColor:
                              ledVSource === v ? "var(--border-strong)" : "var(--bg-subpanel)",
                            borderColor: "var(--border-app)",
                            color: ledVSource === v ? "var(--bg-app)" : "var(--text-muted)",
                          }}
                        >
                          {v}V
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="led-vsource-input"
                      type="number"
                      step="0.1"
                      value={ledVSource}
                      onChange={(e) => setLedVSource(Number(e.target.value))}
                      className="w-full border rounded-none px-3 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    />
                    <span
                      className="px-2.5 py-1.5 border border-l-0 rounded-none text-xs font-bold"
                      style={{
                        backgroundColor: "var(--bg-subpanel)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-muted)",
                      }}
                    >
                      V
                    </span>
                  </div>
                </div>

                {/* Forward Voltage */}
                <div>
                  <label
                    htmlFor="led-vforward-input"
                    className="text-[11px] font-bold uppercase block mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    LED Forward Voltage (V_forward)
                  </label>
                  <div className="flex items-center">
                    <input
                      id="led-vforward-input"
                      type="number"
                      step="0.1"
                      value={ledVForward}
                      onChange={(e) => setLedVForward(Number(e.target.value))}
                      className="w-full border rounded-none px-3 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    />
                    <span
                      className="px-2.5 py-1.5 border border-l-0 rounded-none text-xs font-bold"
                      style={{
                        backgroundColor: "var(--bg-subpanel)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-muted)",
                      }}
                    >
                      V
                    </span>
                  </div>
                </div>

                {/* Target Current */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="led-current-input"
                      className="text-[11px] font-bold uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Target Current (I_target)
                    </label>
                    <div className="flex gap-1">
                      {[5, 10, 15, 20].map((ma) => (
                        <button
                          key={ma}
                          type="button"
                          onClick={() => setLedCurrentMa(ma)}
                          className="px-1.5 py-0.5 text-[9px] border rounded-none uppercase transition"
                          style={{
                            backgroundColor:
                              ledCurrentMa === ma ? "var(--border-strong)" : "var(--bg-subpanel)",
                            borderColor: "var(--border-app)",
                            color: ledCurrentMa === ma ? "var(--bg-app)" : "var(--text-muted)",
                          }}
                        >
                          {ma}mA
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="led-current-input"
                      type="number"
                      step="1"
                      value={ledCurrentMa}
                      onChange={(e) => setLedCurrentMa(Number(e.target.value))}
                      className="w-full border rounded-none px-3 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    />
                    <span
                      className="px-2.5 py-1.5 border border-l-0 rounded-none text-xs font-bold"
                      style={{
                        backgroundColor: "var(--bg-subpanel)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-muted)",
                      }}
                    >
                      mA
                    </span>
                  </div>
                </div>

                {/* Standard Series */}
                <div>
                  <label
                    htmlFor="led-series-select"
                    className="text-[11px] font-bold uppercase block mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Resistor Tolerance Series
                  </label>
                  <select
                    id="led-series-select"
                    value={ledSeries}
                    onChange={(e) => setLedSeries(e.target.value as "E12" | "E24" | "E96")}
                    className="w-full border rounded-none px-3 py-1.5 text-xs outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="E12">E12 Series (±10% Standard Carbon Film)</option>
                    <option value="E24">E24 Series (±5% Standard Metal Film / SMD)</option>
                    <option value="E96">E96 Series (±1% Precision Instrumentation)</option>
                  </select>
                </div>
              </div>

              {/* Quick LED Presets */}
              <div className="pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <span
                  className="text-[10px] font-bold uppercase block mb-1.5"
                  style={{ color: "var(--text-subtle)" }}
                >
                  DIODE FORWARD DROP PRESETS:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(ledPresets).map(([key, p]) => {
                    const isSelected = Math.abs(ledVForward - p.vf) < 0.05;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setLedVForward(p.vf)}
                        className="px-2 py-1 border rounded-none text-[10px] font-bold flex items-center gap-1.5 uppercase transition"
                        style={{
                          backgroundColor: isSelected ? "var(--bg-sunken)" : "var(--bg-panel)",
                          borderColor: isSelected ? "var(--border-strong)" : "var(--border-app)",
                          color: "var(--text-main)",
                        }}
                      >
                        <span
                          className="w-2 h-2 rounded-full inline-block border"
                          style={{
                            backgroundColor: p.color,
                            borderColor: "var(--border-strong)",
                          }}
                        />
                        <span>{p.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Error display if calculation fails */}
            {!ledResult.success && (
              <div
                className="p-4 border rounded-none flex items-start gap-3"
                style={{
                  backgroundColor: "var(--accent-copper-bg)",
                  borderColor: "var(--accent-copper-border)",
                  color: "var(--accent-copper)",
                }}
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs uppercase">Calculation Parameter Conflict</h4>
                  <p className="text-[11px] mt-0.5">{ledResult.error}</p>
                </div>
              </div>
            )}

            {/* Result readout card */}
            {ledResult.success && ledResult.data && (
              <div
                className="p-5 border-2 rounded-none space-y-4"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderColor: "var(--border-strong)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                      style={{
                        backgroundColor: "var(--accent-valid-bg)",
                        borderColor: "var(--accent-valid-border)",
                        color: "var(--accent-valid)",
                      }}
                    >
                      CALCULATION VERIFIED
                    </span>
                    <span
                      className="text-xs font-bold uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      {ledSeries} STANDARD VALUE MATCH
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `${ledResult.data.recommendedResistance} Ω (${ledResult.data.recommendedPowerRating})`,
                        "led-res",
                      )
                    }
                    className="eng-btn rounded-none text-[10px]"
                  >
                    {copiedKey === "led-res" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>COPIED</span>
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="w-3 h-3" />
                        <span>COPY VALUE</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Primary readout */}
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider block mb-1"
                      style={{ color: "var(--text-muted)" }}
                    >
                      RECOMMENDED STANDARD RESISTOR:
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span
                        className="text-3xl font-extrabold tracking-tight"
                        style={{ color: "var(--text-main)" }}
                      >
                        {ledResult.data.recommendedResistance} Ω
                      </span>
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                        (Exact: {ledResult.data.exactResistance.toFixed(1)} Ω)
                      </span>
                    </div>
                  </div>

                  {/* Resistor color stripes */}
                  {ledColorBands && (
                    <div
                      className="p-2 border rounded-none flex flex-col gap-1 shrink-0"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                      }}
                    >
                      <span
                        className="text-[9px] font-bold uppercase"
                        style={{ color: "var(--text-subtle)" }}
                      >
                        4-BAND COLOR CODE:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ledColorBands.bands.map((b, idx) => (
                          <div
                            key={idx}
                            className="px-2 py-0.5 text-[9px] font-bold border rounded-none"
                            style={{
                              backgroundColor: b.color,
                              color: b.textColor,
                              borderColor: "var(--border-strong)",
                            }}
                            title={b.label}
                          >
                            {b.label.split(" ")[0]}
                          </div>
                        ))}
                        <div
                          className="px-2 py-0.5 text-[9px] font-bold border rounded-none"
                          style={{
                            backgroundColor: ledColorBands.toleranceBand.color,
                            color: ledColorBands.toleranceBand.textColor,
                            borderColor: "var(--border-strong)",
                          }}
                          title={ledColorBands.toleranceBand.label}
                        >
                          {ledColorBands.toleranceBand.label.split(" ")[0]}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Secondary telemetry metrics */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t text-[11px]"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div
                    className="p-2.5 border rounded-none"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span
                      className="block text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      OPERATING CURRENT:
                    </span>
                    <span
                      className="font-bold text-sm mt-0.5 block"
                      style={{ color: "var(--accent-valid)" }}
                    >
                      {(ledResult.data.operatingCurrent * 1000).toFixed(2)} mA
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      Under ATmega328P 20mA limit
                    </span>
                  </div>

                  <div
                    className="p-2.5 border rounded-none"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span
                      className="block text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      POWER DISSIPATION:
                    </span>
                    <span
                      className="font-bold text-sm mt-0.5 block"
                      style={{ color: "var(--text-main)" }}
                    >
                      {(ledResult.data.resistorPower * 1000).toFixed(1)} mW
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      P = I_op² * R_standard
                    </span>
                  </div>

                  <div
                    className="p-2.5 border rounded-none"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span
                      className="block text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      RECOMMENDED RATING:
                    </span>
                    <span
                      className="font-bold text-sm mt-0.5 block uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      {ledResult.data.recommendedPowerRating}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      Standard 1/4W (0.25W) axial/SMD
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. VOLTAGE DIVIDER CALCULATOR                                            */}
        {/* ========================================================================= */}
        {subTab === "divider" && (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Header info card */}
            <div
              className="p-4 border rounded-none"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-main)" }}
                  >
                    Unloaded Voltage Divider (Doc §14.2)
                  </h3>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Computes output voltage, transfer ratio, quiescent current consumption, and
                    power dissipation for sensor scaling and ADC input impedance matching.
                  </p>
                </div>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase shrink-0"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-main)",
                  }}
                >
                  KIRCHHOFF'S VOLTAGE LAW
                </span>
              </div>

              {/* Formula display */}
              <div
                className="mt-3 p-2.5 border rounded-none text-[11px] font-mono"
                style={{
                  backgroundColor: "var(--bg-sunken)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                <span>FORMULA: </span>
                <span className="font-bold">V_out = V_in * (R2 / (R1 + R2))</span>
                <span className="mx-2" style={{ color: "var(--text-subtle)" }}>
                  |
                </span>
                <span>I_quiescent = V_in / (R1 + R2)</span>
                <span className="mx-2" style={{ color: "var(--text-subtle)" }}>
                  |
                </span>
                <span>Z_out ≈ R1 || R2</span>
              </div>
            </div>

            {/* Inputs Grid */}
            <div
              className="p-4 border rounded-none space-y-4"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Vin */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="div-vin-input"
                      className="text-[11px] font-bold uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Input Voltage (V_in)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="div-vin-input"
                      type="number"
                      step="0.1"
                      value={divVin}
                      onChange={(e) => setDivVin(Number(e.target.value))}
                      className="w-full border rounded-none px-3 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    />
                    <span
                      className="px-2.5 py-1.5 border border-l-0 rounded-none text-xs font-bold"
                      style={{
                        backgroundColor: "var(--bg-subpanel)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-muted)",
                      }}
                    >
                      V
                    </span>
                  </div>
                </div>

                {/* R1 Top */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="div-r1-input"
                      className="text-[11px] font-bold uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Top Resistor (R1)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="div-r1-input"
                      type="number"
                      step="100"
                      value={divR1}
                      onChange={(e) => setDivR1(Number(e.target.value))}
                      className="w-full border rounded-none px-3 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    />
                    <span
                      className="px-2.5 py-1.5 border border-l-0 rounded-none text-xs font-bold"
                      style={{
                        backgroundColor: "var(--bg-subpanel)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-muted)",
                      }}
                    >
                      Ω
                    </span>
                  </div>
                </div>

                {/* R2 Bottom */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="div-r2-input"
                      className="text-[11px] font-bold uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Bottom Resistor (R2)
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="div-r2-input"
                      type="number"
                      step="100"
                      value={divR2}
                      onChange={(e) => setDivR2(Number(e.target.value))}
                      className="w-full border rounded-none px-3 py-1.5 text-xs outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    />
                    <span
                      className="px-2.5 py-1.5 border border-l-0 rounded-none text-xs font-bold"
                      style={{
                        backgroundColor: "var(--bg-subpanel)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-muted)",
                      }}
                    >
                      Ω
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Ratio Presets */}
              <div className="pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <span
                  className="text-[10px] font-bold uppercase block mb-1.5"
                  style={{ color: "var(--text-subtle)" }}
                >
                  COMMON DIVIDER ARCHITECTURES:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setDivVin(5.0);
                      setDivR1(10000);
                      setDivR2(20000);
                    }}
                    className="px-2 py-1 border rounded-none text-[10px] font-bold uppercase transition"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    5V → 3.33V (10k / 20k)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDivVin(5.0);
                      setDivR1(10000);
                      setDivR2(10000);
                    }}
                    className="px-2 py-1 border rounded-none text-[10px] font-bold uppercase transition"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    Half Rail 5V → 2.5V (10k / 10k)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDivVin(12.0);
                      setDivR1(14000);
                      setDivR2(10000);
                    }}
                    className="px-2 py-1 border rounded-none text-[10px] font-bold uppercase transition"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    12V → 5.0V (14k / 10k)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDivVin(5.0);
                      setDivR1(90000);
                      setDivR2(10000);
                    }}
                    className="px-2 py-1 border rounded-none text-[10px] font-bold uppercase transition"
                    style={{
                      backgroundColor: "var(--bg-panel)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    10:1 Attenuation (90k / 10k)
                  </button>
                </div>
              </div>
            </div>

            {/* Error display if calculation fails */}
            {!dividerResult.success && (
              <div
                className="p-4 border rounded-none flex items-start gap-3"
                style={{
                  backgroundColor: "var(--accent-copper-bg)",
                  borderColor: "var(--accent-copper-border)",
                  color: "var(--accent-copper)",
                }}
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs uppercase">Divider Error</h4>
                  <p className="text-[11px] mt-0.5">{dividerResult.error}</p>
                </div>
              </div>
            )}

            {/* Divider Results Readout */}
            {dividerResult.success && dividerResult.data && (
              <div
                className="p-5 border-2 rounded-none space-y-4"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderColor: "var(--border-strong)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                      style={{
                        backgroundColor: "var(--accent-valid-bg)",
                        borderColor: "var(--accent-valid-border)",
                        color: "var(--accent-valid)",
                      }}
                    >
                      OUTPUT RATIO: {(dividerResult.data.ratio * 100).toFixed(1)}%
                    </span>
                    <span
                      className="text-xs font-bold uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      TOTAL RESISTANCE:{" "}
                      {dividerResult.data.rTotal >= 1000
                        ? `${(dividerResult.data.rTotal / 1000).toFixed(1)} kΩ`
                        : `${dividerResult.data.rTotal} Ω`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(`${dividerResult.data.vOut.toFixed(3)} V`, "div-out")
                    }
                    className="eng-btn rounded-none text-[10px]"
                  >
                    {copiedKey === "div-out" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>COPIED</span>
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="w-3 h-3" />
                        <span>COPY V_OUT</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Primary Readout */}
                <div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider block mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    DIVIDED OUTPUT VOLTAGE (V_OUT):
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-3xl font-extrabold tracking-tight"
                      style={{ color: "var(--text-main)" }}
                    >
                      {dividerResult.data.vOut.toFixed(3)} V
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                      ({(dividerResult.data.ratio * 100).toFixed(2)}% of {divVin}V input)
                    </span>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t text-[11px]"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div
                    className="p-2.5 border rounded-none"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span
                      className="block text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      QUIESCENT CURRENT:
                    </span>
                    <span
                      className="font-bold text-sm mt-0.5 block"
                      style={{ color: "var(--text-main)" }}
                    >
                      {(dividerResult.data.quiescentCurrent * 1000).toFixed(3)} mA
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      Continuous rail drain
                    </span>
                  </div>

                  <div
                    className="p-2.5 border rounded-none"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span
                      className="block text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      POWER IN TOP R1:
                    </span>
                    <span
                      className="font-bold text-sm mt-0.5 block"
                      style={{ color: "var(--text-main)" }}
                    >
                      {(dividerResult.data.powerR1 * 1000).toFixed(2)} mW
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      Safe for 1/8W resistor
                    </span>
                  </div>

                  <div
                    className="p-2.5 border rounded-none"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span
                      className="block text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      POWER IN BOTTOM R2:
                    </span>
                    <span
                      className="font-bold text-sm mt-0.5 block"
                      style={{ color: "var(--text-main)" }}
                    >
                      {(dividerResult.data.powerR2 * 1000).toFixed(2)} mW
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      Safe for 1/8W resistor
                    </span>
                  </div>
                </div>

                {/* Impedance rule note */}
                <div
                  className="p-2.5 border rounded-none text-[11px] flex items-start gap-2"
                  style={{
                    backgroundColor: "var(--bg-subpanel)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-muted)",
                  }}
                >
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold" style={{ color: "var(--text-main)" }}>
                      ADC Input Impedance Advisory (Doc §9.1):
                    </span>{" "}
                    The effective output impedance of this divider is Thevenin equivalent R1 || R2 ={" "}
                    {((divR1 * divR2) / (divR1 + divR2) / 1000).toFixed(2)} kΩ. For ATmega328P ADC
                    inputs, recommended source impedance is ≤ 10 kΩ to prevent sampling capacitor
                    charging droop.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. ENGINEERING NOTATION PARSER & FORMATTER                               */}
        {/* ========================================================================= */}
        {subTab === "units" && (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* Header info card */}
            <div
              className="p-4 border rounded-none"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-main)" }}
                  >
                    Engineering Notation Parser &amp; Formatter (BS 1852 / IEC 60062)
                  </h3>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Converts schematic shorthand (e.g. 4k7, 100nF, 2M2, 0R1, 22p) to standard float
                    values and canonical BS 1852 component markings.
                  </p>
                </div>
                <span
                  className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase shrink-0"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-main)",
                  }}
                >
                  BS 1852
                </span>
              </div>
            </div>

            {/* Inputs Grid */}
            <div
              className="p-4 border rounded-none space-y-4"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Notation Input */}
                <div>
                  <label
                    htmlFor="eng-notation-input"
                    className="text-[11px] font-bold uppercase block mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Component Value Shorthand
                  </label>
                  <input
                    id="eng-notation-input"
                    type="text"
                    value={engInput}
                    onChange={(e) => setEngInput(e.target.value)}
                    placeholder="e.g. 4k7, 220, 100n, 0R05"
                    className="w-full border rounded-none px-3 py-1.5 text-xs font-mono outline-none uppercase"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  />
                </div>

                {/* Base Unit Select */}
                <div>
                  <label
                    htmlFor="eng-base-unit-select"
                    className="text-[11px] font-bold uppercase block mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Physical Quantity Unit
                  </label>
                  <select
                    id="eng-base-unit-select"
                    value={engUnitType}
                    onChange={(e) => setEngUnitType(e.target.value)}
                    className="w-full border rounded-none px-3 py-1.5 text-xs outline-none cursor-pointer"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    <option value="Ω">Ω (Resistance - Ohms)</option>
                    <option value="F">F (Capacitance - Farads)</option>
                    <option value="H">H (Inductance - Henries)</option>
                    <option value="V">V (Electric Potential - Volts)</option>
                    <option value="A">A (Current - Amperes)</option>
                    <option value="Hz">Hz (Frequency - Hertz)</option>
                    <option value="W">W (Power - Watts)</option>
                  </select>
                </div>
              </div>

              {/* Sample notation chips */}
              <div className="pt-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
                <span
                  className="text-[10px] font-bold uppercase block mb-1.5"
                  style={{ color: "var(--text-subtle)" }}
                >
                  COMMON SCHEMATIC NOTATION EXAMPLES:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { text: "4k7", unit: "Ω" },
                    { text: "100n", unit: "F" },
                    { text: "22p", unit: "F" },
                    { text: "0R1", unit: "Ω" },
                    { text: "1M5", unit: "Ω" },
                    { text: "220u", unit: "F" },
                    { text: "10uH", unit: "H" },
                    { text: "16M", unit: "Hz" },
                  ].map((chip) => (
                    <button
                      key={chip.text}
                      type="button"
                      onClick={() => {
                        setEngInput(chip.text);
                        setEngUnitType(chip.unit);
                      }}
                      className="px-2 py-1 border rounded-none text-[10px] font-bold font-mono transition"
                      style={{
                        backgroundColor:
                          engInput === chip.text ? "var(--border-strong)" : "var(--bg-panel)",
                        borderColor: "var(--border-app)",
                        color: engInput === chip.text ? "var(--bg-app)" : "var(--text-main)",
                      }}
                    >
                      {chip.text}
                    </button>
                  ))}
                </div>
              </div>

              {/* R-Notation toggle */}
              <div
                className="flex items-center gap-2 pt-2 border-t"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <input
                  id="r-notation-toggle"
                  type="checkbox"
                  checked={rNotationToggle}
                  onChange={(e) => setRNotationToggle(e.target.checked)}
                  className="rounded-none cursor-pointer"
                />
                <label
                  htmlFor="r-notation-toggle"
                  className="text-[11px] font-bold uppercase cursor-pointer"
                  style={{ color: "var(--text-main)" }}
                >
                  Enable BS 1852 R-Notation Replacement (e.g. 4k7 instead of 4.7 kΩ)
                </label>
              </div>
            </div>

            {/* Error banner if invalid input */}
            {!parsedEngineering.success && (
              <div
                className="p-4 border rounded-none flex items-start gap-3"
                style={{
                  backgroundColor: "var(--accent-copper-bg)",
                  borderColor: "var(--accent-copper-border)",
                  color: "var(--accent-copper)",
                }}
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs uppercase">Notation Parse Failure</h4>
                  <p className="text-[11px] mt-0.5">{parsedEngineering.error}</p>
                </div>
              </div>
            )}

            {/* Results card */}
            {parsedEngineering.success && parsedEngineering.value !== null && (
              <div
                className="p-5 border-2 rounded-none space-y-4"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderColor: "var(--border-strong)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-3"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <span
                    className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                    style={{
                      backgroundColor: "var(--accent-valid-bg)",
                      borderColor: "var(--accent-valid-border)",
                      color: "var(--accent-valid)",
                    }}
                  >
                    PARSED VALUE: {parsedEngineering.formatted}
                  </span>

                  <button
                    type="button"
                    onClick={() => copyToClipboard(parsedEngineering.formatted, "eng-copy")}
                    className="eng-btn rounded-none text-[10px]"
                  >
                    {copiedKey === "eng-copy" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span>COPIED</span>
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="w-3 h-3" />
                        <span>COPY FORMATTED</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Primary Raw Float */}
                <div>
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider block mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    CANONICAL BASE FLOAT VALUE:
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-3xl font-extrabold tracking-tight"
                      style={{ color: "var(--text-main)" }}
                    >
                      {parsedEngineering.value}
                    </span>
                    <span
                      className="text-sm font-bold uppercase"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {engUnitType} (base units)
                    </span>
                  </div>
                </div>

                {/* Formatted Columns */}
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t text-[11px]"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div
                    className="p-3 border rounded-none"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span
                      className="block text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      BS 1852 R-NOTATION:
                    </span>
                    <span
                      className="font-bold text-base mt-1 block font-mono"
                      style={{ color: "var(--text-main)" }}
                    >
                      {parsedEngineering.formatted}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      Replaces decimal point with SI prefix to avoid misprints
                    </span>
                  </div>

                  <div
                    className="p-3 border rounded-none"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-subtle)",
                    }}
                  >
                    <span
                      className="block text-[10px] uppercase font-bold"
                      style={{ color: "var(--text-muted)" }}
                    >
                      STANDARD SI METRIC PREFIX:
                    </span>
                    <span
                      className="font-bold text-base mt-1 block font-mono"
                      style={{ color: "var(--text-main)" }}
                    >
                      {parsedEngineering.formattedStandard}
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--text-subtle)" }}>
                      Standard engineering notation with whitespace
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
