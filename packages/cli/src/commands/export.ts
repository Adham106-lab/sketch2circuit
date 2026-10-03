/**
 * @license Apache-2.0
 * @s2c/cli — `s2c export` Command (Doc §13 / §15).
 */

import fs from "node:fs";
import path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import type { Circuit } from "@s2c/circuit-json";
import {
  exportBomCsv,
  exportKicadNetlist,
  formatWiringTableMarkdown,
  generateBom,
  generateWiringTable,
} from "@s2c/export";
import { circuitToAto } from "@s2c/export-ato";

export interface ExportCommandOptions {
  format?: "ato" | "netlist" | "kicad" | "bom" | "wiring";
  out?: string;
  board?: string;
}

export function exportCommand(
  filePath: string,
  options: ExportCommandOptions = {},
): { code: number; output: string } {
  if (!filePath) {
    return {
      code: 3,
      output:
        "Error: Missing input file.\nUsage: s2c export --format <ato|netlist|bom|wiring> <sketch.ino|circuit.json> [-o <outfile>]",
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

  if (filePath.endsWith(".json")) {
    try {
      circuit = JSON.parse(content) as Circuit;
    } catch (err) {
      return {
        code: 3,
        output: `Error: Invalid Circuit JSON: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  } else {
    const boardId = options.board?.toLowerCase() === "nano" ? "ARDUINO_NANO" : "ARDUINO_UNO_R3";
    const result = synthesizeSketch(content, { boardId });
    circuit = result.circuit;
  }

  const format = options.format || "ato";
  let outputData = "";

  switch (format) {
    case "ato": {
      outputData = circuitToAto(circuit);
      break;
    }
    case "netlist":
    case "kicad": {
      outputData = exportKicadNetlist(circuit);
      break;
    }
    case "bom": {
      const bom = generateBom(circuit);
      outputData = exportBomCsv(bom);
      break;
    }
    case "wiring": {
      const table = generateWiringTable(circuit);
      outputData = formatWiringTableMarkdown(table);
      break;
    }
    default: {
      return {
        code: 3,
        output: `Error: Unknown export format '${format}'. Valid formats: ato, netlist, bom, wiring`,
      };
    }
  }

  if (options.out) {
    const outPath = options.out;
    const dir = path.dirname(outPath);
    if (dir && dir !== ".") {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outPath, outputData, "utf-8");
    return {
      code: 0,
      output: `Exported ${format.toUpperCase()} successfully to ${outPath} (${outputData.length} bytes)`,
    };
  }

  return {
    code: 0,
    output: outputData,
  };
}
