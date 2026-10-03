/**
 * @license Apache-2.0
 * @s2c/apps/playground — Milestone 18b Canvas & Wiring Unit Tests.
 */

import { compileBlockDiagram } from "@s2c/block-diagram";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlockDiagramTab } from "../../../src/components/BlockDiagramTab.js";

describe("Milestone 18b: Block Diagram Canvas UI & Compilation Integration", () => {
  it("renders the Block Diagram canvas, palette, and inspector with connected blocks", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(BlockDiagramTab, { theme: "dark" }),
    );

    // 1. Verify Header & Title
    expect(html).toContain("Block-Diagram Simulation Editor");
    expect(html).toContain("M18c ENGINE &amp; SCOPE");
    expect(html).toContain("Run Simulation");

    // 2. Verify Palette Categories
    expect(html).toContain("Block Palette");
    expect(html).toContain("Sources");
    expect(html).toContain("Math &amp; Algebraic");
    expect(html).toContain("Dynamics (State)");
    expect(html).toContain("Sinks");

    // 3. Verify at least 5 distinct block types exist in palette
    expect(html).toContain("Constant");
    expect(html).toContain("Step");
    expect(html).toContain("Gain");
    expect(html).toContain("Sum");
    expect(html).toContain("Integrator");
    expect(html).toContain("Transfer Function");
    expect(html).toContain("PID Controller");
    expect(html).toContain("Scope");

    // 4. Verify Inspector Panel
    expect(html).toContain("Block Inspector");

    // 5. Verify Canvas ReactFlow Container
    expect(html).toContain('id="block-diagram-canvas"');
    expect(html).toContain("react-flow");

    // Print raw DOM evidence for M18b acceptance
    console.log("=== M18b CANVAS RAW DOM EVIDENCE ===");
    console.log(html);
  });

  it("validates preset 1 (valid feedback loop) with 5 blocks and state dynamics", () => {
    const validDiagram = {
      blocks: [
        { id: "step", type: "Step", label: "StepInput", params: { stepTime: 0.1, initialValue: 0, finalValue: 1 } },
        { id: "sum", type: "Sum", label: "ErrorSum", params: { signs: "+-" } },
        { id: "integ", type: "Integrator", label: "Integrator", params: { initialCondition: 0 } },
        { id: "gain", type: "Gain", label: "FeedbackGain", params: { gain: 1.0 } },
        { id: "scope", type: "Scope", label: "Scope", params: { title: "Filtered Output" } },
      ],
      connections: [
        { id: "e1", fromBlockId: "step", fromPortId: "out", toBlockId: "sum", toPortId: "in1" },
        { id: "e2", fromBlockId: "sum", fromPortId: "out", toBlockId: "integ", toPortId: "in" },
        { id: "e3", fromBlockId: "integ", fromPortId: "out", toBlockId: "gain", toPortId: "in" },
        { id: "e4", fromBlockId: "gain", fromPortId: "out", toBlockId: "sum", toPortId: "in2" },
        { id: "e5", fromBlockId: "integ", fromPortId: "out", toBlockId: "scope", toPortId: "in" },
      ],
    };

    const compiled = compileBlockDiagram(validDiagram);
    expect(compiled.valid).toBe(true);
    expect(compiled.numStates).toBe(1);
    expect(compiled.diagnostics.length).toBe(0);
    expect(compiled.algebraicOrder).toBeDefined();
  });

  it("rejects preset 2 (pure algebraic loop) with specific diagnostic naming blocks and suggestion", () => {
    const loopDiagram = {
      blocks: [
        { id: "ref_src", type: "Constant", label: "RefInput", params: { value: 5.0 } },
        { id: "sum_alg", type: "Sum", label: "Sum1", params: { signs: "+-" } },
        { id: "gain_alg", type: "Gain", label: "Gain1", params: { gain: 10.0 } },
      ],
      connections: [
        { id: "e1", fromBlockId: "ref_src", fromPortId: "out", toBlockId: "sum_alg", toPortId: "in1" },
        { id: "e2", fromBlockId: "sum_alg", fromPortId: "out", toBlockId: "gain_alg", toPortId: "in" },
        { id: "e3", fromBlockId: "gain_alg", fromPortId: "out", toBlockId: "sum_alg", toPortId: "in2" },
      ],
    };

    const compiled = compileBlockDiagram(loopDiagram);
    expect(compiled.valid).toBe(false);

    const loopErr = compiled.diagnostics.find((d) => d.ruleId === "diagram.algebraic-loop");
    expect(loopErr).toBeDefined();
    expect(loopErr?.message).toContain("Algebraic loop detected: cycle of direct-feedthrough blocks found: [Sum1 -> Gain1 -> Sum1]");
    expect(loopErr?.suggestion).toContain("Insert an Integrator or Delay block in this loop: [Sum1 -> Gain1 -> Sum1]");
    expect(loopErr?.blocksInLoop).toEqual(["sum_alg", "gain_alg", "sum_alg"]);
  });

  it("simulates preset 4: PID closed-loop control around synthesized DC motor actuator (tau=80ms)", () => {
    // Model matching M17 DC Motor speed transient (tau = 80ms -> H(s) = 12.5 / (s + 12.5))
    const pidMotorDiagram = {
      blocks: [
        { id: "setpoint", type: "Step", label: "TargetRPM", params: { stepTime: 0.05, initialValue: 0.0, finalValue: 1000.0 } },
        { id: "sum_err", type: "Sum", label: "ErrorJunction", params: { signs: "+-" } },
        { id: "pid_ctrl", type: "PID", label: "SpeedPID", params: { Kp: 0.5, Ki: 20.0, Kd: 0.01, N: 50.0 } },
        { id: "motor_actuator", type: "TransferFunction", label: "DCMotorSpeed", params: { numerator: [12.5], denominator: [1.0, 12.5] } },
        { id: "scope_speed", type: "Scope", label: "SpeedScope", params: { title: "DC Motor Shaft Speed (RPM)" } },
      ],
      connections: [
        { id: "c1", fromBlockId: "setpoint", fromPortId: "out", toBlockId: "sum_err", toPortId: "in1" },
        { id: "c2", fromBlockId: "sum_err", fromPortId: "out", toBlockId: "pid_ctrl", toPortId: "in" },
        { id: "c3", fromBlockId: "pid_ctrl", fromPortId: "out", toBlockId: "motor_actuator", toPortId: "in" },
        { id: "c4", fromBlockId: "motor_actuator", fromPortId: "out", toBlockId: "sum_err", toPortId: "in2" },
        { id: "c5", fromBlockId: "motor_actuator", fromPortId: "out", toBlockId: "scope_speed", toPortId: "in" },
      ],
    };

    const compiled = compileBlockDiagram(pidMotorDiagram);
    expect(compiled.valid).toBe(true);
    expect(compiled.numStates).toBe(3); // 2 from PID, 1 from Plant

    // Run with RKF45 default solver
    const simResult = compiled.runSimulation({ t0: 0, tEnd: 1.0, relTol: 1e-5, absTol: 1e-7 }, "rkf45");
    expect(simResult.success).toBe(true);

    const pts = simResult.scopeSignals.scope_speed?.points ?? [];
    expect(pts.length).toBeGreaterThan(20);

    const peakVal = Math.max(...pts.map((p) => p.y));
    const finalVal = pts[pts.length - 1]?.y ?? 0.0;
    const overshootPct = ((peakVal - 1000.0) / 1000.0) * 100;

    // Verify stable closed-loop response settling near target reference 1000 RPM
    expect(peakVal).toBeGreaterThan(1050.0); // Overshoots target
    expect(peakVal).toBeLessThan(1150.0); // Within reasonable overshoot < 15%
    expect(finalVal).toBeGreaterThan(995.0); // Settles near 1000 RPM
    expect(finalVal).toBeLessThan(1005.0);
    expect(overshootPct).toBeGreaterThan(5.0);
    expect(overshootPct).toBeLessThan(15.0);
  });

  it("verifies live parameter tuning alters transient response (Kp = 0.2 vs Kp = 1.0)", () => {
    function runTuning(Kp: number) {
      const diag = {
        blocks: [
          { id: "setpoint", type: "Step", label: "TargetRPM", params: { stepTime: 0.05, initialValue: 0.0, finalValue: 1000.0 } },
          { id: "sum_err", type: "Sum", label: "ErrorJunction", params: { signs: "+-" } },
          { id: "pid_ctrl", type: "PID", label: "SpeedPID", params: { Kp, Ki: 20.0, Kd: 0.01, N: 50.0 } },
          { id: "motor_actuator", type: "TransferFunction", label: "DCMotorSpeed", params: { numerator: [12.5], denominator: [1.0, 12.5] } },
          { id: "scope_speed", type: "Scope", label: "SpeedScope", params: { title: "DC Motor Shaft Speed (RPM)" } },
        ],
        connections: [
          { id: "c1", fromBlockId: "setpoint", fromPortId: "out", toBlockId: "sum_err", toPortId: "in1" },
          { id: "c2", fromBlockId: "sum_err", fromPortId: "out", toBlockId: "pid_ctrl", toPortId: "in" },
          { id: "c3", fromBlockId: "pid_ctrl", fromPortId: "out", toBlockId: "motor_actuator", toPortId: "in" },
          { id: "c4", fromBlockId: "motor_actuator", fromPortId: "out", toBlockId: "sum_err", toPortId: "in2" },
          { id: "c5", fromBlockId: "motor_actuator", fromPortId: "out", toBlockId: "scope_speed", toPortId: "in" },
        ],
      };
      const comp = compileBlockDiagram(diag);
      const res = comp.runSimulation({ t0: 0, tEnd: 1.0, relTol: 1e-5, absTol: 1e-7 }, "rkf45");
      const pts = res.scopeSignals.scope_speed?.points ?? [];
      const peak = Math.max(...pts.map((p) => p.y));
      return { peak, overshootPct: ((peak - 1000.0) / 1000.0) * 100 };
    }

    const underdamped = runTuning(0.2);
    const tuned = runTuning(1.0);

    // Kp = 0.2 has higher peak overshoot than Kp = 1.0
    expect(underdamped.peak).toBeGreaterThan(tuned.peak + 50.0);
    expect(underdamped.overshootPct).toBeGreaterThan(tuned.overshootPct + 10.0);
  });
});
