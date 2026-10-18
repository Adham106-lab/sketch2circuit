import { describe, expect, it } from "vitest";
import type { Circuit } from "@s2c/circuit-json";
import {
  CurrentProtectionRule,
  I2CPullUpRule,
  PinContentionRule,
  runErcPass,
  StrappingAndRestrictedPinsRule,
} from "../src/index.js";

describe("Electrical Rule Check (ERC) Pass (Task 2)", () => {
  it("detects pin contention when two active outputs drive the same net", () => {
    const circuit: Circuit = {
      schemaVersion: "0.1.0",
      name: "Driver Contention",
      components: [
        {
          id: "U1",
          kind: "mcu",
          ports: [{ id: "U1.D4", name: "D4", kind: "output" }],
        },
        {
          id: "U2",
          kind: "ic",
          ports: [{ id: "U2.OUT", name: "OUT", kind: "output" }],
        },
      ],
      nets: [
        {
          id: "NET_COLLISION",
          kind: "signal",
          portIds: ["U1.D4", "U2.OUT"],
        },
      ],
    };

    const diags = PinContentionRule.run(circuit, { circuit });
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0].ruleId).toBe("erc.pin-contention");
    expect(diags[0].severity).toBe("error");
  });

  it("detects missing I2C pull-up resistors and can auto-inject virtual pull-ups", () => {
    const circuit: Circuit = {
      schemaVersion: "0.1.0",
      name: "Floating I2C Bus",
      components: [
        {
          id: "U1",
          kind: "mcu",
          ports: [
            { id: "U1.A4", name: "A4", kind: "bidirectional", pinCapabilities: ["I2C_SDA"] },
            { id: "U1.A5", name: "A5", kind: "bidirectional", pinCapabilities: ["I2C_SCL"] },
            { id: "U1.5V", name: "5V", kind: "power" },
            { id: "U1.GND", name: "GND", kind: "ground" },
          ],
        },
        {
          id: "RTC1",
          kind: "sensor",
          ports: [
            { id: "RTC1.SDA", name: "SDA", kind: "bidirectional" },
            { id: "RTC1.SCL", name: "SCL", kind: "input" },
          ],
        },
      ],
      nets: [
        { id: "NET_I2C_SDA", kind: "signal", portIds: ["U1.A4", "RTC1.SDA"] },
        { id: "NET_I2C_SCL", kind: "signal", portIds: ["U1.A5", "RTC1.SCL"] },
        { id: "5V", kind: "power", voltage: 5, portIds: ["U1.5V"] },
        { id: "GND", kind: "ground", voltage: 0, portIds: ["U1.GND"] },
      ],
    };

    // Before fix: warnings generated
    const passResultBefore = runErcPass(circuit, { boardId: "arduino-uno" });
    const missingPullupDiags = passResultBefore.diagnostics.filter((d) => d.ruleId === "erc.i2c-missing-pullup");
    expect(missingPullupDiags.length).toBe(2);

    // With autoInjectI2CPullups: true
    const passResultFixed = runErcPass(circuit, {
      boardId: "arduino-uno",
      autoInjectI2CPullups: true,
    });
    expect(passResultFixed.injectedComponentsCount).toBe(2);
    expect(passResultFixed.circuit.components.some((c) => c.id.startsWith("R_VIRT_PU_"))).toBe(true);

    // Re-checking the fixed circuit should have 0 missing pullup diagnostics
    const passResultAfter = runErcPass(passResultFixed.circuit, { boardId: "arduino-uno" });
    const diagsAfter = passResultAfter.diagnostics.filter((d) => d.ruleId === "erc.i2c-missing-pullup");
    expect(diagsAfter.length).toBe(0);
  });

  it("flags high-current solenoid actuator connected directly to MCU GPIO", () => {
    const dangerousCircuit: Circuit = {
      schemaVersion: "0.1.0",
      name: "Direct Solenoid Hazard",
      components: [
        {
          id: "U1",
          kind: "mcu",
          ports: [{ id: "U1.D8", name: "D8", kind: "output" }],
        },
        {
          id: "SOL1",
          kind: "relay",
          name: "12V Lock Solenoid",
          properties: { peakCurrentMa: 600 },
          ports: [
            { id: "SOL1.POS", name: "POS", kind: "passive" },
            { id: "SOL1.NEG", name: "NEG", kind: "passive" },
          ],
        },
      ],
      nets: [
        { id: "NET_SOLENOID_DRIVE", kind: "signal", portIds: ["U1.D8", "SOL1.NEG"] },
        { id: "12V", kind: "power", voltage: 12, portIds: ["SOL1.POS"] },
      ],
    };

    const diags = CurrentProtectionRule.run(dangerousCircuit, {
      circuit: dangerousCircuit,
      board: {
        id: "uno",
        name: "Uno",
        mcuFamily: "AVR",
        operatingVoltage: 5,
        maxGpioCurrentMa: 20,
        totalPackageCurrentMa: 200,
        pins: {},
      },
    });

    expect(diags.length).toBe(1);
    expect(diags[0].ruleId).toBe("erc.direct-actuator-gpio");
    expect(diags[0].severity).toBe("error");
  });

  it("flags ESP32 input-only pins configured as outputs and unsafe strapping pin states", () => {
    const esp32Circuit: Circuit = {
      schemaVersion: "0.1.0",
      name: "ESP32 Violations",
      metadata: { board: "esp32-devkit-v1" },
      components: [
        {
          id: "U1",
          kind: "mcu",
          name: "ESP32",
          ports: [
            // Input only pin used as output
            { id: "U1.GPIO34", name: "GPIO34", kind: "output" },
            // Strapping pin GPIO0 pulled to ground
            { id: "U1.GPIO0", name: "GPIO0", kind: "bidirectional" },
            // Strapping pin GPIO12 pulled to 3.3V
            { id: "U1.GPIO12", name: "GPIO12", kind: "bidirectional" },
            { id: "U1.3V3", name: "3V3", kind: "power" },
            { id: "U1.GND", name: "GND", kind: "ground" },
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
        { id: "NET_LED", kind: "signal", portIds: ["U1.GPIO34", "LED1.A"] },
        { id: "GND", kind: "ground", voltage: 0, portIds: ["U1.GND", "LED1.K", "U1.GPIO0"] },
        { id: "3V3", kind: "power", voltage: 3.3, portIds: ["U1.3V3", "U1.GPIO12"] },
      ],
    };

    const passResult = runErcPass(esp32Circuit, { boardId: "esp32-devkit-v1" });
    const inputOnlyDiags = passResult.errors.filter((e) => e.ruleId === "erc.restricted-pin.input-only");
    expect(inputOnlyDiags.length).toBe(1);
    expect(inputOnlyDiags[0].message).toContain("GPIO34");

    const strappingDiags = passResult.errors.filter((e) => e.ruleId === "erc.strapping-pin-violation");
    expect(strappingDiags.length).toBe(2); // GPIO0 pulled LOW, GPIO12 pulled HIGH
  });
});
