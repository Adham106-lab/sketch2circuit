/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Milestone 13: 3D Scene-Description Generator Unit Tests.
 * Unit-testable without WebGL or browser APIs.
 */

import fs from "fs";
import path from "path";
import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { describe, expect, it } from "vitest";
import { placeCircuit } from "../src/placer.js";
import { routeCircuit } from "../src/router.js";
import { buildPcbScene3D } from "../src/scene3d.js";

const BLINK_CODE = `
const int ledPin = 13;
void setup() { pinMode(ledPin, OUTPUT); }
void loop() {
  digitalWrite(ledPin, HIGH);
  delay(1000);
  digitalWrite(ledPin, LOW);
  delay(1000);
}
`;

describe("M13 Pure 3D Scene-Description Generator", () => {
  it("generates a valid 3D scene description for Blink circuit without WebGL", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const routingRes = routeCircuit(placementRes.layout, syn.circuit);

    const scene = buildPcbScene3D(routingRes.layout, syn.circuit);

    // 1. Metadata checks
    expect(scene.metadata).toBeDefined();
    expect(scene.metadata.title).toBe("3D PCB Scene Representation");
    expect(scene.metadata.thicknessMm).toBe(1.6);
    expect(scene.metadata.boardWidthMm).toBeGreaterThan(60);
    expect(scene.metadata.boardHeightMm).toBeGreaterThan(50);
    expect(scene.metadata.componentCount).toBe(syn.circuit.components.length);
    expect(scene.metadata.totalNodeCount).toBeGreaterThan(10);

    // 2. Board Slab Substrate
    expect(scene.board).toBeDefined();
    expect(scene.board.id).toBe("pcb-substrate-slab");
    expect(scene.board.geometry?.kind).toBe("extruded-polygon");
    if (scene.board.geometry?.kind === "extruded-polygon") {
      expect(scene.board.geometry.polygon.length).toBe(13); // Uno shield outline
      expect(scene.board.geometry.depth).toBe(1.6);
      expect(scene.board.geometry.holes?.length).toBe(4); // 4 mounting holes
    }

    // 3. Traces
    expect(scene.traces.length).toBe(routingRes.layout.traces.length);
    for (const t of scene.traces) {
      expect(t.geometry?.kind).toBe("tube");
      expect(t.material.metalness).toBeGreaterThan(0.5);
    }

    // 4. Vias
    expect(scene.vias.length).toBe(routingRes.layout.vias.length * 2); // Ring + drill cavity

    // 5. Pads
    expect(scene.pads.length).toBeGreaterThan(0);
    for (const p of scene.pads) {
      expect(p.material.color).toBeDefined();
    }

    // 6. Components 3D bodies
    expect(scene.components.length).toBeGreaterThan(0);
    const ledDome = scene.components.find((c) => c.id.includes("D1-dome"));
    expect(ledDome, "LED D1 dome mesh generated").toBeDefined();
    expect(ledDome?.material.transparent).toBe(true);
  });

  it("generates complete 3D scene description for user_multi_peripheral benchmark", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../../fixtures/sketches/user_multi_peripheral.ino",
    );
    const userCode = fs.readFileSync(fixturePath, "utf-8");
    const syn = synthesizeSketch(userCode, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const routingRes = routeCircuit(placementRes.layout, syn.circuit);

    const scene = buildPcbScene3D(routingRes.layout, syn.circuit);

    // Component meshes exist for all peripheral types
    const ids = scene.components.map((c) => c.id);

    // Pushbuttons
    expect(ids.some((id) => id.includes("SW1"))).toBe(true);
    expect(ids.some((id) => id.includes("SW2"))).toBe(true);

    // LEDs
    expect(ids.some((id) => id.includes("D1-dome"))).toBe(true);
    expect(ids.some((id) => id.includes("D2-dome"))).toBe(true);

    // Servo Header
    expect(ids.some((id) => id.includes("SERVO1"))).toBe(true);

    // Capacitors (Can + Decoupling)
    expect(ids.some((id) => id.includes("C_SERVO1"))).toBe(true);
    expect(ids.some((id) => id.includes("C_DECOUPLING"))).toBe(true);

    // Resistors
    expect(ids.some((id) => id.includes("R1"))).toBe(true);
    expect(ids.some((id) => id.includes("R2"))).toBe(true);

    // Potentiometer
    expect(ids.some((id) => id.includes("POT1"))).toBe(true);

    // Buzzer / Motor
    expect(ids.some((id) => id.includes("SPK1"))).toBe(true);
    expect(ids.some((id) => id.includes("M1"))).toBe(true);

    // Serialization: JSON.stringify must succeed cleanly without circular references
    const jsonStr = JSON.stringify(scene);
    expect(jsonStr.length).toBeGreaterThan(10000);
    const parsed = JSON.parse(jsonStr);
    expect(parsed.metadata.componentCount).toBe(16);
    expect(parsed.metadata.traceCount).toBe(routingRes.layout.traces.length);
  });
});
