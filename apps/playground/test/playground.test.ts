import { synthesizeSketch } from "@s2c/arduino";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SimulationTab } from "../../../src/components/SimulationTab.js";

const SERVO_SKETCH = `
#include <Servo.h>
Servo myServo;
void setup() {
  myServo.attach(9);
}
void loop() {
  myServo.write(90);
  delay(1000);
}
`;

describe("@s2c/playground scaffolding and SimulationTab rendering", () => {
  it("initializes playground module test suite", () => {
    expect(true).toBe(true);
  });

  it("renders SimulationTab with circuit presets and displays SVG and disclaimers", () => {
    const syn = synthesizeSketch(SERVO_SKETCH, { boardId: "ARDUINO_UNO_R3" });
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(SimulationTab, {
        circuit: syn.circuit,
        sketchName: "Servo Sweep",
      }),
    );

    // Verify key UI elements are rendered
    expect(html).toContain("In-Browser Simulation Engine");
    expect(html).toContain("<svg");
    expect(html).toContain("Capacitor Transient Step Response");
    expect(html).toContain("M17 NUMERIC SOLVER (RK4 &amp; RKF45)");
    expect(html).toContain("Illustrative model");

    console.log("=== RENDERED DOM / SVG OUTPUT FROM SIMULATION TAB ===");
    console.log(html);
  });
});

