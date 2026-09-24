import { createCircuit } from "@s2c/core";
import { describe, expect, it } from "vitest";
import {
  EXPORT_VERSION,
  exportBomCsv,
  exportKicadNetlist,
  formatBomMarkdown,
  formatWiringTableAscii,
  formatWiringTableMarkdown,
  generateBom,
  generateSynthesisReport,
  generateWiringTable,
} from "../src/index.js";

describe("@s2c/export Suite (Doc §13)", () => {
  it("exports package version constant", () => {
    expect(EXPORT_VERSION).toBe("0.1.0");
  });

  const testCircuit = createCircuit({ title: "Blinky Circuit" })
    .addPart("ARDUINO_UNO_R3", "U1")
    .addLed("D1", "Red")
    .addResistor("R1", "330Ω")
    .connect("U1.D13", "R1.1")
    .connect("R1.2", "D1.A")
    .connectNet("GND", ["D1.K", "U1.GND"])
    .build();

  it("generates structured wiring table and formats as markdown and ascii", () => {
    const rows = generateWiringTable(testCircuit);
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const mcuRow = rows.find((r) => r.fromPort === "U1.D13");
    expect(mcuRow).toBeDefined();
    expect(mcuRow?.toPort).toBe("R1.1");
    expect(mcuRow?.componentRef).toBe("R1");

    const md = formatWiringTableMarkdown(rows);
    expect(md).toContain("| MCU / From Pin | Component | Terminal | Net | Description / Notes |");
    expect(md).toContain("`U1.D13`");
    expect(md).toContain("**R1**");

    const ascii = formatWiringTableAscii(rows);
    expect(ascii).toContain("WIRING TABLE");
    expect(ascii).toContain("U1.D13");
  });

  it("generates Bill of Materials (BOM) and exports RFC 4180 CSV", () => {
    const bom = generateBom(testCircuit);
    expect(bom.length).toBeGreaterThanOrEqual(2);

    const rRow = bom.find((b) => b.partNumber.includes("RES") || b.value === "330Ω");
    expect(rRow).toBeDefined();
    expect(rRow?.designators).toContain("R1");

    const csv = exportBomCsv(bom);
    expect(csv).toContain("Item,Qty,Reference,Value,Part Number,Description,Footprint");
    expect(csv).toContain("330Ω");

    const md = formatBomMarkdown(bom);
    expect(md).toContain("| Item | Qty | Reference | Value |");
    expect(md).toContain("`R1`");
  });

  it("exports KiCad S-expression netlist (.net)", () => {
    const netlist = exportKicadNetlist(testCircuit);
    expect(netlist).toContain('(export (version "E")');
    expect(netlist).toContain('(comp (ref "U1")');
    expect(netlist).toContain('(comp (ref "D1")');
    expect(netlist).toContain('(comp (ref "R1")');
    expect(netlist).toContain("(nets");
    expect(netlist).toContain('(node (ref "U1") (pin "D13"))');
    expect(netlist).toContain('(node (ref "R1") (pin "1"))');
  });

  it("generates complete markdown synthesis report", () => {
    const report = generateSynthesisReport(testCircuit, {
      title: "Blink Circuit",
      sourceFile: "Blink.ino",
      diagnostics: [
        {
          ruleId: "erc.servo-power",
          severity: "warning",
          message: "High power load",
          explanation: "High current draw exceeds onboard supply",
          suggestion: "Use external 5V regulator",
          target: { type: "component", id: "U1" },
        },
      ],
      unresolved: ["Dynamic pin 'pins[i]' in pinMode"],
    });

    expect(report).toContain("# Circuit Synthesis Report: Blink Circuit");
    expect(report).toContain("## 1. Executive Summary");
    expect(report).toContain("## 2. Electrical Rules Check (ERC) Diagnostics");
    expect(report).toContain("## 3. Unresolved Dynamic Items (Doc §12.8)");
    expect(report).toContain("## 4. Hardware Wiring Table");
    expect(report).toContain("## 5. Bill of Materials (BOM)");
  });
});
