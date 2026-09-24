import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CLI_VERSION, runCli } from "../src/index.js";

describe("@s2c/cli Command Line Suite (Doc §13)", () => {
  it("exports package version constant", () => {
    expect(CLI_VERSION).toBe("0.1.0");
  });

  describe("Global Flags & Help", () => {
    it("returns help text with exit code 0 on --help", async () => {
      const res = await runCli(["--help"]);
      expect(res.code).toBe(0);
      expect(res.output).toContain("sketch2circuit (s2c)");
      expect(res.output).toContain("COMMANDS:");
    });

    it("returns version on --version", async () => {
      const res = await runCli(["--version"]);
      expect(res.code).toBe(0);
      expect(res.output).toContain("s2c version 0.1.0");
    });

    it("returns exit code 3 on unknown command", async () => {
      const res = await runCli(["foobar"]);
      expect(res.code).toBe(3);
      expect(res.output).toContain("Unknown command 'foobar'");
    });
  });

  describe("s2c explain <ruleId>", () => {
    it("explains rule with engineering rationale and remediation", async () => {
      const res = await runCli(["explain", "erc.led-current"]);
      expect(res.code).toBe(0);
      expect(res.output).toContain("RULE: erc.led-current");
      expect(res.output).toContain("ENGINEERING RATIONALE:");
      expect(res.output).toContain("REMEDIATION");
      expect(res.output).toContain("I_f = (V_supply - V_f) / R_series");
    });

    it("outputs structured JSON when --json flag is passed", async () => {
      const res = await runCli(["explain", "erc.floating-input", "--json"]);
      expect(res.code).toBe(0);
      const parsed = JSON.parse(res.output);
      expect(parsed.id).toBe("erc.floating-input");
      expect(parsed.rationale).toBeDefined();
    });

    it("returns exit code 3 on unknown rule ID", async () => {
      const res = await runCli(["explain", "erc.nonexistent-rule"]);
      expect(res.code).toBe(3);
      expect(res.output).toContain("Unknown rule 'erc.nonexistent-rule'");
    });
  });

  describe("s2c sketch <sketch.ino>", () => {
    const tmpDir = path.join(os.tmpdir(), `s2c-test-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const blinkPath = path.join(tmpDir, "Blink.ino");
    fs.writeFileSync(
      blinkPath,
      `
        const int led = 13;
        void setup() { pinMode(led, OUTPUT); }
        void loop() { digitalWrite(led, HIGH); delay(1000); digitalWrite(led, LOW); delay(1000); }
      `,
      "utf-8",
    );

    it("synthesizes sketch and outputs human report", async () => {
      const res = await runCli(["sketch", blinkPath, "--format", "report"]);
      expect(res.code).toBe(0);
      expect(res.output).toContain("# Circuit Synthesis Report:");
      expect(res.output).toContain("## 4. Hardware Wiring Table");
      expect(res.output).toContain("## 5. Bill of Materials (BOM)");
    });

    it("outputs wiring table markdown on --format wiring", async () => {
      const res = await runCli(["sketch", blinkPath, "--format", "wiring"]);
      expect(res.code).toBe(0);
      expect(res.output).toContain("| MCU / From Pin | Component | Terminal | Net |");
      expect(res.output).toContain("`U1.D13`");
    });

    it("outputs BOM CSV on --format bom", async () => {
      const res = await runCli(["sketch", blinkPath, "--format", "bom"]);
      expect(res.code).toBe(0);
      expect(res.output).toContain("Item,Qty,Reference,Value,Part Number");
      expect(res.output).toContain("300Ω");
    });

    it("outputs KiCad netlist on --format netlist", async () => {
      const res = await runCli(["sketch", blinkPath, "--format", "netlist"]);
      expect(res.code).toBe(0);
      expect(res.output).toContain('(export (version "E")');
      expect(res.output).toContain('(comp (ref "D1")');
    });

    it("generates all 6 production artifacts into --out directory", async () => {
      const outDir = path.join(tmpDir, "out_artifacts");
      const res = await runCli(["sketch", blinkPath, "--out", outDir]);
      expect(res.code).toBe(0);
      expect(res.output).toContain("Successfully synthesized");

      expect(fs.existsSync(path.join(outDir, "Blink.circuit.json"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "Blink.schematic.svg"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "Blink.wiring.md"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "Blink.bom.csv"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "Blink.kicad.net"))).toBe(true);
      expect(fs.existsSync(path.join(outDir, "Blink.report.md"))).toBe(true);
    });
  });

  describe("s2c check <circuit|sketch> Exit Codes (Doc §13)", () => {
    const tmpDir = path.join(os.tmpdir(), `s2c-check-${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    it("exits with 0 on valid sketch with no ERC errors", async () => {
      const validSketch = path.join(tmpDir, "Valid.ino");
      fs.writeFileSync(
        validSketch,
        `
          const int led = 13;
          void setup() { pinMode(led, OUTPUT); }
          void loop() { digitalWrite(led, HIGH); }
        `,
        "utf-8",
      );

      const res = await runCli(["check", validSketch]);
      expect(res.code).toBe(0);
      expect(res.output).toContain("0 error(s)");
    });

    it("exits with 1 when ERC errors are present (power short)", async () => {
      const shortCircuit = path.join(tmpDir, "short.circuit.json");
      fs.writeFileSync(
        shortCircuit,
        JSON.stringify({
          schemaVersion: "0.1.0",
          name: "Dead Short",
          components: [
            {
              id: "U1",
              kind: "mcu",
              name: "MCU",
              ports: [
                { id: "U1.5V", name: "5V", kind: "power", voltageRange: [5, 5] },
                { id: "U1.GND", name: "GND", kind: "ground", voltageRange: [0, 0] },
              ],
            },
          ],
          nets: [{ id: "SHORT_NET", kind: "power", portIds: ["U1.5V", "U1.GND"] }],
        }),
        "utf-8",
      );

      const res = await runCli(["check", shortCircuit]);
      expect(res.code).toBe(1);
      expect(res.output).toContain("❌ ERROR: [erc.power-short]");
    });

    it("exits with 2 when runtime-computed pins are present in --strict mode", async () => {
      const dynamicSketch = path.join(tmpDir, "Dynamic.ino");
      fs.writeFileSync(
        dynamicSketch,
        `
          void setup() {
            for (int i = 0; i < 4; i++) {
              pinMode(pins[i], OUTPUT);
            }
          }
        `,
        "utf-8",
      );

      const res = await runCli(["check", dynamicSketch, "--strict"]);
      expect(res.code).toBe(2);
      expect(res.output).toContain("FAILED in --strict mode due to unresolved dynamic pin items");
    });
  });
});
