/**
 * @license Apache-2.0
 * @s2c/export — Bill of Materials (BOM) Exporter (Doc §13).
 */

import type { Circuit } from "@s2c/circuit-json";
import type { BomRow } from "./types.js";

/**
 * Aggregates and groups components from a Circuit IR into a standard Bill of Materials.
 */
export function generateBom(circuit: Circuit): BomRow[] {
  // Group key: kind + value + partNumber
  const groupMap = new Map<
    string,
    {
      designators: string[];
      value: string;
      partNumber: string;
      description: string;
      footprint?: string;
    }
  >();

  for (const comp of circuit.components) {
    const val = comp.value ? String(comp.value) : "—";
    const partNum = comp.partNumber || comp.kind.toUpperCase();
    const key = `${comp.kind}|${val}|${partNum}`;

    let grp = groupMap.get(key);
    if (!grp) {
      grp = {
        designators: [],
        value: val,
        partNumber: partNum,
        description: comp.name || `${comp.kind} ${val !== "—" ? val : ""}`.trim(),
        footprint: comp.footprint,
      };
      groupMap.set(key, grp);
    }
    grp.designators.push(comp.id);
  }

  const rows: BomRow[] = [];
  let itemNum = 1;

  for (const grp of groupMap.values()) {
    // Sort designators naturally: R1, R2, ...
    grp.designators.sort((a, b) => {
      const matchA = a.match(/^([A-Za-z]+)(\d+)$/);
      const matchB = b.match(/^([A-Za-z]+)(\d+)$/);
      if (matchA && matchB && matchA[1] === matchB[1]) {
        return Number(matchA[2]) - Number(matchB[2]);
      }
      return a.localeCompare(b.localeCompare(b) ? a : b);
    });

    rows.push({
      item: itemNum++,
      quantity: grp.designators.length,
      designators: grp.designators.join(", "),
      value: grp.value,
      partNumber: grp.partNumber,
      description: grp.description,
      footprint: grp.footprint,
    });
  }

  return rows.sort((a, b) => a.designators.localeCompare(b.designators));
}

/**
 * Exports BOM as an RFC 4180 compliant CSV string.
 */
export function exportBomCsv(rows: BomRow[]): string {
  const headers = ["Item", "Qty", "Reference", "Value", "Part Number", "Description", "Footprint"];
  const lines: string[] = [headers.join(",")];

  for (const r of rows) {
    const row = [
      r.item,
      r.quantity,
      escapeCsv(r.designators),
      escapeCsv(r.value),
      escapeCsv(r.partNumber),
      escapeCsv(r.description),
      escapeCsv(r.footprint || ""),
    ];
    lines.push(row.join(","));
  }

  return lines.join("\n");
}

/**
 * Formats BOM as a Markdown table.
 */
export function formatBomMarkdown(rows: BomRow[]): string {
  if (rows.length === 0) return "*Empty Bill of Materials.*";

  const header =
    "| Item | Qty | Reference | Value | Part Number | Description | Footprint |\n|---|---|---|---|---|---|---|";
  const body = rows
    .map(
      (r) =>
        `| ${r.item} | ${r.quantity} | \`${r.designators}\` | ${r.value} | \`${r.partNumber}\` | ${r.description} | ${r.footprint || "—"} |`,
    )
    .join("\n");

  return `${header}\n${body}`;
}

function escapeCsv(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
