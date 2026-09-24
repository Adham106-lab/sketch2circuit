/**
 * @license Apache-2.0
 * @s2c/export — Wiring Table Generator with Physical GND Allocation (Doc §12.9, §13, GAP-02).
 */

import type { Circuit } from "@s2c/circuit-json";
import type { WiringRow } from "./types.js";

export interface WiringTableOptions {
  boardType?: "ARDUINO_UNO_R3" | "ARDUINO_NANO" | string;
}

/**
 * Generates an intuitive point-to-point breadboard/bench wiring table from a Circuit IR.
 * Resolves logical GND to physical Uno R3 header pins (POWER.GND.1, POWER.GND.2, DIGITAL.GND)
 * and falls back gracefully to breadboard ground rail for >3 ground connections.
 */
export function generateWiringTable(circuit: Circuit, options?: WiringTableOptions): WiringRow[] {
  const rows: WiringRow[] = [];
  const compMap = new Map(circuit.components.map((c) => [c.id, c]));
  const mcuComp = circuit.components.find((c) => c.kind === "mcu");

  const isUno =
    !options?.boardType ||
    options.boardType === "ARDUINO_UNO_R3" ||
    mcuComp?.partNumber === "A000066" ||
    mcuComp?.name?.toLowerCase().includes("uno");

  // Official Uno R3 Schematic Pinout: exactly 3 physical header ground pins
  const unoPhysicalGndPins = [
    {
      pin: "POWER.GND.1",
      desc: "Power Header JP2 Pin 6 (between 5V and GND.2)",
    },
    {
      pin: "POWER.GND.2",
      desc: "Power Header JP2 Pin 7 (between GND.1 and VIN)",
    },
    {
      pin: "DIGITAL.GND",
      desc: "Digital Header JP1 Pin 4 (between AREF and D13)",
    },
  ];

  let gndAllocationCount = 0;

  for (const net of circuit.nets) {
    if (net.portIds.length < 2) continue;

    // Check if net contains an MCU pin
    const mcuPort = net.portIds.find((pid) => pid.startsWith(`${mcuComp?.id || "U1"}.`));

    if (mcuPort) {
      // Net connects MCU to peripherals
      const otherPorts = net.portIds.filter((pid) => pid !== mcuPort);
      const isGroundNet =
        net.id.toUpperCase() === "GND" ||
        mcuPort.endsWith(".GND") ||
        mcuPort.includes(".GND.") ||
        mcuPort.includes(".DIGITAL.GND");

      for (const targetPort of otherPorts) {
        const [targetCompId, targetPin] = targetPort.split(".");
        const comp = compMap.get(targetCompId || "");
        const baseNote = comp?.value ? `${comp.value} ${comp.name || comp.kind}` : comp?.name;

        let resolvedFromPort = mcuPort;
        let gndWiringNote = "";

        if (isGroundNet && isUno) {
          const mcuRef = mcuComp?.id || "U1";
          if (gndAllocationCount < unoPhysicalGndPins.length) {
            const assigned = unoPhysicalGndPins[gndAllocationCount++];
            resolvedFromPort = `${mcuRef}.${assigned.pin}`;
            gndWiringNote = assigned.desc;
          } else {
            // Graceful fallback when >3 GND connections are needed
            gndAllocationCount++;
            resolvedFromPort = "Breadboard.GND_RAIL";
            gndWiringNote = `Breadboard Ground Rail (-) [Tie ${mcuRef}.POWER.GND.1 to blue (-) rail]`;
          }
        }

        const combinedNotes = gndWiringNote
          ? baseNote
            ? `${baseNote} — ${gndWiringNote}`
            : gndWiringNote
          : baseNote;

        rows.push({
          fromPort: resolvedFromPort,
          toPort: targetPort,
          componentRef: targetCompId || "",
          componentKind: comp?.kind || "component",
          terminal: targetPin || "",
          netId: net.id,
          notes: combinedNotes,
        });
      }
    } else {
      // Passive/component interconnections (e.g. Resistor R1 -> LED D1)
      const firstPort = net.portIds[0];
      for (let i = 1; i < net.portIds.length; i++) {
        const secondPort = net.portIds[i];
        const [targetCompId, targetPin] = secondPort.split(".");
        const comp = compMap.get(targetCompId || "");
        rows.push({
          fromPort: firstPort,
          toPort: secondPort,
          componentRef: targetCompId || "",
          componentKind: comp?.kind || "component",
          terminal: targetPin || "",
          netId: net.id,
          notes: "Series interconnect",
        });
      }
    }
  }

  // Sort rows deterministically by MCU pin or source port
  return rows.sort(
    (a, b) => a.fromPort.localeCompare(b.fromPort) || a.toPort.localeCompare(b.toPort),
  );
}

/**
 * Formats wiring table as a GitHub-flavored Markdown table.
 */
export function formatWiringTableMarkdown(rows: WiringRow[]): string {
  if (rows.length === 0) {
    return "*No wiring connections recorded.*";
  }

  const header =
    "| MCU / From Pin | Component | Terminal | Net | Description / Notes |\n|---|---|---|---|---|";
  const body = rows
    .map(
      (r) =>
        `| \`${r.fromPort}\` | **${r.componentRef}** (${r.componentKind}) | \`${r.terminal}\` | \`${r.netId}\` | ${r.notes || "—"} |`,
    )
    .join("\n");

  return `${header}\n${body}`;
}

/**
 * Formats wiring table as plain ASCII text.
 */
export function formatWiringTableAscii(rows: WiringRow[]): string {
  if (rows.length === 0) return "No wiring connections recorded.";

  const lines = [
    "WIRING TABLE",
    "================================================================================",
    "From Port        -> To Port          Component        Net        Notes",
    "--------------------------------------------------------------------------------",
  ];

  for (const r of rows) {
    const from = r.fromPort.padEnd(16);
    const to = r.toPort.padEnd(16);
    const comp = `${r.componentRef} (${r.terminal})`.padEnd(16);
    const net = r.netId.padEnd(10);
    const note = r.notes || "";
    lines.push(`${from} -> ${to}  ${comp} ${net} ${note}`);
  }

  return lines.join("\n");
}
