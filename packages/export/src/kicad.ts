/**
 * @license Apache-2.0
 * @s2c/export — KiCad Netlist Exporter (Doc §13).
 */

import type { Circuit } from "@s2c/circuit-json";

/**
 * Exports a Circuit IR to standard KiCad S-expression netlist format (.net).
 * Compatible with KiCad PCB Editor (v6/v7/v8).
 */
export function exportKicadNetlist(circuit: Circuit): string {
  const lines: string[] = [
    '(export (version "E")',
    "  (design",
    `    (source "${circuit.name || "sketch2circuit"}")`,
    `    (date "${circuit.metadata?.generatedAt || new Date().toISOString()}"))`,
    "  (components",
  ];

  // Components block
  for (const comp of circuit.components) {
    const ref = comp.id;
    const val = comp.value ? String(comp.value) : comp.name || comp.kind;
    const footprint = comp.footprint || `Generic:${comp.kind}`;
    lines.push(`    (comp (ref "${ref}")`);
    lines.push(`      (value "${escapeSExpr(val)}")`);
    lines.push(`      (footprint "${escapeSExpr(footprint)}")`);
    lines.push('      (libsource (lib "Device") (part "R"))');
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
        lines.push(`      (node (ref "${compRef}") (pin "${pin}"))`);
      }
    }
    lines.push("    )");
  }
  lines.push("  )");
  lines.push(")");

  return lines.join("\n");
}

function escapeSExpr(str: string): string {
  return str.replace(/["\\]/g, "\\$&");
}
