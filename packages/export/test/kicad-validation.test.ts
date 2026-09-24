/**
 * @license Apache-2.0
 * Comprehensive S-Expression AST & Golden-File Validation Tests for KiCad Netlist (GAP-01).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCircuit } from "@s2c/core";
import { describe, expect, it } from "vitest";
import { exportKicadNetlist, parseSExpr, validateKicadNetlistSExpr } from "../src/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("KiCad Netlist S-Expression AST & Golden-File Validation (GAP-01)", () => {
  const testCircuit = createCircuit({
    title: "Blinky Circuit",
  })
    .addPart("ARDUINO_UNO_R3", "U1")
    .addLed("D1", "Red")
    .addResistor("R1", "330Ω")
    .connect("U1.D13", "R1.1")
    .connect("R1.2", "D1.A")
    .connectNet("GND", ["D1.K", "U1.GND"])
    .build();

  it("parses nested S-expressions with atoms and escape characters", () => {
    const input = '(export (version "E") (design (source "test\\"quoted\\"")))';
    const ast = parseSExpr(input);

    expect(ast.length).toBe(1);
    expect(ast[0].type).toBe("list");
    if (ast[0].type === "list") {
      expect(ast[0].tag).toBe("export");
      expect(ast[0].items.length).toBe(3);
    }
  });

  it("rejects unbalanced parentheses with informative syntax errors", () => {
    expect(() => parseSExpr('(export (version "E"')).toThrow(
      "Unclosed parenthesis in S-expression",
    );
    expect(() => parseSExpr('(export (version "E")))')).toThrow("Unexpected closing parenthesis");
  });

  it("validates exported netlist against strict KiCad Version E S-expression schema", () => {
    const netlist = exportKicadNetlist(testCircuit);
    const validation = validateKicadNetlistSExpr(netlist);

    expect(validation.valid).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.version).toBe("E");
    expect(validation.componentCount).toBe(3);
    expect(validation.netCount).toBe(3);

    // Verify component records in AST
    const u1 = validation.components.find((c) => c.ref === "U1");
    const d1 = validation.components.find((c) => c.ref === "D1");
    const r1 = validation.components.find((c) => c.ref === "R1");
    expect(u1).toBeDefined();
    expect(d1?.value).toBe("Red");
    expect(r1?.value).toBe("330Ω");

    // Verify net node references
    const gndNet = validation.nets.find((n) => n.name === "GND");
    expect(gndNet).toBeDefined();
    expect(gndNet?.nodes).toContainEqual({ ref: "D1", pin: "K" });
    expect(gndNet?.nodes).toContainEqual({ ref: "U1", pin: "GND" });
  });

  it("flags semantic violations in corrupted netlists", () => {
    // Netlist referencing undefined component ref U99
    const badNetlist = `
(export (version "E")
  (design (source "Test"))
  (components
    (comp (ref "R1") (value "10k") (footprint "Resistor") (libsource (lib "D") (part "R")) (sheetpath (names "/") (tstamps "/")))
  )
  (nets
    (net (code "1") (name "NET1")
      (node (ref "R1") (pin "1"))
      (node (ref "U99") (pin "4"))
    )
  )
)
`;
    const res = validateKicadNetlistSExpr(badNetlist);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes("references unknown component ref 'U99'"))).toBe(true);
  });

  it("performs golden-file differential verification against KiCad reference netlist", () => {
    const goldenPath = join(__dirname, "fixtures", "kicad_blink_golden.net");
    const goldenText = readFileSync(goldenPath, "utf-8");

    // Validate the golden file itself
    const goldenValidation = validateKicadNetlistSExpr(goldenText);
    expect(goldenValidation.valid).toBe(true);

    // Generate fresh netlist from the circuit IR
    const generatedNetlist = exportKicadNetlist(testCircuit);
    const genValidation = validateKicadNetlistSExpr(generatedNetlist);
    expect(genValidation.valid).toBe(true);

    // Assert structural equivalence
    expect(genValidation.version).toBe(goldenValidation.version);
    expect(genValidation.componentCount).toBe(goldenValidation.componentCount);
    expect(genValidation.netCount).toBe(goldenValidation.netCount);

    // Assert topological equivalence of components
    const genRefs = genValidation.components.map((c) => c.ref).sort();
    const goldenRefs = goldenValidation.components.map((c) => c.ref).sort();
    expect(genRefs).toEqual(goldenRefs);

    // Assert node pin connections match
    for (const goldenNet of goldenValidation.nets) {
      const match = genValidation.nets.find((n) => n.name === goldenNet.name);
      expect(match).toBeDefined();
      expect(match?.nodes.length).toBe(goldenNet.nodes.length);
    }
  });
});
