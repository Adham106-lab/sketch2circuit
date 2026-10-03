/**
 * @license Apache-2.0
 * @s2c/sim-engine — Deterministic Numerical ODE Solvers (RK4 & Adaptive RKF45).
 */

export type OdeDerivativeFn = (t: number, y: number[]) => number[];

export interface OdeSimulationOptions {
  t0: number;
  tEnd: number;
  dt?: number; // Fixed step size for RK4, or initial guess for RKF45
  relTol?: number; // Relative tolerance for RKF45 (default 1e-4)
  absTol?: number; // Absolute tolerance for RKF45 (default 1e-6)
  maxSteps?: number; // Safety threshold against infinite loops (default 50,000)
}

export interface OdePoint {
  t: number;
  y: number[];
}

export interface OdeSolution {
  points: OdePoint[];
  method: "rk4" | "rkf45";
  totalSteps: number;
  truncated: boolean;
}

/**
 * Classical Runge-Kutta 4th-order (RK4) numerical integrator with fixed step size.
 *
 * k1 = f(t, y)
 * k2 = f(t + dt/2, y + dt/2 * k1)
 * k3 = f(t + dt/2, y + dt/2 * k2)
 * k4 = f(t + dt, y + dt * k3)
 * y_{n+1} = y_n + (dt/6) * (k1 + 2*k2 + 2*k3 + k4)
 */
export function solveRk4(
  f: OdeDerivativeFn,
  y0: number[],
  options: OdeSimulationOptions,
): OdeSolution {
  const { t0, tEnd, maxSteps = 50000 } = options;
  const dt = options.dt ?? (tEnd - t0) / 500;

  if (dt <= 0 || tEnd <= t0) {
    throw new Error(`Invalid integration interval: t0=${t0}, tEnd=${tEnd}, dt=${dt}`);
  }

  const dim = y0.length;
  const points: OdePoint[] = [{ t: t0, y: [...y0] }];
  let t = t0;
  let y = [...y0];
  let steps = 0;
  let truncated = false;

  while (t < tEnd - 1e-12) {
    if (steps >= maxSteps) {
      truncated = true;
      break;
    }

    const currentDt = Math.min(dt, tEnd - t);

    // k1
    const k1 = f(t, y);

    // k2
    const yTemp2 = new Array(dim);
    for (let i = 0; i < dim; i++) {
      yTemp2[i] = y[i] + (currentDt / 2) * k1[i];
    }
    const k2 = f(t + currentDt / 2, yTemp2);

    // k3
    const yTemp3 = new Array(dim);
    for (let i = 0; i < dim; i++) {
      yTemp3[i] = y[i] + (currentDt / 2) * k2[i];
    }
    const k3 = f(t + currentDt / 2, yTemp3);

    // k4
    const yTemp4 = new Array(dim);
    for (let i = 0; i < dim; i++) {
      yTemp4[i] = y[i] + currentDt * k3[i];
    }
    const k4 = f(t + currentDt, yTemp4);

    // Next state
    const nextY = new Array(dim);
    for (let i = 0; i < dim; i++) {
      nextY[i] = y[i] + (currentDt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    }

    t += currentDt;
    y = nextY;
    steps++;

    points.push({ t, y: [...y] });
  }

  return {
    points,
    method: "rk4",
    totalSteps: steps,
    truncated,
  };
}

/**
 * Adaptive Runge-Kutta-Fehlberg 4(5) (RKF45) numerical integrator.
 * Uses Butcher tableau coefficients to compute both 4th-order and 5th-order approximations,
 * estimating truncation error per step and adaptively adjusting dt.
 */
export function solveRkf45(
  f: OdeDerivativeFn,
  y0: number[],
  options: OdeSimulationOptions,
): OdeSolution {
  const { t0, tEnd, relTol = 1e-4, absTol = 1e-6, maxSteps = 50000 } = options;
  let dt = options.dt ?? (tEnd - t0) / 200;

  if (dt <= 0 || tEnd <= t0) {
    throw new Error(`Invalid integration interval: t0=${t0}, tEnd=${tEnd}, dt=${dt}`);
  }

  const dim = y0.length;
  const points: OdePoint[] = [{ t: t0, y: [...y0] }];
  let t = t0;
  let y = [...y0];
  let steps = 0;
  let truncated = false;

  // Butcher tableau coefficients for Fehlberg 4(5)
  const a2 = 1 / 4;
  const b21 = 1 / 4;

  const a3 = 3 / 8;
  const b31 = 3 / 32;
  const b32 = 9 / 32;

  const a4 = 12 / 13;
  const b41 = 1932 / 2197;
  const b42 = -7200 / 2197;
  const b43 = 7296 / 2197;

  const a5 = 1;
  const b51 = 439 / 216;
  const b52 = -8;
  const b53 = 3680 / 513;
  const b54 = -845 / 4104;

  const a6 = 1 / 2;
  const b61 = -8 / 27;
  const b62 = 2;
  const b63 = -3544 / 2565;
  const b64 = 1859 / 4104;
  const b65 = -11 / 40;

  // 4th order weights (c*)
  const cStar1 = 25 / 216;
  const cStar3 = 1408 / 2565;
  const cStar4 = 2197 / 4104;
  const cStar5 = -1 / 5;

  // 5th order weights (c)
  const c1 = 16 / 135;
  const c3 = 6656 / 12825;
  const c4 = 28561 / 56430;
  const c5 = -9 / 50;
  const c6 = 2 / 55;

  const minDt = 1e-12;
  const maxDt = (tEnd - t0) / 10;

  while (t < tEnd - 1e-12) {
    if (steps >= maxSteps) {
      truncated = true;
      break;
    }

    if (t + dt > tEnd) {
      dt = tEnd - t;
    }

    // k1
    const k1 = f(t, y);

    // k2
    const y2 = new Array(dim);
    for (let i = 0; i < dim; i++) y2[i] = y[i] + dt * (b21 * k1[i]);
    const k2 = f(t + a2 * dt, y2);

    // k3
    const y3 = new Array(dim);
    for (let i = 0; i < dim; i++) y3[i] = y[i] + dt * (b31 * k1[i] + b32 * k2[i]);
    const k3 = f(t + a3 * dt, y3);

    // k4
    const y4 = new Array(dim);
    for (let i = 0; i < dim; i++) y4[i] = y[i] + dt * (b41 * k1[i] + b42 * k2[i] + b43 * k3[i]);
    const k4 = f(t + a4 * dt, y4);

    // k5
    const y5 = new Array(dim);
    for (let i = 0; i < dim; i++) {
      y5[i] = y[i] + dt * (b51 * k1[i] + b52 * k2[i] + b53 * k3[i] + b54 * k4[i]);
    }
    const k5 = f(t + a5 * dt, y5);

    // k6
    const y6 = new Array(dim);
    for (let i = 0; i < dim; i++) {
      y6[i] = y[i] + dt * (b61 * k1[i] + b62 * k2[i] + b63 * k3[i] + b64 * k4[i] + b65 * k5[i]);
    }
    const k6 = f(t + a6 * dt, y6);

    // Error estimate (diff between 4th and 5th order)
    let maxErrorRatio = 0;
    for (let i = 0; i < dim; i++) {
      const y4th = y[i] + dt * (cStar1 * k1[i] + cStar3 * k3[i] + cStar4 * k4[i] + cStar5 * k5[i]);
      const y5th = y[i] + dt * (c1 * k1[i] + c3 * k3[i] + c4 * k4[i] + c5 * k5[i] + c6 * k6[i]);
      const error = Math.abs(y5th - y4th);
      const tol = absTol + relTol * Math.max(Math.abs(y[i]), Math.abs(y5th));
      const ratio = error / tol;
      if (ratio > maxErrorRatio) {
        maxErrorRatio = ratio;
      }
    }

    if (maxErrorRatio <= 1.0 || dt <= minDt) {
      // Step accepted (using 5th order solution for local extrapolation)
      const nextY = new Array(dim);
      for (let i = 0; i < dim; i++) {
        nextY[i] = y[i] + dt * (c1 * k1[i] + c3 * k3[i] + c4 * k4[i] + c5 * k5[i] + c6 * k6[i]);
      }
      t += dt;
      y = nextY;
      steps++;
      points.push({ t, y: [...y] });

      // Compute next step size
      const factor = maxErrorRatio === 0 ? 2.0 : 0.84 * (1 / maxErrorRatio) ** 0.2;
      dt = Math.max(minDt, Math.min(maxDt, dt * Math.min(2.0, Math.max(0.1, factor))));
    } else {
      // Step rejected — reduce dt
      const factor = Math.max(0.1, 0.84 * (1 / maxErrorRatio) ** 0.2);
      dt = Math.max(minDt, dt * factor);
    }
  }

  return {
    points,
    method: "rkf45",
    totalSteps: steps,
    truncated,
  };
}
