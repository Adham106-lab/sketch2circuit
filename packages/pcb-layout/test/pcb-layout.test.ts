/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Comprehensive test suite for deterministic PCB placement & ratsnest.
 */

import fs from "node:fs";
import path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import type { Circuit } from "@s2c/circuit-json";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE, getFootprintDefinition } from "@s2c/footprints";
import { PcbLayoutSchema } from "@s2c/pcb-json";
import { describe, expect, it } from "vitest";
import { SAMPLE_SKETCHES } from "../../../src/components/sample-sketches.js";
import {
  ARDUINO_UNO_R3_KEEPOUTS,
  isPolygonContained,
  placeCircuit,
  polygonsIntersect,
  resolvePartAndFootprint,
  transformPolygon,
} from "../src/index.js";

describe("M10 Deterministic PCB Placement & Layout Engine", () => {
  const BLINK_CODE = `
    const int ledPin = 13;
    void setup() {
      pinMode(ledPin, OUTPUT);
    }
    void loop() {
      digitalWrite(ledPin, HIGH);
      delay(1000);
      digitalWrite(ledPin, LOW);
      delay(1000);
    }
  `;

  const POT_CODE = `
    const int potPin = A0;
    const int ledPin = 9;
    void setup() {
      pinMode(ledPin, OUTPUT);
    }
    void loop() {
      int val = analogRead(potPin);
      analogWrite(ledPin, val / 4);
    }
  `;

  it("places the canonical Blink circuit on an Arduino Uno R3 shield", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    expect(syn.circuit.components.length).toBeGreaterThanOrEqual(3); // Uno, Resistor, LED

    const result = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    expect(result.placedCount).toBe(syn.circuit.components.length);
    expect(result.unplacedCount).toBe(0);
    expect(result.metrics.edgeCount).toBeGreaterThan(0);
    expect(result.metrics.totalWirelengthMm).toBeGreaterThan(0);

    // Validate layout passes zod schema
    const parseResult = PcbLayoutSchema.safeParse(result.layout);
    expect(parseResult.success, JSON.stringify(parseResult)).toBe(true);
  });

  it("is 100% deterministic (calling placer twice produces identical JSON)", () => {
    const syn = synthesizeSketch(POT_CODE, { boardId: "ARDUINO_UNO_R3" });

    const run1 = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const run2 = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    expect(JSON.stringify(run1.layout)).toBe(JSON.stringify(run2.layout));
    expect(run1.metrics.totalWirelengthMm).toBe(run2.metrics.totalWirelengthMm);
    expect(run1.metrics.edgeCount).toBe(run2.metrics.edgeCount);
  });

  it("ensures no discrete components intersect USB or DC barrel jack keepout zones", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const result = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    for (const pl of result.layout.placements) {
      if (pl.footprintId === "module:arduino-uno-r3") continue;

      const fp = getFootprintDefinition(pl.footprintId);
      expect(fp).toBeDefined();
      if (!fp) continue;

      const worldCourtyard = transformPolygon(fp.courtyard, pl.x, pl.y, pl.rotation);
      for (const ko of ARDUINO_UNO_R3_KEEPOUTS) {
        const overlaps = polygonsIntersect(worldCourtyard, ko.polygon);
        expect(
          overlaps,
          `Component '${pl.componentId}' at (${pl.x}, ${pl.y}) overlaps keepout '${ko.name}'`,
        ).toBe(false);
      }
    }
  });

  it("ensures no discrete components have overlapping courtyards", () => {
    const syn = synthesizeSketch(POT_CODE, { boardId: "ARDUINO_UNO_R3" });
    const result = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const discretePlacements = result.layout.placements.filter(
      (p) => p.footprintId !== "module:arduino-uno-r3",
    );

    for (let i = 0; i < discretePlacements.length; i++) {
      for (let j = i + 1; j < discretePlacements.length; j++) {
        const plA = discretePlacements[i];
        const plB = discretePlacements[j];
        if (!plA || !plB) continue;

        const fpA = getFootprintDefinition(plA.footprintId);
        const fpB = getFootprintDefinition(plB.footprintId);
        expect(fpA).toBeDefined();
        expect(fpB).toBeDefined();
        if (!fpA || !fpB) continue;

        const polyA = transformPolygon(fpA.courtyard, plA.x, plA.y, plA.rotation);
        const polyB = transformPolygon(fpB.courtyard, plB.x, plB.y, plB.rotation);

        const overlaps = polygonsIntersect(polyA, polyB);
        expect(
          overlaps,
          `Component '${plA.componentId}' and '${plB.componentId}' have overlapping courtyards!`,
        ).toBe(false);
      }
    }
  });

  it("ensures all placed discrete components are inside the board outline", () => {
    const syn = synthesizeSketch(POT_CODE, { boardId: "ARDUINO_UNO_R3" });
    const result = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const discretePlacements = result.layout.placements.filter(
      (p) => p.footprintId !== "module:arduino-uno-r3",
    );

    for (const pl of discretePlacements) {
      const fp = getFootprintDefinition(pl.footprintId);
      expect(fp).toBeDefined();
      if (!fp) continue;

      const poly = transformPolygon(fp.courtyard, pl.x, pl.y, pl.rotation);
      const isInside = isPolygonContained(poly, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      expect(
        isInside,
        `Component '${pl.componentId}' at (${pl.x}, ${pl.y}) extends outside shield outline`,
      ).toBe(true);
    }
  });

  it("computes ratsnest edges and positive MST wirelength", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const result = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    expect(result.metrics.edges.length).toBeGreaterThanOrEqual(2);
    for (const edge of result.metrics.edges) {
      expect(edge.lengthMm).toBeGreaterThan(0);
      expect(edge.fromPad).toBeDefined();
      expect(edge.toPad).toBeDefined();
      expect(edge.fromPoint).toBeDefined();
      expect(edge.toPoint).toBeDefined();
    }
  });

  // (a) Test that placed + unplaced === components.length on every corpus circuit
  it("verifies placed + unplaced === components.length on every corpus circuit", () => {
    for (const sample of SAMPLE_SKETCHES) {
      const syn = synthesizeSketch(sample.code, { boardId: "ARDUINO_UNO_R3" });
      const totalComps = syn.circuit.components.length;
      const res = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

      expect(
        res.placedCount + res.unplacedCount,
        `Conservation of components failed for sketch '${sample.id}'`,
      ).toBe(totalComps);

      expect(res.layout.placements.length).toBe(res.placedCount);
      expect(res.unplacedCount).toBe(0);
    }
  });

  // Test that unknown parts or missing footprints never silently fall back to headers
  it("rejects unknown parts or missing footprints to unplaced with diagnostic without falling back to headers", () => {
    const fakeCircuit = {
      id: "test_unknown_part",
      name: "Test Unknown Part",
      components: [
        {
          id: "U1",
          name: "Arduino Uno",
          kind: "mcu",
          partNumber: "ARDUINO_UNO_R3",
          ports: [{ id: "U1.D2", name: "D2", kind: "io" }],
        },
        {
          id: "X_UNKNOWN",
          name: "Mystery Gizmo",
          kind: "unknown_gizmo_type",
          ports: [{ id: "X_UNKNOWN.1", name: "1", kind: "passive" }],
        },
      ],
      nets: [{ id: "N1", name: "NET1", portIds: ["U1.D2", "X_UNKNOWN.1"] }],
    } as unknown as Circuit;
    const res = placeCircuit(fakeCircuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    expect(res.unplacedCount).toBe(1);
    expect(res.layout.unplaced).toContain("X_UNKNOWN");
    expect(res.layout.placements.some((p) => p.componentId === "X_UNKNOWN")).toBe(false);
    const diag = res.layout.drc.find((v) => v.componentId === "X_UNKNOWN");
    expect(diag).toBeDefined();
    expect(diag?.code).toBe("ERR_UNPLACED_NO_FOOTPRINT");
    expect(diag?.message).toContain("X_UNKNOWN");
    expect(diag?.message).toContain("unknown_gizmo_type");
  });

  // (b) Placement on exact multi-peripheral sketch:
  // buttons D2/D3, LEDs D4/D5, motor D6, buzzer D7, servo D9, pot A0, LDR A1
  it("places exact multi-peripheral sketch from user fixture with verified 3-pin footprints and zero keepout hits", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../../fixtures/sketches/user_multi_peripheral.ino",
    );
    expect(fs.existsSync(fixturePath), "user_multi_peripheral.ino fixture exists").toBe(true);
    const userCode = fs.readFileSync(fixturePath, "utf-8");

    const syn = synthesizeSketch(userCode, { boardId: "ARDUINO_UNO_R3" });
    const totalComps = syn.circuit.components.length;
    expect(totalComps).toBe(16);

    const res = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    expect(res.placedCount).toBe(totalComps);
    expect(res.unplacedCount).toBe(0);
    expect(res.metrics.totalWirelengthMm).toBeGreaterThan(0);
    expect(res.metrics.edgeCount).toBeGreaterThan(0);

    const placements = res.layout.placements;

    // Verify Footprint Audit:
    // POT1 must resolve to 3-pin rotary potentiometer, NOT 2-pin header
    const potPlacement = placements.find((p) => p.componentId === "POT1");
    expect(potPlacement).toBeDefined();
    expect(potPlacement?.footprintId).toBe("pot:3-pin-rotary");
    const potFp = getFootprintDefinition(potPlacement!.footprintId);
    expect(potFp?.pads.length).toBe(3);

    // SERVO1 must resolve to 3-pin header, NOT 2-pin header
    const servoPlacement = placements.find((p) => p.componentId === "SERVO1");
    expect(servoPlacement).toBeDefined();
    expect(servoPlacement?.footprintId).toBe("header:3-pin-0.1in");
    const servoFp = getFootprintDefinition(servoPlacement!.footprintId);
    expect(servoFp?.pads.length).toBe(3);

    // C_DECOUPLING must resolve to ceramic disc capacitor (0.1in pitch)
    const capPlacement = placements.find((p) => p.componentId === "C_DECOUPLING");
    expect(capPlacement).toBeDefined();
    expect(capPlacement?.footprintId).toBe("capacitor:radial-0.1in");

    // Assert SPK1 always has an associated ~100 ohm series current-limiting resistor in its driving net
    const spkComp = syn.circuit.components.find((c) => c.id === "SPK1");
    expect(spkComp).toBeDefined();
    const spkPosNet = syn.circuit.nets.find((n) => n.portIds.includes("SPK1.+"));
    expect(spkPosNet, "SPK1.+ has a driving net").toBeDefined();
    const buzzerResistorPort = spkPosNet?.portIds.find((p) => p !== "SPK1.+");
    expect(buzzerResistorPort).toBeDefined();
    const buzzerResId = buzzerResistorPort?.split(".")[0];
    const buzzerResComp = syn.circuit.components.find((c) => c.id === buzzerResId);
    expect(buzzerResComp?.kind).toBe("resistor");
    expect(buzzerResComp?.value).toBe("100Ω");

    // Assert buttons use internal pullup: SW1 and SW2 connect directly between MCU pin and GND (no external pullup resistors)
    const sw1PinNet = syn.circuit.nets.find((n) => n.portIds.includes("SW1.1"));
    expect(sw1PinNet?.portIds).toEqual(["SW1.1", "U1.D2"]);
    const sw2PinNet = syn.circuit.nets.find((n) => n.portIds.includes("SW2.1"));
    expect(sw2PinNet?.portIds).toEqual(["SW2.1", "U1.D3"]);

    // Assert LED resistors are 300Ω per E24 series calculation (5V - 2.0V @ 10mA)
    const r1 = syn.circuit.components.find((c) => c.id === "R1");
    const r2 = syn.circuit.components.find((c) => c.id === "R2");
    expect(r1?.value).toBe("300Ω");
    expect(r2?.value).toBe("300Ω");

    // Check keepout hits
    for (const p of placements) {
      if (p.footprintId === "module:arduino-uno-r3") continue;
      const fp = getFootprintDefinition(p.footprintId);
      expect(fp).toBeDefined();
      if (!fp) continue;

      const poly = transformPolygon(fp.courtyard, p.x, p.y, p.rotation);
      for (const ko of ARDUINO_UNO_R3_KEEPOUTS) {
        const hit = polygonsIntersect(poly, ko.polygon);
        expect(hit, `Component '${p.componentId}' overlaps keepout '${ko.name}'`).toBe(false);
      }
    }

    // Check courtyard overlaps
    for (let i = 0; i < placements.length; i++) {
      if (placements[i]?.footprintId === "module:arduino-uno-r3") continue;
      const fpA = getFootprintDefinition(placements[i]!.footprintId);
      if (!fpA) continue;
      const polyA = transformPolygon(
        fpA.courtyard,
        placements[i]!.x,
        placements[i]!.y,
        placements[i]!.rotation,
      );

      for (let j = i + 1; j < placements.length; j++) {
        if (placements[j]?.footprintId === "module:arduino-uno-r3") continue;
        const fpB = getFootprintDefinition(placements[j]!.footprintId);
        if (!fpB) continue;
        const polyB = transformPolygon(
          fpB.courtyard,
          placements[j]!.x,
          placements[j]!.y,
          placements[j]!.rotation,
        );

        const overlap = polygonsIntersect(polyA, polyB);
        expect(
          overlap,
          `Courtyard overlap between '${placements[i]!.componentId}' and '${placements[j]!.componentId}'`,
        ).toBe(false);
      }
    }
  });

  // Circuit-level invariant test: every port referenced by any net resolves to an existing pad, and ports without pad === 0
  it("enforces circuit-level invariant: every port referenced by any net resolves to an existing pad, and ports without pad === 0", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../../fixtures/sketches/user_multi_peripheral.ino",
    );
    const userCode = fs.readFileSync(fixturePath, "utf-8");
    const allCircuits = [
      ...SAMPLE_SKETCHES.map((s) => ({ id: s.id, code: s.code })),
      { id: "user_multi_peripheral", code: userCode },
    ];

    for (const testCase of allCircuits) {
      const syn = synthesizeSketch(testCase.code, { boardId: "ARDUINO_UNO_R3" });
      const res = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      const fpMap = new Map();
      for (const fp of res.layout.footprints) fpMap.set(fp.id, fp);

      const compMap = new Map(syn.circuit.components.map((c) => [c.id, c]));
      const plMap = new Map(res.layout.placements.map((p) => [p.componentId, p]));

      let portsWithoutPad = 0;
      const unresolvablePorts: string[] = [];

      for (const net of syn.circuit.nets) {
        for (const portId of net.portIds ?? []) {
          const [compId, portName] = portId.split(".");
          const comp = compMap.get(compId);
          expect(comp, `Component '${compId}' in net '${net.id}' exists in circuit`).toBeDefined();
          if (!comp) {
            portsWithoutPad++;
            continue;
          }

          const pl = plMap.get(compId);
          expect(pl, `Component '${compId}' is placed on board`).toBeDefined();
          if (!pl) {
            portsWithoutPad++;
            continue;
          }

          const fp = fpMap.get(pl.footprintId);
          expect(fp, `Footprint '${pl.footprintId}' for '${compId}' exists`).toBeDefined();
          if (!fp) {
            portsWithoutPad++;
            continue;
          }

          const { pinMap } = resolvePartAndFootprint(comp);
          expect(
            pinMap,
            `Component '${compId}' (${comp.partNumber ?? comp.kind}) must have an explicit pinMap entry`,
          ).toBeDefined();

          const padNumber = pinMap?.[portName];
          if (!padNumber) {
            portsWithoutPad++;
            unresolvablePorts.push(
              `${portId} (missing explicit pinMap entry for port "${portName}")`,
            );
            continue;
          }

          const padExists = fp.pads.some((p: { number: string }) => p.number === padNumber);
          if (!padExists) {
            portsWithoutPad++;
            unresolvablePorts.push(`${portId} -> pad "${padNumber}" in ${fp.id}`);
          }
        }
      }

      expect(
        portsWithoutPad,
        `Circuit '${testCase.id}' has unresolvable ports: ${unresolvablePorts.join(", ")}`,
      ).toBe(0);
    }
  });

  // Multi-pad terminal test with tactile switch:
  it("treats multi-pad tactile switch terminals as single electrical node with zero internal edges, connecting nearest pad", () => {
    const buttonSample = SAMPLE_SKETCHES.find((s) => s.id === "button_pullup")!;
    const syn = synthesizeSketch(buttonSample.code, { boardId: "ARDUINO_UNO_R3" });
    const res = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const swPlacement = res.layout.placements.find((p) => p.componentId === "SW1");
    expect(swPlacement).toBeDefined();

    const swFp = getFootprintDefinition("button:tact-6mm")!;
    expect(swFp.pads.length).toBe(4);
    const pad1s = swFp.pads.filter((p) => p.number === "1");
    const pad2s = swFp.pads.filter((p) => p.number === "2");
    expect(pad1s.length).toBe(2);
    expect(pad2s.length).toBe(2);

    // Verify in ratsnest: NO edge connects SW1 pad 1 to SW1 pad 1, nor SW1 pad 2 to SW1 pad 2
    for (const edge of res.metrics.edges) {
      const isInternal1 = edge.fromPad.startsWith("SW1.1") && edge.toPad.startsWith("SW1.1");
      const isInternal2 = edge.fromPad.startsWith("SW1.2") && edge.toPad.startsWith("SW1.2");
      expect(isInternal1, "No internal MST edge between SW1.1 pads").toBe(false);
      expect(isInternal2, "No internal MST edge between SW1.2 pads").toBe(false);
    }

    // Verify external edge connects to SW1
    const d2Edge = res.metrics.edges.find(
      (e) =>
        (e.fromPad.startsWith("SW1.1") && e.toPad === "U1.D2") ||
        (e.toPad.startsWith("SW1.1") && e.fromPad === "U1.D2"),
    );
    expect(d2Edge).toBeDefined();
  });

  // Cluster placement quality in Blink: R1 to D1 under 15 mm
  it("ensures cluster placement quality in Blink: R1 to D1 is under 15 mm", () => {
    const blinkSample = SAMPLE_SKETCHES.find((s) => s.id === "blink")!;
    const syn = synthesizeSketch(blinkSample.code, { boardId: "ARDUINO_UNO_R3" });
    const res = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const r1 = res.layout.placements.find((p) => p.componentId === "R1")!;
    const d1 = res.layout.placements.find((p) => p.componentId === "D1")!;
    expect(r1).toBeDefined();
    expect(d1).toBeDefined();

    const distMm = Math.hypot(r1.x - d1.x, r1.y - d1.y);
    expect(distMm).toBeLessThan(15.0);
  });

  // (c) Compare ratsnest metrics against golden file (all corpus sketches plus user_multi_peripheral)
  it("matches golden file ratsnest metrics for all corpus sketches plus user_multi_peripheral", () => {
    const goldenPath = path.resolve(__dirname, "ratsnest-metrics.golden.json");
    expect(fs.existsSync(goldenPath)).toBe(true);
    const goldenData = JSON.parse(fs.readFileSync(goldenPath, "utf-8")) as Record<
      string,
      {
        componentCount: number;
        placedCount: number;
        unplacedCount: number;
        edgeCount: number;
        totalWirelengthMm: number;
      }
    >;

    const fixturePath = path.resolve(
      __dirname,
      "../../../fixtures/sketches/user_multi_peripheral.ino",
    );
    const userCode = fs.readFileSync(fixturePath, "utf-8");
    const allCircuits = [
      ...SAMPLE_SKETCHES.map((s) => ({ id: s.id, code: s.code })),
      { id: "user_multi_peripheral", code: userCode },
    ];

    for (const sample of allCircuits) {
      const expected = goldenData[sample.id];
      expect(expected, `Golden metrics exist for '${sample.id}'`).toBeDefined();
      if (!expected) continue;

      const syn = synthesizeSketch(sample.code, { boardId: "ARDUINO_UNO_R3" });
      const res = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

      expect(syn.circuit.components.length).toBe(expected.componentCount);
      expect(res.placedCount).toBe(expected.placedCount);
      expect(res.unplacedCount).toBe(expected.unplacedCount);
      expect(res.metrics.edgeCount).toBe(expected.edgeCount);
      expect(res.metrics.totalWirelengthMm).toBeCloseTo(expected.totalWirelengthMm, 1);
    }
  });
});
