import { describe, expect, it } from "vitest";
import {
  ARDUINO_UNO_R3,
  getPartDefinition,
  HC_SR04,
  instantiatePart,
  LED_GENERIC,
  PARTS_CATALOG,
  PARTS_VERSION,
  RESISTOR_GENERIC,
} from "../src/index.js";

describe("@s2c/parts package", () => {
  it("exports package version constant", () => {
    expect(PARTS_VERSION).toBe("0.1.0");
  });

  it("contains Arduino Uno R3 with verified pins and capabilities", () => {
    expect(ARDUINO_UNO_R3.verified).toBe(true);
    const d9 = ARDUINO_UNO_R3.ports.find((p) => p.name === "D9");
    expect(d9).toBeDefined();
    expect(d9?.pinCapabilities).toContain("PWM");
    expect(d9?.pinCapabilities).toContain("GPIO");
    expect(d9?.currentLimit).toBe(0.04); // 40mA absolute max
  });

  it("retrieves parts by catalog query", () => {
    const uno = getPartDefinition("Arduino Uno R3");
    expect(uno?.id).toBe("ARDUINO_UNO_R3");

    const sensor = getPartDefinition("HC-SR04");
    expect(sensor?.id).toBe(HC_SR04.id);
  });

  it("instantiates a component with unique port IDs prefixed with instance ID", () => {
    const r1 = instantiatePart(RESISTOR_GENERIC, "R1", { value: "330Ω" });
    expect(r1.id).toBe("R1");
    expect(r1.kind).toBe("resistor");
    expect(r1.value).toBe("330Ω");
    expect(r1.ports).toHaveLength(2);
    expect(r1.ports[0].id).toBe("R1.1");
    expect(r1.ports[1].id).toBe("R1.2");

    const led = instantiatePart(LED_GENERIC, "LED1", { name: "Power Indicator" });
    expect(led.ports.find((p) => p.name === "A")?.id).toBe("LED1.A");
    expect(led.ports.find((p) => p.name === "K")?.id).toBe("LED1.K");
  });

  it("ensures every catalog part has valid port kinds and names", () => {
    const parts = Object.values(PARTS_CATALOG);
    expect(parts.length).toBeGreaterThanOrEqual(10);
    for (const part of parts) {
      expect(part.id).toBeDefined();
      expect(part.ports.length).toBeGreaterThan(0);
      const portNames = new Set<string>();
      for (const port of part.ports) {
        expect(port.name).toBeTruthy();
        expect([
          "passive",
          "power",
          "ground",
          "input",
          "output",
          "bidirectional",
          "no_connect",
        ]).toContain(port.kind);
        expect(portNames.has(port.name)).toBe(false);
        portNames.add(port.name);
      }
    }
  });
});
