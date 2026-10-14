/**
 * @license Apache-2.0
 * @s2c/exporters — KiCad S-Expression Netlist (.net) Exporter.
 *
 * Produces a standard KiCad S-expression netlist compatible with KiCad PCB Editor (v6/v7/v8).
 */

import type { Circuit } from "@s2c/circuit-json";

function escapeSExpr(str: string): string {
  return str.replace(/["\\]/g, "\\$&");
}

/**
 * Serializes Circuit IR to a standard KiCad S-expression netlist (.net).
 */
export function toKiCadNetlist(circuit: Circuit): string {
  const lines: string[] = [
    '(export (version "E")',
    "  (design",
    `    (source "${escapeSExpr(circuit.name || "sketch2circuit")}")`,
    `    (date "${escapeSExpr(circuit.metadata?.generatedAt || new Date().toISOString())}")`,
    `    (tool "sketch2circuit EDA Compiler"))`,
    "  (components",
  ];

  // Components block
  for (const comp of circuit.components) {
    const ref = comp.id;
    const val = comp.value ? String(comp.value) : comp.name || comp.kind;
    const footprint = comp.footprint || `Generic_Footprints:${comp.kind}`;
    const libpart = comp.kind === "resistor" ? "R" : comp.kind === "capacitor" ? "C" : comp.kind === "led" ? "LED" : comp.kind;

    lines.push(`    (comp (ref "${escapeSExpr(ref)}")`);
    lines.push(`      (value "${escapeSExpr(val)}")`);
    lines.push(`      (footprint "${escapeSExpr(footprint)}")`);
    lines.push(`      (libsource (lib "Device") (part "${escapeSExpr(libpart)}"))`);
    lines.push('      (sheetpath (names "/") (tstamps "/")))');
  }
  lines.push("  )");

  // Nets block
  lines.push("  (nets");
  let code = 1;
  for (const net of circuit.nets) {
    lines.push(`    (net (code "${code++}") (name "${escapeSExpr(net.id)}")`);
    for (const portId of net.portIds) {
      const [compRef, pin] = portId.split(".");
      if (compRef && pin) {
        lines.push(`      (node (ref "${escapeSExpr(compRef)}") (pin "${escapeSExpr(pin)}"))`);
      }
    }
    lines.push("    )");
  }
  lines.push("  )");
  lines.push(")");

  return lines.join("\n");
}
