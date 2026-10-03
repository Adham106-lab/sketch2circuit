/**
 * @license Apache-2.0
 * @s2c/sim-engine — Unit tests for preset models against real synthesized circuits.
 */

import fs from "node:fs";
import path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import { describe, expect, it } from "vitest";
import {
  buildLdrDividerPreset,
  buildPotentiometerPreset,
  buildRcDecouplingPreset,
  buildServoStepPreset,
  getAvailableCircuitPresets,
} from "../src/presets.js";

const userMultiPath = path.resolve(
  __dirname,
  "../../../fixtures/sketches/user_multi_peripheral.ino",
);
const userMultiCode = fs.existsSync(userMultiPath)
  ? fs.readFileSync(userMultiPath, "utf-8")
  : `
    #include <Servo.h>
    const int ldrPin = A1;
    void setup() { pinMode(ldrPin, INPUT); }
    void loop() { int v = analogRead(ldrPin); }
  `;

const CORPUS_SKETCHES = {
  blink: `
    void setup() { pinMode(13, OUTPUT); }
    void loop() { digitalWrite(13, HIGH); delay(500); digitalWrite(13, LOW); delay(500); }
  `,
  pot_analog: `
    void setup() { pinMode(A0, INPUT); }
    void loop() { int v = analogRead(A0); delay(100); }
  `,
  servo_sweep: `
    #include <Servo.h>
    Servo myServo;
    void setup() { myServo.attach(9); }
    void loop() { myServo.write(90); delay(500); }
  `,
  user_multi_peripheral: userMultiCode,
};

describe("M17 Circuit Presets Extraction & Modeling", () => {
  it("extracts real potentiometer parameters from pot_analog circuit", () => {
    const syn = synthesizeSketch(CORPUS_SKETCHES.pot_analog, { boardId: "ARDUINO_UNO_R3" });
    const potPreset = buildPotentiometerPreset(syn.circuit);

    expect(potPreset).not.toBeNull();
    expect(potPreset?.kind).toBe("pot_divider");
    expect(potPreset?.isIllustrative).toBe(false);
    expect(potPreset?.extractedParameters["Supply Voltage (Vcc)"]).toBe("5 V");
    expect(potPreset?.extractedParameters["Pot Total Resistance"]).toBe("10000 Ω");
    expect(potPreset?.points.length).toBe(101);

    // Verify 0%, 50%, 100% transfer points
    const p0 = potPreset?.points[0];
    const p50 = potPreset?.points[50];
    const p100 = potPreset?.points[100];
    expect(p0?.y).toBe(0.0);
    expect(p50?.y).toBe(2.5);
    expect(p100?.y).toBe(5.0);
  });

  it("extracts bulk capacitor and servo illustrative model from servo_sweep circuit", () => {
    const syn = synthesizeSketch(CORPUS_SKETCHES.servo_sweep, { boardId: "ARDUINO_UNO_R3" });

    // 1. RC bulk capacitor preset
    const rcPreset = buildRcDecouplingPreset(syn.circuit);
    expect(rcPreset).not.toBeNull();
    expect(rcPreset?.kind).toBe("rc_filter");
    expect(rcPreset?.extractedParameters["Capacitance (C)"]).toBe("100.0 µF");
    expect(rcPreset?.extractedParameters["Assumed Series Resistance (R)"]).toBe("10 Ω");
    expect(rcPreset?.points.length).toBeGreaterThan(50);
    expect(rcPreset?.points[0]?.y).toBe(0.0);
    expect(rcPreset?.points[rcPreset.points.length - 1]?.y).toBeCloseTo(5.0, 1);

    // 2. Servo step preset (MANDATORY: Must be clearly labeled illustrative)
    const servoPreset = buildServoStepPreset(syn.circuit);
    expect(servoPreset).not.toBeNull();
    expect(servoPreset?.kind).toBe("servo_step");
    expect(servoPreset?.isIllustrative).toBe(true);
    expect(servoPreset?.disclaimer).toBe(
      "Illustrative model — not derived from a verified datasheet transfer function.",
    );
    expect(servoPreset?.points[0]?.y).toBe(0.0);
    expect(servoPreset?.points[servoPreset.points.length - 1]?.y).toBeCloseTo(90.0, 0);
  });

  it("extracts real LDR divider resistor from user_multi_peripheral circuit", () => {
    const syn = synthesizeSketch(CORPUS_SKETCHES.user_multi_peripheral, {
      boardId: "ARDUINO_UNO_R3",
    });
    const ldrPreset = buildLdrDividerPreset(syn.circuit);

    expect(ldrPreset).not.toBeNull();
    expect(ldrPreset?.kind).toBe("ldr_divider");
    expect(ldrPreset?.isIllustrative).toBe(false);
    expect(ldrPreset?.extractedParameters["Series Resistor (R_series)"]).toBe("10000 Ω");
    expect(ldrPreset?.points.length).toBe(101);

    // In bright light (500 ohms), Vout = 5 * 10000 / (500 + 10000) = ~4.76V
    const brightPoint = ldrPreset?.points[0];
    expect(brightPoint?.x).toBe(500);
    expect(brightPoint?.y).toBeCloseTo(4.762, 2);

    // In darkness (100k ohms), Vout = 5 * 10000 / (100000 + 10000) = ~0.45V
    const darkPoint = ldrPreset?.points[100];
    expect(darkPoint?.x).toBe(100000);
    expect(darkPoint?.y).toBeCloseTo(0.455, 2);
  });

  it("discovers all applicable presets for a rich multi-peripheral circuit", () => {
    const syn = synthesizeSketch(CORPUS_SKETCHES.user_multi_peripheral, {
      boardId: "ARDUINO_UNO_R3",
    });
    const presets = getAvailableCircuitPresets(syn.circuit);

    // Should find LDR, Pot, Decoupling/Bulk Cap, and Servo
    expect(presets.length).toBeGreaterThanOrEqual(3);
    const kinds = presets.map((p) => p.kind);
    expect(kinds).toContain("pot_divider");
    expect(kinds).toContain("rc_filter");
    expect(kinds).toContain("servo_step");
  });
});
