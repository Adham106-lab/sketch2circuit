import { describe, expect, it } from "vitest";
import {
  buildNetCentricIndex,
  createBus,
  createLogicalNet,
  emitLogicalNetFromASTCall,
  isBipartiteNetGraph,
} from "../src/net-graph.js";
import { parseCircuit } from "../src/schema.js";
import type { Circuit } from "../src/types.js";

describe("Strict Bipartite Net-Centric Graph & Provenance (Task 1)", () => {
  it("creates and parses a circuit with logical nets, buses, and provenance", () => {
    const circuit: Circuit = {
      schemaVersion: "0.1.0",
      name: "Bipartite I2C & GPIO Circuit",
      components: [
        {
          id: "U1",
          kind: "mcu",
          name: "ESP32-DevKitC",
          ports: [
            { id: "U1.GPIO21", name: "GPIO21", kind: "bidirectional", pinCapabilities: ["I2C_SDA"] },
            { id: "U1.GPIO22", name: "GPIO22", kind: "bidirectional", pinCapabilities: ["I2C_SCL"] },
            { id: "U1.GPIO13", name: "GPIO13", kind: "output", pinCapabilities: ["GPIO"] },
            { id: "U1.GND", name: "GND", kind: "ground" },
          ],
          provenance: {
            evidenceType: "EXPLICIT_AST_CALL",
            confidence: 1.0,
            direction: "BIDIRECTIONAL",
            notes: "Main MCU defined in board manifest",
          },
        },
        {
          id: "RTC1",
          kind: "sensor",
          name: "DS3231",
          ports: [
            { id: "RTC1.SDA", name: "SDA", kind: "bidirectional" },
            { id: "RTC1.SCL", name: "SCL", kind: "input" },
            { id: "RTC1.GND", name: "GND", kind: "ground" },
          ],
          provenance: {
            sourceFile: "sketch.ino",
            lineSpan: { startLine: 3, endLine: 3 },
            evidenceType: "LIBRARY_INFERENCE",
            confidence: 0.95,
            notes: "#include <RTClib.h> and RTC_DS3231 rtc;",
          },
        },
        {
          id: "LED1",
          kind: "led",
          name: "Heartbeat LED",
          ports: [
            { id: "LED1.A", name: "A", kind: "passive" },
            { id: "LED1.K", name: "K", kind: "passive" },
          ],
          provenance: {
            sourceFile: "sketch.ino",
            lineSpan: { startLine: 12, endLine: 12 },
            evidenceType: "EXPLICIT_AST_CALL",
            confidence: 1.0,
            direction: "OUTPUT",
            notes: "pinMode(13, OUTPUT); digitalWrite(13, HIGH);",
          },
        },
      ],
      nets: [
        createLogicalNet({
          id: "NET_I2C_SDA",
          name: "I2C_SDA",
          kind: "signal",
          portIds: ["U1.GPIO21", "RTC1.SDA"],
          provenance: {
            sourceFile: "sketch.ino",
            lineSpan: { startLine: 8, endLine: 8 },
            evidenceType: "LIBRARY_INFERENCE",
            confidence: 0.95,
            direction: "BIDIRECTIONAL",
          },
        }),
        createLogicalNet({
          id: "NET_I2C_SCL",
          name: "I2C_SCL",
          kind: "signal",
          portIds: ["U1.GPIO22", "RTC1.SCL"],
          provenance: {
            sourceFile: "sketch.ino",
            lineSpan: { startLine: 8, endLine: 8 },
            evidenceType: "LIBRARY_INFERENCE",
            confidence: 0.95,
            direction: "OUTPUT",
          },
        }),
        emitLogicalNetFromASTCall({
          mcuPortId: "U1.GPIO13",
          targetPortId: "LED1.A",
          pinNumber: 13,
          callName: "digitalWrite",
          sourceFile: "sketch.ino",
          lineSpan: { startLine: 14, endLine: 14 },
          confidence: 1.0,
          direction: "OUTPUT",
        }),
        {
          id: "GND",
          name: "GND",
          kind: "ground",
          voltage: 0,
          portIds: ["U1.GND", "RTC1.GND", "LED1.K"],
        },
      ],
      buses: [
        createBus({
          id: "I2C_BUS_0",
          name: "Primary I2C Bus",
          type: "I2C_BUS",
          netIds: ["NET_I2C_SDA", "NET_I2C_SCL"],
          signals: {
            sda: "NET_I2C_SDA",
            scl: "NET_I2C_SCL",
          },
          provenance: {
            evidenceType: "LIBRARY_INFERENCE",
            confidence: 0.98,
            direction: "BIDIRECTIONAL",
          },
        }),
      ],
    };

    const parsed = parseCircuit(circuit);
    expect(parsed.buses).toHaveLength(1);
    expect(parsed.buses?.[0].type).toBe("I2C_BUS");
    expect(parsed.nets[2].id).toBe("NET_GPIO_13");
    expect(parsed.nets[2].provenance?.evidenceType).toBe("EXPLICIT_AST_CALL");

    const bipartiteCheck = isBipartiteNetGraph(parsed);
    expect(bipartiteCheck.valid).toBe(true);

    const index = buildNetCentricIndex(parsed);
    expect(index.portToNetMap.get("U1.GPIO13")?.id).toBe("NET_GPIO_13");
    expect(index.busesByType.get("I2C_BUS")?.length).toBe(1);
  });
});
