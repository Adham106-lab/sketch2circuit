import { describe, expect, it } from "vitest";
import type { Circuit } from "@s2c/circuit-json";
import {
  circuitToElkGraph,
  classifyPortSide,
  compressPowerRails,
} from "../src/index.js";

describe("Port-Aware Deterministic Layout Engine (Task 4)", () => {
  it("enforces fixed port sides: NORTH=Power, SOUTH=GND, WEST=Inputs, EAST=Outputs", () => {
    expect(classifyPortSide({ id: "U1.VCC", name: "VCC", kind: "power" })).toBe("NORTH");
    expect(classifyPortSide({ id: "U1.5V", name: "5V", kind: "power" })).toBe("NORTH");
    expect(classifyPortSide({ id: "U1.3V3", name: "3V3", kind: "power" })).toBe("NORTH");

    expect(classifyPortSide({ id: "U1.GND", name: "GND", kind: "ground" })).toBe("SOUTH");
    expect(classifyPortSide({ id: "U1.0V", name: "0V", kind: "ground" })).toBe("SOUTH");

    expect(classifyPortSide({ id: "U1.A0", name: "A0", kind: "input", pinCapabilities: ["ADC"] })).toBe("WEST");
    expect(classifyPortSide({ id: "U1.RX", name: "RX", kind: "input" })).toBe("WEST");

    expect(classifyPortSide({ id: "U1.D9", name: "D9", kind: "output", pinCapabilities: ["PWM"] })).toBe("EAST");
    expect(classifyPortSide({ id: "U1.TX", name: "TX", kind: "output" })).toBe("EAST");
  });

  it("compresses power rails into localized stubs instead of routing long global wires", () => {
    const circuit: Circuit = {
      schemaVersion: "0.1.0",
      name: "Blink Schematic",
      components: [
        {
          id: "U1",
          kind: "mcu",
          ports: [
            { id: "U1.5V", name: "5V", kind: "power" },
            { id: "U1.GND", name: "GND", kind: "ground" },
            { id: "U1.D13", name: "D13", kind: "output" },
          ],
        },
        {
          id: "R1",
          kind: "resistor",
          ports: [
            { id: "R1.1", name: "1", kind: "passive" },
            { id: "R1.2", name: "2", kind: "passive" },
          ],
        },
        {
          id: "LED1",
          kind: "led",
          ports: [
            { id: "LED1.A", name: "A", kind: "passive" },
            { id: "LED1.K", name: "K", kind: "passive" },
          ],
        },
      ],
      nets: [
        { id: "NET_GPIO_13", kind: "signal", portIds: ["U1.D13", "R1.1"] },
        { id: "NET_R1_LED", kind: "signal", portIds: ["R1.2", "LED1.A"] },
        { id: "5V", kind: "power", voltage: 5, portIds: ["U1.5V"] },
        { id: "GND", kind: "ground", voltage: 0, portIds: ["U1.GND", "LED1.K"] },
      ],
    };

    const compressed = compressPowerRails(circuit);
    expect(compressed.signalNets.length).toBe(2); // Only GPIO_13 and R1_LED
    expect(compressed.powerStubs.length).toBe(3); // U1.5V, U1.GND, LED1.K

    const gndStubs = compressed.powerStubs.filter((s) => s.side === "SOUTH");
    expect(gndStubs.length).toBe(2);
    expect(gndStubs.map((s) => s.symbol)).toContain("GND_ARROW");

    const vccStubs = compressed.powerStubs.filter((s) => s.side === "NORTH");
    expect(vccStubs.length).toBe(1);
    expect(vccStubs[0].symbol).toBe("VCC_FLAG");
  });

  it("transforms Circuit IR into valid ELK JSON with layered algorithm and fixed sides", () => {
    const circuit: Circuit = {
      schemaVersion: "0.1.0",
      name: "Sensor Circuit",
      components: [
        {
          id: "U1",
          kind: "mcu",
          ports: [
            { id: "U1.A4", name: "A4", kind: "bidirectional" },
            { id: "U1.5V", name: "5V", kind: "power" },
            { id: "U1.GND", name: "GND", kind: "ground" },
          ],
        },
        {
          id: "POT1",
          kind: "potentiometer",
          ports: [
            { id: "POT1.SIG", name: "SIG", kind: "output" },
            { id: "POT1.VCC", name: "VCC", kind: "power" },
            { id: "POT1.GND", name: "GND", kind: "ground" },
          ],
        },
      ],
      nets: [
        { id: "NET_POT_SIG", kind: "signal", portIds: ["POT1.SIG", "U1.A4"] },
        { id: "5V", kind: "power", voltage: 5, portIds: ["U1.5V", "POT1.VCC"] },
        { id: "GND", kind: "ground", voltage: 0, portIds: ["U1.GND", "POT1.GND"] },
      ],
    };

    const elkGraph = circuitToElkGraph(circuit, { compressPowerRails: true });

    expect(elkGraph.layoutOptions["org.eclipse.elk.algorithm"]).toBe("org.eclipse.elk.layered");
    expect(elkGraph.layoutOptions["org.eclipse.elk.portConstraints"]).toBe("FIXED_SIDE");
    expect(elkGraph.layoutOptions["org.eclipse.elk.edgeRouting"]).toBe("ORTHOGONAL");

    expect(elkGraph.children.length).toBe(2);
    const u1Node = elkGraph.children.find((c) => c.id === "U1");
    expect(u1Node).toBeDefined();

    const u1VccPort = u1Node?.ports?.find((p) => p.id === "U1.5V");
    expect(u1VccPort?.layoutOptions?.["org.eclipse.elk.port.side"]).toBe("NORTH");

    const u1GndPort = u1Node?.ports?.find((p) => p.id === "U1.GND");
    expect(u1GndPort?.layoutOptions?.["org.eclipse.elk.port.side"]).toBe("SOUTH");

    // Edges should only contain the signal net
    expect(elkGraph.edges.length).toBe(1);
    expect(elkGraph.edges[0].properties?.netId).toBe("NET_POT_SIG");

    // Power stubs are separated
    expect(elkGraph.powerStubs?.length).toBe(4);
  });
});
