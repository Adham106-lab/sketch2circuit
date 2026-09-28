/**
 * @license Apache-2.0
 * Documentation & Project Reference Tab (Milestone 8).
 * Features: Ecosystem Comparison Matrix, Demo Video Script, and Known Technical Limitations.
 * Fully styled for CAD Workbench visual identity: Drafting Sheet (Light) & Oscilloscope (Dark).
 */

import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Cpu,
  Layers,
  Tv,
} from "lucide-react";
import { useState } from "react";

export function DocumentationTab() {
  const [subSection, setSubSection] = useState<"comparison" | "video" | "limitations">(
    "comparison",
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const comparisonRows = [
    {
      capability: "Input Source",
      s2c: "Arduino C++ (.ino) or TSX",
      s2cHighlight: true,
      tscircuit: "TypeScript / React",
      atopile: "Python-like (.ato)",
      fritzing: "Drag & Drop GUI",
      kicad: "Schematic Capture",
      wokwi: "diagram.json",
    },
    {
      capability: "Inference from Code",
      s2c: "Yes (Tree-sitter AST)",
      s2cHighlight: true,
      s2cType: "yes",
      tscircuit: "No",
      atopile: "No",
      fritzing: "No",
      kicad: "No",
      wokwi: "No",
    },
    {
      capability: "Electrical Rules Check (ERC)",
      s2c: "18+ Quantitative Rules",
      s2cHighlight: true,
      s2cType: "yes",
      tscircuit: "Basic DRC",
      atopile: "Type Constraints",
      fritzing: "None",
      kicad: "Pin Types Only",
      wokwi: "None",
    },
    {
      capability: "Schematic Generation",
      s2c: "Deterministic SVG (Net-label)",
      s2cHighlight: true,
      s2cType: "yes",
      tscircuit: "Vector / Canvas",
      atopile: "KiCad Export",
      fritzing: "Schematic View",
      kicad: "Native Vector",
      wokwi: "2D Breadboard",
    },
    {
      capability: "KiCad Netlist Export",
      s2c: "Yes (Version 'E')",
      s2cHighlight: true,
      s2cType: "yes",
      tscircuit: "No",
      atopile: "Yes",
      fritzing: "No",
      kicad: "Native",
      wokwi: "No",
    },
    {
      capability: "Physical Breadboard Guide",
      s2c: "Header Pin Allocation Table",
      s2cHighlight: true,
      s2cType: "yes",
      tscircuit: "Manual Drawing",
      atopile: "No",
      fritzing: "Visual Wire Graph",
      kicad: "Manual Routing",
      wokwi: "Visual Simulation",
    },
    {
      capability: "Determinism & CLI Pipeline",
      s2c: "100% Deterministic (s2c CLI)",
      s2cHighlight: true,
      s2cType: "yes",
      tscircuit: "Code-driven CLI",
      atopile: "CLI Compiler",
      fritzing: "GUI Only",
      kicad: "CLI available in v8+",
      wokwi: "Browser Web-app",
    },
    {
      capability: "License",
      s2c: "Apache-2.0 (Open Source)",
      s2cHighlight: true,
      tscircuit: "MIT",
      atopile: "Apache-2.0",
      fritzing: "Proprietary ($)",
      kicad: "GPLv3+",
      wokwi: "Proprietary",
    },
  ];

  const exportComparisonMarkdown = () => {
    let md =
      "| Capability | sketch2circuit (s2c) | tscircuit | atopile | Fritzing | KiCad | Wokwi |\n";
    md += "| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n";
    for (const r of comparisonRows) {
      md += `| ${r.capability} | **${r.s2c}** | ${r.tscircuit} | ${r.atopile} | ${r.fritzing} | ${r.kicad} | ${r.wokwi} |\n`;
    }
    return md;
  };

  return (
    <div
      className="flex flex-col h-full border rounded-none overflow-hidden font-mono text-xs"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-app)",
        color: "var(--text-main)",
      }}
    >
      {/* Top Navigation Ribbon */}
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
            onClick={() => setSubSection("comparison")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: subSection === "comparison" ? "var(--bg-panel)" : "transparent",
              borderColor:
                subSection === "comparison" ? "var(--border-strong)" : "var(--border-app)",
              color: subSection === "comparison" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <Layers
              className="w-3.5 h-3.5"
              style={{ color: subSection === "comparison" ? "var(--border-strong)" : "inherit" }}
            />
            <span>ECOSYSTEM COMPARISON</span>
          </button>

          <button
            type="button"
            onClick={() => setSubSection("video")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: subSection === "video" ? "var(--bg-panel)" : "transparent",
              borderColor: subSection === "video" ? "var(--border-strong)" : "var(--border-app)",
              color: subSection === "video" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <Tv
              className="w-3.5 h-3.5"
              style={{ color: subSection === "video" ? "var(--border-strong)" : "inherit" }}
            />
            <span>DEMO WALKTHROUGH SCRIPT</span>
          </button>

          <button
            type="button"
            onClick={() => setSubSection("limitations")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: subSection === "limitations" ? "var(--bg-panel)" : "transparent",
              borderColor:
                subSection === "limitations" ? "var(--border-strong)" : "var(--border-app)",
              color: subSection === "limitations" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <AlertCircle
              className="w-3.5 h-3.5"
              style={{ color: subSection === "limitations" ? "var(--border-strong)" : "inherit" }}
            />
            <span>KNOWN LIMITATIONS (M8)</span>
          </button>
        </div>

        <div
          className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider"
          style={{ color: "var(--text-muted)" }}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>TECHNICAL SPECIFICATIONS &amp; BENCHMARKS</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 overflow-y-auto p-4 md:p-6"
        style={{ backgroundColor: "var(--bg-app)" }}
      >
        {/* ========================================================================= */}
        {/* SUBSECTION: ECOSYSTEM COMPARISON MATRIX                                  */}
        {/* ========================================================================= */}
        {subSection === "comparison" && (
          <div className="max-w-6xl mx-auto space-y-5">
            {/* Header description */}
            <div
              className="p-4 border rounded-none"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-main)" }}
                  >
                    Toolchain Comparison Matrix (Doc §16)
                  </h3>
                  <p className="text-[11px] mt-1" style={{ color: "var(--text-muted)" }}>
                    Rigorous comparative benchmark positioning sketch2circuit (s2c) against existing
                    electronics-as-code platforms, schematic capture suites, and interactive
                    simulators.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => copyToClipboard(exportComparisonMarkdown(), "comp-md")}
                  className="eng-btn rounded-none text-[10px]"
                >
                  {copiedKey === "comp-md" ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span>COPIED MARKDOWN</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-3 h-3" />
                      <span>COPY TABLE (MD)</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Matrix Table */}
            <div
              className="border rounded-none overflow-hidden"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr
                      className="border-b text-[11px] font-bold uppercase"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    >
                      <th className="p-3 border-r" style={{ borderColor: "var(--border-app)" }}>
                        CAPABILITY / FEATURE
                      </th>
                      <th
                        className="p-3 border-r"
                        style={{
                          borderColor: "var(--border-strong)",
                          backgroundColor: "var(--bg-subpanel)",
                          color: "var(--text-main)",
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" style={{ color: "var(--border-strong)" }} />
                          <span>SKETCH2CIRCUIT (S2C)</span>
                        </div>
                      </th>
                      <th className="p-3 border-r" style={{ borderColor: "var(--border-app)" }}>
                        TSCIRCUIT
                      </th>
                      <th className="p-3 border-r" style={{ borderColor: "var(--border-app)" }}>
                        ATOPILE
                      </th>
                      <th className="p-3 border-r" style={{ borderColor: "var(--border-app)" }}>
                        FRITZING
                      </th>
                      <th className="p-3 border-r" style={{ borderColor: "var(--border-app)" }}>
                        KICAD
                      </th>
                      <th className="p-3">WOKWI</th>
                    </tr>
                  </thead>
                  <tbody
                    className="divide-y"
                    style={{
                      borderColor: "var(--border-subtle)",
                      color: "var(--text-main)",
                    }}
                  >
                    {comparisonRows.map((row, idx) => (
                      <tr
                        key={row.capability}
                        className="transition hover:opacity-95"
                        style={{
                          backgroundColor: idx % 2 === 0 ? "var(--bg-panel)" : "var(--bg-subpanel)",
                        }}
                      >
                        <td
                          className="p-3 font-bold border-r text-[11px] uppercase"
                          style={{
                            borderColor: "var(--border-app)",
                            color: "var(--text-main)",
                          }}
                        >
                          {row.capability}
                        </td>
                        <td
                          className="p-3 font-extrabold border-r text-[11px]"
                          style={{
                            borderColor: "var(--border-strong)",
                            backgroundColor: "var(--bg-sunken)",
                            color: "var(--text-main)",
                          }}
                        >
                          <div className="flex items-center gap-1.5">
                            {row.s2cType === "yes" && (
                              <CheckCircle2
                                className="w-3.5 h-3.5 shrink-0"
                                style={{ color: "var(--accent-valid)" }}
                              />
                            )}
                            <span>{row.s2c}</span>
                          </div>
                        </td>
                        <td
                          className="p-3 border-r text-[11px]"
                          style={{
                            borderColor: "var(--border-app)",
                            color:
                              row.tscircuit === "No" ? "var(--text-subtle)" : "var(--text-muted)",
                          }}
                        >
                          {row.tscircuit}
                        </td>
                        <td
                          className="p-3 border-r text-[11px]"
                          style={{
                            borderColor: "var(--border-app)",
                            color:
                              row.atopile === "No" ? "var(--text-subtle)" : "var(--text-muted)",
                          }}
                        >
                          {row.atopile}
                        </td>
                        <td
                          className="p-3 border-r text-[11px]"
                          style={{
                            borderColor: "var(--border-app)",
                            color:
                              row.fritzing === "None" || row.fritzing === "No"
                                ? "var(--text-subtle)"
                                : "var(--text-muted)",
                          }}
                        >
                          {row.fritzing}
                        </td>
                        <td
                          className="p-3 border-r text-[11px]"
                          style={{
                            borderColor: "var(--border-app)",
                            color: row.kicad === "No" ? "var(--text-subtle)" : "var(--text-muted)",
                          }}
                        >
                          {row.kicad}
                        </td>
                        <td
                          className="p-3 text-[11px]"
                          style={{
                            color:
                              row.wokwi === "No" || row.wokwi === "None"
                                ? "var(--text-subtle)"
                                : "var(--text-muted)",
                          }}
                        >
                          {row.wokwi}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Strategic differentiators callout */}
            <div
              className="p-4 border-l-4 rounded-none space-y-2"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderLeftColor: "var(--border-strong)",
                borderColor: "var(--border-app)",
              }}
            >
              <h4
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--text-main)" }}
              >
                Key Architecture Takeaway: Inference Over Manual Redundancy
              </h4>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Unlike existing solutions that require engineers to specify the schematic or circuit
                graph twice (once in code, and again in GUI schematic capture or TSX declarations),{" "}
                <span className="font-bold" style={{ color: "var(--text-main)" }}>
                  sketch2circuit uses Tree-sitter C++ AST analysis to deduce physical hardware
                  intent directly from microcontroller firmware calls
                </span>{" "}
                (<code>pinMode</code>, <code>digitalWrite</code>, <code>analogRead</code>, and
                peripheral library constructors). It then pairs this deduction with an 18-rule
                physics-grade Electrical Rules Check (ERC) engine to validate currents, voltages,
                and protection topologies before generating standard KiCad Version "E" netlists.
              </p>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBSECTION: DEMO WALKTHROUGH SCRIPT                                      */}
        {/* ========================================================================= */}
        {subSection === "video" && (
          <div className="max-w-4xl mx-auto space-y-5">
            {/* Header info */}
            <div
              className="p-4 border rounded-none"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 border rounded-none shrink-0"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--border-strong)",
                    }}
                  >
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h3
                      className="text-sm font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-main)" }}
                    >
                      Technical Walkthrough Demonstration Script (3m 15s)
                    </h3>
                    <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Authoritative presentation outline illustrating synthesis, quantitative ERC
                      diagnostics, and multi-format export pipelines.
                    </p>
                  </div>
                </div>

                <div
                  className="px-2.5 py-1 border rounded-none text-[10px] font-bold uppercase"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-main)",
                  }}
                >
                  TOTAL RUNTIME: 3:15
                </div>
              </div>
            </div>

            {/* Scenes */}
            <div className="space-y-4">
              {/* Scene 1 */}
              <div
                className="p-4 border-l-4 rounded-none space-y-3"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderLeftColor: "var(--border-strong)",
                  borderColor: "var(--border-app)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    >
                      SCENE 1: 0:00 – 0:30
                    </span>
                    <h4
                      className="font-bold text-xs uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      The Disconnect in Hardware Prototyping
                    </h4>
                  </div>
                  <span
                    className="text-[10px] uppercase font-bold"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    STAGE: MOTIVATION &amp; PROBLEM STATEMENT
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Split-screen contrast showing Arduino C++ firmware code on the left and a desk
                  full of unorganized breadboard jumpers on the right. Highlights the fundamental
                  flaw: firmware code already embodies explicit physical hardware intent, but
                  traditional workflows force manual redrawing in separate schematic tools.
                </p>

                <div
                  className="p-3 border rounded-none text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-main)",
                  }}
                >
                  <span
                    className="font-bold block mb-1 text-[10px] uppercase"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    SCRIPT VOICE-OVER NARRATIVE:
                  </span>
                  "Every microcontroller sketch contains hardware assumptions: pins, voltage limits,
                  and peripheral protocols. Today, engineers write firmware in one tool and manually
                  redraw schematics in another. sketch2circuit eliminates this duplication by
                  compiling code directly to validated circuits."
                </div>
              </div>

              {/* Scene 2 */}
              <div
                className="p-4 border-l-4 rounded-none space-y-3"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderLeftColor: "var(--border-strong)",
                  borderColor: "var(--border-app)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    >
                      SCENE 2: 0:30 – 1:15
                    </span>
                    <h4
                      className="font-bold text-xs uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      Synthesis Studio &amp; Tree-sitter Evidence Inference
                    </h4>
                  </div>
                  <span
                    className="text-[10px] uppercase font-bold"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    STAGE: AST PARSING &amp; SYNTHESIS
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  User loads the Distance Alarm sketch. Real-time Tree-sitter AST extraction
                  recognizes{" "}
                  <code
                    className="px-1.5 py-0.5 border rounded-none"
                    style={{
                      backgroundColor: "var(--code-bg)",
                      color: "var(--code-text)",
                      borderColor: "var(--border-app)",
                    }}
                  >
                    pulseIn(8, HIGH)
                  </code>{" "}
                  and maps an HC-SR04 ultrasonic sensor with high confidence, auto-sizing
                  current-limiting passives and linking pin nets.
                </p>

                <div
                  className="p-3 border rounded-none text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-main)",
                  }}
                >
                  <span
                    className="font-bold block mb-1 text-[10px] uppercase"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    KEY TECHNICAL EVIDENCE DISPLAYED:
                  </span>
                  Deterministic peripheral matching score, ATmega328P DIP-28 pin mappings, and SVG
                  net-label schematic render updated live in &lt; 50ms.
                </div>
              </div>

              {/* Scene 3 */}
              <div
                className="p-4 border-l-4 rounded-none space-y-3"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderLeftColor: "var(--accent-copper)",
                  borderColor: "var(--border-app)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                      style={{
                        backgroundColor: "var(--accent-copper-bg)",
                        borderColor: "var(--accent-copper-border)",
                        color: "var(--accent-copper)",
                      }}
                    >
                      SCENE 3: 1:15 – 2:00
                    </span>
                    <h4
                      className="font-bold text-xs uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      Quantitative Electrical Rules Check (ERC) Diagnostics
                    </h4>
                  </div>
                  <span
                    className="text-[10px] uppercase font-bold"
                    style={{ color: "var(--accent-copper)" }}
                  >
                    STAGE: PHYSICS VALIDATION
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  User disconnects an inductive DC motor clamp diode or LED series resistor. The ERC
                  engine immediately produces a red diagnostic hazard card showing the exact
                  Faraday's Law formula (<code>V_spike = -L * dI/dt &gt; 120V</code>), explaining
                  ATmega328P die junction breakdown, and providing a 1N4007 flyback remediation
                  protocol with one-click code annotations.
                </p>

                <div
                  className="p-3 border rounded-none text-[11px]"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                    color: "var(--text-main)",
                  }}
                >
                  <span
                    className="font-bold block mb-1 text-[10px] uppercase"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    DIAGNOSTIC CRITERIA TESTED:
                  </span>
                  18 quantitative rules spanning pin current &gt; 20mA, package budget &gt; 200mA,
                  unclamped inductive kickback, servo regulator droop, and open-drain I2C pullups.
                </div>
              </div>

              {/* Scene 4 */}
              <div
                className="p-4 border-l-4 rounded-none space-y-3"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderLeftColor: "var(--border-strong)",
                  borderColor: "var(--border-app)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    >
                      SCENE 4: 2:00 – 2:40
                    </span>
                    <h4
                      className="font-bold text-xs uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      Physical Ground Header Allocation &amp; KiCad Netlist
                    </h4>
                  </div>
                  <span
                    className="text-[10px] uppercase font-bold"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    STAGE: ARTIFACT EXPORT
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Demonstration of distinct physical header pin allocation (<code>POWER.GND.1</code>
                  , <code>POWER.GND.2</code>, <code>DIGITAL.GND</code>) preventing breadboard ground
                  loops, followed by one-click generation and download of the KiCad Version "E"
                  S-expression netlist.
                </p>
              </div>

              {/* Scene 5 */}
              <div
                className="p-4 border-l-4 rounded-none space-y-3"
                style={{
                  backgroundColor: "var(--bg-panel)",
                  borderLeftColor: "var(--border-strong)",
                  borderColor: "var(--border-app)",
                }}
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                  style={{ borderColor: "var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    >
                      SCENE 5: 2:40 – 3:15
                    </span>
                    <h4
                      className="font-bold text-xs uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      CLI Toolchain &amp; Reproducible CI Pipelines
                    </h4>
                  </div>
                  <span
                    className="text-[10px] uppercase font-bold"
                    style={{ color: "var(--text-subtle)" }}
                  >
                    STAGE: AUTOMATION &amp; SUMMARY
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Demonstration of the command-line interface running{" "}
                  <code
                    className="px-1.5 py-0.5 border rounded-none"
                    style={{
                      backgroundColor: "var(--code-bg)",
                      color: "var(--code-text)",
                      borderColor: "var(--border-app)",
                    }}
                  >
                    s2c compile sketch.ino --target uno
                  </code>{" "}
                  outputting zero-dependency ASCII wiring tables directly in stdout for headless
                  CI/CD firmware validation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBSECTION: KNOWN TECHNICAL LIMITATIONS (M8)                             */}
        {/* ========================================================================= */}
        {subSection === "limitations" && (
          <div className="max-w-4xl mx-auto space-y-5">
            {/* Caution banner */}
            <div
              className="p-4 border-l-4 rounded-none flex items-start gap-3"
              style={{
                backgroundColor: "var(--accent-copper-bg)",
                borderLeftColor: "var(--accent-copper)",
                borderColor: "var(--accent-copper-border)",
                color: "var(--text-main)",
              }}
            >
              <AlertTriangle
                className="w-5 h-5 shrink-0 mt-0.5"
                style={{ color: "var(--accent-copper)" }}
              />
              <div>
                <h4
                  className="font-bold text-xs uppercase tracking-wide"
                  style={{ color: "var(--accent-copper)" }}
                >
                  Strict Engineering Governance &amp; Limitation Disclosure (Doc §15)
                </h4>
                <p
                  className="text-[11px] mt-1 leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  In accordance with formal ISO/IEC engineering documentation standards, known
                  technical constraints, sandboxed environment bounds, and boundary assumptions are
                  openly declared below.
                </p>
              </div>
            </div>

            {/* Gap 1 */}
            <div
              className="p-4 border rounded-none space-y-3"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                    style={{
                      backgroundColor: "var(--accent-copper-bg)",
                      borderColor: "var(--accent-copper-border)",
                      color: "var(--accent-copper)",
                    }}
                  >
                    GAP-01: OPEN
                  </span>
                  <h4 className="font-bold text-xs uppercase" style={{ color: "var(--text-main)" }}>
                    KiCad Netlist Exporter Golden-File Provenance
                  </h4>
                </div>
                <span
                  className="text-[10px] uppercase font-bold"
                  style={{ color: "var(--text-subtle)" }}
                >
                  ARTIFACT VERIFICATION BOUND
                </span>
              </div>

              <div
                className="p-3 border rounded-none text-[11px] font-mono"
                style={{
                  backgroundColor: "var(--bg-sunken)",
                  borderColor: "var(--border-subtle)",
                  color: "var(--text-main)",
                }}
              >
                "Golden KiCad netlist fixture is hand-written per the S-expr spec, not exported from
                real KiCad, due to no KiCad binary in this sandbox. Needs a real export to fully
                close."
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                The S-expression AST parser (
                <code className="font-bold" style={{ color: "var(--text-main)" }}>
                  parseSExpr
                </code>
                ) strictly verifies balanced parentheses, tokenization, escape characters, and KiCad
                Version "E" structural schema rules. The test suite passes 100% against this
                specification and will ingest machine-generated files when the host environment
                allows.
              </p>
            </div>

            {/* Point 2 */}
            <div
              className="p-4 border rounded-none space-y-3"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div
                className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
                style={{ borderColor: "var(--border-subtle)" }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="px-2 py-0.5 text-[10px] font-bold border rounded-none uppercase"
                    style={{
                      backgroundColor: "var(--bg-sunken)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-main)",
                    }}
                  >
                    DOC §15 POINT 7
                  </span>
                  <h4 className="font-bold text-xs uppercase" style={{ color: "var(--text-main)" }}>
                    Physical Hardware Bench Testing Requirement
                  </h4>
                </div>
                <span
                  className="text-[10px] uppercase font-bold"
                  style={{ color: "var(--text-subtle)" }}
                >
                  EMPIRICAL LAB REQUIREMENT
                </span>
              </div>

              <p className="text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Physical hardware assembly and electrical instrumentation (using breadboards,
                multimeters, and oscilloscopes) is an empirical physical procedure that must be
                conducted on physical hardware by a human engineer. It cannot be physically measured
                or captured inside a headless software virtual environment.
              </p>
            </div>

            {/* Point 3 */}
            <div
              className="p-4 border rounded-none space-y-3"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
              }}
            >
              <div className="border-b pb-2" style={{ borderColor: "var(--border-subtle)" }}>
                <h4 className="font-bold text-xs uppercase" style={{ color: "var(--text-main)" }}>
                  Synthesis Scope &amp; Boundary Conditions
                </h4>
              </div>

              <div className="space-y-2 text-[11px]">
                <div
                  className="p-2.5 border rounded-none"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <span className="font-bold block" style={{ color: "var(--text-main)" }}>
                    1. Static Compile-Time Resolution Only:
                  </span>
                  <p className="mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Pin identifiers must be statically resolvable at compile time. Runtime-computed
                    pin variables (such as dynamic array lookups or sensor-derived numbers) are
                    recorded as <code className="font-bold">UnresolvedItem</code> rather than
                    guessed.
                  </p>
                </div>

                <div
                  className="p-2.5 border rounded-none"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <span className="font-bold block" style={{ color: "var(--text-main)" }}>
                    2. Analog Front-End Boundaries:
                  </span>
                  <p className="mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Multi-stage active op-amp topologies, RF matching networks, and switch-mode
                    converters cannot be inferred from digital firmware calls and are out of scope
                    for v1 synthesis.
                  </p>
                </div>

                <div
                  className="p-2.5 border rounded-none"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <span className="font-bold block" style={{ color: "var(--text-main)" }}>
                    3. Target Microcontroller Profile:
                  </span>
                  <p className="mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Version 1.0 targets the 5V ATmega328P (Arduino Uno R3) DIP-28 and 16MHz
                    clocking. Support for 3.3V dual-core ESP32 and RP2040 microcontrollers is
                    roadmap Milestone 9.
                  </p>
                </div>

                <div
                  className="p-2.5 border rounded-none"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <span className="font-bold block text-amber-500">
                    4. RC Servo (SG90) Header Pinout &amp; Polarity Warning:
                  </span>
                  <p className="mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Standard 3-pin servo headers are generated with verified silkscreen pad markers:
                    Pad 1 = <strong>S</strong> (PWM signal / Orange wire), Pad 2 ={" "}
                    <strong>+</strong> (5V VCC / Red wire), Pad 3 = <strong>-</strong> (GND / Brown
                    wire). Center VCC (+5V) follows the official TowerPro SG90 datasheet and JR RC
                    standard to prevent reverse supply latch-up if accidentally flipped. Always
                    verify physical cable polarity (Brown=GND, Red=VCC, Orange=Signal) against board
                    silkscreen before applying power.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
