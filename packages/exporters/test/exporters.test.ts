import { describe, expect, it } from "vitest";
import type { Circuit } from "@s2c/circuit-json";
import { toKiCadNetlist, toWokwiDiagram } from "../src/index.js";

const TEST_CIRCUIT: Circuit = {
  schemaVersion: "0.1.0",
  name: "Blink Simulation",
  components: [
    {
      id: "U1",
      kind: "mcu",
      name: "Arduino Uno",
      ports: [
        { id: "U1.D13", name: "D13", kind: "output" },
        { id: "U1.5V", name: "5V", kind: "power" },
        { id: "U1.GND", name: "GND", kind: "ground" },
      ],
    },
    {
      id: "R1",
      kind: "resistor",
      value: "220Ω",
      ports: [
        { id: "R1.1", name: "1", kind: "passive" },
        { id: "R1.2", name: "2", kind: "passive" },
      ],
    },
    {
      id: "LED1",
      kind: "led",
      value: "Blue",
      ports: [
        { id: "LED1.A", name: "A", kind: "passive" },
        { id: "LED1.K", name: "K", kind: "passive" },
      ],
    },
  ],
  nets: [
    { id: "NET_GPIO_13", kind: "signal", portIds: ["U1.D13", "R1.1"] },
    { id: "NET_R1_LED", kind: "signal", portIds: ["R1.2", "LED1.A"] },
    { id: "GND", kind: "ground", voltage: 0, portIds: ["LED1.K", "U1.GND"] },
  ],
};

describe("Universal Export Bridges (Task 5)", () => {
  it("serializes Circuit IR into valid Wokwi diagram.json structure", () => {
    const diagram = toWokwiDiagram(TEST_CIRCUIT);

    expect(diagram.version).toBe(1);
    expect(diagram.editor).toBe("wokwi");
    expect(diagram.parts.length).toBe(3);

    // Verify MCU part
    const mcuPart = diagram.parts.find((p) => p.id === "U1");
    expect(mcuPart?.type).toBe("wokwi-arduino-uno");

    // Verify LED part and attributes
    const ledPart = diagram.parts.find((p) => p.id === "LED1");
    expect(ledPart?.type).toBe("wokwi-led");
    expect(ledPart?.attrs?.color).toBe("blue");

    // Verify connections
    expect(diagram.connections.length).toBe(3);
    const gndConn = diagram.connections.find((c) => c[2] === "black");
    expect(gndConn).toBeDefined();
    // LED cathode is mapped to 'C' in Wokwi
    expect(gndConn?.[0]).toBe("LED1:C");
    expect(gndConn?.[1]).toBe("U1:GND.1");

    // Signal connection from D13 to R1
    const d13Conn = diagram.connections.find((c) => c[0] === "U1:13");
    expect(d13Conn).toBeDefined();
    expect(d13Conn?.[1]).toBe("R1:1");
  });

  it("serializes Circuit IR into standard KiCad S-expression netlist (.net)", () => {
    const kicadNetlist = toKiCadNetlist(TEST_CIRCUIT);

    expect(kicadNetlist).toContain('(export (version "E")');
    expect(kicadNetlist).toContain('(source "Blink Simulation")');
    expect(kicadNetlist).toContain('(comp (ref "U1")');
    expect(kicadNetlist).toContain('(comp (ref "R1")');
    expect(kicadNetlist).toContain('(comp (ref "LED1")');
    expect(kicadNetlist).toContain('(net (code "1") (name "NET_GPIO_13")');
    expect(kicadNetlist).toContain('(node (ref "U1") (pin "D13"))');
    expect(kicadNetlist).toContain('(node (ref "R1") (pin "1"))');
  });
});
