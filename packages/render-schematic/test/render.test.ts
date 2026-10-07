import fs from "fs";
import path from "path";
import { synthesizeSketch } from "@s2c/arduino";
import { createCircuit } from "@s2c/core";
import { describe, expect, it } from "vitest";
import {
  checkSchematicCollisions,
  computeElementBoundingBoxes,
  computeSchematicLayout,
  RENDER_SCHEMATIC_VERSION,
  renderResistor,
  renderSchematicSvg,
  routeNetsExperimental,
  THEME_COLORS,
} from "../src/index.js";

describe("@s2c/render-schematic package (M3)", () => {
  it("exports package version constant", () => {
    expect(RENDER_SCHEMATIC_VERSION).toBe("0.1.0");
  });

  // (a) Determinism test: same Circuit IR rendered twice produces byte-identical SVG
  it("(a) determinism test: same Circuit IR rendered twice produces byte-identical SVG", () => {
    const circuit = createCircuit({
      title: "Deterministic Blink Circuit",
      description: "Reproducibility verification circuit",
    })
      .addPart("ARDUINO_UNO_R3", "U1")
      .addResistor("R1", "220Ω")
      .addLed("LED1", "Red")
      .connect("U1.D9", "R1.1")
      .connect("R1.2", "LED1.A")
      .connectNet("GND", ["LED1.K", "U1.GND"])
      .build();

    const render1 = renderSchematicSvg(circuit, { theme: "dark" });
    const render2 = renderSchematicSvg(circuit, { theme: "dark" });

    // Exact byte-for-byte string equality
    expect(render1.svg).toBe(render2.svg);
    expect(render1.width).toBe(render2.width);
    expect(render1.height).toBe(render2.height);
    expect(render1.viewBox).toBe(render2.viewBox);
  });

  // (b) Symbol snapshot test: resistor renders expected IEEE zigzag path data
  it("(b) symbol snapshot test: resistor renders expected IEEE zigzag path data", () => {
    const circuit = createCircuit({ title: "Resistor Snapshot" }).addResistor("R1", "10kΩ").build();

    const layout = computeSchematicLayout(circuit, { padding: 40 });
    const placedResistor = layout.components.find((c) => c.component.id === "R1");
    expect(placedResistor).toBeDefined();
    if (!placedResistor) throw new Error("Placed resistor not found");

    const resistorSvg = renderResistor(placedResistor, THEME_COLORS.dark);

    // Verify component wrapper attributes
    expect(resistorSvg).toContain(
      '<g id="comp-R1" class="component component-resistor" data-component-id="R1">',
    );
    // Verify reference designator and value texts
    expect(resistorSvg).toContain(">R1</text>");
    expect(resistorSvg).toContain(">10kΩ</text>");

    // Verify the standard IEEE 6-peak zigzag path
    // cx = 100, cy = 100, width = 80, height = 40
    const expectedPath =
      "M 60 100 L 80 100 L 83.33333333333333 88 L 90 112 L 96.66666666666667 88 L 103.33333333333334 112 L 110 88 L 116.66666666666667 112 L 120 100 L 140 100";
    expect(resistorSvg).toContain(`d="${expectedPath}"`);
  });

  // (c) ViewBox / Bounding-box correctness for a multi-component circuit
  it("(c) viewBox / bounding-box correctness for a multi-component circuit", () => {
    const circuit = createCircuit({ title: "Multi-Component Layout Bounding Box" })
      .addPart("ARDUINO_UNO_R3", "U1")
      .addResistor("R1", "1kΩ")
      .addResistor("R2", "2kΩ")
      .addResistor("R3", "3kΩ")
      .addLed("LED1", "Blue")
      .addCapacitor("C1", "100nF")
      .connect("U1.D13", "R1.1")
      .connect("R1.2", "LED1.A")
      .connectNet("GND", ["LED1.K", "U1.GND", "C1.2"])
      .build();

    const layout = computeSchematicLayout(circuit, { padding: 50 });

    // Verify layout coordinates bounding box
    expect(layout.components.length).toBe(6);
    expect(layout.width).toBeGreaterThanOrEqual(800);
    expect(layout.height).toBeGreaterThanOrEqual(500);

    // Render result viewBox matches layout dimensions
    const result = renderSchematicSvg(circuit, { padding: 50 });
    expect(result.width).toBe(layout.width);
    expect(result.height).toBe(layout.height);
    expect(result.viewBox).toBe(`0 0 ${layout.width} ${layout.height}`);

    // All component positions must be strictly within canvas bounds (including padding)
    for (const comp of layout.components) {
      expect(comp.x).toBeGreaterThanOrEqual(50);
      expect(comp.x + comp.width).toBeLessThanOrEqual(result.width - 50);
      expect(comp.y).toBeGreaterThanOrEqual(50);
      expect(comp.y + comp.height).toBeLessThanOrEqual(result.height - 50);
    }
  });

  it("renders net labels attached to pins per Doc §10 (avoiding wire routing)", () => {
    const circuit = createCircuit({ title: "Net Label Architecture" })
      .addResistor("R1", "330Ω")
      .addLed("LED1", "Green")
      .connect("R1.2", "LED1.A")
      .connectNet("5V", ["R1.1"])
      .connectNet("GND", ["LED1.K"])
      .build();

    const result = renderSchematicSvg(circuit);

    // In Doc §10 net-label architecture:
    // Net label badges and power/ground glyphs appear, no crisscrossing wire paths
    expect(result.svg).toContain('class="net-label-badge"');
    expect(result.svg).toContain('class="symbol-ground"');
    expect(result.svg).toContain('class="symbol-power"');
    expect(result.svg).not.toContain('class="net-wire"');
  });

  it("isolates experimental v2 wire router without affecting default v1 renderer", () => {
    const circuit = createCircuit()
      .addResistor("R1", "1kΩ")
      .addResistor("R2", "2kΩ")
      .connect("R1.1", "R2.1")
      .build();

    const layout = computeSchematicLayout(circuit);
    const experimentalNets = routeNetsExperimental(circuit, layout.portPositions);

    expect(experimentalNets.length).toBeGreaterThan(0);
    expect(experimentalNets[0].pathData).toContain("M ");
  });

  // (d) Zero-collision invariant: automated post-layout bounding-box overlap verification
  it("(d) asserts zero bounding-box overlaps on the multi-peripheral circuit (user_multi_peripheral.ino)", () => {
    const fixturePath = path.resolve(__dirname, "../../../fixtures/sketches/user_multi_peripheral.ino");
    expect(fs.existsSync(fixturePath)).toBe(true);

    const sketchCode = fs.readFileSync(fixturePath, "utf-8");
    const { circuit } = synthesizeSketch(sketchCode, { boardId: "ARDUINO_UNO_R3" });

    const report = checkSchematicCollisions(circuit);
    if (!report.valid) {
      console.error(
        "Collisions detected in user_multi_peripheral:",
        report.collisions.map(
          (c) => `${c.elementA.id} (${c.elementA.type}) vs ${c.elementB.id} (${c.elementB.type})`,
        ),
      );
    }
    expect(report.valid).toBe(true);
    expect(report.collisionCount).toBe(0);
    expect(report.collisions).toHaveLength(0);

    // Verify SVG renders properly
    const svgResult = renderSchematicSvg(circuit);
    expect(svgResult.svg).toContain("<svg");
    expect(svgResult.svg).toContain("TowerPro SG90 Micro Servo 9g");
    expect(svgResult.svg).toContain("Passive Piezo Buzzer");
  });

  it("(e) asserts zero bounding-box overlaps on every sketch in the fixture corpus", () => {
    const fixturesDir = path.resolve(__dirname, "../../../fixtures/sketches");
    const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith(".ino"));
    expect(files.length).toBeGreaterThanOrEqual(2);

    for (const file of files) {
      const sketchCode = fs.readFileSync(path.join(fixturesDir, file), "utf-8");
      const { circuit } = synthesizeSketch(sketchCode, { boardId: "ARDUINO_UNO_R3" });
      const report = checkSchematicCollisions(circuit);
      expect(
        report.valid,
        `Expected 0 collisions in ${file}, found ${report.collisionCount}: ${report.collisions
          .map((c) => `${c.elementA.id} vs ${c.elementB.id}`)
          .join(", ")}`,
      ).toBe(true);
      expect(report.collisionCount).toBe(0);
    }
  });
});
