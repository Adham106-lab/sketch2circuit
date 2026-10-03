/**
 * @license Apache-2.0
 * @s2c/block-diagram — Milestone 18a: Core Block Diagram Engine Unit Tests.
 *
 * Verifies:
 * 1. M17 Simple Harmonic Oscillator reproduction with exact pointwise numeric comparisons
 * 2. Positive algebraic loop detection & rejection (at least 3 tests)
 * 3. Negative / control acceptance of feedback loops broken by state blocks (at least 3 tests)
 * 4. Unconnected required input detection & rejection (at least 2 tests)
 * 5. Deterministic simulation execution
 * 6. Closed-loop PID control of a dynamic transfer function plant
 */

import { describe, expect, it } from "vitest";
import { compileBlockDiagram } from "../src/compile.js";
import type { BlockDiagram } from "../src/graph.js";

describe("Milestone 18a: Core Block Diagram Engine", () => {
  // =========================================================================
  // 1. M17 Harmonic Oscillator Reproduction
  // =========================================================================
  it("reproduces the M17 Simple Harmonic Oscillator via hand-built block diagram within tolerance 1e-3", () => {
    // Equation: x''(t) + omega^2 * x(t) = 0 with omega = 2.0 rad/s
    // State 1 (v): dv/dt = a = -4.0 * x, v(0) = 0.0
    // State 2 (x): dx/dt = v, x(0) = 1.0
    // Analytic solution: x(t) = cos(2*t), v(t) = -2*sin(2*t)
    const omega = 2.0;
    const omegaSquared = omega * omega; // 4.0
    const tEnd = 2.0 * Math.PI;
    const dt = 0.005;

    const diagram: BlockDiagram = {
      blocks: [
        {
          id: "gain_accel",
          type: "Gain",
          label: "NegOmegaSq",
          params: { gain: -omegaSquared },
        },
        {
          id: "int_vel",
          type: "Integrator",
          label: "IntegratorVelocity",
          params: { initialCondition: 0.0 },
        },
        {
          id: "int_pos",
          type: "Integrator",
          label: "IntegratorPosition",
          params: { initialCondition: 1.0 },
        },
        {
          id: "scope_pos",
          type: "Scope",
          label: "PositionScope",
          params: { title: "Oscillator Position x(t)" },
        },
      ],
      connections: [
        // Acceleration -> Velocity Integrator
        {
          id: "c1",
          fromBlockId: "gain_accel",
          fromPortId: "out",
          toBlockId: "int_vel",
          toPortId: "in",
        },
        // Velocity -> Position Integrator
        {
          id: "c2",
          fromBlockId: "int_vel",
          fromPortId: "out",
          toBlockId: "int_pos",
          toPortId: "in",
        },
        // Position -> Acceleration Gain (feedback loop)
        {
          id: "c3",
          fromBlockId: "int_pos",
          fromPortId: "out",
          toBlockId: "gain_accel",
          toPortId: "in",
        },
        // Position -> Scope
        {
          id: "c4",
          fromBlockId: "int_pos",
          fromPortId: "out",
          toBlockId: "scope_pos",
          toPortId: "in",
        },
      ],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(true);
    expect(compiled.numStates).toBe(2);
    expect(compiled.diagnostics.length).toBe(0);

    const sim = compiled.runSimulation({ t0: 0, tEnd, dt }, "rk4");
    expect(sim.success).toBe(true);
    expect(sim.solution).toBeDefined();

    const scope = sim.scopeSignals.scope_pos;
    expect(scope).toBeDefined();
    expect(scope!.points.length).toBeGreaterThan(1000);

    let maxError = 0.0;
    const comparisonSamples: Array<{
      t: number;
      analyticX: number;
      numericX: number;
      absDiff: number;
    }> = [];

    for (const pt of scope!.points) {
      const analyticX = Math.cos(omega * pt.x);
      const numericX = pt.y;
      const diff = Math.abs(numericX - analyticX);
      if (diff > maxError) {
        maxError = diff;
      }

      if (
        Math.abs(pt.x - 1.0) < 1e-3 ||
        Math.abs(pt.x - 3.14) < 5e-3 ||
        Math.abs(pt.x - 3.145) < 5e-3 ||
        Math.abs(pt.x - tEnd) < 1e-3
      ) {
        comparisonSamples.push({
          t: Number(pt.x.toFixed(3)),
          analyticX: Number(analyticX.toFixed(5)),
          numericX: Number(numericX.toFixed(5)),
          absDiff: Number(diff.toFixed(6)),
        });
      }
    }

    console.log("M18a Block Diagram Harmonic Oscillator Comparison Samples:", comparisonSamples);
    console.log(
      `M18a Block Diagram Harmonic Oscillator Max Error: ${maxError.toExponential(4)} (Threshold: 1e-3)`,
    );

    // Verifies match against M17 precision
    expect(maxError).toBeLessThan(1e-3);
  });

  // =========================================================================
  // 2. Positive Algebraic-Loop Rejection Tests (At least 3)
  // =========================================================================
  it("rejects simple direct-feedthrough loop: Gain1 -> Gain2 -> Gain1", () => {
    const diagram: BlockDiagram = {
      blocks: [
        { id: "g1", type: "Gain", label: "Gain1", params: { gain: 2.0 } },
        { id: "g2", type: "Gain", label: "Gain2", params: { gain: 3.0 } },
      ],
      connections: [
        { id: "c1", fromBlockId: "g1", fromPortId: "out", toBlockId: "g2", toPortId: "in" },
        { id: "c2", fromBlockId: "g2", fromPortId: "out", toBlockId: "g1", toPortId: "in" },
      ],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(false);

    const loopDiag = compiled.diagnostics.find((d) => d.ruleId === "diagram.algebraic-loop");
    expect(loopDiag).toBeDefined();
    expect(loopDiag?.message).toContain(
      "Algebraic loop detected: cycle of direct-feedthrough blocks found",
    );
    expect(loopDiag?.suggestion).toContain("Insert an Integrator or Delay block in this loop");
    expect(loopDiag?.blocksInLoop).toBeDefined();
    expect(loopDiag?.blocksInLoop?.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects feedback loop without dynamics: Sum1 -> Gain1 -> Sum1", () => {
    const diagram: BlockDiagram = {
      blocks: [
        { id: "src", type: "Constant", label: "Source", params: { value: 5.0 } },
        { id: "sum1", type: "Sum", label: "Sum1", params: { signs: "+-" } },
        { id: "gain1", type: "Gain", label: "Gain1", params: { gain: 10.0 } },
      ],
      connections: [
        { id: "c1", fromBlockId: "src", fromPortId: "out", toBlockId: "sum1", toPortId: "in1" },
        { id: "c2", fromBlockId: "sum1", fromPortId: "out", toBlockId: "gain1", toPortId: "in" },
        // Feedback directly into Sum without any state block:
        { id: "c3", fromBlockId: "gain1", fromPortId: "out", toBlockId: "sum1", toPortId: "in2" },
      ],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(false);

    const loopDiag = compiled.diagnostics.find((d) => d.ruleId === "diagram.algebraic-loop");
    expect(loopDiag).toBeDefined();
    expect(loopDiag?.message).toContain("[Sum1 -> Gain1 -> Sum1]");
    expect(loopDiag?.suggestion).toContain(
      "Insert an Integrator or Delay block in this loop: [Sum1 -> Gain1 -> Sum1]",
    );
  });

  it("rejects multi-block non-linear algebraic cycle: Gain -> Saturation -> Abs -> Sum -> Gain", () => {
    const diagram: BlockDiagram = {
      blocks: [
        { id: "src", type: "Constant", label: "Ref", params: { value: 1.0 } },
        { id: "sum", type: "Sum", label: "SumBlock", params: { signs: "+-" } },
        { id: "gain", type: "Gain", label: "GainBlock", params: { gain: 2.0 } },
        {
          id: "sat",
          type: "Saturation",
          label: "SatBlock",
          params: { upperLimit: 10, lowerLimit: -10 },
        },
        { id: "abs", type: "Abs", label: "AbsBlock", params: {} },
      ],
      connections: [
        { id: "c0", fromBlockId: "src", fromPortId: "out", toBlockId: "sum", toPortId: "in1" },
        { id: "c1", fromBlockId: "sum", fromPortId: "out", toBlockId: "gain", toPortId: "in" },
        { id: "c2", fromBlockId: "gain", fromPortId: "out", toBlockId: "sat", toPortId: "in" },
        { id: "c3", fromBlockId: "sat", fromPortId: "out", toBlockId: "abs", toPortId: "in" },
        // Close algebraic loop into sum:
        { id: "c4", fromBlockId: "abs", fromPortId: "out", toBlockId: "sum", toPortId: "in2" },
      ],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(false);

    const loopDiag = compiled.diagnostics.find((d) => d.ruleId === "diagram.algebraic-loop");
    expect(loopDiag).toBeDefined();
    expect(loopDiag?.message).toContain("Algebraic loop detected");
    expect(loopDiag?.blocksInLoop).toContain("sum");
    expect(loopDiag?.blocksInLoop).toContain("gain");
    expect(loopDiag?.blocksInLoop).toContain("sat");
    expect(loopDiag?.blocksInLoop).toContain("abs");
  });

  // =========================================================================
  // 3. Negative / Control Acceptance Tests (Loops Containing State Blocks)
  // =========================================================================
  it("accepts and solves feedback loop broken by an Integrator: Step -> Sum -> Integrator -> Gain -> Sum", () => {
    // 1st order low-pass filter: dy/dt = (u - y) / tau with tau = 1.0
    const diagram: BlockDiagram = {
      blocks: [
        {
          id: "step",
          type: "Step",
          label: "StepInput",
          params: { stepTime: 0.1, initialValue: 0, finalValue: 1 },
        },
        { id: "sum", type: "Sum", label: "ErrorSum", params: { signs: "+-" } },
        {
          id: "integ",
          type: "Integrator",
          label: "StateIntegrator",
          params: { initialCondition: 0 },
        },
        { id: "gain", type: "Gain", label: "FeedbackGain", params: { gain: 1.0 } },
        { id: "scope", type: "Scope", label: "OutputScope", params: {} },
      ],
      connections: [
        { id: "c1", fromBlockId: "step", fromPortId: "out", toBlockId: "sum", toPortId: "in1" },
        { id: "c2", fromBlockId: "sum", fromPortId: "out", toBlockId: "integ", toPortId: "in" },
        { id: "c3", fromBlockId: "integ", fromPortId: "out", toBlockId: "gain", toPortId: "in" },
        { id: "c4", fromBlockId: "gain", fromPortId: "out", toBlockId: "sum", toPortId: "in2" }, // loop back
        { id: "c5", fromBlockId: "integ", fromPortId: "out", toBlockId: "scope", toPortId: "in" },
      ],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(true);
    expect(compiled.numStates).toBe(1);
    expect(compiled.diagnostics.length).toBe(0);

    const sim = compiled.runSimulation({ t0: 0, tEnd: 2.0, dt: 0.01 }, "rk4");
    expect(sim.success).toBe(true);

    const pts = sim.scopeSignals.scope?.points;
    expect(pts).toBeDefined();
    expect(pts?.length).toBeGreaterThan(100);
    // At t=2.0 (after ~1.9s of step = ~1.9 tau), y ≈ 1 - exp(-1.9) ≈ 0.85
    const finalVal = pts![pts!.length - 1]!.y;
    expect(finalVal).toBeGreaterThan(0.8);
    expect(finalVal).toBeLessThan(0.9);
  });

  it("accepts and solves feedback loop broken by a TransferFunction: Step -> Sum -> TF -> Sum", () => {
    // Plant H(s) = 1 / (s + 2) in unity negative feedback
    const diagram: BlockDiagram = {
      blocks: [
        { id: "src", type: "Constant", label: "Ref", params: { value: 2.0 } },
        { id: "sum", type: "Sum", label: "SumBlock", params: { signs: "+-" } },
        {
          id: "plant",
          type: "TransferFunction",
          label: "FirstOrderPlant",
          params: { numerator: [1.0], denominator: [1.0, 2.0] },
        },
        { id: "scope", type: "Scope", label: "PlantScope", params: {} },
      ],
      connections: [
        { id: "c1", fromBlockId: "src", fromPortId: "out", toBlockId: "sum", toPortId: "in1" },
        { id: "c2", fromBlockId: "sum", fromPortId: "out", toBlockId: "plant", toPortId: "in" },
        { id: "c3", fromBlockId: "plant", fromPortId: "out", toBlockId: "sum", toPortId: "in2" },
        { id: "c4", fromBlockId: "plant", fromPortId: "out", toBlockId: "scope", toPortId: "in" },
      ],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(true);
    expect(compiled.numStates).toBe(1);

    const sim = compiled.runSimulation({ t0: 0, tEnd: 3.0, dt: 0.01 }, "rk4");
    expect(sim.success).toBe(true);
    // Closed-loop DC gain: (1/2) / (1 + 1/2) = 1/3. For input 2.0, steady-state is 2/3 ≈ 0.6667
    const pts = sim.scopeSignals.scope?.points;
    const finalVal = pts![pts!.length - 1]!.y;
    expect(Math.abs(finalVal - 2.0 / 3.0)).toBeLessThan(1e-2);
  });

  it("accepts and solves feedback loop broken by a Delay block: Constant -> Sum -> Delay -> Sum", () => {
    const diagram: BlockDiagram = {
      blocks: [
        { id: "src", type: "Constant", label: "In", params: { value: 1.0 } },
        { id: "sum", type: "Sum", label: "Sum", params: { signs: "+-" } },
        {
          id: "delay",
          type: "Delay",
          label: "Delay1",
          params: { delayTime: 0.2, initialOutput: 0.0 },
        },
        { id: "scope", type: "Scope", label: "Scope", params: {} },
      ],
      connections: [
        { id: "c1", fromBlockId: "src", fromPortId: "out", toBlockId: "sum", toPortId: "in1" },
        { id: "c2", fromBlockId: "sum", fromPortId: "out", toBlockId: "delay", toPortId: "in" },
        { id: "c3", fromBlockId: "delay", fromPortId: "out", toBlockId: "sum", toPortId: "in2" },
        { id: "c4", fromBlockId: "delay", fromPortId: "out", toBlockId: "scope", toPortId: "in" },
      ],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(true);
    expect(compiled.diagnostics.length).toBe(0);

    const sim = compiled.runSimulation({ t0: 0, tEnd: 1.0, dt: 0.01 }, "rk4");
    expect(sim.success).toBe(true);
  });

  // =========================================================================
  // 4. Unconnected Required Input Rejection Tests (At least 2)
  // =========================================================================
  it("rejects isolated Gain block with unconnected required input port", () => {
    const diagram: BlockDiagram = {
      blocks: [{ id: "g1", type: "Gain", label: "FloatingGain", params: { gain: 2.0 } }],
      connections: [],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(false);

    const err = compiled.diagnostics.find((d) => d.ruleId === "diagram.unconnected-required-input");
    expect(err).toBeDefined();
    expect(err?.blockId).toBe("g1");
    expect(err?.portId).toBe("in");
    expect(err?.message).toContain(
      'Block "FloatingGain" (Gain) has unconnected required input port "in"',
    );
  });

  it("rejects Sum block when required second input port is unconnected", () => {
    const diagram: BlockDiagram = {
      blocks: [
        { id: "src", type: "Constant", label: "Source", params: { value: 1.0 } },
        { id: "sum", type: "Sum", label: "IncompleteSum", params: { signs: "+-" } },
      ],
      connections: [
        // Wire into in1 only; in2 is left unconnected
        { id: "c1", fromBlockId: "src", fromPortId: "out", toBlockId: "sum", toPortId: "in1" },
      ],
    };

    const compiled = compileBlockDiagram(diagram);
    expect(compiled.valid).toBe(false);

    const err = compiled.diagnostics.find(
      (d) => d.ruleId === "diagram.unconnected-required-input" && d.portId === "in2",
    );
    expect(err).toBeDefined();
    expect(err?.blockId).toBe("sum");
    expect(err?.message).toContain(
      'Block "IncompleteSum" (Sum) has unconnected required input port "in2"',
    );
  });

  // =========================================================================
  // 5. Determinism Test
  // =========================================================================
  it("executes identically and deterministically across multiple compilation runs", () => {
    const diagram: BlockDiagram = {
      blocks: [
        {
          id: "step",
          type: "Step",
          label: "Step",
          params: { stepTime: 0.5, initialValue: 0, finalValue: 2 },
        },
        { id: "sum", type: "Sum", label: "Sum", params: { signs: "+-" } },
        { id: "pid", type: "PID", label: "PIDController", params: { Kp: 2.0, Ki: 1.0, Kd: 0.1 } },
        {
          id: "plant",
          type: "TransferFunction",
          label: "Plant",
          params: { numerator: [1], denominator: [1, 2, 1] },
        },
        { id: "scope", type: "Scope", label: "Scope", params: {} },
      ],
      connections: [
        { id: "c1", fromBlockId: "step", fromPortId: "out", toBlockId: "sum", toPortId: "in1" },
        { id: "c2", fromBlockId: "sum", fromPortId: "out", toBlockId: "pid", toPortId: "in" },
        { id: "c3", fromBlockId: "pid", fromPortId: "out", toBlockId: "plant", toPortId: "in" },
        { id: "c4", fromBlockId: "plant", fromPortId: "out", toBlockId: "sum", toPortId: "in2" },
        { id: "c5", fromBlockId: "plant", fromPortId: "out", toBlockId: "scope", toPortId: "in" },
      ],
    };

    const compiled1 = compileBlockDiagram(diagram);
    const compiled2 = compileBlockDiagram(diagram);

    expect(compiled1.valid).toBe(true);
    expect(compiled2.valid).toBe(true);
    expect(compiled1.numStates).toBe(compiled2.numStates);
    expect(compiled1.initialState).toEqual(compiled2.initialState);

    const sim1 = compiled1.runSimulation({ t0: 0, tEnd: 3.0, dt: 0.01 }, "rk4");
    const sim2 = compiled2.runSimulation({ t0: 0, tEnd: 3.0, dt: 0.01 }, "rk4");

    expect(sim1.timePoints.length).toBe(sim2.timePoints.length);
    const pts1 = sim1.scopeSignals.scope?.points ?? [];
    const pts2 = sim2.scopeSignals.scope?.points ?? [];

    expect(pts1.length).toBe(pts2.length);
    for (let i = 0; i < pts1.length; i++) {
      expect(pts1[i]?.x).toBe(pts2[i]?.x);
      expect(pts1[i]?.y).toBe(pts2[i]?.y);
    }
  });

  // =========================================================================
  // 6. Step Discontinuity O(dt) Error Halving & RKF45 Recovery Regression Test
  // =========================================================================
  it("verifies O(dt) error halving for fixed-step RK4 across interior step discontinuity and high-precision recovery via RKF45", () => {
    function createStepFeedbackDiagram(stepTime: number): BlockDiagram {
      return {
        blocks: [
          {
            id: "step",
            type: "Step",
            label: "Step",
            params: { stepTime, initialValue: 0, finalValue: 1 },
          },
          { id: "sum", type: "Sum", label: "Sum", params: { signs: "+-" } },
          { id: "integ", type: "Integrator", label: "Integrator", params: { initialCondition: 0 } },
          { id: "gain", type: "Gain", label: "Gain", params: { gain: 1.0 } },
          { id: "scope", type: "Scope", label: "Scope", params: {} },
        ],
        connections: [
          { id: "c1", fromBlockId: "step", fromPortId: "out", toBlockId: "sum", toPortId: "in1" },
          { id: "c2", fromBlockId: "sum", fromPortId: "out", toBlockId: "integ", toPortId: "in" },
          { id: "c3", fromBlockId: "integ", fromPortId: "out", toBlockId: "gain", toPortId: "in" },
          { id: "c4", fromBlockId: "gain", fromPortId: "out", toBlockId: "sum", toPortId: "in2" },
          { id: "c5", fromBlockId: "integ", fromPortId: "out", toBlockId: "scope", toPortId: "in" },
        ],
      };
    }

    // Part A: Step at t = 0.0 s (no interior boundary smearing) achieves floating-point accuracy
    const diagT0 = createStepFeedbackDiagram(0.0);
    const compT0 = compileBlockDiagram(diagT0);
    const simT0 = compT0.runSimulation({ t0: 0, tEnd: 2.0, dt: 0.005 }, "rk4");
    const ptsT0 = simT0.scopeSignals.scope?.points ?? [];
    const finalT0 = ptsT0[ptsT0.length - 1]?.y ?? 0.0;
    const analyticT0 = 1.0 - Math.exp(-2.0);
    const errT0 = Math.abs(finalT0 - analyticT0);
    expect(errT0).toBeLessThan(1e-10);

    // Part B: Step at t = 0.1 s evaluated with dt = 0.010 vs dt = 0.005
    const diagT1 = createStepFeedbackDiagram(0.1);
    const compT1 = compileBlockDiagram(diagT1);

    const simDt01 = compT1.runSimulation({ t0: 0, tEnd: 2.0, dt: 0.01 }, "rk4");
    const ptsDt01 = simDt01.scopeSignals.scope?.points ?? [];
    const finalDt01 = ptsDt01[ptsDt01.length - 1]?.y ?? 0.0;

    const simDt005 = compT1.runSimulation({ t0: 0, tEnd: 2.0, dt: 0.005 }, "rk4");
    const ptsDt005 = simDt005.scopeSignals.scope?.points ?? [];
    const finalDt005 = ptsDt005[ptsDt005.length - 1]?.y ?? 0.0;

    const analyticT1 = 1.0 - Math.exp(-1.9); // elapsed time = 1.9 s
    const errDt01 = Math.abs(finalDt01 - analyticT1);
    const errDt005 = Math.abs(finalDt005 - analyticT1);

    // Assert strict O(dt) halving ratio: err(dt=0.01) / err(dt=0.005) must equal 2.0 within 1%
    const ratio = errDt01 / errDt005;
    expect(ratio).toBeGreaterThan(1.98);
    expect(ratio).toBeLessThan(2.02);

    // Part C: RKF45 adaptive solver subdivides near discontinuity and recovers high precision
    const simRkf45 = compT1.runSimulation(
      { t0: 0, tEnd: 2.0, relTol: 1e-6, absTol: 1e-8 },
      "rkf45",
    );
    const ptsRkf45 = simRkf45.scopeSignals.scope?.points ?? [];
    const finalRkf45 = ptsRkf45[ptsRkf45.length - 1]?.y ?? 0.0;
    const errRkf45 = Math.abs(finalRkf45 - analyticT1);
    expect(errRkf45).toBeLessThan(1e-6);
  });
});
