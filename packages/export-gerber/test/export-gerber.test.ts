/**
 * @license Apache-2.0
 * @s2c/export-gerber — Test suite for 2-layer RS-274X Gerber and Excellon drill export.
 */

import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { placeCircuit, routeCircuit } from "@s2c/pcb-layout";
import { describe, expect, it } from "vitest";
import { exportGerber } from "../src/index.js";

describe("M20a: RS-274X Gerber & Excellon Drill Export", () => {
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

  const HC_SR04_CODE = `
    const int trigPin = 9;
    const int echoPin = 10;
    const int ledPin = 13;
    void setup() {
      pinMode(trigPin, OUTPUT);
      pinMode(echoPin, INPUT);
      pinMode(ledPin, OUTPUT);
    }
    void loop() {
      digitalWrite(trigPin, LOW);
      delayMicroseconds(2);
      digitalWrite(trigPin, HIGH);
      delayMicroseconds(10);
      digitalWrite(trigPin, LOW);
      long duration = pulseIn(echoPin, HIGH);
      if (duration < 1000) {
        digitalWrite(ledPin, HIGH);
      } else {
        digitalWrite(ledPin, LOW);
      }
    }
  `;

  function buildTestLayout(code: string) {
    const syn = synthesizeSketch(code, { boardId: "ARDUINO_UNO_R3" });
    const placed = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const routed = routeCircuit(placed.layout, syn.circuit, { gridPitchMm: 0.635 });
    return routed.layout;
  }

  // Helper to validate standard Ucamco RS-274X syntax
  function validateGerberSyntax(content: string, layerName: string) {
    expect(content).toContain(`G04 Layer: ${layerName}`);
    expect(content).toContain("%FSLAX46Y46*%"); // Ucamco §4.1 Format Specification
    expect(content).toContain("%MOMM*%"); // Ucamco §4.2 Unit (mm)
    expect(content).toContain("%IPPOS*%"); // Image Polarity
    expect(content).toContain("G01*"); // Linear interpolation mode
    expect(content).toMatch(/%ADD\d+[CRO],/); // Ucamco §4.3 Aperture definitions
    expect(content).toMatch(/D\d+\*/); // Ucamco §4.4 Aperture selection
    expect(content.trim().endsWith("M02*")).toBe(true); // Ucamco §4.7 End of file
  }

  // Helper to validate standard Excellon NC drill syntax
  function validateExcellonSyntax(content: string) {
    expect(content).toContain("M48"); // Header start
    expect(content).toContain("METRIC,TZ"); // Metric units
    expect(content).toMatch(/T01C\d+\.\d{3}/); // Tool definitions
    expect(content).toContain("%"); // Header end
    expect(content).toContain("G90"); // Absolute mode
    expect(content).toContain("G05"); // Drill mode
    expect(content).toMatch(/X\d+\.\d{3}Y\d+\.\d{3}/); // Coordinates
    expect(content.trim().endsWith("M30")).toBe(true); // End of drill program
  }

  // Test 1: Canonical Blink Circuit
  it("exports Corpus 1 (Blink Circuit) to full 8-file Gerber & drill set", () => {
    const layout = buildTestLayout(BLINK_CODE);
    const result = exportGerber(layout, { boardName: "blink" });

    // Verify all 8 standard files exist
    expect(Object.keys(result.files).sort()).toEqual([
      "blink.drl",
      "blink.gbl",
      "blink.gbo",
      "blink.gbs",
      "blink.gko",
      "blink.gtl",
      "blink.gto",
      "blink.gts",
    ]);

    // Verify Gerber syntax on all layers
    validateGerberSyntax(result.topCopper, "Top Copper (GTL)");
    validateGerberSyntax(result.bottomCopper, "Bottom Copper (GBL)");
    validateGerberSyntax(result.topSoldermask, "Top Soldermask (GTS)");
    validateGerberSyntax(result.bottomSoldermask, "Bottom Soldermask (GBS)");
    validateGerberSyntax(result.topSilkscreen, "Top Silkscreen (GTO)");
    validateGerberSyntax(result.boardOutline, "Board Outline (GKO)");

    // Verify Excellon drill syntax
    validateExcellonSyntax(result.drill);

    // Verify metrics
    expect(result.metrics.topCopperTraceCount).toBeGreaterThan(0);
    expect(result.metrics.topPadCount).toBeGreaterThan(0);
    expect(result.metrics.drillHoleCount).toBeGreaterThan(0);
    expect(result.metrics.aperturesDefinedTopCopper).toBeGreaterThan(0);
  });

  // Test 2: Potentiometer Circuit
  it("exports Corpus 2 (Potentiometer Circuit) to full 8-file Gerber & drill set", () => {
    const layout = buildTestLayout(POT_CODE);
    const result = exportGerber(layout, { boardName: "pot" });

    expect(Object.keys(result.files).sort()).toEqual([
      "pot.drl",
      "pot.gbl",
      "pot.gbo",
      "pot.gbs",
      "pot.gko",
      "pot.gtl",
      "pot.gto",
      "pot.gts",
    ]);

    validateGerberSyntax(result.topCopper, "Top Copper (GTL)");
    validateGerberSyntax(result.bottomCopper, "Bottom Copper (GBL)");
    validateGerberSyntax(result.topSoldermask, "Top Soldermask (GTS)");
    validateGerberSyntax(result.boardOutline, "Board Outline (GKO)");
    validateExcellonSyntax(result.drill);

    expect(result.metrics.topPadCount).toBeGreaterThanOrEqual(10);
    expect(result.metrics.drillHoleCount).toBeGreaterThanOrEqual(10);
  });

  // Test 3: HC-SR04 Ultrasonic Sensor Circuit
  it("exports Corpus 3 (HC-SR04 Circuit) to full 8-file Gerber & drill set", () => {
    const layout = buildTestLayout(HC_SR04_CODE);
    const result = exportGerber(layout, { boardName: "hc_sr04" });

    expect(Object.keys(result.files).sort()).toEqual([
      "hc_sr04.drl",
      "hc_sr04.gbl",
      "hc_sr04.gbo",
      "hc_sr04.gbs",
      "hc_sr04.gko",
      "hc_sr04.gtl",
      "hc_sr04.gto",
      "hc_sr04.gts",
    ]);

    validateGerberSyntax(result.topCopper, "Top Copper (GTL)");
    validateGerberSyntax(result.bottomCopper, "Bottom Copper (GBL)");
    validateGerberSyntax(result.boardOutline, "Board Outline (GKO)");
    validateExcellonSyntax(result.drill);

    expect(result.metrics.topPadCount).toBeGreaterThanOrEqual(12);
    expect(result.metrics.drillHoleCount).toBeGreaterThanOrEqual(12);
  });
});
