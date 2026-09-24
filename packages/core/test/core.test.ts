import { describe, expect, it } from "vitest";
import {
  CircuitBuilder,
  CORE_VERSION,
  createCircuit,
  DisjointSet,
  jsx,
  renderCircuit,
} from "../src/index.js";

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

  it("handles duplicate reference designator collision with actionable error", () => {
    const builder = new CircuitBuilder();
    builder.addResistor("R1", "10kΩ");

    expect(() => builder.addResistor("R1", "20kΩ")).toThrowError(
      /Duplicate reference designator 'R1': component 'R1' \(resistor\) is already registered in circuit\./i,
    );
  });

  it("provides actionable error when connecting to a nonexistent component with suggested-closest-match", () => {
    const builder = new CircuitBuilder();
    builder.addPart("ARDUINO_UNO_R3", "U1");
    builder.addResistor("R1", "10kΩ");

    // Typo: U2 instead of U1, or R2 instead of R1
    expect(() => builder.connect("U2.D9", "R1.1")).toThrowError(
      /Component 'U2' not found while connecting port 'U2\.D9'\. Did you mean 'U1'\? Available components: \[U1, R1\]\./i,
    );
  });

  it("provides actionable error when connecting to a nonexistent pin with suggested-closest-match", () => {
    const builder = new CircuitBuilder();
    builder.addPart("ARDUINO_UNO_R3", "U1");
    builder.addResistor("R1", "10kΩ");

    // Typo: D99 instead of D9 on Uno
    expect(() => builder.connect("U1.D99", "R1.1")).toThrowError(
      /Port 'D99' not found on component 'U1' \(Arduino Uno R3\)\. Did you mean 'D9'\? Available ports: \[/i,
    );
  });

  it("merges nets using proper Union-Find Disjoint Set and preserves named nets", () => {
    const builder = new CircuitBuilder();
    builder.addResistor("R1", "1kΩ");
    builder.addResistor("R2", "1kΩ");
    builder.addResistor("R3", "1kΩ");

    // Connect R1.1 to R2.1, then R2.1 to R3.1 via transitive unions
    builder.connect("R1.1", "R2.1");
    builder.connect("R2.1", "R3.1");

    // Attach GND to R3.1
    builder.connectNet("GND", ["R3.1"]);

    const circuit = builder.build();

    // R1.1, R2.1, and R3.1 must all be merged into the canonical GND net
    const gndNet = circuit.nets.find((n) => n.id === "GND");
    expect(gndNet).toBeDefined();
    expect(gndNet?.portIds).toEqual(expect.arrayContaining(["R1.1", "R2.1", "R3.1"]));

    const r1 = circuit.components.find((c) => c.id === "R1");
    expect(r1?.ports.find((p) => p.name === "1")?.netId).toBe("GND");
  });
});

describe("@s2c/core DisjointSet unit tests", () => {
  it("implements union-find with path compression and equivalence classes", () => {
    const dsu = new DisjointSet<string>();
    dsu.makeSet("A");
    dsu.makeSet("B");
    dsu.makeSet("C");
    dsu.makeSet("D");

    dsu.union("A", "B");
    dsu.union("B", "C");

    expect(dsu.find("A")).toBe(dsu.find("C"));
    expect(dsu.find("A")).not.toBe(dsu.find("D"));

    // Union with priority
    dsu.union("C", "D", (root1, root2) => (root1 === "D" ? root1 : root2));
    const classes = dsu.getEquivalenceClasses();
    expect(classes.size).toBe(1);
    expect(Array.from(classes.values())[0]).toHaveLength(4);
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
