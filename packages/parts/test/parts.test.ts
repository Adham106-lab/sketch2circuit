import { describe, expect, it } from "vitest";
import {
  ARDUINO_UNO_R3,
  ESP32_WROOM_32,
  findClosestPart,
  getPartDefinition,
  HC_SR04,
  instantiatePart,
  LED_GENERIC,
  lookupPartWithSuggestion,
  PARTS_CATALOG,
  PARTS_VERSION,
  RESISTOR_GENERIC,
} from "../src/index.js";

describe("@s2c/parts package", () => {
  it("exports package version constant", () => {
    expect(PARTS_VERSION).toBe("0.1.0");
  });

  it("ensures every catalog part carries either a real datasheet URL or verified: false (doc §7)", () => {
    const parts = Object.values(PARTS_CATALOG);
    expect(parts.length).toBeGreaterThanOrEqual(12);

    for (const part of parts) {
      if (part.verified) {
        expect(part.datasheetUrl).toBeDefined();
        expect(typeof part.datasheetUrl).toBe("string");
        expect(part.datasheetUrl).toMatch(/^https?:\/\//);
      } else {
        expect(part.verified).toBe(false);
      }
    }
  });

  it("models ESP32-WROOM-32 correctly at 3.3V logic level (not 5V Uno levels)", () => {
    expect(ESP32_WROOM_32.defaultProperties?.operatingVoltage).toBe(3.3);
    expect(ESP32_WROOM_32.datasheetUrl).toContain("espressif.com");

    const gpioPins = ESP32_WROOM_32.ports.filter((p) => p.name.startsWith("GPIO"));
    expect(gpioPins.length).toBeGreaterThan(0);

    for (const gpio of gpioPins) {
      expect(gpio.voltageRange).toEqual([0, 3.3]);
      // ESP32 GPIO drive current is 12mA recommended, unlike Uno's 40mA
      expect(gpio.currentLimit).toBe(0.012);
    }

    const power3v3 = ESP32_WROOM_32.ports.find((p) => p.name === "3V3");
    expect(power3v3?.voltageRange).toEqual([3.3, 3.3]);
  });

  it("provides actionable error with suggested-closest-match for unknown part IDs", () => {
    // 1. Typos in instantiatePart
    expect(() => instantiatePart("HC_SR05", "U1")).toThrowError(
      /Part 'HC_SR05' not found in catalog\. Did you mean 'HC_SR04'\?/i,
    );

    expect(() => instantiatePart("ARDUINO_UN0_R3", "U1")).toThrowError(
      /Part 'ARDUINO_UN0_R3' not found in catalog\. Did you mean 'ARDUINO_UNO_R3'\?/i,
    );

    // 2. Lookup with suggestion helper
    const lookupResult = lookupPartWithSuggestion("ESP32_WROOM");
    expect(lookupResult.part).toBeUndefined();
    expect(lookupResult.suggestion).toBe("ESP32_WROOM_32");
    expect(lookupResult.availablePartIds).toContain("ESP32_WROOM_32");

    // 3. findClosestPart
    const closest = findClosestPart("SG90_SER");
    expect(closest?.id).toBe("SG90_SERVO");
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
    expect(led.verified).toBe(false); // Generic part without specific datasheet
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
