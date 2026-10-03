/**
 * @license Apache-2.0
 * @s2c/sim-engine — Analytic vs. Numerical Verification for ODE Solvers.
 */

import { describe, expect, it } from "vitest";
import { solveRk4, solveRkf45 } from "../src/ode.js";

describe("M17 ODE Numerical Solvers vs. Closed-Form Analytic Solutions", () => {
  it("verifies RC charge transient against closed-form V(t) = V0*(1 - e^(-t/tau)) within tolerance 1e-3", () => {
    // Problem parameters:
    // Vsupply = 5.0 V, R = 1000 ohms, C = 100 uF (0.0001 F)
    // tau = R * C = 0.100 seconds
    const vSupply = 5.0;
    const r = 1000.0;
    const c = 100e-6;
    const tau = r * c; // 0.1s
    const tEnd = 0.5; // 5*tau

    // ODE: dV/dt = (Vsupply - V) / tau
    const f = (_t: number, y: number[]) => [(vSupply - y[0]!) / tau];
    const y0 = [0.0];

    const dt = 0.005; // 5ms step
    const solution = solveRk4(f, y0, { t0: 0, tEnd, dt });

    expect(solution.points.length).toBeGreaterThan(50);

    let maxAbsoluteError = 0.0;
    const sampleComparisons: Array<{
      t: number;
      analytic: number;
      numeric: number;
      absDiff: number;
    }> = [];

    for (const pt of solution.points) {
      // Analytic formula:
      const vAnalytic = vSupply * (1 - Math.exp(-pt.t / tau));
      const vNumeric = pt.y[0]!;
      const diff = Math.abs(vNumeric - vAnalytic);
      if (diff > maxAbsoluteError) {
        maxAbsoluteError = diff;
      }
      if (
        Math.abs(pt.t - 0.1) < 1e-4 ||
        Math.abs(pt.t - 0.2) < 1e-4 ||
        Math.abs(pt.t - 0.5) < 1e-4
      ) {
        sampleComparisons.push({
          t: Number(pt.t.toFixed(3)),
          analytic: Number(vAnalytic.toFixed(5)),
          numeric: Number(vNumeric.toFixed(5)),
          absDiff: Number(diff.toFixed(6)),
        });
      }
    }

    console.log("RC Charge Curve — Analytic vs RK4 Numeric Comparison Samples:", sampleComparisons);
    console.log(
      `RC Charge Curve — Maximum Absolute Error: ${maxAbsoluteError.toExponential(4)} (Threshold: 1e-3)`,
    );

    // Strict numerical tolerance:
    expect(maxAbsoluteError).toBeLessThan(1e-3);
  });

  it("verifies Simple Harmonic Oscillator (coupled 2-variable ODE) against analytic cos(omega*t) within tolerance 1e-3", () => {
    // Problem parameters:
    // x''(t) + omega^2 * x(t) = 0
    // Let y = [x, v], where dx/dt = v, dv/dt = -omega^2 * x
    // Initial condition: x(0) = 1.0, v(0) = 0.0
    // Analytic solution: x(t) = cos(omega * t), v(t) = -omega * sin(omega * t)
    const omega = 2.0; // 2 rad/s
    const tEnd = 2.0 * Math.PI; // Full period
    const dt = 0.005;

    const f = (_t: number, y: number[]) => [
      y[1]!, // dx/dt = v
      -omega * omega * y[0]!, // dv/dt = -omega^2 * x
    ];
    const y0 = [1.0, 0.0];

    const solution = solveRk4(f, y0, { t0: 0, tEnd, dt });

    let maxPositionError = 0.0;
    const sampleComparisons: Array<{
      t: number;
      analyticX: number;
      numericX: number;
      absDiff: number;
    }> = [];

    for (const pt of solution.points) {
      const analyticX = Math.cos(omega * pt.t);
      const numericX = pt.y[0]!;
      const diff = Math.abs(numericX - analyticX);
      if (diff > maxPositionError) {
        maxPositionError = diff;
      }
      if (
        Math.abs(pt.t - 1.0) < 1e-3 ||
        Math.abs(pt.t - 3.14) < 5e-3 ||
        Math.abs(pt.t - tEnd) < 1e-3
      ) {
        sampleComparisons.push({
          t: Number(pt.t.toFixed(3)),
          analyticX: Number(analyticX.toFixed(5)),
          numericX: Number(numericX.toFixed(5)),
          absDiff: Number(diff.toFixed(6)),
        });
      }
    }

    console.log(
      "Harmonic Oscillator — Analytic vs RK4 Numeric Comparison Samples:",
      sampleComparisons,
    );
    console.log(
      `Harmonic Oscillator — Maximum Position Error: ${maxPositionError.toExponential(4)} (Threshold: 1e-3)`,
    );

    expect(maxPositionError).toBeLessThan(1e-3);
  });

  it("verifies adaptive RKF45 error control on non-linear exponential decay", () => {
    // dy/dt = -3*y, y(0) = 10, analytic y(t) = 10*e^(-3*t)
    const lambda = 3.0;
    const f = (_t: number, y: number[]) => [-lambda * y[0]!];
    const y0 = [10.0];

    const solution = solveRkf45(f, y0, {
      t0: 0,
      tEnd: 2.0,
      relTol: 1e-5,
      absTol: 1e-7,
    });

    expect(solution.method).toBe("rkf45");
    expect(solution.truncated).toBe(false);

    let maxDiff = 0.0;
    for (const pt of solution.points) {
      const analytic = 10.0 * Math.exp(-lambda * pt.t);
      const diff = Math.abs(pt.y[0]! - analytic);
      if (diff > maxDiff) maxDiff = diff;
    }

    console.log(`Adaptive RKF45 Exponential Decay Max Error: ${maxDiff.toExponential(4)}`);
    expect(maxDiff).toBeLessThan(1e-4);
  });
});
