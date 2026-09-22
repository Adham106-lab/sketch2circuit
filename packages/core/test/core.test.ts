import { describe, expect, it } from "vitest";
import { CircuitBuilder, CORE_VERSION, createCircuit, jsx, renderCircuit } from "../src/index.js";

describe("@s2c/core CircuitBuilder API", () => {
  it("exports package version constant", () => {
    expect(CORE_VERSION).toBe("0.1.0");
  });

  it("builds an LED + resistor circuit with automated nets", () => {
    const builder = createCircuit({ title: "Blink Circuit" });

    builder
      .addPart("ARDUINO_UNO_R3", "U1")
      .addResistor("R1", "220Ω")
      .addLed("LED1", "Red")
      .connect("U1.D9", "R1.1")
      .connect("R1.2", "LED1.A")
      .connectNet("GND", ["LED1.K", "U1.GND"]);

    const circuit = builder.build();

    expect(circuit.components).toHaveLength(3);
    expect(circuit.nets).toHaveLength(3); // 2 signal nets + 1 GND net

    const u1 = circuit.components.find((c) => c.id === "U1");
    expect(u1?.ports.find((p) => p.name === "D9")?.netId).toBeDefined();

    const gndNet = circuit.nets.find((n) => n.id === "GND");
    expect(gndNet).toBeDefined();
    expect(gndNet?.portIds).toContain("LED1.K");
    expect(gndNet?.portIds).toContain("U1.GND");
  });

  it("throws clear error when duplicate component ID is registered", () => {
    const builder = new CircuitBuilder();
    builder.addResistor("R1", "10kΩ");
    expect(() => builder.addResistor("R1", "20kΩ")).toThrowError(/already registered/);
  });

  it("throws clear error when invalid port is connected", () => {
    const builder = new CircuitBuilder();
    builder.addResistor("R1", "10kΩ");
    expect(() => builder.connect("R1.INVALID", "R1.1")).toThrowError(/Port 'INVALID' not found/);
  });
});

describe("@s2c/core JSX Runtime & renderCircuit", () => {
  it("renders a circuit from JSX descriptors", () => {
    const tree = jsx("circuit", {
      children: [
        jsx("part", { part: "ARDUINO_UNO_R3", id: "U1" }),
        jsx("resistor", { id: "R1", value: "330Ω" }),
        jsx("led", { id: "LED1", color: "Green" }),
        jsx("connect", { from: "U1.D13", to: "R1.1" }),
        jsx("connect", { from: "R1.2", to: "LED1.A" }),
        jsx("net", { id: "GND", connect: ["LED1.K", "U1.GND"] }),
      ],
    });

    const circuit = renderCircuit(tree);

    expect(circuit.components).toHaveLength(3);
    expect(circuit.nets.length).toBeGreaterThanOrEqual(3);

    const r1 = circuit.components.find((c) => c.id === "R1");
    expect(r1?.value).toBe("330Ω");

    const gnd = circuit.nets.find((n) => n.id === "GND");
    expect(gnd?.portIds).toContain("LED1.K");
  });

  it("renders functional subcomponents", () => {
    function IndicatorLed(props: { id: string; pin: string }) {
      const resId = `R_${props.id}`;
      return jsx("circuit", {
        children: [
          jsx("resistor", { id: resId, value: "220Ω" }),
          jsx("led", { id: props.id, color: "Blue" }),
          jsx("connect", { from: props.pin, to: `${resId}.1` }),
          jsx("connect", { from: `${resId}.2`, to: `${props.id}.A` }),
        ],
      });
    }

    const tree = jsx("circuit", {
      children: [
        jsx("part", { part: "ARDUINO_NANO", id: "U1" }),
        jsx(IndicatorLed, { id: "STATUS", pin: "U1.D3" }),
      ],
    });

    const circuit = renderCircuit(tree);
    expect(circuit.components.map((c) => c.id)).toEqual(
      expect.arrayContaining(["U1", "R_STATUS", "STATUS"]),
    );
  });
});
