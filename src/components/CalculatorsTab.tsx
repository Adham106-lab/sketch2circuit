/**
 * @license Apache-2.0
 * Engineering Calculators Component powered by @s2c/units.
 */

import {
  calculateLedResistor,
  calculateVoltageDivider,
  formatEngineering,
  parseEngineering,
} from "@s2c/units";
import { Calculator, Sliders, Zap } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

export const CalculatorsTab: React.FC = () => {
  const [subTab, setSubTab] = useState<"units" | "led" | "divider">("led");

  // 1. Engineering Units
  const [engInput, setEngInput] = useState("4k7");
  const [rNotationToggle, _setRNotationToggle] = useState(true);
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

  // 2. LED Resistor
  const [ledVSource, setLedVSource] = useState<number>(5.0);
  const [ledVForward, setLedVForward] = useState<number>(2.0);
  const [ledCurrentMa, setLedCurrentMa] = useState<number>(15);
  const [ledSeries, setLedSeries] = useState<"E12" | "E24" | "E96">("E24");

  const ledPresets: Record<string, { vf: number; name: string }> = {
    red: { vf: 2.0, name: "Standard Red (2.0V)" },
    green: { vf: 2.2, name: "Standard Green (2.2V)" },
    blue: { vf: 3.2, name: "Standard Blue (3.2V)" },
    white: { vf: 3.3, name: "White (3.3V)" },
    ir: { vf: 1.2, name: "Infrared (1.2V)" },
  };

  const ledResult = useMemo(() => {
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

  // 3. Voltage Divider
  const [divVin, setDivVin] = useState<number>(5.0);
  const [divR1, setDivR1] = useState<number>(10000);
  const [divR2, setDivR2] = useState<number>(20000);

  const dividerResult = useMemo(() => {
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
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Sub-bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 text-xs">
        <button
          type="button"
          onClick={() => setSubTab("led")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            subTab === "led"
              ? "bg-indigo-600 text-white font-medium"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>LED Current Limiter</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("divider")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            subTab === "divider"
              ? "bg-indigo-600 text-white font-medium"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Sliders className="w-3.5 h-3.5 text-sky-400" />
          <span>Voltage Divider</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("units")}
          className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
            subTab === "units"
              ? "bg-indigo-600 text-white font-medium"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          }`}
        >
          <Calculator className="w-3.5 h-3.5 text-emerald-400" />
          <span>Engineering Units</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* 1. LED Limiter */}
        {subTab === "led" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100">LED Current-Limiting Resistor</h3>
              <p className="text-xs text-slate-400 mt-1">
                Computes optimal resistance with exact E-series E12/E24/E96 snapping and power
                dissipation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Source Voltage (V_source)</span>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.1"
                      value={ledVSource}
                      onChange={(e) => setLedVSource(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    />
                    <span className="text-xs font-mono text-slate-500">V</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Forward Voltage (V_forward)</span>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="0.1"
                      value={ledVForward}
                      onChange={(e) => setLedVForward(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    />
                    <span className="text-xs font-mono text-slate-500">V</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Target Current</span>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      step="1"
                      value={ledCurrentMa}
                      onChange={(e) => setLedCurrentMa(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100"
                    />
                    <span className="text-xs font-mono text-slate-500">mA</span>
                  </div>
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Preferred E-Series</span>
                  <select
                    value={ledSeries}
                    onChange={(e) => setLedSeries(e.target.value as "E12" | "E24" | "E96")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1"
                  >
                    <option value="E12">E12 (10% Tolerance)</option>
                    <option value="E24">E24 (5% Standard)</option>
                    <option value="E96">E96 (1% Precision)</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-xs text-slate-500 font-mono">Quick LED Color Presets:</span>
              <div className="flex flex-wrap gap-2">
                {Object.entries(ledPresets).map(([key, p]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLedVForward(p.vf)}
                    className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Results card */}
            {ledResult.success && ledResult.data && (
              <div className="p-4 bg-slate-950 rounded-xl border border-indigo-500/30 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-indigo-400">
                    Recommended Standard Resistor
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300">
                    {ledSeries} Match
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold font-mono text-slate-100">
                    {ledResult.data.recommendedResistance} Ω
                  </span>
                  <span className="text-xs text-slate-400">
                    (Exact theoretical:{" "}
                    {ledResult.data.exactResistance != null
                      ? ledResult.data.exactResistance.toFixed(1)
                      : "—"}{" "}
                    Ω)
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500">Power Dissipation:</span>
                    <p className="font-mono text-slate-200 mt-0.5">
                      {ledResult.data.resistorPower != null
                        ? (ledResult.data.resistorPower * 1000).toFixed(1)
                        : "—"}{" "}
                      mW
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Actual Current:</span>
                    <p className="font-mono text-emerald-400 mt-0.5">
                      {ledResult.data.operatingCurrent != null
                        ? (ledResult.data.operatingCurrent * 1000).toFixed(2)
                        : "—"}{" "}
                      mA
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Rating:</span>
                    <p className="font-mono text-indigo-300 mt-0.5">
                      {ledResult.data.recommendedPowerRating || "0.25W"}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. Voltage Divider */}
        {subTab === "divider" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100">Voltage Divider Calculator</h3>
              <p className="text-xs text-slate-400 mt-1">
                Computes output voltage, transfer ratio, quiescent current, and resistor power
                dissipation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Input Voltage (V_in)</span>
                  <input
                    type="number"
                    step="0.1"
                    value={divVin}
                    onChange={(e) => setDivVin(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1"
                  />
                </label>
              </div>
              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Top Resistor R1 (Ω)</span>
                  <input
                    type="number"
                    step="100"
                    value={divR1}
                    onChange={(e) => setDivR1(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1"
                  />
                </label>
              </div>
              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Bottom Resistor R2 (Ω)</span>
                  <input
                    type="number"
                    step="100"
                    value={divR2}
                    onChange={(e) => setDivR2(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1"
                  />
                </label>
              </div>
            </div>

            {dividerResult.success && dividerResult.data && (
              <div className="p-4 bg-slate-950 rounded-xl border border-sky-500/30 space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase text-sky-400">
                    Divided Output Voltage (V_out)
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/10 text-sky-300">
                    Ratio:{" "}
                    {dividerResult.data.ratio != null
                      ? (dividerResult.data.ratio * 100).toFixed(1)
                      : "—"}
                    %
                  </span>
                </div>

                <div className="text-3xl font-bold font-mono text-slate-100">
                  {dividerResult.data.vOut != null ? dividerResult.data.vOut.toFixed(3) : "—"} V
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500">Quiescent Current:</span>
                    <p className="font-mono text-slate-200 mt-0.5">
                      {dividerResult.data.quiescentCurrent != null
                        ? (dividerResult.data.quiescentCurrent * 1000).toFixed(2)
                        : "—"}{" "}
                      mA
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Power in R1:</span>
                    <p className="font-mono text-slate-200 mt-0.5">
                      {dividerResult.data.powerR1 != null
                        ? (dividerResult.data.powerR1 * 1000).toFixed(2)
                        : "—"}{" "}
                      mW
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Power in R2:</span>
                    <p className="font-mono text-slate-200 mt-0.5">
                      {dividerResult.data.powerR2 != null
                        ? (dividerResult.data.powerR2 * 1000).toFixed(2)
                        : "—"}{" "}
                      mW
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Engineering Units */}
        {subTab === "units" && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-100">
                Engineering Notation Parser &amp; Formatter
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Converts schematic shorthand (e.g. 4k7, 100nF, 2M2, 0R1) to exact float values and
                standard engineering formats.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Notation Input</span>
                  <input
                    type="text"
                    value={engInput}
                    onChange={(e) => setEngInput(e.target.value)}
                    placeholder="e.g. 4k7, 220, 100n"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-100 mt-1"
                  />
                </label>
              </div>

              <div>
                <label className="text-xs text-slate-400 block">
                  <span>Base Unit</span>
                  <select
                    value={engUnitType}
                    onChange={(e) => setEngUnitType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 mt-1"
                  >
                    <option value="Ω">Ω (Resistance)</option>
                    <option value="F">F (Capacitance)</option>
                    <option value="H">H (Inductance)</option>
                    <option value="V">V (Voltage)</option>
                    <option value="A">A (Current)</option>
                  </select>
                </label>
              </div>
            </div>

            {parsedEngineering.success && (
              <div className="p-4 bg-slate-950 rounded-xl border border-emerald-500/30 space-y-3">
                <span className="text-xs font-mono uppercase text-emerald-400">Parsed Value</span>
                <div className="text-2xl font-bold font-mono text-slate-100">
                  {parsedEngineering.value}{" "}
                  <span className="text-slate-500 font-sans text-sm">base units</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <span className="text-slate-500">R-Notation (BS 1852):</span>
                    <p className="font-mono text-indigo-300 mt-0.5 text-sm">
                      {parsedEngineering.formatted}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500">Standard Metric Prefix:</span>
                    <p className="font-mono text-slate-200 mt-0.5 text-sm">
                      {parsedEngineering.formattedStandard}
                    </p>
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
