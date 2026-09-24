/**
 * @license Apache-2.0
 * @s2c/cli — `s2c sketch <sketch.ino>` Command (Doc §13).
 */

import fs from "node:fs";
import path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import {
  exportBomCsv,
  exportKicadNetlist,
  formatWiringTableMarkdown,
  generateBom,
  generateSynthesisReport,
  generateWiringTable,
} from "@s2c/export";
import { renderSchematicSvg } from "@s2c/render-schematic";

export interface SketchOptions {
  board?: string;
  format?: "json" | "svg" | "report" | "wiring" | "bom" | "netlist" | "all";
  out?: string;
  annotationsOnly?: boolean;
  interactive?: boolean;
  strict?: boolean;
}

export function sketchCommand(
  filePath: string,
  options: SketchOptions = {},
): { code: number; output: string } {
  if (!filePath) {
    return {
      code: 3,
      output:
        "Error: Missing sketch file.\nUsage: s2c sketch <sketch.ino> [--board uno] [--format json|svg|report|wiring|bom|netlist] [--out ./out]",
    };
  }

  if (!fs.existsSync(filePath)) {
    return {
      code: 3,
      output: `Error: File not found: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const result = synthesizeSketch(content, {
    boardId: options.board?.toLowerCase() === "uno" ? "ARDUINO_UNO_R3" : "ARDUINO_UNO_R3",
  });

  const baseName = path.basename(filePath, path.extname(filePath));
  const format = options.format || (options.out ? "all" : "report");

  // If output directory is specified, write output files
  if (options.out) {
    fs.mkdirSync(options.out, { recursive: true });

    // 1. JSON
    fs.writeFileSync(
      path.join(options.out, `${baseName}.circuit.json`),
      JSON.stringify(result.circuit, null, 2),
      "utf-8",
    );

    // 2. SVG
    const svg = renderSchematicSvg(result.circuit).svg;
    fs.writeFileSync(path.join(options.out, `${baseName}.schematic.svg`), svg, "utf-8");

    // 3. Wiring table
    const wiringRows = generateWiringTable(result.circuit);
    fs.writeFileSync(
      path.join(options.out, `${baseName}.wiring.md`),
      formatWiringTableMarkdown(wiringRows),
      "utf-8",
    );

    // 4. BOM CSV
    const bomRows = generateBom(result.circuit);
    fs.writeFileSync(path.join(options.out, `${baseName}.bom.csv`), exportBomCsv(bomRows), "utf-8");

    // 5. KiCad netlist
    const netlist = exportKicadNetlist(result.circuit);
    fs.writeFileSync(path.join(options.out, `${baseName}.kicad.net`), netlist, "utf-8");

    // 6. Report
    const report = generateSynthesisReport(result.circuit, {
      title: baseName,
      sourceFile: filePath,
      diagnostics: result.diagnostics,
      unresolved: result.unresolved,
    });
    fs.writeFileSync(path.join(options.out, `${baseName}.report.md`), report, "utf-8");
  }

  let stdoutContent = "";
  if (format === "json") {
    stdoutContent = JSON.stringify(result.circuit, null, 2);
  } else if (format === "svg") {
    stdoutContent = renderSchematicSvg(result.circuit).svg;
  } else if (format === "wiring") {
    const rows = generateWiringTable(result.circuit);
    stdoutContent = formatWiringTableMarkdown(rows);
  } else if (format === "bom") {
    const rows = generateBom(result.circuit);
    stdoutContent = exportBomCsv(rows);
  } else if (format === "netlist") {
    stdoutContent = exportKicadNetlist(result.circuit);
  } else {
    // report or all
    const report = generateSynthesisReport(result.circuit, {
      title: baseName,
      sourceFile: filePath,
      diagnostics: result.diagnostics,
      unresolved: result.unresolved,
    });
    stdoutContent = options.out
      ? `Successfully synthesized '${filePath}' -> ${options.out}\nGenerated: JSON, SVG, Wiring, BOM CSV, KiCad netlist, and Report.`
      : report;
  }

  const errors = result.diagnostics.filter((d) => d.severity === "error");
  if (errors.length > 0) {
    return { code: 1, output: stdoutContent };
  }
  if (options.strict && result.unresolved.length > 0) {
    return { code: 2, output: stdoutContent };
  }

  return { code: 0, output: stdoutContent };
}
