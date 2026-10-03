/**
 * @license Apache-2.0
 * @s2c/sim-engine — Circuit-behavior preset models tied directly to synthesized Circuit IR.
 */

import type { Circuit, Component } from "@s2c/circuit-json";
import { parseEngineering } from "@s2c/units";
import { solveRk4 } from "./ode.js";

export type PresetPeripheralKind =
  | "ldr_divider"
  | "pot_divider"
  | "rc_filter"
  | "servo_step"
  | "motor_step";

export interface PresetModelPoint {
  x: number;
  y: number;
  label?: string;
}

export interface PresetModelResult {
  id: string;
  name: string;
  kind: PresetPeripheralKind;
  description: string;
  isIllustrative: boolean;
  disclaimer?: string;
  xAxisLabel: string;
  yAxisLabel: string;
  xAxisUnit: string;
  yAxisUnit: string;
  extractedParameters: Record<string, string | number>;
  assumptions: string[];
  points: PresetModelPoint[];
  metadata: {
    componentIds: string[];
    circuitHash?: string;
  };
}

/**
 * Searches a synthesized circuit for an LDR / photoresistor and its associated divider resistor.
 */
export function buildLdrDividerPreset(circuit: Circuit): PresetModelResult | null {
  const ldr = circuit.components.find(
    (c) =>
      c.kind === "sensor" &&
      (/ldr|photo|light/i.test(c.id) ||
        /ldr|photo|light/i.test(c.name ?? "") ||
        /GL5528/i.test(c.partNumber ?? "")),
  );

  if (!ldr) return null;

  // Find the series divider resistor connected to the LDR
  let dividerResistor: Component | undefined;
  for (const comp of circuit.components) {
    if (comp.kind === "resistor") {
      // Check if it shares a net with the LDR
      const sharesNet = circuit.nets.some(
        (net) =>
          net.portIds.some((p) => p.startsWith(`${ldr.id}.`)) &&
          net.portIds.some((p) => p.startsWith(`${comp.id}.`)),
      );
      if (sharesNet) {
        dividerResistor = comp;
        break;
      }
    }
  }

  // Parse extracted resistor value from Circuit IR
  let rSeriesOhms = 10000; // fallback if unparsed
  let rSource = "Assumed default 10kΩ";
  if (dividerResistor?.value) {
    try {
      const parsedVal = parseEngineering(String(dividerResistor.value));
      if (Number.isFinite(parsedVal) && parsedVal > 0) {
        rSeriesOhms = parsedVal;
        rSource = `Extracted from ${dividerResistor.id} (${dividerResistor.value})`;
      }
    } catch {
      // Keep fallback
    }
  }

  const vSupply = 5.0; // Standard 5V Uno rail

  // Generate static transfer curve: sweep R_LDR from 500 ohms (bright light) to 100k ohms (darkness)
  const points: PresetModelPoint[] = [];
  const minLog = Math.log10(500);
  const maxLog = Math.log10(100000);
  const steps = 100;

  for (let i = 0; i <= steps; i++) {
    const logR = minLog + (i / steps) * (maxLog - minLog);
    const rLdr = 10 ** logR;
    // Voltage across R_series: Vout = Vcc * (R_series / (R_ldr + R_series))
    const vOut = vSupply * (rSeriesOhms / (rLdr + rSeriesOhms));
    points.push({
      x: Math.round(rLdr),
      y: Number(vOut.toFixed(3)),
    });
  }

  return {
    id: `sim_ldr_${ldr.id}`,
    name: `LDR Voltage Divider Transfer Curve (${ldr.id})`,
    kind: "ldr_divider",
    description: `Theoretical static voltage divider response of photoresistor ${ldr.id} against series load resistor ${dividerResistor?.id ?? "R_PULLDOWN"}.`,
    isIllustrative: false,
    xAxisLabel: "LDR Resistance (RLDR)",
    yAxisLabel: "Output Voltage (Vout)",
    xAxisUnit: "Ω",
    yAxisUnit: "V",
    extractedParameters: {
      "Supply Voltage (Vcc)": `${vSupply} V`,
      "Series Resistor (R_series)": `${rSeriesOhms} Ω`,
      "Load Resistor RefDes": dividerResistor?.id ?? "Assumed 10k",
      "Resistor Attribution": rSource,
    },
    assumptions: [
      "Assumes linear Ohm's law voltage division across static equilibrium.",
      "LDR resistance range modeled from 500 Ω (daylight saturation) to 100 kΩ (darkness).",
      "Theoretical transfer curve without ADC quantization or input impedance loading.",
    ],
    points,
    metadata: {
      componentIds: [ldr.id, ...(dividerResistor ? [dividerResistor.id] : [])],
      circuitHash: circuit.name || circuit.metadata?.sketchName || "circuit",
    },
  };
}

/**
 * Searches a synthesized circuit for a potentiometer and calculates its wiper voltage transfer.
 */
export function buildPotentiometerPreset(circuit: Circuit): PresetModelResult | null {
  const pot = circuit.components.find(
    (c) =>
      (c.kind === "potentiometer" || /pot|trimpot/i.test(c.id) || /pot/i.test(c.name ?? "")) &&
      c.kind !== "mcu",
  );

  if (!pot) return null;

  let rPotOhms = 10000;
  let rSource = "Assumed 10kΩ standard pot";
  if (pot.value) {
    try {
      const parsedVal = parseEngineering(String(pot.value));
      if (Number.isFinite(parsedVal) && parsedVal > 0) {
        rPotOhms = parsedVal;
        rSource = `Extracted from ${pot.id} (${pot.value})`;
      }
    } catch {
      // Keep fallback
    }
  }

  const vSupply = 5.0;
  const points: PresetModelPoint[] = [];

  for (let wiperPct = 0; wiperPct <= 100; wiperPct += 1) {
    const vOut = vSupply * (wiperPct / 100);
    points.push({
      x: wiperPct,
      y: Number(vOut.toFixed(3)),
    });
  }

  return {
    id: `sim_pot_${pot.id}`,
    name: `Potentiometer Wiper Transfer Characteristic (${pot.id})`,
    kind: "pot_divider",
    description: `Theoretical static voltage division of potentiometer ${pot.id} across wiper position 0% to 100%.`,
    isIllustrative: false,
    xAxisLabel: "Wiper Travel Position",
    yAxisLabel: "Wiper Voltage (Vout)",
    xAxisUnit: "%",
    yAxisUnit: "V",
    extractedParameters: {
      "Supply Voltage (Vcc)": `${vSupply} V`,
      "Pot Total Resistance": `${rPotOhms} Ω`,
      "Pot Attribution": rSource,
    },
    assumptions: [
      "Linear taper (Type B potentiometer track assumed).",
      "Negligible wiper contact resistance (< 1 Ω).",
      "No external circuit loading on wiper terminal.",
    ],
    points,
    metadata: {
      componentIds: [pot.id],
      circuitHash: circuit.name || circuit.metadata?.sketchName || "circuit",
    },
  };
}

/**
 * Searches a synthesized circuit for bulk capacitors or decoupling capacitors and calculates first-order step response.
 */
export function buildRcDecouplingPreset(circuit: Circuit): PresetModelResult | null {
  // Look for bulk capacitor first (e.g. 100uF servo filter), or decoupling capacitor (100nF)
  const bulkCap = circuit.components.find(
    (c) =>
      (c.kind === "capacitor" || /cap/i.test(c.id) || /capacitor/i.test(c.name ?? "")) &&
      (/bulk/i.test(c.id) ||
        /bulk/i.test(c.name ?? "") ||
        /100u|100µ|47u|47µ|220u|330u|470u|1000u/i.test(String(c.value ?? ""))),
  );
  const cap =
    bulkCap ??
    circuit.components.find(
      (c) =>
        c.kind === "capacitor" ||
        /cap|c_bulk|c_decoupling/i.test(c.id) ||
        /capacitor/i.test(c.name ?? ""),
    );

  if (!cap) return null;

  let capFarads = 100e-6; // 100µF default
  let capSource = "Default 100µF";
  if (cap.value) {
    try {
      const parsedVal = parseEngineering(String(cap.value));
      if (Number.isFinite(parsedVal) && parsedVal > 0) {
        capFarads = parsedVal;
        capSource = `Extracted from ${cap.id} (${cap.value})`;
      }
    } catch {
      // Keep fallback
    }
  }

  // Look for any explicit series resistor in the same net; if none, state assumed source/trace ESR
  const assumedSeriesR = 10.0; // 10 ohms assumed internal/source resistance
  const tau = assumedSeriesR * capFarads;
  const tEnd = Math.max(1e-4, 5 * tau); // 5 time constants covers 99.3% charge

  const vSupply = 5.0;

  // Use the numerical ODE solver RK4 to integrate dV/dt = (Vsupply - V) / (R*C)
  const odeSol = solveRk4(
    (_t, y) => {
      const vCap = y[0] ?? 0;
      const dvdt = (vSupply - vCap) / (assumedSeriesR * capFarads);
      return [dvdt];
    },
    [0.0], // Initial condition V(0) = 0V
    { t0: 0, tEnd, dt: tEnd / 100 },
  );

  const points: PresetModelPoint[] = odeSol.points.map((pt) => ({
    x: Number((pt.t * 1000).toFixed(4)), // Milliseconds
    y: Number((pt.y[0] ?? 0).toFixed(3)),
  }));

  return {
    id: `sim_rc_${cap.id}`,
    name: `Capacitor Transient Step Response (${cap.id})`,
    kind: "rc_filter",
    description: `Time-domain numerical step response for capacitor ${cap.id} charging through supply impedance.`,
    isIllustrative: false,
    xAxisLabel: "Time (t)",
    yAxisLabel: "Capacitor Voltage (Vc)",
    xAxisUnit: "ms",
    yAxisUnit: "V",
    extractedParameters: {
      "Capacitance (C)": `${(capFarads * 1e6).toFixed(1)} µF`,
      "Component RefDes": cap.id,
      "Capacitor Attribution": capSource,
      "Assumed Series Resistance (R)": `${assumedSeriesR} Ω`,
      "Time Constant (τ = RC)": `${(tau * 1000).toFixed(3)} ms`,
    },
    assumptions: [
      `Assumed series source resistance R = ${assumedSeriesR} Ω (representing PCB trace resistance, power rail ESR, and MCU output impedance) as no explicit discrete series resistor was bound to this net.`,
      "Ideal capacitor without dielectric absorption or leakage.",
      "Step input voltage instantaneous at t = 0.",
    ],
    points,
    metadata: {
      componentIds: [cap.id],
      circuitHash: circuit.name || circuit.metadata?.sketchName || "circuit",
    },
  };
}

/**
 * Illustrative open-loop step response for SG90 servo.
 * MANDATORY: Prominently marked as illustrative.
 */
export function buildServoStepPreset(circuit: Circuit): PresetModelResult | null {
  const servo = circuit.components.find(
    (c) =>
      c.kind === "generic" ||
      c.kind === "module" ||
      /servo|sg90/i.test(c.id) ||
      /servo|sg90/i.test(c.name ?? "") ||
      /servo|sg90/i.test(c.partNumber ?? ""),
  );

  if (!servo) return null;

  // Illustrative step response: 0 to 90 degrees target angle
  // Assumed first-order motor lag with assumed time constant tau = 0.06s (60ms)
  const tauAssumed = 0.06;
  const targetAngle = 90.0; // degrees
  const tEnd = 0.35; // 350ms

  const odeSol = solveRk4(
    (_t, y) => {
      const theta = y[0] ?? 0;
      const dTheta = (targetAngle - theta) / tauAssumed;
      return [dTheta];
    },
    [0.0],
    { t0: 0, tEnd, dt: tEnd / 100 },
  );

  const points: PresetModelPoint[] = odeSol.points.map((pt) => ({
    x: Number((pt.t * 1000).toFixed(1)), // ms
    y: Number((pt.y[0] ?? 0).toFixed(2)), // degrees
  }));

  return {
    id: `sim_servo_${servo.id}`,
    name: `Illustrative Servo Angular Step Response (${servo.id})`,
    kind: "servo_step",
    description: `Illustrative first-order step response for SG90 positioner ${servo.id} stepping from 0° to 90°.`,
    isIllustrative: true,
    disclaimer: "Illustrative model — not derived from a verified datasheet transfer function.",
    xAxisLabel: "Time (t)",
    yAxisLabel: "Horn Shaft Angle (θ)",
    xAxisUnit: "ms",
    yAxisUnit: "deg",
    extractedParameters: {
      "Target Angle": `${targetAngle}°`,
      "Target Peripheral": servo.id,
      "Assumed Mechanical Time Constant (τ)": `${tauAssumed * 1000} ms`,
    },
    assumptions: [
      "Illustrative model — not derived from a verified datasheet transfer function.",
      "Assumed simple first-order mechanical lag (τ = 60ms) based on generic 9g micro-servo operating speed (0.1s/60° at 4.8V).",
      "Neglects internal gear train backlash, motor deadband, and inertial overshoot.",
    ],
    points,
    metadata: {
      componentIds: [servo.id],
      circuitHash: circuit.name || circuit.metadata?.sketchName || "circuit",
    },
  };
}

/**
 * Illustrative open-loop step response for DC motor.
 * MANDATORY: Prominently marked as illustrative.
 */
export function buildDcMotorStepPreset(circuit: Circuit): PresetModelResult | null {
  const motor = circuit.components.find(
    (c) =>
      c.kind === "generic" ||
      c.kind === "module" ||
      /motor/i.test(c.id) ||
      /motor/i.test(c.name ?? "") ||
      /motor/i.test(c.partNumber ?? ""),
  );

  if (!motor) return null;

  // Illustrative first-order speed build-up: 0 to 5000 RPM
  const targetRpm = 5000;
  const tauMotor = 0.08; // 80ms
  const tEnd = 0.45; // 450ms

  const odeSol = solveRk4(
    (_t, y) => {
      const omega = y[0] ?? 0;
      const dOmega = (targetRpm - omega) / tauMotor;
      return [dOmega];
    },
    [0.0],
    { t0: 0, tEnd, dt: tEnd / 100 },
  );

  const points: PresetModelPoint[] = odeSol.points.map((pt) => ({
    x: Number((pt.t * 1000).toFixed(1)), // ms
    y: Number((pt.y[0] ?? 0).toFixed(1)), // RPM
  }));

  return {
    id: `sim_motor_${motor.id}`,
    name: `Illustrative DC Motor Speed Transient (${motor.id})`,
    kind: "motor_step",
    description: `Illustrative first-order rotational acceleration for DC motor ${motor.id} under step voltage.`,
    isIllustrative: true,
    disclaimer: "Illustrative model — not derived from a verified datasheet transfer function.",
    xAxisLabel: "Time (t)",
    yAxisLabel: "Rotational Speed (ω)",
    xAxisUnit: "ms",
    yAxisUnit: "RPM",
    extractedParameters: {
      "No-Load Target Speed": `${targetRpm} RPM`,
      "Target Peripheral": motor.id,
      "Assumed Electro-Mechanical Time Constant (τm)": `${tauMotor * 1000} ms`,
    },
    assumptions: [
      "Illustrative model — not derived from a verified datasheet transfer function.",
      "Assumed first-order electro-mechanical acceleration time constant τm = 80ms.",
      "Neglects armature back-EMF nonlinearities, brush friction, and load torque perturbations.",
    ],
    points,
    metadata: {
      componentIds: [motor.id],
      circuitHash: circuit.name || circuit.metadata?.sketchName || "circuit",
    },
  };
}

/**
 * Discovers all viable simulation presets from a given Circuit IR.
 */
export function getAvailableCircuitPresets(circuit: Circuit): PresetModelResult[] {
  const presets: PresetModelResult[] = [];

  const ldrPreset = buildLdrDividerPreset(circuit);
  if (ldrPreset) presets.push(ldrPreset);

  const potPreset = buildPotentiometerPreset(circuit);
  if (potPreset) presets.push(potPreset);

  const rcPreset = buildRcDecouplingPreset(circuit);
  if (rcPreset) presets.push(rcPreset);

  const servoPreset = buildServoStepPreset(circuit);
  if (servoPreset) presets.push(servoPreset);

  const motorPreset = buildDcMotorStepPreset(circuit);
  if (motorPreset) presets.push(motorPreset);

  return presets;
}
