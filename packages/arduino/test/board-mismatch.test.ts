/**
 * @license Apache-2.0
 * @s2c/arduino — Board Mismatch & Non-Uno Architecture Detection Tests.
 * Asserts that sketches targeting non-Uno architectures (e.g. ESP32) fail loudly
 * with explicit diagnostics and Unresolved items, never silently.
 */

import { describe, expect, it } from "vitest";
import { synthesizeSketch } from "../src/synthesizer.js";

describe("Board Architecture Mismatch & Unsupported Library Detection", () => {
  it("detects real-world ESP32 sketch with unknown libraries and out-of-range GPIOs", () => {
    const esp32Sketch = `
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <RTClib.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

void setup() {
  pinMode(21, OUTPUT);
  pinMode(22, INPUT);
  pinMode(27, OUTPUT);
  pinMode(4, OUTPUT);
  digitalWrite(21, HIGH);
  digitalWrite(27, LOW);
}

void loop() {
  digitalWrite(4, HIGH);
}
`;

    const result = synthesizeSketch(esp32Sketch, { boardId: "ARDUINO_UNO_R3" });

    // 1. Must NEVER silently return empty unresolved
    expect(result.unresolved.length).toBeGreaterThan(0);
    expect(result.unresolvedItems.length).toBeGreaterThan(0);

    // 2. Must detect board architecture mismatch
    const mismatchDiag = result.diagnostics.find(
      (d) => d.ruleId === "synthesis.board-architecture-mismatch",
    );
    expect(mismatchDiag).toBeDefined();
    expect(mismatchDiag?.message).toContain("ESP32");
    expect(mismatchDiag?.message).toContain("Arduino Uno R3");

    // 3. Must detect unrecognized libraries
    const libDiags = result.diagnostics.filter(
      (d) => d.ruleId === "synthesis.unrecognized-library",
    );
    expect(libDiags.length).toBeGreaterThanOrEqual(6);
    const libMessages = libDiags.map((d) => d.message).join(" ");
    expect(libMessages).toContain("WiFi.h");
    expect(libMessages).toContain("WebServer.h");
    expect(libMessages).toContain("Preferences.h");
    expect(libMessages).toContain("Adafruit_SSD1306.h");

    // 4. Must detect pins outside Uno range (21, 22, 27)
    const pinDiags = result.diagnostics.filter(
      (d) => d.ruleId === "synthesis.pin-out-of-range",
    );
    expect(pinDiags.length).toBeGreaterThanOrEqual(3);
    const pinMessages = pinDiags.map((d) => d.message).join(" ");
    expect(pinMessages).toContain("Pin 21");
    expect(pinMessages).toContain("Pin 22");
    expect(pinMessages).toContain("Pin 27");
    expect(pinMessages).toContain("(0-13, A0-A5)");

    // 5. Pin 4 is valid on Uno, so it synthesizes LED on D4 without crashing
    const d4Comp = result.circuit.components.find((c) => c.id === "D1" || c.id === "LED1");
    expect(d4Comp).toBeDefined();
  });

  it("fails loudly when an ESP32 sketch has zero peripherals and only unknown libraries", () => {
    const pureEsp32Sketch = `
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>

WebServer server(80);
Preferences prefs;

void setup() {
  server.begin();
  prefs.begin("my-app", false);
}

void loop() {
  server.handleClient();
}
`;

    const result = synthesizeSketch(pureEsp32Sketch, { boardId: "ARDUINO_UNO_R3" });

    // Zero components synthesized
    expect(result.peripherals.length).toBe(0);

    // Must NOT silently pass — must report unresolved items explaining why
    expect(result.unresolved.length).toBeGreaterThan(0);
    expect(result.unresolved.some((u) => u.includes("Zero peripheral components synthesized"))).toBe(
      true,
    );
    expect(
      result.diagnostics.some((d) => d.ruleId === "synthesis.board-architecture-mismatch"),
    ).toBe(true);
    expect(result.diagnostics.some((d) => d.ruleId === "synthesis.unrecognized-library")).toBe(
      true,
    );
  });

  it("detects single out-of-range pin without crashing CircuitBuilder", () => {
    const invalidPinSketch = `
void setup() {
  pinMode(34, INPUT);
  pinMode(25, OUTPUT);
  digitalWrite(25, HIGH);
}

void loop() {}
`;

    // Must not throw an uncaught Error on U1.D25 / U1.D34
    expect(() => {
      const result = synthesizeSketch(invalidPinSketch, { boardId: "ARDUINO_UNO_R3" });
      expect(result.unresolved.some((u) => u.includes("Pin 25") || u.includes("Pin 34"))).toBe(
        true,
      );
      expect(result.diagnostics.some((d) => d.ruleId === "synthesis.pin-out-of-range")).toBe(true);
    }).not.toThrow();
  });
});
