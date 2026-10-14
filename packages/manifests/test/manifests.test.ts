import { describe, expect, it } from "vitest";
import {
  expandComponentTemplate,
  getBoardManifest,
  getComponentTemplate,
  mergeTemplateIntoCircuit,
} from "../src/index.js";
import type { Circuit } from "@s2c/circuit-json";

describe("Declarative Board & Component Manifests (Task 3)", () => {
  it("loads Arduino Uno and ESP32 board manifests with pin capability matrix and strapping rules", () => {
    const uno = getBoardManifest("arduino-uno");
    expect(uno).toBeDefined();
    expect(uno?.operatingVoltage).toBe(5.0);
    expect(uno?.pins.D13.capabilities).toContain("SPI_SCK");

    const esp32 = getBoardManifest("esp32-devkit-v1");
    expect(esp32).toBeDefined();
    expect(esp32?.operatingVoltage).toBe(3.3);
    // Input only pins
    expect(esp32?.pins.GPIO34.inputOnly).toBe(true);
    expect(esp32?.pins.GPIO34.maxCurrentMa).toBe(0);
    // Strapping pins
    expect(esp32?.pins.GPIO0.strappingRule?.safeBootState).toBe("HIGH");
    expect(esp32?.pins.GPIO12.strappingRule?.safeBootState).toBe("LOW");
  });

  it("expands DS3231 template and injects decoupling capacitor and pullup resistors", () => {
    const expanded = expandComponentTemplate("DS3231", "RTC1", {
      SDA: "NET_I2C_SDA",
      SCL: "NET_I2C_SCL",
      VCC: "5V",
      GND: "GND",
    });

    expect(expanded.primaryComponent.id).toBe("RTC1");
    // Supporting passives: C_DEC, R_PU_SDA, R_PU_SCL
    expect(expanded.supportingComponents.length).toBe(3);
    expect(expanded.supportingComponents.map((c) => c.kind)).toContain("capacitor");
    expect(expanded.supportingComponents.map((c) => c.kind)).toContain("resistor");

    // Decoupling cap is connected to VCC and GND
    const sdaNet = expanded.generatedNets.find((n) => n.id === "NET_I2C_SDA");
    expect(sdaNet?.portIds).toContain("RTC1.SDA");
    expect(sdaNet?.portIds).toContain("RTC1_R_PU_SDA.1");
  });

  it("expands Solenoid template with MOSFET driver stage and flyback protection diode", () => {
    const expanded = expandComponentTemplate("Solenoid", "SOL1", {
      COIL_POS: "12V",
      GPIO_PIN: "NET_GPIO_4",
      GND: "GND",
    });

    expect(expanded.primaryComponent.id).toBe("SOL1");
    const kinds = expanded.supportingComponents.map((c) => c.kind);
    expect(kinds).toContain("diode"); // 1N4007 flyback
    expect(kinds).toContain("transistor"); // IRLZ44N MOSFET
    expect(kinds).toContain("resistor"); // gate resistor & pull-down

    const flyback = expanded.supportingComponents.find((c) => c.value === "1N4007");
    expect(flyback).toBeDefined();
  });

  it("merges expanded template into an existing Circuit IR cleanly", () => {
    const baseCircuit: Circuit = {
      schemaVersion: "0.1.0",
      name: "Base Circuit",
      components: [
        {
          id: "U1",
          kind: "mcu",
          name: "ESP32",
          ports: [
            { id: "U1.GPIO21", name: "GPIO21", kind: "bidirectional" },
            { id: "U1.GPIO22", name: "GPIO22", kind: "bidirectional" },
            { id: "U1.3V3", name: "3V3", kind: "power" },
            { id: "U1.GND", name: "GND", kind: "ground" },
          ],
        },
      ],
      nets: [
        { id: "NET_I2C_SDA", kind: "signal", portIds: ["U1.GPIO21"] },
        { id: "NET_I2C_SCL", kind: "signal", portIds: ["U1.GPIO22"] },
        { id: "3V3", kind: "power", voltage: 3.3, portIds: ["U1.3V3"] },
        { id: "GND", kind: "ground", voltage: 0, portIds: ["U1.GND"] },
      ],
    };

    const merged = mergeTemplateIntoCircuit(baseCircuit, "DS3231", "RTC1", {
      SDA: "NET_I2C_SDA",
      SCL: "NET_I2C_SCL",
      VCC: "3V3",
      GND: "GND",
    });

    expect(merged.components.length).toBe(1 + 1 + 3); // MCU + RTC + 3 passives
    const mergedSda = merged.nets.find((n) => n.id === "NET_I2C_SDA");
    expect(mergedSda?.portIds).toContain("U1.GPIO21");
    expect(mergedSda?.portIds).toContain("RTC1.SDA");
  });
});
