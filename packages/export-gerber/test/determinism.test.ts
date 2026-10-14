/**
 * @license Apache-2.0
 * @s2c/export-gerber — Determinism test suite.
 * Asserts that the same PcbLayout input yields byte-identical Gerber and drill output files.
 */

import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { placeCircuit, routeCircuit } from "@s2c/pcb-layout";
import { describe, expect, it } from "vitest";
import { exportGerber } from "../src/index.js";

describe("M20a: Determinism of Gerber & Drill Export", () => {
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

  it("produces byte-identical output across repeated exports of the same PcbLayout", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placed = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const routed = routeCircuit(placed.layout, syn.circuit, { gridPitchMm: 0.635 });

    // Run export 3 separate times
    const run1 = exportGerber(routed.layout, { boardName: "test_board" });
    const run2 = exportGerber(routed.layout, { boardName: "test_board" });
    const run3 = exportGerber(routed.layout, { boardName: "test_board" });

    // 1. Files dictionary keys match exactly
    expect(Object.keys(run1.files).sort()).toEqual(Object.keys(run2.files).sort());
    expect(Object.keys(run1.files).sort()).toEqual(Object.keys(run3.files).sort());

    // 2. Every single file must be byte-for-byte identical across runs
    for (const [filename, content1] of Object.entries(run1.files)) {
      const content2 = run2.files[filename];
      const content3 = run3.files[filename];

      expect(content1).toBe(content2);
      expect(content1).toBe(content3);

      // Verify length and exact string equality
      expect(content1.length).toBeGreaterThan(0);
      expect(typeof content2).toBe("string");
      expect(Buffer.from(content1, "utf-8").equals(Buffer.from(content2 ?? "", "utf-8"))).toBe(
        true,
      );
    }

    // 3. Metrics are identical
    expect(run1.metrics).toEqual(run2.metrics);
    expect(run1.metrics).toEqual(run3.metrics);
  });
});
