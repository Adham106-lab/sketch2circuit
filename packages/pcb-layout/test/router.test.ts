/**
 * @license Apache-2.0
 * @s2c/pcb-layout — M11 2-Layer Grid Router & Design Rule Check (DRC) Test Suite.
 */

import fs from "node:fs";
import path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { type PcbLayout, PcbLayoutSchema } from "@s2c/pcb-json";
import { describe, expect, it } from "vitest";
import { SAMPLE_SKETCHES } from "../../../src/components/sample-sketches.js";
import {
  ARDUINO_UNO_R3_KEEPOUTS,
  checkDrc,
  placeCircuit,
  pointInPolygon,
  routeCircuit,
  routeLayout,
} from "../src/index.js";

describe("M11 2-Layer Grid Router & DRC Engine", () => {
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

  // 1. Basic Routing on Blink Circuit
  it("routes the canonical Blink circuit with valid PcbLayout schema, traces, and DRC check", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const routingRes = routeCircuit(placementRes.layout, syn.circuit, {
      gridPitchMm: 0.635,
    });

    expect(routingRes.layout).toBeDefined();
    expect(routingRes.routedConnections).toBeGreaterThan(0);
    expect(routingRes.totalTraces).toBeGreaterThan(0);
    expect(routingRes.wirelengthMm).toBeGreaterThan(0);

    // Schema validation
    const parsed = PcbLayoutSchema.safeParse(routingRes.layout);
    expect(parsed.success, "Routed layout complies with PcbLayoutSchema").toBe(true);

    // Traces must have valid coordinates and widths
    for (const trace of routingRes.layout.traces) {
      expect(trace.points.length).toBeGreaterThanOrEqual(2);
      expect(trace.width).toBeGreaterThanOrEqual(routingRes.layout.rules.minTraceWidthMm);
      expect(["top", "bottom"]).toContain(trace.layer);
    }

    // DRC violations must be populated
    expect(routingRes.layout.drc).toBeDefined();
  });

  // 2. Determinism check
  it("is 100% deterministic (routing the same layout twice yields bitwise identical results)", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const run1 = routeCircuit(placementRes.layout, syn.circuit, { gridPitchMm: 0.635 });
    const run2 = routeCircuit(placementRes.layout, syn.circuit, { gridPitchMm: 0.635 });

    expect(JSON.stringify(run1.layout.traces)).toBe(JSON.stringify(run2.layout.traces));
    expect(JSON.stringify(run1.layout.vias)).toBe(JSON.stringify(run2.layout.vias));
    expect(JSON.stringify(run1.layout.drc)).toBe(JSON.stringify(run2.layout.drc));
    expect(run1.wirelengthMm).toBe(run2.wirelengthMm);
  });

  // 3. Keepout avoidance
  it("ensures no routed traces or vias penetrate USB or DC barrel jack keepout zones", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const routed = routeLayout(placementRes.layout, syn.circuit);

    for (const trace of routed.traces) {
      for (const pt of trace.points) {
        for (const ko of ARDUINO_UNO_R3_KEEPOUTS) {
          const inKo = pointInPolygon(pt, ko.polygon);
          expect(
            inKo,
            `Trace point (${pt.x}, ${pt.y}) in net '${trace.netId}' must not be inside keepout '${ko.name}'`,
          ).toBe(false);
        }
      }
    }

    for (const via of routed.vias) {
      for (const ko of ARDUINO_UNO_R3_KEEPOUTS) {
        const inKo = pointInPolygon({ x: via.x, y: via.y }, ko.polygon);
        expect(
          inKo,
          `Via at (${via.x}, ${via.y}) in net '${via.netId}' must not be inside keepout '${ko.name}'`,
        ).toBe(false);
      }
    }
  });

  // 4. DRC: Trace width violation detection
  it("DRC flags traces whose width is below minimum trace width", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const layoutWithNarrowTrace: PcbLayout = {
      ...placementRes.layout,
      traces: [
        {
          id: "TR_FAIL_1",
          netId: "NET_1",
          layer: "top",
          width: 0.1, // 0.1mm is below default 0.254mm
          points: [
            { x: 30, y: 30 },
            { x: 40, y: 30 },
          ],
        },
      ],
    };

    const violations = checkDrc(layoutWithNarrowTrace);
    const widthViolation = violations.find((v) => v.code === "DRC_TRACE_WIDTH");
    expect(widthViolation).toBeDefined();
    expect(widthViolation?.severity).toBe("error");
    expect(widthViolation?.message).toContain("below minimum");
  });

  // 5. DRC: Clearance violation detection (Trace to Trace)
  it("DRC flags clearance violations between different net traces on the same layer", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    // Two parallel traces separated by only 0.1mm (< 0.254mm) on the same layer
    const layoutWithClearanceViolation: PcbLayout = {
      ...placementRes.layout,
      traces: [
        {
          id: "TR_A",
          netId: "NET_A",
          layer: "top",
          width: 0.254,
          points: [
            { x: 30, y: 30 },
            { x: 40, y: 30 },
          ],
        },
        {
          id: "TR_B",
          netId: "NET_B",
          layer: "top",
          width: 0.254,
          points: [
            { x: 30, y: 30.3 }, // centerline distance = 0.3mm; clearance = 0.3 - 0.254 = 0.046mm < 0.254mm
            { x: 40, y: 30.3 },
          ],
        },
      ],
    };

    const violations = checkDrc(layoutWithClearanceViolation);
    const clrViolation = violations.find((v) => v.code === "DRC_CLEARANCE_TRACE_TRACE");
    expect(clrViolation).toBeDefined();
    expect(clrViolation?.severity).toBe("error");
    expect(clrViolation?.message).toContain("Clearance violation");
  });

  // 6. DRC: Board Edge violation detection
  it("DRC flags traces placed outside or too close to board edge", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const layoutWithEdgeViolation: PcbLayout = {
      ...placementRes.layout,
      traces: [
        {
          id: "TR_OUT",
          netId: "NET_OUT",
          layer: "top",
          width: 0.254,
          points: [
            { x: -5, y: -5 }, // Completely outside board outline
            { x: -5, y: 10 },
          ],
        },
      ],
    };

    const violations = checkDrc(layoutWithEdgeViolation);
    const edgeViolation = violations.find((v) => v.code === "DRC_BOARD_EDGE");
    expect(edgeViolation).toBeDefined();
    expect(edgeViolation?.message).toContain("outside board outline");
  });

  // 7. DRC: Keepout violation detection
  it("DRC flags traces penetrating keepout zones", () => {
    const syn = synthesizeSketch(BLINK_CODE, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    // USB keepout is near (0, 31) to (18, 48)
    const layoutWithKeepoutViolation: PcbLayout = {
      ...placementRes.layout,
      traces: [
        {
          id: "TR_KO",
          netId: "NET_KO",
          layer: "top",
          width: 0.254,
          points: [
            { x: 5, y: 38 },
            { x: 10, y: 38 },
          ],
        },
      ],
    };

    const violations = checkDrc(layoutWithKeepoutViolation);
    const koViolation = violations.find((v) => v.code === "DRC_KEEPOUT_HIT");
    expect(koViolation).toBeDefined();
    expect(koViolation?.message).toContain("keepout");
  });

  // 8. Routing on user_multi_peripheral fixture
  it("routes user_multi_peripheral fixture successfully", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../../fixtures/sketches/user_multi_peripheral.ino",
    );
    const userCode = fs.readFileSync(fixturePath, "utf-8");
    const syn = synthesizeSketch(userCode, { boardId: "ARDUINO_UNO_R3" });
    const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);

    const routingRes = routeCircuit(placementRes.layout, syn.circuit, {
      gridPitchMm: 0.635,
    });

    expect(routingRes.layout).toBeDefined();
    expect(routingRes.routedConnections).toBeGreaterThan(0);
    expect(routingRes.totalTraces).toBeGreaterThan(0);
    expect(routingRes.wirelengthMm).toBeGreaterThan(0);

    const parsed = PcbLayoutSchema.safeParse(routingRes.layout);
    expect(parsed.success, "Routed user layout matches schema").toBe(true);
  });

  // 9. Corpus-wide routing completion and DRC report
  it("computes corpus-wide routing completion and DRC metrics for all sketches", () => {
    const fixturePath = path.resolve(
      __dirname,
      "../../../fixtures/sketches/user_multi_peripheral.ino",
    );
    const userCode = fs.readFileSync(fixturePath, "utf-8");

    const allCircuits = [
      ...SAMPLE_SKETCHES.map((s: { id: string; name: string; code: string }) => ({
        id: s.id,
        name: s.name,
        code: s.code,
      })),
      {
        id: "user_multi_peripheral",
        name: "12. User Multi-Peripheral Sketch",
        code: userCode,
      },
    ];

    const report: Record<string, unknown> = {};

    for (const item of allCircuits) {
      const syn = synthesizeSketch(item.code, { boardId: "ARDUINO_UNO_R3" });
      const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      const totalConns = placementRes.layout.unrouted?.length ?? 0;

      const routingRes = routeCircuit(placementRes.layout, syn.circuit, {
        gridPitchMm: 0.635,
      });

      const drcErrorsByType: Record<string, number> = {};
      for (const v of routingRes.layout.drc ?? []) {
        if (v.code === "DRC_UNROUTED_CONNECTION") continue; // track separately
        drcErrorsByType[v.code] = (drcErrorsByType[v.code] || 0) + 1;
      }

      const totalDrcErrors = Object.values(drcErrorsByType).reduce((a, b) => a + b, 0);
      const completionRate =
        totalConns > 0
          ? Number(((routingRes.routedConnections / totalConns) * 100).toFixed(1))
          : 100;

      report[item.id] = {
        name: item.name,
        totalConnections: totalConns,
        routedConnections: routingRes.routedConnections,
        unroutedConnections: routingRes.unroutedConnections,
        completionRatePercent: completionRate,
        totalTraces: routingRes.totalTraces,
        totalVias: routingRes.totalVias,
        wirelengthMm: routingRes.wirelengthMm,
        drcErrorCount: totalDrcErrors,
        drcErrorsByType,
      };
    }

    console.log("=== CORPUS ROUTING COMPLETION REPORT ===");
    console.log(JSON.stringify(report, null, 2));

    const goldenPath = path.resolve(__dirname, "routing-metrics.golden.json");
    fs.writeFileSync(goldenPath, JSON.stringify(report, null, 2), "utf-8");
    expect(fs.existsSync(goldenPath)).toBe(true);
  });
});
