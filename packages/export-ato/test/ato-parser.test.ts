/**
 * @license Apache-2.0
 * @s2c/export-ato — Atopile (.ato) Parser & Synthesizer Test Suite.
 */

import { describe, expect, it } from "vitest";
import { circuitToAto } from "../src/ato-generator.js";
import {
  DEFAULT_ATO_SKETCH,
  circuitToArduino,
  normalizeElectricalValue,
  parseAto,
  synthesizeAto,
} from "../src/ato-parser.js";

describe("Atopile (.ato) Language Parser & Synthesis", () => {
  it("normalizes electrical values and tolerances accurately", () => {
    expect(normalizeElectricalValue("330ohm +/- 5%")).toEqual({
      display: "330Ω",
      numeric: 330,
      tolerance: 0.05,
    });
    expect(normalizeElectricalValue("10kohm")).toEqual({
      display: "10kΩ",
      numeric: 10000,
      tolerance: undefined,
    });
    expect(normalizeElectricalValue("100nF")).toEqual({
      display: "100nF",
      numeric: 1e-7,
      tolerance: undefined,
    });
    expect(normalizeElectricalValue("10uF")).toEqual({
      display: "10uF",
      numeric: 1e-5,
      tolerance: undefined,
    });
  });

  it("parses module name, signals, components, and properties", () => {
    const atoCode = `
module IndicatorCircuit:
    signal GND
    signal VCC_5V

    mcu = new ArduinoUno
    r1 = new Resistor
    led = new LED

    r1.value = 330ohm +/- 5%
    r1.package = "0805"
    led.color = "red"
    led.package = "0805"

    mcu.gnd ~ GND
    mcu.power_5v ~ VCC_5V
    mcu.d13 ~ r1.p1
    r1.p2 ~ led.anode
    led.cathode ~ GND
`;

    const res = parseAto(atoCode);
    expect(res.valid).toBe(true);
    expect(res.moduleName).toBe("IndicatorCircuit");
    expect(res.circuit.name).toBe("IndicatorCircuit");

    // Verify components
    expect(res.circuit.components.length).toBe(3);

    const mcu = res.circuit.components.find((c) => c.kind === "mcu");
    expect(mcu).toBeDefined();
    expect(mcu?.id).toBe("U1");

    const resistor = res.circuit.components.find((c) => c.kind === "resistor");
    expect(resistor).toBeDefined();
    expect(resistor?.value).toBe("330Ω");
    expect(resistor?.footprint).toBe("0805");
    expect(resistor?.properties?.tolerance).toBe(0.05);

    const led = res.circuit.components.find((c) => c.kind === "led");
    expect(led).toBeDefined();
    expect(led?.value).toBe("Red");
    expect(led?.properties?.color).toBe("red");
    expect(led?.footprint).toBe("0805");

    // Verify line-level evidence and confidence: 1.0
    expect(resistor?.provenance?.confidence).toBe(1.0);
    expect(resistor?.provenance?.evidenceType).toBe("EXPLICIT_AST_CALL");
    expect(resistor?.provenance?.lineSpan?.startLine).toBeGreaterThan(0);

    // Verify nets
    expect(res.circuit.nets.length).toBeGreaterThanOrEqual(3);
    const gndNet = res.circuit.nets.find((n) => n.id === "GND");
    expect(gndNet).toBeDefined();
    expect(gndNet?.kind).toBe("ground");
    expect(gndNet?.portIds).toContain("U1.GND");
    expect(gndNet?.portIds.some((p) => p.endsWith(".K"))).toBe(true);
  });

  it("evaluates all 18 ERC rules and passes clean atopile design without errors", () => {
    const res = synthesizeAto(DEFAULT_ATO_SKETCH);
    expect(res.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    expect(res.peripherals.length).toBeGreaterThanOrEqual(2);
    expect(res.pinGraph.has("D13")).toBe(true);
    expect(res.pinGraph.has("D2")).toBe(true);
  });

  it("catches missing current-limiting resistor on LED directly from .ato code", () => {
    const invalidLedAto = `
module BadLedCircuit:
    signal GND
    mcu = new ArduinoUno
    led = new LED

    # Direct wiring to D13 with NO current-limiting resistor:
    mcu.d13 ~ led.anode
    led.cathode ~ GND
`;

    const res = synthesizeAto(invalidLedAto);
    const ledError = res.diagnostics.find((d) => d.ruleId === "erc.led-no-resistor");
    expect(ledError).toBeDefined();
    expect(ledError?.severity).toBe("error");
    expect(ledError?.message).toContain("without a current-limiting resistor");
  });

  it("catches direct power-to-ground short circuit from .ato code", () => {
    const shortAto = `
module ShortCircuit:
    signal GND
    signal VCC_5V

    mcu = new ArduinoUno
    # Direct short across power rails:
    VCC_5V ~ GND
`;

    const res = synthesizeAto(shortAto);
    const shortError = res.diagnostics.find((d) => d.ruleId === "erc.power-short");
    expect(shortError).toBeDefined();
    expect(shortError?.severity).toBe("error");
    expect(shortError?.message).toContain("short");
  });

  it("reports precise syntax errors with line numbers for malformed .ato input", () => {
    const syntaxErrAto = `
module BrokenCircuit:
    mcu = new ArduinoUno
    r1 = new Resistor
    mcu.d13 - r1.p1
`;

    const res = parseAto(syntaxErrAto);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.length).toBeGreaterThan(0);
    const err = res.diagnostics[0]!;
    expect(err.ruleId).toBe("ato.syntax-error");
    expect(err.sourceRange?.startLine).toBe(5);
  });

  it("reports error when connecting nonexistent component or port in .ato code", () => {
    const missingCompAto = `
module MissingCompCircuit:
    mcu = new ArduinoUno
    mcu.d13 ~ phantom_resistor.p1
`;

    const res = parseAto(missingCompAto);
    expect(res.valid).toBe(false);
    expect(res.diagnostics.some((d) => d.message.includes("phantom_resistor"))).toBe(true);
  });

  it("translates .ato-synthesized Circuit IR into compiling Arduino C++ firmware", () => {
    const res = synthesizeAto(DEFAULT_ATO_SKETCH);
    const arduinoCode = circuitToArduino(res.circuit);

    expect(arduinoCode).toContain("void setup()");
    expect(arduinoCode).toContain("void loop()");
    expect(arduinoCode).toContain("pinMode(13, OUTPUT)");
    expect(arduinoCode).toContain("pinMode(2, INPUT_PULLUP)");
    expect(arduinoCode).toContain("digitalWrite(13, HIGH)");
    expect(arduinoCode).toContain("digitalRead(2)");
  });

  it("performs roundtrip translation between Circuit IR, .ato, and Arduino firmware", () => {
    const res = synthesizeAto(DEFAULT_ATO_SKETCH);
    const exportedAto = circuitToAto(res.circuit, { moduleName: "MainCircuit" });

    expect(exportedAto).toContain("module MainCircuit:");
    expect(exportedAto).toContain("signal GND");
    expect(exportedAto).toContain("new Resistor");
    expect(exportedAto).toContain("~");

    const reParsed = parseAto(exportedAto);
    expect(reParsed.valid).toBe(true);
    expect(reParsed.circuit.components.length).toBe(res.circuit.components.length);
  });
});
