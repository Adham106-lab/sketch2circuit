/**
 * @license Apache-2.0
 * @s2c/export-ato — Atopile (.ato) Exporter Test Suite (Doc §15).
 * Validates syntax plausibility against real atopile repo examples,
 * asserts verified vs unverified part references, and tests CLI integration.
 */

import fs from "node:fs";
import path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import { runCli } from "@s2c/cli";
import { describe, expect, it } from "vitest";
import { circuitToAto } from "../src/ato-generator.js";

const CORPUS_SKETCHES: Record<string, string> = {
  blink: `
const int ledPin = 13;
void setup() { pinMode(ledPin, OUTPUT); }
void loop() { digitalWrite(ledPin, HIGH); delay(1000); digitalWrite(ledPin, LOW); delay(1000); }
`,
  button_pullup: `
const int btnPin = 2;
void setup() { pinMode(btnPin, INPUT_PULLUP); }
void loop() { int val = digitalRead(btnPin); }
`,
  button_pulldown: `
const int btnPin = 2;
const int ledPin = 12;
void setup() { pinMode(btnPin, INPUT); pinMode(ledPin, OUTPUT); }
void loop() { digitalWrite(ledPin, digitalRead(btnPin)); }
`,
  servo_sweep: `
#include <Servo.h>
Servo myservo;
void setup() { myservo.attach(9); }
void loop() { myservo.write(90); }
`,
  hc_sr04: `
const int trigPin = 11;
const int echoPin = 12;
void setup() { pinMode(trigPin, OUTPUT); pinMode(echoPin, INPUT); }
void loop() {
  digitalWrite(trigPin, LOW); delayMicroseconds(2);
  digitalWrite(trigPin, HIGH); delayMicroseconds(10);
  digitalWrite(trigPin, LOW);
  long duration = pulseIn(echoPin, HIGH);
}
`,
  pot_analog: `
const int potPin = A0;
void setup() { pinMode(potPin, INPUT); }
void loop() { int val = analogRead(potPin); }
`,
  erc_hazards: `
// Direct motor drive requiring flyback diode
const int motorPin = 3;
void setup() { pinMode(motorPin, OUTPUT); }
void loop() { analogWrite(motorPin, 200); }
`,
};

describe("M15a — Atopile (.ato) Exporter", () => {
  it("generates idiomatic .ato module for canonical Blink sketch", () => {
    const res = synthesizeSketch(CORPUS_SKETCHES.blink, {
      boardId: "ARDUINO_UNO_R3",
      timestamp: "2026-10-01T00:00:00Z",
    });
    const ato = circuitToAto(res.circuit, {
      moduleName: "BlinkApp",
      timestamp: "2026-10-01T00:00:00Z",
    });

    // 1. Module declaration
    expect(ato).toContain("module BlinkApp:");

    // 2. Standard library imports
    expect(ato).toContain("import Resistor");
    expect(ato).toContain("import LED");

    // 3. Components instantiated
    expect(ato).toContain("u1 = new ArduinoUnoR3Header");
    expect(ato).toContain("d1 = new LED");
    expect(ato).toContain("r1 = new Resistor");

    // 4. Value constraints & unverified note (auto-picking constraint per atopile examples/auto-picking)
    expect(ato).toContain("r1.resistance = 300ohm +/- 5%");
    expect(ato).toContain("# TODO: unverified part reference");

    // 5. Connections use '~' wire syntax
    expect(ato).toContain("u1.D13 ~ r1.p1");
    expect(ato).toContain("d1.anode ~ r1.p2");
    expect(ato).toContain("d1.cathode ~ GND");
    expect(ato).toContain("u1.GND ~ GND");
  });

  it("generates valid .ato for Button (INPUT_PULLUP)", () => {
    const res = synthesizeSketch(CORPUS_SKETCHES.button_pullup);
    const ato = circuitToAto(res.circuit, { moduleName: "ButtonPullupApp" });

    expect(ato).toContain("module ButtonPullupApp:");
    expect(ato).toContain("sw1 = new TactileSwitch");
    expect(ato).toContain("u1.D2 ~ sw1.p1");
    expect(ato).toContain("sw1.p2 ~ GND");
  });

  it("generates valid .ato for Button (INPUT with external pull-down resistor)", () => {
    const res = synthesizeSketch(CORPUS_SKETCHES.button_pulldown);
    const ato = circuitToAto(res.circuit, { moduleName: "ButtonPulldownApp" });

    expect(ato).toContain("module ButtonPulldownApp:");
    expect(ato).toContain("sw1 = new TactileSwitch");
    expect(ato).toContain("r1 = new Resistor");
    expect(ato).toContain("r1.resistance = 10kohm +/- 5%");
    expect(ato).toContain("signal VCC_5V");
    expect(ato).toContain("signal GND");
  });

  it("generates valid .ato for Servo Sweep with 100µF bulk capacitor", () => {
    const res = synthesizeSketch(CORPUS_SKETCHES.servo_sweep);
    const ato = circuitToAto(res.circuit, { moduleName: "ServoApp" });

    expect(ato).toContain("module ServoApp:");
    expect(ato).toContain("servo1 = new SG90Servo");
    expect(ato).toContain('servo1.mpn = "SG90"');
    expect(ato).toContain("c_servo1 = new Capacitor");
    expect(ato).toContain("c_servo1.capacitance = 100uF +/- 20%");
    expect(ato).toContain("u1.D9 ~ servo1.pwm");
  });

  it("generates valid .ato for HC-SR04 Ultrasonic Sonar", () => {
    const res = synthesizeSketch(CORPUS_SKETCHES.hc_sr04);
    const ato = circuitToAto(res.circuit, { moduleName: "SonarApp" });

    expect(ato).toContain("module SonarApp:");
    expect(ato).toContain("new HC_SR04");
    expect(ato).toContain("u1.D11 ~ sensor1.trig");
    expect(ato).toContain("u1.D12 ~ sensor1.echo");
    expect(ato).toContain("sensor1.vcc ~ VCC_5V");
    expect(ato).toContain("sensor1.gnd ~ GND");
  });

  it("generates valid .ato for Potentiometer Analog Voltage Divider", () => {
    const res = synthesizeSketch(CORPUS_SKETCHES.pot_analog);
    const ato = circuitToAto(res.circuit, { moduleName: "PotApp" });

    expect(ato).toContain("module PotApp:");
    expect(ato).toContain("pot1 = new Potentiometer");
    expect(ato).toContain("u1.A0 ~ pot1.p2");
  });

  it("marks unverified JLCPCB LCSC parts for 1N4007 flyback diode and 2N2222 transistor with TODO", async () => {
    const { createCircuit } = await import("@s2c/core");
    const b = createCircuit({ title: "Motor Driver with Flyback Diode" });
    b.addPart("ARDUINO_UNO_R3", "U1");
    b.addPart("1N4007", "D_FLYBACK1");
    b.addPart("2N2222", "Q1");
    b.connectNet("5V", ["U1.5V", "D_FLYBACK1.K"]);
    b.connect("D_FLYBACK1.A", "Q1.C");
    b.connect("U1.D3", "Q1.B");
    b.connectNet("GND", ["U1.GND", "Q1.E"]);
    const circuit = b.build();
    const ato = circuitToAto(circuit, { moduleName: "MotorDriverApp" });

    // Must emit unverified TODO comment rather than fabricated or unverified LCSC number
    expect(ato).toContain("# TODO: unverified part reference (1N4007 flyback diode");
    expect(ato).toContain('d_flyback1.mpn = "1N4007"');

    // Must emit unverified TODO comment for 2N2222A
    expect(ato).toContain("# TODO: unverified part reference (2N2222A NPN transistor");
    expect(ato).toContain('q1.mpn = "2N2222A"');
  });

  it("guarantees byte-identical deterministic output across repeated runs", () => {
    const res = synthesizeSketch(CORPUS_SKETCHES.blink, {
      boardId: "ARDUINO_UNO_R3",
      timestamp: "2026-10-01T00:00:00Z",
    });
    const run1 = circuitToAto(res.circuit, {
      moduleName: "BlinkApp",
      timestamp: "2026-10-01T00:00:00Z",
    });
    const run2 = circuitToAto(res.circuit, {
      moduleName: "BlinkApp",
      timestamp: "2026-10-01T00:00:00Z",
    });

    expect(run1).toBe(run2);
  });
});

describe("M15a — CLI Integration: s2c export --format ato", () => {
  it("exports .ato file from sketch via CLI", async () => {
    const tempDir = path.join(process.cwd(), "tmp_test_ato");
    fs.mkdirSync(tempDir, { recursive: true });
    const sketchPath = path.join(tempDir, "blink.ino");
    const outPath = path.join(tempDir, "blink.ato");

    fs.writeFileSync(sketchPath, CORPUS_SKETCHES.blink, "utf-8");

    const cliResult = await runCli(["export", "--format", "ato", sketchPath, "-o", outPath]);

    expect(cliResult.code).toBe(0);
    expect(cliResult.output).toContain("Exported ATO successfully");
    expect(fs.existsSync(outPath)).toBe(true);

    const generatedAto = fs.readFileSync(outPath, "utf-8");
    expect(generatedAto).toContain("module SynthesizedArduinoCircuit:");
    expect(generatedAto).toContain("u1.D13 ~ r1.p1");

    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
