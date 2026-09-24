/**
 * @license Apache-2.0
 * @s2c/rules — ERC: IC Decoupling Capacitor Verification (Doc §9).
 */

import type { Circuit, Diagnostic, Net } from "@s2c/circuit-json";
import { parseEngineering } from "@s2c/units";
import type { RuleContext, RuleDefinition } from "../types.js";

const MAX_DECOUPLING_CAP_FARADS = 1e-6; // 1µF max for typical local high-frequency bypass

export const decouplingRule: RuleDefinition = {
  id: "erc.decoupling",
  name: "IC Power Decoupling Capacitor Verification",
  description:
    "Verifies that microcontrollers and integrated circuits have local ceramic bypass/decoupling capacitors across supply rails.",
  category: "power",
  defaultSeverity: "warning",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Evaluate MCUs and ICs
    const ics = circuit.components.filter((c) => c.kind === "mcu" || c.kind === "ic");

    for (const ic of ics) {
      // Find power and ground ports on this IC
      const powerPorts = ic.ports.filter(
        (p) =>
          p.kind === "power" ||
          p.name.toUpperCase().includes("VCC") ||
          p.name.toUpperCase().includes("5V") ||
          p.name.toUpperCase().includes("3V3") ||
          p.name.toUpperCase().includes("VDD"),
      );

      const groundPorts = ic.ports.filter(
        (p) =>
          p.kind === "ground" ||
          p.name.toUpperCase().includes("GND") ||
          p.name.toUpperCase().includes("VSS"),
      );

      if (powerPorts.length === 0 || groundPorts.length === 0) {
        continue;
      }

      // Check if at least one connected power port and connected ground port exist
      for (const pPort of powerPorts) {
        const pNet = context.portToNet.get(pPort.id);
        if (!pNet) continue;

        for (const gPort of groundPorts) {
          const gNet = context.portToNet.get(gPort.id);
          if (!gNet) continue;

          // Check if there is a decoupling capacitor bridging pNet and gNet
          const hasDecouplingCap = findDecouplingCap(pNet, gNet, context);

          if (!hasDecouplingCap) {
            diagnostics.push({
              ruleId: "erc.decoupling",
              severity: "warning",
              message: `IC '${ic.id}' (${ic.name || ic.kind}) lacks a local decoupling capacitor between '${pNet.id}' and '${gNet.id}'.`,
              explanation: `Microcontroller/IC '${ic.id}' digital logic switches states with high slew rates (di/dt > 100mA/ns). Without a low-ESR ceramic bypass capacitor (~100nF / 0.1µF), PCB trace inductance causes supply voltage bounce (ΔV = L * di/dt), triggering unexpected CPU brownout resets.`,
              target: { type: "component", id: ic.id },
              suggestion: `Connect a 100nF (0.1µF) ceramic capacitor across '${pNet.id}' and '${gNet.id}' in close physical proximity to '${ic.id}'.`,
            });
            break; // Report once per power rail
          }
        }
      }
    }

    return diagnostics;
  },
};

function findDecouplingCap(powerNet: Net, groundNet: Net, context: RuleContext): boolean {
  const pPorts = context.netToPorts.get(powerNet.id) ?? [];
  for (const p of pPorts) {
    const comp = context.portToComponent.get(p.id);
    if (comp?.kind === "capacitor") {
      // Check other port of this capacitor
      const otherPort = comp.ports.find((cp) => cp.id !== p.id);
      if (otherPort) {
        const otherNet = context.portToNet.get(otherPort.id);
        if (otherNet?.id === groundNet.id) {
          // Verify value is reasonable for decoupling (<= 1µF)
          const valStr = comp.value || (comp.properties?.capacitance as string);
          if (valStr) {
            try {
              const cFarads = parseEngineering(valStr);
              if (cFarads <= MAX_DECOUPLING_CAP_FARADS) {
                return true;
              }
            } catch {
              return true; // treat unparseable as valid cap
            }
          } else {
            return true;
          }
        }
      }
    }
  }
  return false;
}
