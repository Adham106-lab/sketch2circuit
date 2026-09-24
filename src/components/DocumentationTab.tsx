/**
 * @license Apache-2.0
 * Documentation & Project Reference Tab (Milestone 8).
 * Features: Ecosystem Comparison Matrix, Demo Video Script, and Known Technical Limitations.
 */

import { AlertCircle, BookOpen, Layers, Tv } from "lucide-react";
import { useState } from "react";

export function DocumentationTab() {
  const [subSection, setSubSection] = useState<"comparison" | "video" | "limitations">(
    "comparison",
  );

  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-100">
      {/* Top sub-nav */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-indigo-400" />
          <h2 className="font-semibold text-slate-100 text-base">
            Technical Documentation & Specifications (M8)
          </h2>
        </div>

        <div className="flex gap-1.5 rounded-lg border border-slate-800 bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setSubSection("comparison")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
              subSection === "comparison"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Ecosystem Comparison
          </button>

          <button
            type="button"
            onClick={() => setSubSection("video")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
              subSection === "video"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <Tv className="h-3.5 w-3.5" />
            Demo Walkthrough Script
          </button>

          <button
            type="button"
            onClick={() => setSubSection("limitations")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-medium text-xs transition-colors ${
              subSection === "limitations"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            }`}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Known Limitations
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* SUBSECTION: ECOSYSTEM COMPARISON */}
        {subSection === "comparison" && (
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg">
              <h3 className="font-semibold text-slate-100 text-base">
                Toolchain Comparison Matrix (Doc §16)
              </h3>
              <p className="mt-1 text-slate-400 text-xs">
                How sketch2circuit compares against existing electronics-as-code and EDA platforms.
              </p>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-300">
                      <th className="p-3 font-semibold">Capability</th>
                      <th className="p-3 font-semibold text-indigo-400">sketch2circuit (s2c)</th>
                      <th className="p-3 font-semibold">tscircuit</th>
                      <th className="p-3 font-semibold">atopile</th>
                      <th className="p-3 font-semibold">Fritzing</th>
                      <th className="p-3 font-semibold">KiCad</th>
                      <th className="p-3 font-semibold">Wokwi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="p-3 font-medium text-slate-200">Input Source</td>
                      <td className="p-3 font-semibold text-indigo-300">
                        Arduino C++ (.ino) or TSX
                      </td>
                      <td className="p-3">TypeScript / React</td>
                      <td className="p-3">Python-like (.ato)</td>
                      <td className="p-3">Drag & Drop GUI</td>
                      <td className="p-3">Schematic Capture</td>
                      <td className="p-3">diagram.json</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-200">Inference from Code</td>
                      <td className="p-3 font-semibold text-emerald-400">Yes (Tree-sitter AST)</td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3 text-rose-400">No</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-200">Electrical Rules Check</td>
                      <td className="p-3 font-semibold text-indigo-300">18+ Quantitative Rules</td>
                      <td className="p-3">Basic DRC</td>
                      <td className="p-3">Type Constraints</td>
                      <td className="p-3 text-rose-400">None</td>
                      <td className="p-3">Pin Types Only</td>
                      <td className="p-3 text-rose-400">None</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-200">Schematic Generation</td>
                      <td className="p-3 font-semibold text-indigo-300">
                        Deterministic SVG (Net-label)
                      </td>
                      <td className="p-3">Vector / Canvas</td>
                      <td className="p-3">KiCad Export</td>
                      <td className="p-3">Schematic View</td>
                      <td className="p-3">Native Vector</td>
                      <td className="p-3">2D Breadboard</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-200">KiCad Netlist Export</td>
                      <td className="p-3 font-semibold text-emerald-400">Yes (Version "E")</td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3 text-emerald-400">Yes</td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3 text-emerald-400">Native</td>
                      <td className="p-3 text-rose-400">No</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-200">Breadboard Guide</td>
                      <td className="p-3 font-semibold text-emerald-400">
                        Physical Pin Allocation Table
                      </td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3">Manual Drawing</td>
                      <td className="p-3 text-rose-400">No</td>
                      <td className="p-3">Visual Wire Graph</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-medium text-slate-200">License</td>
                      <td className="p-3 font-semibold text-indigo-300">Apache-2.0</td>
                      <td className="p-3">MIT</td>
                      <td className="p-3">Apache-2.0</td>
                      <td className="p-3 text-rose-400">Proprietary ($)</td>
                      <td className="p-3">GPLv3+</td>
                      <td className="p-3 text-rose-400">Proprietary</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION: VIDEO WALKTHROUGH SCRIPT */}
        {subSection === "video" && (
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                <Tv className="h-5 w-5 text-indigo-400" />
                <div>
                  <h3 className="font-semibold text-slate-100 text-base">
                    Interactive Video Walkthrough Script (3m 15s)
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Demonstrating the full sketch-to-circuit synthesis, ERC, and export workflow.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-indigo-300 text-xs">
                      Scene 1: The Disconnect (0:00 – 0:30)
                    </h5>
                    <span className="font-mono text-slate-500 text-xs">Intro</span>
                  </div>
                  <p className="mt-1 text-slate-300 text-xs">
                    Split-screen contrast showing software firmware code on the left and a desk full
                    of unorganized breadboard jumpers on the right. Highlights the fundamental
                    problem: code contains hardware intent, but traditional tools require manual
                    redrawing.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-indigo-300 text-xs">
                      Scene 2: Synthesis Studio & Evidence (0:30 – 1:15)
                    </h5>
                    <span className="font-mono text-slate-500 text-xs">Inference Engine</span>
                  </div>
                  <p className="mt-1 text-slate-300 text-xs">
                    User loads the Distance Alarm sketch. Real-time Tree-sitter AST extraction
                    recognizes <code>pulseIn</code> on pin 8 and maps the HC-SR04 ultrasonic sensor
                    with 85% confidence, sizing the piezo buzzer current limiter on pin 6.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-indigo-300 text-xs">
                      Scene 3: Quantitative ERC Rules Engine (1:15 – 2:00)
                    </h5>
                    <span className="font-mono text-slate-500 text-xs">Physics Validation</span>
                  </div>
                  <p className="mt-1 text-slate-300 text-xs">
                    User removes an LED resistor. The ERC engine immediately displays a red
                    diagnostic showing calculated infinite current overdraw, explaining the 20 mA
                    pin limit and offering an E24 330 Ω standard replacement.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-indigo-300 text-xs">
                      Scene 4: Physical Ground Allocation & KiCad Export (2:00 – 2:40)
                    </h5>
                    <span className="font-mono text-slate-500 text-xs">Artifact Generation</span>
                  </div>
                  <p className="mt-1 text-slate-300 text-xs">
                    Demonstration of distinct physical header pin allocation (
                    <code>POWER.GND.1</code>, <code>POWER.GND.2</code>, <code>DIGITAL.GND</code>)
                    and one-click download of the KiCad Version "E" S-expression netlist.
                  </p>
                </div>

                <div className="rounded-lg border border-slate-800/80 bg-slate-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-indigo-300 text-xs">
                      Scene 5: CLI Toolchain & Developer Workflow (2:40 – 3:15)
                    </h5>
                    <span className="font-mono text-slate-500 text-xs">Summary</span>
                  </div>
                  <p className="mt-1 text-slate-300 text-xs">
                    Demonstration of the command-line interface running{" "}
                    <code>s2c compile blink.ino</code> and generating clean terminal wiring tables,
                    demonstrating reproducible pipelines and developer workflow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBSECTION: KNOWN LIMITATIONS */}
        {subSection === "limitations" && (
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 text-amber-400" />
                <div>
                  <h3 className="font-semibold text-amber-200 text-sm">
                    Open Gaps & Documented Limitations (M8)
                  </h3>
                  <p className="mt-1 text-slate-300 text-xs leading-relaxed">
                    In accordance with rigorous engineering standards, known technical constraints
                    and sandbox limitations are openly documented below.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-950/80 px-2 py-0.5 font-mono font-medium text-amber-400 text-xs">
                  GAP-01: OPEN
                </span>
                <h4 className="font-semibold text-slate-100 text-sm">
                  KiCad Netlist Exporter Golden-File Provenance
                </h4>
              </div>

              <div className="mt-3 rounded-lg border border-amber-900/30 bg-amber-950/30 p-3">
                <p className="font-mono text-amber-200 text-xs">
                  "Golden KiCad netlist fixture is hand-written per the S-expr spec, not exported
                  from real KiCad, due to no KiCad binary in this sandbox. Needs a real export to
                  fully close."
                </p>
              </div>

              <p className="mt-3 text-slate-300 text-xs leading-relaxed">
                The AST parser and validator (<code className="text-indigo-300">parseSExpr</code>)
                strictly validates balanced parenthesis hierarchies, string escapes, and Version "E"
                schema compliance. The test suite passes 100% against this specification model and
                will be updated with an authentic machine export once provided.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg">
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-950/80 px-2 py-0.5 font-mono font-medium text-indigo-400 text-xs">
                  DOC §15 POINT 7
                </span>
                <h4 className="font-semibold text-slate-100 text-sm">
                  Physical Hardware Bench Testing Requirement
                </h4>
              </div>
              <p className="mt-3 text-slate-300 text-xs leading-relaxed">
                Physical hardware assembly and electrical instrumentation (using breadboards,
                multimeters, and oscilloscopes) is an empirical task that must be carried out by a
                human engineer on physical hardware. It cannot be executed or measured inside a
                headless software sandbox.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 shadow-lg">
              <h4 className="font-semibold text-slate-100 text-sm">
                Synthesis Scope & Boundary Conditions
              </h4>
              <ul className="mt-3 space-y-2 text-slate-300 text-xs">
                <li className="flex items-start gap-2">
                  <span className="font-mono text-indigo-400">•</span>
                  <span>
                    <strong>Static Resolution Only</strong>: Pin indices must be resolvable at
                    compile time. Runtime-computed pin numbers (e.g. from sensor values or dynamic
                    array indexing) are reported as{" "}
                    <code className="text-amber-300">UnresolvedItem</code> rather than guessed.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-indigo-400">•</span>
                  <span>
                    <strong>Analog Front-End Design</strong>: Multi-stage active op-amp filters and
                    RF circuits cannot be inferred from digital microcontroller code and are out of
                    scope for v1.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-indigo-400">•</span>
                  <span>
                    <strong>Target Microcontroller</strong>: Version 1.0 focuses on the 5V
                    ATmega328P (Arduino Uno R3). 3.3V microcontrollers (ESP32, RP2040) are queued
                    for post-v1.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
