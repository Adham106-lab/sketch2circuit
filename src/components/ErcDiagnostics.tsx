/**
 * @license Apache-2.0
 * ERC Diagnostics Panel component powered by @s2c/rules.
 * Distinctive engineering aesthetic: sharp rectangular cards,
 * copper-red (#B5432A) warning tags, muted green (#3D6B4F) remediation blocks.
 */

import type { Diagnostic } from "@s2c/circuit-json";
import { DEFAULT_RULES, type RuleDefinition } from "@s2c/rules";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  ShieldCheck,
  Zap,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

// ============================================================================
// Authoritative Physics & Mathematical Formula Lookup for 18 Rules (Doc §9.1)
// ============================================================================
interface EnhancedRuleMeta {
  formula?: string;
  formulaLabel?: string;
  physicsDetail?: string;
  remediationProtocol?: string;
  checklist?: string[];
  standardRef?: string;
}

const RULE_ENHANCED_META: Record<string, EnhancedRuleMeta> = {
  "erc.inductive-load-no-flyback": {
    formula: "V_spike = -L * (dI / dt)   [Peak Back-EMF: > 120V, t_decay < 50ns]",
    formulaLabel: "FARADAY'S LAW OF INDUCTIVE KICKBACK",
    physicsDetail:
      "Inductive coils (DC motors, relays, solenoids) store electromagnetic energy E = 1/2 * L * I². When the switching transistor or GPIO driver turns OFF, the magnetic field collapses instantaneously (dt ≈ 10–50ns). Under Faraday's Law, this rapid di/dt creates a massive reverse-polarity voltage spike that exceeds transistor collector-emitter breakdown voltage (V_CEO), destroying semiconductor junctions.",
    remediationProtocol:
      "Install a 1N4007 (or fast switching 1N4148 / Schottky 1N5819) clamp diode in reverse parallel across the motor or relay coil terminals: cathode (striped band) connected to positive supply rail (+VCC) and anode connected to switching transistor collector/drain. When the transistor switches off, the diode becomes forward-biased and provides a safe, low-impedance freewheeling loop to dissipate coil current.",
    checklist: [
      "Diode cathode connected to +VCC supply rail",
      "Diode anode connected to transistor collector / drain terminal",
      "Diode reverse voltage rating (V_R) >= 2x V_supply (1N4007 rated 1000V)",
      "Keep diode trace loop physically as short as possible to eliminate parasitic RF emission",
    ],
    standardRef:
      "Doc §9.1: Inductive Transient Protection / IEC 61000-4-4 Electrical Fast Transient",
  },
  "erc.pin-current": {
    formula: "I_pin = V_pin / R_load <= 40.0mA   (Absolute Max Rating for ATmega328P)",
    formulaLabel: "OHM'S LAW & ABSOLUTE MAXIMUM PIN DRIVE RATING",
    physicsDetail:
      "Microcontroller GPIO pins are driven by microscopic internal complementary MOSFETs with silicon bond wires. Sourcing or sinking excessive current causes intense localized Joule heating (P = I² * R_dson) and electromigration inside the silicon die. While continuous operating current should remain under 20mA, exceeding 40mA triggers immediate thermal stress, threshold voltage shift, or permanent bond wire fusion.",
    remediationProtocol:
      "Increase total series load resistance to at least R_min = V_cc / 40mA = 125Ω (or 250Ω for conservative 20mA continuous operation). If the peripheral requires high operating current (motors, solenoids, power LEDs), insert an active buffer stage using a 2N2222 NPN BJT with a 1kΩ base resistor, a logic-level N-channel MOSFET (e.g. 2N7000 or IRLZ44N), or an optoisolated driver module.",
    checklist: [
      "Ensure direct GPIO series resistance R >= 125Ω (5V / 40mA) or >= 250Ω (5V / 20mA)",
      "If load current exceeds 20mA, decouple via 2N2222 transistor or MOSFET buffer",
      "Verify sum of all concurrent GPIO currents remains under 200mA package limit",
    ],
    standardRef:
      "ATmega328P Datasheet §32.1: Absolute Maximum Ratings (DC Current per I/O Pin: 40mA)",
  },
  "erc.total-current": {
    formula: "Σ I_gpio + I_quiescent <= 200mA   (ATmega328P Package Power Limit)",
    formulaLabel: "KIRCHHOFF'S CURRENT LAW & TOTAL PACKAGE THERMAL BUDGET",
    physicsDetail:
      "The microcontroller package has finite leadframe and bond wire current carrying capacity. Even if individual pins stay below 40mA, concurrent high-current output states can exceed the total 200mA supply pin limit, causing thermal throttling, VCC rail droop, and brownout resets.",
    remediationProtocol:
      "Offload high-current actuators to dedicated external power rails using driver arrays (e.g. ULN2003A, TPIC6B595) or high-side P-channel MOSFET switches.",
    checklist: [
      "Audit simultaneous HIGH output states across all digital pins",
      "Power LEDs and actuators from main 5V rail rather than MCU I/O pins",
    ],
    standardRef: "ATmega328P Datasheet §32.1: DC Current VCC and GND Pins: 200.0mA",
  },
  "erc.led-no-resistor": {
    formula: "I_led = (V_cc - V_forward) / R_internal ≈ (5.0V - 2.0V) / 5Ω ≈ 600mA",
    formulaLabel: "SHOCKLEY DIODE EQUATION & THERMAL RUNAWAY",
    physicsDetail:
      "Light emitting diodes exhibit an exponential current-voltage relationship above forward turn-on voltage. Direct connection across a voltage source causes uncontrolled current surge leading to instant thermal runaway and bond wire destruction.",
    remediationProtocol:
      "Insert a current-limiting resistor in series with the LED anode or cathode. For typical 5V operation: R = (5.0V - 2.0V) / 10mA = 300Ω (standard 330Ω E24 resistor).",
    checklist: [
      "Select standard E24 resistor (220Ω, 330Ω, or 470Ω for 5V circuits)",
      "Verify resistor power rating P = I² * R is within 1/4W (0.25W) limit",
    ],
    standardRef: "Doc §9.1: Diode Current Limiting & E24 Resistor Selection",
  },
  "erc.servo-power": {
    formula: "I_stall = 500mA–1500mA > I_regulator_headroom   (Onboard LDO Limit: 500mA)",
    formulaLabel: "SERVO ACCELERATION & STALL TRANSIENT BUDGET",
    physicsDetail:
      "RC hobby servos (e.g. TowerPro SG90) draw large peak currents during mechanical movement and stall (up to 1.2A). Driving the servo power pin from the Arduino onboard 5V regulator causes supply rail dips that trigger brown-out resets (BOR).",
    remediationProtocol:
      "Power the servo VCC terminal from an independent regulated 5V power supply capable of delivering 1A–2A continuous, connecting all grounds together in a common ground reference.",
    checklist: [
      "Power servo from external 5V supply rail with common ground reference",
      "Place a 47µF–100µF electrolytic decoupling capacitor close to servo power connector",
    ],
    standardRef: "Doc §9.1: Actuator Power Separation & Ground Integrity",
  },
  "erc.i2c-pullups": {
    formula: "t_rise = 0.8473 * R_pullup * C_bus <= 1000ns   (I2C Standard Mode)",
    formulaLabel: "NXP UM10204 I2C BUS RISE TIME SPECIFICATION",
    physicsDetail:
      "I2C uses open-drain drivers. Without external pull-up resistors, the bus capacitance cannot charge back to VCC when drivers release the line, stalling serial communication.",
    remediationProtocol:
      "Place 4.7kΩ pull-up resistors between SDA/SCL and VCC (or 2.2kΩ for fast mode 400kHz).",
    checklist: ["Add 4.7kΩ resistor between SDA and 5V", "Add 4.7kΩ resistor between SCL and 5V"],
    standardRef: "NXP UM10204: I2C-bus Specification and User Manual §7.1",
  },
};

// ============================================================================
// Deterministic Synthetic Benchmark Violations (Flyback Diode & Pin Current)
// ============================================================================
const BENCHMARK_VIOLATIONS: Diagnostic[] = [
  {
    ruleId: "erc.inductive-load-no-flyback",
    severity: "warning",
    message: "Inductive load 'M1' (DC Motor on D3) lacks an antiparallel flyback clamp diode.",
    explanation:
      "DC motor 'M1' is driven via switching GPIO pin D3. When PWM modulation turns the driver OFF, rapid interruption of inductive coil current induces high-voltage back-EMF transients (V = -L * di/dt) exceeding 100V. Without a clamp diode, this inductive spike destroys microcontroller driver FETs.",
    target: { type: "component", id: "M1" },
    suggestion:
      "Connect a 1N4007 clamp diode in reverse parallel across motor 'M1' terminals: cathode to positive rail (+VCC) and anode to transistor collector/drain.",
  },
  {
    ruleId: "erc.pin-current",
    severity: "error",
    message:
      "Output current through port 'ATmega328P.D6' (73.5mA) exceeds safe 40.0mA GPIO rating.",
    explanation:
      "Port 'ATmega328P.D6' is configured as digital OUTPUT driving low-impedance load 'R_LOAD' (68Ω) directly to GND at 5.0V. Calculated pin current I = 5.0V / 68Ω = 73.5mA exceeds absolute maximum datasheet rating of 40.0mA by 33.5mA.",
    target: { type: "port", id: "ATmega328P.D6" },
    suggestion:
      "Increase series load resistance to at least 125Ω (for 40mA max limit, or 250Ω for 20mA safe margin), or buffer pin D6 using a 2N2222 NPN transistor stage.",
  },
];

const ruleMap = new Map<string, RuleDefinition>(DEFAULT_RULES.map((r) => [r.id, r]));

interface ErcDiagnosticsProps {
  diagnostics: Diagnostic[];
}

export const ErcDiagnostics: React.FC<ErcDiagnosticsProps> = ({ diagnostics: liveDiagnostics }) => {
  const [sourceMode, setSourceMode] = useState<"live" | "benchmark">(() =>
    liveDiagnostics.length === 0 ? "benchmark" : "live",
  );
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({
    "erc.inductive-load-no-flyback-0": true,
    "erc.pin-current-1": true,
  });
  const [activeRuleModal, setActiveRuleModal] = useState<string | null>(null);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Active diagnostics based on selected source mode
  const currentDiagnostics = useMemo(() => {
    if (sourceMode === "benchmark") {
      return BENCHMARK_VIOLATIONS;
    }
    return liveDiagnostics;
  }, [sourceMode, liveDiagnostics]);

  const errorCount = currentDiagnostics.filter((d) => d.severity === "error").length;
  const warningCount = currentDiagnostics.filter((d) => d.severity === "warning").length;
  const infoCount = currentDiagnostics.filter((d) => d.severity === "info").length;

  const filteredDiagnostics = useMemo(() => {
    return currentDiagnostics.filter((d) => {
      if (filter !== "all" && d.severity !== filter) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        d.ruleId.toLowerCase().includes(term) ||
        d.message.toLowerCase().includes(term) ||
        d.target?.id.toLowerCase().includes(term) ||
        d.explanation?.toLowerCase().includes(term)
      );
    });
  }, [currentDiagnostics, filter, searchTerm]);

  const toggleExpand = (cardKey: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [cardKey]: !prev[cardKey],
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    filteredDiagnostics.forEach((d, idx) => {
      next[`${d.ruleId}-${idx}`] = true;
    });
    setExpandedCards(next);
  };

  const collapseAll = () => {
    setExpandedCards({});
  };

  const handleCopyReport = () => {
    const lines = [
      "================================================================================",
      "SKETCH2CIRCUIT — ELECTRICAL RULES CHECK (ERC) AUDIT REPORT (DOC §9.1)",
      "================================================================================",
      `Date/Time: ${new Date().toISOString()}`,
      `Source: ${sourceMode === "benchmark" ? "Synthetic Benchmark Suite" : "Live Sketch Synthesis"}`,
      `Total Checks: 18 Defined Rules | Violations Detected: ${currentDiagnostics.length}`,
      `Breakdown: ${errorCount} Errors, ${warningCount} Warnings, ${infoCount} Notices`,
      "--------------------------------------------------------------------------------",
    ];

    currentDiagnostics.forEach((d, idx) => {
      const meta = RULE_ENHANCED_META[d.ruleId];
      lines.push(
        `\n[ITEM ${idx + 1}] ${d.severity.toUpperCase()}: ${d.ruleId}`,
        `TARGET: ${d.target ? `${d.target.id} (${d.target.type})` : "General Circuit"}`,
        `MESSAGE: ${d.message}`,
      );
      if (meta?.formula) {
        lines.push(`FORMULA: ${meta.formula}`);
      }
      if (d.explanation) {
        lines.push(`PHYSICS & RATING: ${d.explanation}`);
      }
      if (d.suggestion) {
        lines.push(`REMEDIATION: ${d.suggestion}`);
      }
    });

    lines.push(
      "\n================================================================================",
      "END OF ERC AUDIT REPORT — DETERMINISTIC PASS/FAIL SPECIFICATION",
      "================================================================================",
    );

    navigator.clipboard.writeText(lines.join("\n"));
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const selectedRuleDef = activeRuleModal ? ruleMap.get(activeRuleModal) : null;
  const selectedRuleMeta = activeRuleModal ? RULE_ENHANCED_META[activeRuleModal] : null;

  return (
    <div
      className="flex flex-col h-full border rounded-none overflow-hidden font-mono"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-app)",
        color: "var(--text-main)",
      }}
    >
      {/* ===================================================================== */}
      {/* HEADER BANNER: ERC ENGINE CONTROLS & STATUS                          */}
      {/* ===================================================================== */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b rounded-none"
        style={{
          backgroundColor: "var(--bg-subpanel)",
          borderColor: "var(--border-app)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 border rounded-none shrink-0"
            style={{
              borderColor:
                errorCount > 0 || warningCount > 0 ? "#B5432A" : "var(--accent-valid-border)",
              backgroundColor:
                errorCount > 0 || warningCount > 0
                  ? "rgba(181, 67, 42, 0.12)"
                  : "var(--accent-valid-bg)",
              color: errorCount > 0 || warningCount > 0 ? "#B5432A" : "var(--accent-valid)",
            }}
          >
            {errorCount > 0 ? (
              <AlertCircle className="w-5 h-5 text-[#B5432A]" />
            ) : warningCount > 0 ? (
              <AlertTriangle className="w-5 h-5 text-[#B5432A]" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                <span>ELECTRICAL RULES CHECK (ERC)</span>
                <span
                  className="text-[9px] px-1.5 py-0.2 border rounded-none font-normal"
                  style={{
                    borderColor: "var(--border-app)",
                    color: "var(--text-muted)",
                  }}
                >
                  DOC §9.1 SPEC
                </span>
              </h3>
              {errorCount === 0 && warningCount === 0 ? (
                <span
                  className="text-[10px] px-2 py-0.5 border rounded-none font-bold"
                  style={{
                    borderColor: "var(--accent-valid-border)",
                    backgroundColor: "var(--accent-valid-bg)",
                    color: "var(--accent-valid)",
                  }}
                >
                  PASSED (0 VIOLATIONS)
                </span>
              ) : (
                <span className="erc-warning-tag">
                  <AlertTriangle className="w-3 h-3 text-[#B5432A]" />
                  <span>
                    {errorCount + warningCount} HAZARD
                    {errorCount + warningCount === 1 ? "" : "S"} DETECTED
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              DETERMINISTIC 18-RULE PHYSICS, TRANSIENT SPIKE &amp; PIN CURRENT VERIFICATION
            </p>
          </div>
        </div>

        {/* Source Switcher: Live Sketch vs Benchmark Suite */}
        <div className="flex items-center gap-2 flex-wrap">
          <div
            className="flex items-center border rounded-none p-0.5"
            style={{
              borderColor: "var(--border-app)",
              backgroundColor: "var(--bg-sunken)",
            }}
          >
            <button
              type="button"
              onClick={() => setSourceMode("live")}
              className="px-2.5 py-1 text-[10px] uppercase font-bold transition rounded-none"
              style={{
                backgroundColor: sourceMode === "live" ? "var(--bg-panel)" : "transparent",
                color: sourceMode === "live" ? "var(--text-main)" : "var(--text-muted)",
                border:
                  sourceMode === "live"
                    ? "1px solid var(--border-strong)"
                    : "1px solid transparent",
              }}
            >
              LIVE SKETCH ({liveDiagnostics.length})
            </button>
            <button
              type="button"
              onClick={() => setSourceMode("benchmark")}
              className="px-2.5 py-1 text-[10px] uppercase font-bold transition flex items-center gap-1.5 rounded-none"
              style={{
                backgroundColor:
                  sourceMode === "benchmark" ? "rgba(181, 67, 42, 0.12)" : "transparent",
                color: sourceMode === "benchmark" ? "#B5432A" : "var(--text-muted)",
                border: sourceMode === "benchmark" ? "1px solid #B5432A" : "1px solid transparent",
              }}
              title="Inspect Benchmark Hazard Suite: Inductive Flyback Diode and Pin Over-Current Cards"
            >
              <Zap className="w-3 h-3" />
              <span>BENCHMARK SUITE (2)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyReport}
            className="eng-btn rounded-none"
            title="Copy formatted ERC engineering audit report to clipboard"
          >
            {copiedReport ? (
              <>
                <Check className="w-3.5 h-3.5" style={{ color: "var(--accent-valid)" }} />
                <span>COPIED REPORT</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>COPY AUDIT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* FILTER & AUDIT SUB-TOOLBAR                                            */}
      {/* ===================================================================== */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b text-[11px]"
        style={{
          backgroundColor: "var(--bg-panel)",
          borderColor: "var(--border-app)",
        }}
      >
        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-none border transition"
            style={{
              borderColor: filter === "all" ? "var(--border-strong)" : "var(--border-app)",
              backgroundColor: filter === "all" ? "var(--bg-sunken)" : "transparent",
              color: filter === "all" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            ALL ({currentDiagnostics.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("error")}
            className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-none border transition flex items-center gap-1"
            style={{
              borderColor: filter === "error" ? "#B5432A" : "var(--border-app)",
              backgroundColor: filter === "error" ? "rgba(181, 67, 42, 0.12)" : "transparent",
              color: filter === "error" ? "#B5432A" : "var(--text-muted)",
            }}
          >
            <AlertCircle className="w-3 h-3 text-[#B5432A]" />
            <span>ERRORS ({errorCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("warning")}
            className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-none border transition flex items-center gap-1"
            style={{
              borderColor: filter === "warning" ? "#B5432A" : "var(--border-app)",
              backgroundColor: filter === "warning" ? "rgba(181, 67, 42, 0.12)" : "transparent",
              color: filter === "warning" ? "#B5432A" : "var(--text-muted)",
            }}
          >
            <AlertTriangle className="w-3 h-3 text-[#B5432A]" />
            <span>WARNINGS ({warningCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter("info")}
            className="px-2 py-0.5 text-[10px] uppercase font-bold rounded-none border transition flex items-center gap-1"
            style={{
              borderColor: filter === "info" ? "var(--border-strong)" : "var(--border-app)",
              backgroundColor: filter === "info" ? "var(--bg-sunken)" : "transparent",
              color: filter === "info" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <Info className="w-3 h-3" />
            <span>NOTICES ({infoCount})</span>
          </button>
        </div>

        {/* Search input & bulk collapse/expand */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="FILTER RULES / PINS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-2.5 py-0.5 text-[10px] border rounded-none uppercase bg-transparent outline-none w-44"
            style={{
              borderColor: "var(--border-app)",
              color: "var(--text-main)",
            }}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={expandAll}
              className="px-2 py-0.5 text-[9px] uppercase border rounded-none hover:opacity-80 transition"
              style={{
                borderColor: "var(--border-app)",
                color: "var(--text-muted)",
              }}
              title="Expand all cards"
            >
              EXPAND ALL
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-2 py-0.5 text-[9px] uppercase border rounded-none hover:opacity-80 transition"
              style={{
                borderColor: "var(--border-app)",
                color: "var(--text-muted)",
              }}
              title="Collapse all cards"
            >
              COLLAPSE ALL
            </button>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* DIAGNOSTICS CARD LIST: SHARP RECTANGULAR CARDS & HAZARDS             */}
      {/* ===================================================================== */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredDiagnostics.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center p-12 text-center border rounded-none"
            style={{
              borderColor: "var(--border-app)",
              backgroundColor: "var(--bg-subpanel)",
            }}
          >
            <CheckCircle2 className="w-10 h-10 mb-3" style={{ color: "var(--accent-valid)" }} />
            <h4
              className="font-bold text-xs uppercase tracking-wide"
              style={{ color: "var(--text-main)" }}
            >
              ZERO ELECTRICAL VIOLATIONS IN CURRENT SELECTION
            </h4>
            <p
              className="text-[11px] max-w-md mt-1 leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              All 18 deterministic electrical rules passed cleanly. The active circuit obeys GPIO
              current limits, supply voltage tolerances, inductive clamping, and pin directional
              impedance rules.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSourceMode("benchmark")}
                className="eng-btn primary rounded-none"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>LOAD BENCHMARK HAZARDS (FLYBACK &amp; PIN CURRENT)</span>
              </button>
              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className="eng-btn rounded-none"
                >
                  RESET FILTERS
                </button>
              )}
            </div>
          </div>
        ) : (
          filteredDiagnostics.map((diag, idx) => {
            const cardKey = `${diag.ruleId}-${idx}`;
            const isExpanded = expandedCards[cardKey] ?? true;
            const isError = diag.severity === "error";
            const isWarning = diag.severity === "warning";
            const isHazard = isError || isWarning;
            const meta = RULE_ENHANCED_META[diag.ruleId];

            return (
              <div
                key={cardKey}
                className={`erc-card ${isHazard ? "has-hazard" : ""}`}
                style={{
                  backgroundColor: "var(--bg-panel)",
                }}
              >
                {/* ------------------------------------------------------------- */}
                {/* CARD HEADER ROW                                               */}
                {/* ------------------------------------------------------------- */}
                <div
                  className="px-3.5 py-2.5 border-b flex flex-wrap items-center justify-between gap-2.5"
                  style={{
                    backgroundColor: isHazard ? "var(--bg-subpanel)" : "var(--bg-sunken)",
                    borderColor: "var(--border-app)",
                  }}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* COPPER-RED WARNING / HAZARD TAG */}
                    {isHazard ? (
                      <span className="erc-warning-tag">
                        <AlertTriangle className="w-3 h-3 text-[#B5432A]" />
                        <span>
                          {diag.severity.toUpperCase()}: {diag.ruleId}
                        </span>
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                        style={{
                          borderColor: "var(--border-strong)",
                          color: "var(--text-main)",
                          backgroundColor: "var(--bg-panel)",
                        }}
                      >
                        <Info className="w-3 h-3" />
                        <span>NOTICE: {diag.ruleId}</span>
                      </span>
                    )}

                    {/* Target Component / Port Badge */}
                    {diag.target && (
                      <span
                        className="text-[10px] px-2 py-0.5 border rounded-none tracking-wider uppercase font-semibold"
                        style={{
                          borderColor: "var(--border-app)",
                          backgroundColor: "var(--bg-panel)",
                          color: "var(--text-main)",
                        }}
                      >
                        TARGET:{" "}
                        <strong className="underline decoration-dotted">{diag.target.id}</strong>{" "}
                        <span style={{ color: "var(--text-muted)" }}>({diag.target.type})</span>
                      </span>
                    )}

                    {/* Standard Tag */}
                    {meta?.standardRef && (
                      <span
                        className="text-[9px] px-1.5 py-0.2 border rounded-none uppercase hidden sm:inline-block"
                        style={{
                          borderColor: "var(--border-app)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {meta.standardRef.split(":")[0]}
                      </span>
                    )}
                  </div>

                  {/* Header Action Buttons */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveRuleModal(diag.ruleId)}
                      className="px-2 py-0.5 text-[10px] border rounded-none flex items-center gap-1 hover:opacity-80 transition"
                      style={{
                        borderColor: "var(--border-app)",
                        backgroundColor: "var(--bg-panel)",
                        color: "var(--text-main)",
                      }}
                      title="Inspect Complete Electrical Specification, Limits & Physics"
                    >
                      <BookOpen className="w-3 h-3" />
                      <span className="hidden sm:inline">SPEC INSPECTOR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleExpand(cardKey)}
                      className="p-1 border rounded-none hover:opacity-80 transition"
                      style={{
                        borderColor: "var(--border-app)",
                        backgroundColor: "var(--bg-panel)",
                        color: "var(--text-muted)",
                      }}
                      title={isExpanded ? "Collapse Card" : "Expand Card"}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* CARD BODY (EXPANDED)                                          */}
                {/* ------------------------------------------------------------- */}
                {isExpanded && (
                  <div className="p-3.5 space-y-3 text-xs leading-relaxed">
                    {/* Primary Violation Message */}
                    <div>
                      <h4
                        className="text-xs font-bold uppercase tracking-tight flex items-start gap-2"
                        style={{ color: "var(--text-main)" }}
                      >
                        <span className="shrink-0 font-bold" style={{ color: "#B5432A" }}>
                          [VIOLATION]
                        </span>
                        <span>{diag.message}</span>
                      </h4>
                    </div>

                    {/* Physics & Rating Explanation */}
                    {diag.explanation && (
                      <div
                        className="p-2.5 border rounded-none text-[11px]"
                        style={{
                          backgroundColor: "var(--bg-sunken)",
                          borderColor: "var(--border-app)",
                          color: "var(--text-main)",
                        }}
                      >
                        <div
                          className="font-bold text-[9px] uppercase tracking-wider mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          PHYSICS &amp; ELECTRICAL RATING ANALYSIS:
                        </div>
                        <p className="leading-relaxed">{diag.explanation}</p>
                      </div>
                    )}

                    {/* Governing Formula Block */}
                    {(meta?.formula ||
                      diag.ruleId.includes("inductive") ||
                      diag.ruleId.includes("pin-current")) && (
                      <div className="erc-formula-box text-[11px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span
                            className="text-[9px] font-bold uppercase tracking-wider"
                            style={{ color: "var(--text-muted)" }}
                          >
                            GOVERNING FORMULA / LAW:
                          </span>
                          <span
                            className="text-[8px] px-1 py-0.2 border rounded-none uppercase"
                            style={{
                              borderColor: "var(--border-app)",
                              color: "var(--text-muted)",
                            }}
                          >
                            {meta?.formulaLabel || "PHYSICAL SPECIFICATION"}
                          </span>
                        </div>
                        <div
                          className="font-mono font-bold py-1 px-2 border rounded-none tracking-wide text-xs"
                          style={{
                            borderColor: "var(--border-app)",
                            backgroundColor: "var(--code-bg)",
                            color: "var(--text-main)",
                          }}
                        >
                          {meta?.formula ||
                            (diag.ruleId.includes("inductive")
                              ? "V_spike = -L * (dI / dt)   [Peak Back-EMF: > 120V]"
                              : "I_pin = V_cc / R_load <= 40.0mA   (Absolute Maximum Limit)")}
                        </div>
                      </div>
                    )}

                    {/* MUTED GREEN (#3D6B4F) REMEDIATION BLOCK */}
                    {(diag.suggestion || meta?.remediationProtocol) && (
                      <div className="erc-remediation-block">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="erc-remediation-title flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>REMEDIATION PROTOCOL:</span>
                          </span>
                          <span
                            className="text-[8px] font-bold uppercase px-1.5 py-0.2 border rounded-none"
                            style={{
                              borderColor: "#3D6B4F",
                              color: "#3D6B4F",
                            }}
                          >
                            HARDWARE WORKAROUND
                          </span>
                        </div>

                        <p
                          className="text-[11px] leading-relaxed font-medium"
                          style={{ color: "var(--text-main)" }}
                        >
                          {diag.suggestion || meta?.remediationProtocol}
                        </p>

                        {/* Engineering Action Checklist */}
                        {meta?.checklist && meta.checklist.length > 0 && (
                          <div
                            className="mt-2.5 pt-2 border-t space-y-1 text-[10px]"
                            style={{ borderColor: "rgba(61, 107, 79, 0.3)" }}
                          >
                            <span
                              className="font-bold uppercase tracking-wider block text-[9px]"
                              style={{ color: "#3D6B4F" }}
                            >
                              ENGINEERING ACTION CHECKLIST:
                            </span>
                            {meta.checklist.map((item, itemIdx) => (
                              <div
                                key={itemIdx}
                                className="flex items-start gap-2"
                                style={{ color: "var(--text-main)" }}
                              >
                                <span
                                  className="font-bold shrink-0 mt-0.5"
                                  style={{ color: "#3D6B4F" }}
                                >
                                  [✓]
                                </span>
                                <span>{item}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ===================================================================== */}
      {/* RULE SPECIFICATION MODAL (DOC §9.1 ELECTRICAL CATALOG)                */}
      {/* ===================================================================== */}
      {selectedRuleDef && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            className="border max-w-xl w-full p-5 space-y-4 rounded-none shadow-none font-mono"
            style={{
              backgroundColor: "var(--bg-panel)",
              borderColor: "var(--border-strong)",
              color: "var(--text-main)",
            }}
          >
            {/* Modal Header */}
            <div
              className="flex items-start justify-between border-b pb-2.5"
              style={{ borderColor: "var(--border-app)" }}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 border rounded-none uppercase"
                    style={{
                      borderColor: "var(--border-strong)",
                      color: "var(--text-main)",
                    }}
                  >
                    {selectedRuleDef.id}
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 border rounded-none uppercase font-bold"
                    style={{
                      borderColor: "#B5432A",
                      color: "#B5432A",
                    }}
                  >
                    {selectedRuleDef.defaultSeverity}
                  </span>
                </div>
                <h3 className="text-sm font-bold mt-1.5 uppercase tracking-wide">
                  {selectedRuleDef.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveRuleModal(null)}
                className="text-xs px-2 py-1 border rounded-none hover:opacity-70 transition font-bold"
                style={{
                  borderColor: "var(--border-app)",
                  color: "var(--text-muted)",
                }}
              >
                ✕ CLOSE
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-3 text-xs leading-relaxed max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex gap-4 text-[10px]">
                <div>
                  <span style={{ color: "var(--text-muted)" }}>CATEGORY: </span>
                  <span className="font-bold uppercase">{selectedRuleDef.category}</span>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>SPECIFICATION: </span>
                  <span className="font-bold">DOC §9.1 ELECTRICAL CATALOG</span>
                </div>
              </div>

              <div>
                <span
                  className="text-[10px] font-bold uppercase block mb-1"
                  style={{ color: "var(--text-muted)" }}
                >
                  SPECIFICATION &amp; CHECK OBJECTIVE:
                </span>
                <p
                  className="p-2.5 border rounded-none text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-app)",
                  }}
                >
                  {selectedRuleDef.description}
                </p>
              </div>

              {selectedRuleMeta?.physicsDetail && (
                <div>
                  <span
                    className="text-[10px] font-bold uppercase block mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    PHYSICAL RATIONALE:
                  </span>
                  <p
                    className="p-2.5 border rounded-none text-[11px] leading-relaxed"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                    }}
                  >
                    {selectedRuleMeta.physicsDetail}
                  </p>
                </div>
              )}

              {selectedRuleMeta?.formula && (
                <div>
                  <span
                    className="text-[10px] font-bold uppercase block mb-1"
                    style={{ color: "var(--text-muted)" }}
                  >
                    MATHEMATICAL LAW / FORMULA:
                  </span>
                  <div
                    className="p-2 border rounded-none font-mono text-[11px] font-bold"
                    style={{
                      backgroundColor: "var(--code-bg)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    {selectedRuleMeta.formula}
                  </div>
                </div>
              )}

              {(selectedRuleMeta?.remediationProtocol || selectedRuleDef.remediation) && (
                <div className="erc-remediation-block">
                  <span className="erc-remediation-title block mb-1">
                    ENGINEERING REMEDIATION PROTOCOL:
                  </span>
                  <p className="text-[11px] leading-relaxed">
                    {selectedRuleMeta?.remediationProtocol || selectedRuleDef.remediation}
                  </p>
                </div>
              )}
            </div>

            <div
              className="pt-2 flex justify-end border-t"
              style={{ borderColor: "var(--border-app)" }}
            >
              <button
                type="button"
                onClick={() => setActiveRuleModal(null)}
                className="eng-btn primary rounded-none"
              >
                DISMISS INSPECTOR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
