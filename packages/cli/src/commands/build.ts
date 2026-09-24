/**
 * @license Apache-2.0
 * @s2c/cli — `s2c build <circuit.tsx|circuit.json>` Command (Doc §13).
 */

import fs from "node:fs";
import path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import { type Circuit, CircuitSchema } from "@s2c/circuit-json";
import {
  exportBomCsv,
  exportKicadNetlist,
  formatWiringTableMarkdown,
  generateBom,
  generateWiringTable,
} from "@s2c/export";
import { renderSchematicSvg } from "@s2c/render-schematic";

export interface BuildOptions {
  out?: string;
  format?: "json" | "svg" | "bom" | "wiring" | "netlist" | "all";
}

export function buildCommand(
  filePath: string,
  options: BuildOptions = {},
): { code: number; output: string } {
  if (!filePath) {
    return {
      code: 3,
      output:
        "Error: Missing input file.\nUsage: s2c build <circuit.json|sketch.ino> [--out ./out] [--format svg|json|bom]",
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      code: 3,
      output: `Error: File not found: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  let circuit: Circuit;

  if (filePath.endsWith(".ino") || filePath.endsWith(".cpp") || filePath.endsWith(".c")) {
    const synth = synthesizeSketch(content);
    circuit = synth.circuit;
  } else {
    try {
      const parsed = JSON.parse(content);
      circuit = CircuitSchema.parse(parsed) as Circuit;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        code: 3,
        output: `Error parsing circuit: ${msg}`,
      };
    }
  }

  const baseName = path.basename(filePath, path.extname(filePath));

  if (options.out) {
    fs.mkdirSync(options.out, { recursive: true });

    // Write IR JSON
    fs.writeFileSync(
      path.join(options.out, `${baseName}.circuit.json`),
      JSON.stringify(circuit, null, 2),
      "utf-8",
    );

    // Write SVG
    const svg = renderSchematicSvg(circuit).svg;
    fs.writeFileSync(path.join(options.out, `${baseName}.schematic.svg`), svg, "utf-8");

    // Write BOM CSV
    const bomRows = generateBom(circuit);
    fs.writeFileSync(path.join(options.out, `${baseName}.bom.csv`), exportBomCsv(bomRows), "utf-8");

    // Write Wiring
    const wiringRows = generateWiringTable(circuit);
    fs.writeFileSync(
      path.join(options.out, `${baseName}.wiring.md`),
      formatWiringTableMarkdown(wiringRows),
      "utf-8",
    );

    // Write KiCad netlist
    const netlist = exportKicadNetlist(circuit);
    fs.writeFileSync(path.join(options.out, `${baseName}.kicad.net`), netlist, "utf-8");

    return {
      code: 0,
      output: `Built artifacts for '${filePath}' -> ${options.out}\nGenerated: JSON, SVG, BOM, Wiring, and KiCad Netlist.`,
    };
  }

  const format = options.format || "json";
  if (format === "svg") {
    return { code: 0, output: renderSchematicSvg(circuit).svg };
  }
  if (format === "bom") {
    return { code: 0, output: exportBomCsv(generateBom(circuit)) };
  }
  if (format === "wiring") {
    return { code: 0, output: formatWiringTableMarkdown(generateWiringTable(circuit)) };
  }
  if (format === "netlist") {
    return { code: 0, output: exportKicadNetlist(circuit) };
  }

  return { code: 0, output: JSON.stringify(circuit, null, 2) };
}
