import { describe, expect, it } from "vitest";
import { parseCircuit, safeParseCircuit, validateCircuitIntegrity } from "../src/schema.js";
import type { Circuit } from "../src/types.js";

const VALID_MINIMAL_CIRCUIT: Circuit = {
  schemaVersion: "0.1.0",
  name: "Blink LED",
  components: [
    {
      id: "R1",
      kind: "resistor",
      value: "330",
      ports: [
        { id: "R1.1", name: "1", kind: "passive" },
        { id: "R1.2", name: "2", kind: "passive" },
      ],
    },
    {
      id: "LED1",
      kind: "led",
      value: "Red",
      ports: [
        { id: "LED1.A", name: "A", kind: "passive" },
        { id: "LED1.K", name: "K", kind: "passive" },
      ],
    },
    {
      id: "U1",
      kind: "mcu",
      name: "Arduino Uno",
      ports: [
        { id: "U1.D13", name: "D13", kind: "output", pinCapabilities: ["GPIO"] },
        { id: "U1.GND", name: "GND", kind: "ground" },
      ],
    },
  ],
  nets: [
    {
      id: "net_d13",
      kind: "signal",
      portIds: ["U1.D13", "R1.1"],
    },
    {
      id: "net_r1_led",
      kind: "signal",
      portIds: ["R1.2", "LED1.A"],
    },
    {
      id: "GND",
      kind: "ground",
      voltage: 0,
      portIds: ["LED1.K", "U1.GND"],
    },
  ],
};

describe("Circuit IR Schema Validation", () => {
  it("successfully parses valid minimal circuit", () => {
    const result = parseCircuit(VALID_MINIMAL_CIRCUIT);
    expect(result.name).toBe("Blink LED");
    expect(result.components.length).toBe(3);
    expect(result.nets.length).toBe(3);
  });

  it("fails when schemaVersion is invalid", () => {
    const invalid = { ...VALID_MINIMAL_CIRCUIT, schemaVersion: "0.2.0" };
    const res = safeParseCircuit(invalid);
    expect(res.success).toBe(false);
  });

  it("fails when component ID contains invalid characters", () => {
    const firstComp = VALID_MINIMAL_CIRCUIT.components[0] ?? {
      id: "R1",
      kind: "resistor" as const,
      ports: [],
    };
    const invalid = {
      ...VALID_MINIMAL_CIRCUIT,
      components: [
        {
          ...firstComp,
          id: "R-1#bad",
        },
      ],
    };
    const res = safeParseCircuit(invalid);
    expect(res.success).toBe(false);
  });
});

describe("Circuit Referential Integrity", () => {
  it("detects dangling port reference in net", () => {
    const broken: Circuit = {
      ...VALID_MINIMAL_CIRCUIT,
      nets: [
        {
          id: "net_broken",
          kind: "signal",
          portIds: ["U1.D13", "R1.NON_EXISTENT"],
        },
      ],
    };
    const errors = validateCircuitIntegrity(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('references non-existent port "R1.NON_EXISTENT"');
  });

  it("detects duplicate component IDs", () => {
    const firstComp = VALID_MINIMAL_CIRCUIT.components[0] ?? {
      id: "R1",
      kind: "resistor" as const,
      ports: [],
    };
    const broken: Circuit = {
      ...VALID_MINIMAL_CIRCUIT,
      components: [firstComp, { ...firstComp }],
    };
    const errors = validateCircuitIntegrity(broken);
    expect(errors.some((e) => e.message.includes('Duplicate component id: "R1"'))).toBe(true);
  });

  it("detects a port wired to multiple conflicting nets", () => {
    const broken: Circuit = {
      ...VALID_MINIMAL_CIRCUIT,
      nets: [
        { id: "net1", kind: "signal", portIds: ["R1.1"] },
        { id: "net2", kind: "signal", portIds: ["R1.1"] },
      ],
    };
    const errors = validateCircuitIntegrity(broken);
    expect(errors.some((e) => e.message.includes("already mapped to net"))).toBe(true);
  });
});
