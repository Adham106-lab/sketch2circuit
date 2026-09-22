import { type Circuit, getCircuitJsonSchema, safeParseCircuit } from "@s2c/circuit-json";
import {
  calculateLedResistor,
  calculateVoltageDivider,
  formatEngineering,
  parseEngineering,
} from "@s2c/units";
import {
  Activity,
  AlertCircle,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  FileCode,
  Layers,
  Sliders,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

const PRESET_CIRCUITS: Record<string, { name: string; description: string; data: Circuit }> = {
  led_circuit: {
    name: "Arduino D13 LED Circuit",
    description:
      "Standard current-limiting circuit connecting Arduino digital pin 13 to an LED and GND via 220Ω resistor.",
    data: {
      schemaVersion: "0.1.0",
      name: "Arduino D13 LED Circuit",
      components: [
        {
          id: "U1",
          kind: "mcu",
          partNumber: "ATMEGA328P-PU",
          ports: [
            {
              id: "U1.D13",
              name: "D13",
              kind: "output",
              pinCapabilities: ["GPIO", "PWM"],
              voltageRange: [0, 5],
              currentLimit: 0.04,
            },
            { id: "U1.GND", name: "GND", kind: "ground", voltageRange: [0, 0] },
          ],
        },
        {
          id: "R1",
          kind: "resistor",
          value: "220Ω",
          ports: [
            { id: "R1.1", name: "1", kind: "passive" },
            { id: "R1.2", name: "2", kind: "passive" },
          ],
        },
        {
          id: "D1",
          kind: "led",
          ports: [
            { id: "D1.A", name: "A", kind: "passive" },
            { id: "D1.K", name: "K", kind: "passive" },
          ],
        },
      ],
      nets: [
        { id: "NET_D13", kind: "signal", portIds: ["U1.D13", "R1.1"] },
        { id: "NET_R_LED", kind: "signal", portIds: ["R1.2", "D1.A"] },
        { id: "GND", kind: "ground", portIds: ["D1.K", "U1.GND"] },
      ],
      assumptions: [
        {
          id: "asm_1",
          category: "peripheral-type",
          description: "Standard red LED forward voltage is approximately 1.8V to 2.0V",
          confidence: 0.95,
          evidence: ["Standard red indicator LED specification"],
        },
      ],
    },
  },
  voltage_divider: {
    name: "Analog Voltage Divider",
    description: "5V to 3.33V resistor voltage divider (10kΩ and 20kΩ) for ADC attenuation.",
    data: {
      schemaVersion: "0.1.0",
      name: "Analog Voltage Divider",
      components: [
        {
          id: "R1",
          kind: "resistor",
          value: "10kΩ",
          ports: [
            { id: "R1.1", name: "1", kind: "passive" },
            { id: "R1.2", name: "2", kind: "passive" },
          ],
        },
        {
          id: "R2",
          kind: "resistor",
          value: "20kΩ",
          ports: [
            { id: "R2.1", name: "1", kind: "passive" },
            { id: "R2.2", name: "2", kind: "passive" },
          ],
        },
      ],
      nets: [
        { id: "VCC_5V", kind: "power", portIds: ["R1.1"] },
        { id: "DIV_OUT", kind: "signal", portIds: ["R1.2", "R2.1"] },
        { id: "GND", kind: "ground", portIds: ["R2.2"] },
      ],
    },
  },
  broken_circuit: {
    name: "Broken Referential Integrity (Test)",
    description:
      "Invalid circuit containing duplicate component IDs and dangling port references to demonstrate rule verification.",
    data: {
      schemaVersion: "0.1.0",
      name: "Broken Referential Integrity Test",
      components: [
        {
          id: "R1",
          kind: "resistor",
          value: "100Ω",
          ports: [{ id: "R1.1", name: "1", kind: "passive" }],
        },
        {
          id: "R1",
          kind: "resistor",
          value: "220Ω",
          ports: [{ id: "R1.1", name: "1", kind: "passive" }],
        },
      ],
      nets: [{ id: "NET_ERR", kind: "signal", portIds: ["R1.1", "U1.NON_EXISTENT_PORT"] }],
    },
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<"circuit" | "units" | "led" | "divider" | "schema">(
    "circuit",
  );

  // Tab 1: Circuit Validator State
  const [selectedPreset, setSelectedPreset] = useState<string>("led_circuit");
  const [circuitJsonText, setCircuitJsonText] = useState<string>(() =>
    JSON.stringify(PRESET_CIRCUITS.led_circuit?.data, null, 2),
  );
  const [copiedSchema, setCopiedSchema] = useState(false);

  // Tab 2: Engineering Units State
  const [engInput, setEngInput] = useState("4k7");
  const [rNotationToggle, setRNotationToggle] = useState(true);
  const [engUnitType, setEngUnitType] = useState("Ω");

  // Tab 3: LED Calculator State
  const [ledVSource, setLedVSource] = useState<number>(5.0);
  const [ledVForward, setLedVForward] = useState<number>(2.0);
  const [ledCurrentMa, setLedCurrentMa] = useState<number>(15);
  const [ledSeries, setLedSeries] = useState<"E12" | "E24" | "E96">("E24");

  // Tab 4: Voltage Divider State
  const [divVin, setDivVin] = useState<number>(5.0);
  const [divR1, setDivR1] = useState<number>(10000);
  const [divR2, setDivR2] = useState<number>(20000);

  // Parse Circuit JSON live
  const validationResult = useMemo(() => {
    try {
      const parsedRaw = JSON.parse(circuitJsonText);
      const res = safeParseCircuit(parsedRaw);
      if (!res.success) {
        return {
          valid: false,
          errors: "errors" in res ? res.errors : ["Validation error"],
          circuit: null,
        };
      }
      return { valid: true, errors: [], circuit: res.data };
    } catch (e: unknown) {
      return {
        valid: false,
        errors: [(e as Error).message || "Invalid JSON syntax"],
        circuit: null,
      };
    }
  }, [circuitJsonText]);

  // Engineering parse live
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

  // LED Resistor calculation live
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

  // Voltage Divider calculation live
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

  const jsonSchema = useMemo(() => {
    return JSON.stringify(getCircuitJsonSchema(), null, 2);
  }, []);

  const handleCopySchema = () => {
    navigator.clipboard.writeText(jsonSchema);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2000);
  };

  return (
    <div
      id="workbench-root"
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans"
    >
      {/* Top Header */}
      <header
        id="workbench-header"
        className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">sketch2circuit</h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                v0.1.0 Online
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Electronics-as-Code Synthesizer &amp; Circuit IR Toolchain
            </p>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <nav
          id="workbench-nav"
          className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 text-sm"
        >
          <button
            id="tab-circuit"
            type="button"
            onClick={() => setActiveTab("circuit")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
              activeTab === "circuit"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Activity className="w-4 h-4" />
            Circuit IR
          </button>
          <button
            id="tab-units"
            type="button"
            onClick={() => setActiveTab("units")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
              activeTab === "units"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Sliders className="w-4 h-4" />
            Units &amp; Notation
          </button>
          <button
            id="tab-led"
            type="button"
            onClick={() => setActiveTab("led")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
              activeTab === "led"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Zap className="w-4 h-4" />
            LED Resistor
          </button>
          <button
            id="tab-divider"
            type="button"
            onClick={() => setActiveTab("divider")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
              activeTab === "divider"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Calculator className="w-4 h-4" />
            Voltage Divider
          </button>
          <button
            id="tab-schema"
            type="button"
            onClick={() => setActiveTab("schema")}
            className={`px-3.5 py-1.5 rounded-lg flex items-center gap-2 transition ${
              activeTab === "schema"
                ? "bg-indigo-600 text-white font-medium shadow-sm"
                : "text-slate-300 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <FileCode className="w-4 h-4" />
            Draft-07 Schema
          </button>
        </nav>
      </header>

      {/* Main Workspace Body */}
      <main id="workbench-main" className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {/* TAB 1: Circuit IR Live Inspector & Validator */}
        {activeTab === "circuit" && (
          <div id="panel-circuit-ir" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">Circuit IR Editor</h2>
                  <p className="text-xs text-slate-400">
                    Live Zod schema validation &amp; referential integrity enforcement
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Presets:</span>
                  <select
                    id="preset-selector"
                    value={selectedPreset}
                    onChange={(e) => {
                      const key = e.target.value;
                      setSelectedPreset(key);
                      const targetPreset = PRESET_CIRCUITS[key];
                      if (targetPreset) {
                        setCircuitJsonText(JSON.stringify(targetPreset.data, null, 2));
                      }
                    }}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="led_circuit">Arduino D13 LED</option>
                    <option value="voltage_divider">Voltage Divider</option>
                    <option value="broken_circuit">Integrity Violations (Test)</option>
                  </select>
                </div>
              </div>

              <div className="relative rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-inner flex flex-col flex-1 min-h-[420px]">
                <textarea
                  id="circuit-json-editor"
                  value={circuitJsonText}
                  onChange={(e) => setCircuitJsonText(e.target.value)}
                  className="w-full flex-1 p-4 bg-transparent font-mono text-xs text-slate-200 resize-none focus:outline-none leading-relaxed"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Validation & Component Topology View */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              {/* Status Header */}
              <div
                id="validation-status-card"
                className={`p-4 rounded-xl border flex items-start gap-3.5 transition ${
                  validationResult.valid
                    ? "bg-emerald-950/30 border-emerald-700/50 text-emerald-300"
                    : "bg-rose-950/30 border-rose-700/50 text-rose-300"
                }`}
              >
                {validationResult.valid ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-semibold text-sm">
                    {validationResult.valid
                      ? "Circuit IR Validated: Structural & Referential Integrity Passed"
                      : "Integrity or Schema Violations Found"}
                  </h3>
                  <p className="text-xs opacity-80 mt-0.5">
                    {validationResult.valid
                      ? `Successfully validated ${validationResult.circuit?.components.length} components and ${validationResult.circuit?.nets.length} interconnected nets.`
                      : `${validationResult.errors.length} issue(s) require attention.`}
                  </p>
                </div>
              </div>

              {/* Error List if any */}
              {!validationResult.valid && (
                <div
                  id="validation-errors"
                  className="bg-slate-900/80 border border-rose-900/40 rounded-xl p-4"
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-rose-400 mb-2">
                    Validation Diagnostics
                  </h4>
                  <ul className="space-y-1.5 text-xs text-rose-200 font-mono">
                    {validationResult.errors.map((err, idx) => (
                      <li
                        key={`err-${idx}`}
                        className="flex items-start gap-2 bg-rose-950/40 px-2.5 py-1.5 rounded border border-rose-900/30"
                      >
                        <span className="text-rose-500 font-bold shrink-0">•</span>
                        <span>{err}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Topology Summary */}
              {validationResult.valid && validationResult.circuit && (
                <div id="circuit-topology-view" className="flex flex-col gap-4">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      Components ({validationResult.circuit.components.length})
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {validationResult.circuit.components.map((comp) => (
                        <div
                          key={comp.id}
                          className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-indigo-300">
                              {comp.id}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                              {comp.kind}
                            </span>
                          </div>
                          {comp.value && (
                            <span className="text-xs text-emerald-400 font-mono">
                              Val: {comp.value}
                            </span>
                          )}
                          <div className="text-[11px] text-slate-400">
                            Ports: {comp.ports.map((p) => p.name).join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Nets &amp; Connectivity ({validationResult.circuit.nets.length})
                    </h4>
                    <div className="space-y-2">
                      {validationResult.circuit.nets.map((net) => (
                        <div
                          key={net.id}
                          className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-4 text-xs font-mono"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-amber-400 font-bold">{net.id}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                              {net.kind}
                            </span>
                          </div>
                          <div className="text-slate-300 text-[11px] flex items-center gap-1">
                            {net.portIds.join(" ⇄ ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Engineering Units & R-Notation */}
        {activeTab === "units" && (
          <div id="panel-units" className="max-w-3xl mx-auto flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Engineering Units &amp; R-Notation
              </h2>
              <p className="text-xs text-slate-400">
                Bidirectional parsing and formatting supporting SI prefixes and IEC component
                R-notation.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label htmlFor="eng-input-field" className="text-xs font-medium text-slate-300">
                    Input String
                  </label>
                  <input
                    id="eng-input-field"
                    type="text"
                    value={engInput}
                    onChange={(e) => setEngInput(e.target.value)}
                    placeholder="e.g. 4k7, 100nF, 22pF, 0R1"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="eng-unit-selector" className="text-xs font-medium text-slate-300">
                    Unit Type
                  </label>
                  <select
                    id="eng-unit-selector"
                    value={engUnitType}
                    onChange={(e) => setEngUnitType(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Ω">Resistance (Ω)</option>
                    <option value="F">Capacitance (F)</option>
                    <option value="H">Inductance (H)</option>
                    <option value="V">Voltage (V)</option>
                    <option value="A">Current (A)</option>
                    <option value="Hz">Frequency (Hz)</option>
                  </select>
                </div>
              </div>

              {/* Quick Preset Buttons & Options */}
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-400">Quick tests:</span>
                  {["4k7", "2R2", "100nF", "22pF", "10M", "0R47", "330"].map((sample) => (
                    <button
                      key={sample}
                      type="button"
                      onClick={() => setEngInput(sample)}
                      className="text-xs font-mono px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700"
                    >
                      {sample}
                    </button>
                  ))}
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rNotationToggle}
                    onChange={(e) => setRNotationToggle(e.target.checked)}
                    className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-0"
                  />
                  <span>R-Notation Mode</span>
                </label>
              </div>

              {/* Conversion Output Panel */}
              <div className="pt-4 border-t border-slate-800">
                {parsedEngineering.success ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Numeric Value</div>
                      <div className="text-lg font-mono font-bold text-white mt-1">
                        {parsedEngineering.value}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">Base SI float</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Standard SI Format</div>
                      <div className="text-lg font-mono font-bold text-emerald-400 mt-1">
                        {parsedEngineering.formattedStandard}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        Standard Prefix + Unit
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">R-Notation Format</div>
                      <div className="text-lg font-mono font-bold text-amber-400 mt-1">
                        {parsedEngineering.formatted}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        Embedded Decimal Prefix
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
                    Parse Error: {parsedEngineering.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LED Resistor Calculator */}
        {activeTab === "led" && (
          <div id="panel-led" className="max-w-3xl mx-auto flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-white">LED Current-Limiting Resistor</h2>
              <p className="text-xs text-slate-400">
                Calculates required resistance, snaps to standard E-series (IEC 60063), and
                evaluates power dissipation.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="led-vsource" className="text-xs font-medium text-slate-300">
                    Supply Voltage (V)
                  </label>
                  <input
                    id="led-vsource"
                    type="number"
                    step="0.1"
                    value={ledVSource}
                    onChange={(e) => setLedVSource(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="led-vforward" className="text-xs font-medium text-slate-300">
                    Forward Drop VF (V)
                  </label>
                  <input
                    id="led-vforward"
                    type="number"
                    step="0.1"
                    value={ledVForward}
                    onChange={(e) => setLedVForward(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="led-current" className="text-xs font-medium text-slate-300">
                    Target Current (mA)
                  </label>
                  <input
                    id="led-current"
                    type="number"
                    step="1"
                    value={ledCurrentMa}
                    onChange={(e) => setLedCurrentMa(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="led-series" className="text-xs font-medium text-slate-300">
                    E-Series Snapping
                  </label>
                  <select
                    id="led-series"
                    value={ledSeries}
                    onChange={(e) => setLedSeries(e.target.value as "E12" | "E24" | "E96")}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  >
                    <option value="E12">E12 (10% Tolerance)</option>
                    <option value="E24">E24 (5% Tolerance)</option>
                    <option value="E96">E96 (1% Precision)</option>
                  </select>
                </div>
              </div>

              {/* Quick LED Color Presets */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-slate-400">LED presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setLedVForward(1.8);
                    setLedCurrentMa(15);
                  }}
                  className="px-2.5 py-1 rounded bg-rose-950/60 text-rose-300 border border-rose-800/40"
                >
                  Red (1.8V @ 15mA)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLedVForward(2.1);
                    setLedCurrentMa(20);
                  }}
                  className="px-2.5 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40"
                >
                  Green (2.1V @ 20mA)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLedVForward(3.2);
                    setLedCurrentMa(20);
                  }}
                  className="px-2.5 py-1 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40"
                >
                  Blue/White (3.2V @ 20mA)
                </button>
              </div>

              {/* Results */}
              <div className="pt-4 border-t border-slate-800">
                {ledResult.success && ledResult.data ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Standard Resistor</div>
                      <div className="text-xl font-mono font-bold text-indigo-400 mt-1">
                        {ledResult.data.recommendedResistance} Ω
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        Exact: {ledResult.data.exactResistance.toFixed(1)} Ω
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Actual Current</div>
                      <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                        {(ledResult.data.operatingCurrent * 1000).toFixed(2)} mA
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        Target: {ledCurrentMa} mA
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Power Dissipation</div>
                      <div className="text-xl font-mono font-bold text-amber-400 mt-1">
                        {(ledResult.data.resistorPower * 1000).toFixed(1)} mW
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">P = I² × R</div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Recommended Rating</div>
                      <div className="text-xl font-mono font-bold text-purple-400 mt-1">
                        {ledResult.data.recommendedPowerRating}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        Safe margin included
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
                    {ledResult.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Voltage Divider Calculator */}
        {activeTab === "divider" && (
          <div id="panel-divider" className="max-w-3xl mx-auto flex flex-col gap-6">
            <div>
              <h2 className="text-lg font-semibold text-white">Voltage Divider Calculator</h2>
              <p className="text-xs text-slate-400">
                Calculates output voltage, quiescent current, and resistor power dissipation.
              </p>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-6 flex flex-col gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="div-vin" className="text-xs font-medium text-slate-300">
                    Input Voltage Vin (V)
                  </label>
                  <input
                    id="div-vin"
                    type="number"
                    step="0.1"
                    value={divVin}
                    onChange={(e) => setDivVin(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="div-r1" className="text-xs font-medium text-slate-300">
                    Top Resistor R1 (Ω)
                  </label>
                  <input
                    id="div-r1"
                    type="number"
                    step="100"
                    value={divR1}
                    onChange={(e) => setDivR1(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="div-r2" className="text-xs font-medium text-slate-300">
                    Bottom Resistor R2 (Ω)
                  </label>
                  <input
                    id="div-r2"
                    type="number"
                    step="100"
                    value={divR2}
                    onChange={(e) => setDivR2(Number(e.target.value))}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Results */}
              <div className="pt-4 border-t border-slate-800">
                {dividerResult.success && dividerResult.data ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Output Voltage Vout</div>
                      <div className="text-xl font-mono font-bold text-emerald-400 mt-1">
                        {dividerResult.data.vOut.toFixed(3)} V
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        Ratio: {(dividerResult.data.ratio * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Divider Current</div>
                      <div className="text-xl font-mono font-bold text-indigo-400 mt-1">
                        {(dividerResult.data.quiescentCurrent * 1000).toFixed(3)} mA
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 font-mono">
                        I = Vin / (R1 + R2)
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                      <div className="text-xs text-slate-400">Power Dissipation</div>
                      <div className="text-sm font-mono text-slate-200 mt-1 space-y-0.5">
                        <div>R1: {(dividerResult.data.powerR1 * 1000).toFixed(2)} mW</div>
                        <div>R2: {(dividerResult.data.powerR2 * 1000).toFixed(2)} mW</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-rose-300 text-xs">
                    {dividerResult.error}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: JSON Schema Export */}
        {activeTab === "schema" && (
          <div id="panel-schema" className="max-w-4xl mx-auto flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Circuit IR JSON Schema (Draft-07)
                </h2>
                <p className="text-xs text-slate-400">
                  Self-contained Draft-07 specification schema for electronics-as-code
                  interoperability.
                </p>
              </div>
              <button
                id="copy-schema-btn"
                type="button"
                onClick={handleCopySchema}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition"
              >
                {copiedSchema ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedSchema ? "Copied!" : "Copy Schema JSON"}
              </button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-inner p-4 max-h-[500px] overflow-y-auto font-mono text-xs text-slate-300">
              <pre>{jsonSchema}</pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        id="workbench-footer"
        className="border-t border-slate-800/80 bg-slate-900/40 px-6 py-3 text-xs text-slate-500 flex items-center justify-between"
      >
        <div>sketch2circuit • Milestone 1 Core Tools</div>
        <div className="flex items-center gap-4">
          <span>@s2c/circuit-json v0.1.0</span>
          <span>@s2c/units v0.1.0</span>
        </div>
      </footer>
    </div>
  );
}
