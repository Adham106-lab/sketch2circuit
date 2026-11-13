/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Milestone 13: 3D Scene-Description Generator Unit Tests.
 * Unit-testable without WebGL or browser APIs.
 */

import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { placeCircuit } from "../src/placer.js";
import { routeCircuit } from "../src/router.js";
import { buildPcbScene3D, eiaColorBands, parseResistanceOhms } from "../src/scene3d.js";

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

  it("calculates accurate 4-band EIA color codes for standard resistors", () => {
    // 220 Ω -> Red, Red, Brown, Gold
    expect(eiaColorBands(220)).toEqual(["#dc2626", "#dc2626", "#78350f", "#eab308"]);
    expect(eiaColorBands("220Ω")).toEqual(["#dc2626", "#dc2626", "#78350f", "#eab308"]);

    // 1 kΩ -> Brown, Black, Red, Gold
    expect(eiaColorBands(1000)).toEqual(["#78350f", "#111827", "#dc2626", "#eab308"]);
    expect(eiaColorBands("1k")).toEqual(["#78350f", "#111827", "#dc2626", "#eab308"]);

    // 4.7 kΩ -> Yellow, Violet, Red, Gold
    expect(eiaColorBands(4700)).toEqual(["#eab308", "#9333ea", "#dc2626", "#eab308"]);
    expect(eiaColorBands("4k7")).toEqual(["#eab308", "#9333ea", "#dc2626", "#eab308"]);

    // 10 kΩ -> Brown, Black, Orange, Gold
    expect(eiaColorBands(10000)).toEqual(["#78350f", "#111827", "#ea580c", "#eab308"]);
    expect(eiaColorBands("10kΩ")).toEqual(["#78350f", "#111827", "#ea580c", "#eab308"]);

    // 22 kΩ -> Red, Red, Orange, Gold
    expect(eiaColorBands(22000)).toEqual(["#dc2626", "#dc2626", "#ea580c", "#eab308"]);
    expect(eiaColorBands("22k")).toEqual(["#dc2626", "#dc2626", "#ea580c", "#eab308"]);

    // 330 Ω -> Orange, Orange, Brown, Gold
    expect(eiaColorBands(330)).toEqual(["#ea580c", "#ea580c", "#78350f", "#eab308"]);

    // 1 MΩ -> Brown, Black, Green, Gold
    expect(eiaColorBands(1000000)).toEqual(["#78350f", "#111827", "#16a34a", "#eab308"]);

    // Undefined fallback -> default 10k
    expect(eiaColorBands(undefined)).toEqual(["#78350f", "#111827", "#ea580c", "#eab308"]);
  });

  it("renders resistor color bands reflecting component.properties.resistance", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const rComp = syn.circuit.components.find((c) => c.id === "R1");
    if (rComp) {
      rComp.properties = { ...rComp.properties, resistance: 220 };
    }
    const plc = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const route = routeCircuit(plc.layout, syn.circuit);
    const scene = buildPcbScene3D(route.layout, syn.circuit);

    const band0 = scene.components.find((c) => c.id === "R1-band-0");
    const band1 = scene.components.find((c) => c.id === "R1-band-1");
    const band2 = scene.components.find((c) => c.id === "R1-band-2");
    const band3 = scene.components.find((c) => c.id === "R1-band-3");

    expect(band0?.material.color).toBe("#dc2626"); // Red (2)
    expect(band1?.material.color).toBe("#dc2626"); // Red (2)
    expect(band2?.material.color).toBe("#78350f"); // Brown (x10^1)
    expect(band3?.material.color).toBe("#eab308"); // Gold (5%)
  });

  it("builds jumper wire as a smooth tube node instead of 16 individual sphere segments", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../../fixtures/sketches/user_multi_peripheral.ino",
    );
    const userCode = fs.readFileSync(fixturePath, "utf-8");
    const syn = synthesizeSketch(userCode, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const routingRes = routeCircuit(placementRes.layout, syn.circuit);
    const scene = buildPcbScene3D(routingRes.layout, syn.circuit);

    // No old 16-sphere chain
    const sphereSegs = scene.components.filter((c) => c.id.includes("-seg-") || c.id.includes("-pt-"));
    expect(sphereSegs.length).toBe(0);

    // Smooth wire tube nodes exist for servo
    const servoWires = scene.components.filter((c) => c.id.includes("SERVO1-srv-wire-"));
    expect(servoWires.length).toBeGreaterThan(0);
    for (const wire of servoWires) {
      expect(wire.kind).toBe("wire");
      expect(wire.geometry?.kind).toBe("tube");
      if (wire.geometry?.kind === "tube") {
        expect(wire.geometry.path.length).toBeGreaterThan(2);
      }
    }
  });
});
