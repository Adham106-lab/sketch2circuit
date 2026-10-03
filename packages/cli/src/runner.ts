/**
 * @license Apache-2.0
 * @s2c/cli — CLI Argument Dispatcher and Runner (Doc §13).
 */

import { buildCommand } from "./commands/build.js";
import { checkCommand } from "./commands/check.js";
import { explainCommand } from "./commands/explain.js";
import { exportCommand } from "./commands/export.js";
import { sketchCommand } from "./commands/sketch.js";

export const CLI_VERSION = "0.1.0";

export interface CliResult {
  code: number;
  output: string;
}

export async function runCli(args: string[]): Promise<CliResult> {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    return {
      code: 0,
      output: getHelpText(),
    };
  }

  if (args.includes("--version") || args.includes("-v")) {
    return {
      code: 0,
      output: `s2c version ${CLI_VERSION}`,
    };
  }

  const [command, ...subArgs] = args;

  switch (command) {
    case "explain": {
      const ruleId = subArgs.find((a) => !a.startsWith("-")) || "";
      const json = subArgs.includes("--json");
      return explainCommand(ruleId, { json });
    }

    case "check": {
      const filePath = subArgs.find((a) => !a.startsWith("-")) || "";
      const strict = subArgs.includes("--strict");
      const json = subArgs.includes("--json");
      return checkCommand(filePath, { strict, json });
    }

    case "sketch": {
      const filePath = subArgs.find((a) => !a.startsWith("-")) || "";
      let board = "uno";
      let format: "json" | "svg" | "report" | "wiring" | "bom" | "netlist" | "all" | undefined;
      let out: string | undefined;
      let annotationsOnly = false;
      let interactive = false;
      let strict = false;

      for (let i = 0; i < subArgs.length; i++) {
        const arg = subArgs[i];
        if (arg === "--board" && i + 1 < subArgs.length) {
          board = subArgs[++i];
        } else if (arg === "--format" && i + 1 < subArgs.length) {
          format = subArgs[++i] as "json" | "svg" | "report" | "wiring" | "bom" | "netlist" | "all";
        } else if (arg === "--out" && i + 1 < subArgs.length) {
          out = subArgs[++i];
        } else if (arg === "--annotations-only") {
          annotationsOnly = true;
        } else if (arg === "--interactive") {
          interactive = true;
        } else if (arg === "--strict") {
          strict = true;
        }
      }

      return sketchCommand(filePath, {
        board,
        format,
        out,
        annotationsOnly,
        interactive,
        strict,
      });
    }

    case "build": {
      const filePath = subArgs.find((a) => !a.startsWith("-")) || "";
      let out: string | undefined;
      let format: "json" | "svg" | "bom" | "wiring" | "netlist" | "all" | undefined;

      for (let i = 0; i < subArgs.length; i++) {
        const arg = subArgs[i];
        if (arg === "--out" && i + 1 < subArgs.length) {
          out = subArgs[++i];
        } else if (arg === "--format" && i + 1 < subArgs.length) {
          format = subArgs[++i] as "json" | "svg" | "bom" | "wiring" | "netlist" | "all";
        }
      }

      return buildCommand(filePath, { out, format });
    }

    case "export": {
      let filePath = "";
      let out: string | undefined;
      let format: "ato" | "netlist" | "kicad" | "bom" | "wiring" | undefined = "ato";
      let board = "uno";

      for (let i = 0; i < subArgs.length; i++) {
        const arg = subArgs[i];
        if ((arg === "-o" || arg === "--out") && i + 1 < subArgs.length) {
          out = subArgs[++i];
        } else if (arg === "--format" && i + 1 < subArgs.length) {
          format = subArgs[++i] as "ato" | "netlist" | "kicad" | "bom" | "wiring";
        } else if (arg === "--board" && i + 1 < subArgs.length) {
          board = subArgs[++i];
        } else if (!arg.startsWith("-") && !filePath) {
          filePath = arg;
        }
      }

      return exportCommand(filePath, { out, format, board });
    }

    default:
      return {
        code: 3,
        output: `Error: Unknown command '${command}'.\nRun 's2c --help' for usage.`,
      };
  }
}

function getHelpText(): string {
  return `sketch2circuit (s2c) — Compiler & Synthesizer CLI (v${CLI_VERSION})

USAGE:
  s2c <command> [options]

COMMANDS:
  export <sketch|circuit>   Export circuit to target format (ato, netlist, bom, wiring)
    --format <fmt>          Output format: ato (default) | netlist | bom | wiring
    -o, --out <file>        Write output to file (prints to stdout if omitted)
    --board <mcu>           Target microcontroller (default: uno)

  sketch <sketch.ino>       Synthesize verified circuit from an Arduino sketch
    --board uno             Target microcontroller board (default: uno)
    --format <fmt>          Output format: json | svg | report | wiring | bom | netlist
    --out <dir>             Write all output files (JSON, SVG, Wiring, BOM, Netlist, Report)
    --strict                Fail (exit code 2) if any dynamic pin expressions are unresolved

  check <circuit|sketch>    Run 18-rule Electrical Rules Check (ERC) on circuit or sketch
    --strict                Fail (exit code 2) if sketch has unresolved items
    --json                  Emit structured JSON diagnostics

  build <circuit|sketch>    Compile circuit IR and generate production artifacts
    --out <dir>             Output directory for artifacts
    --format <fmt>          Output format to stdout: svg | json | bom | wiring | netlist

  explain <ruleId>          Display comprehensive documentation and remediation for an ERC rule
    --json                  Output rule definition as JSON

GLOBAL OPTIONS:
  -h, --help                Show help screen
  -v, --version             Show version number

EXIT CODES:
  0: Success / OK
  1: Electrical Rules Check (ERC) violations / errors found
  2: Unresolved dynamic items present in --strict mode
  3: Command-line or argument usage error
`;
}
