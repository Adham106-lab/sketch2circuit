/**
 * @license Apache-2.0
 * @s2c/rules — ERC: System Power Supply Budget Verification (Doc §9.1: erc.power-budget).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import { parseEngineering } from "@s2c/units";
import type { RuleContext, RuleDefinition } from "../types.js";

const DEFAULT_USB_POWER_BUDGET_A = 0.5; // 500mA nominal for USB 2.0

export const powerBudgetRule: RuleDefinition = {
  id: "erc.power-budget",
  name: "System Power Budget & Current Draw Verification",
  description:
    "Verifies that the total estimated system operating current does not exceed the nominal supply source capacity (e.g. 500mA standard USB).",
  category: "power",
  defaultSeverity: "warning",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Find main 5V power net
    const powerNets = circuit.nets.filter(
      (n) => n.kind === "power" || n.id.toUpperCase() === "5V" || n.id.toUpperCase() === "VCC",
    );

    for (const net of powerNets) {
      let totalCurrentA = 0.05; // 50mA base quiescent for MCU + regulator
      const consumerBreakdown: string[] = ["MCU logic (~50mA)"];

      const ports = context.netToPorts.get(net.id) ?? [];
      for (const p of ports) {
        const comp = context.portToComponent.get(p.id);
        if (!comp || comp.kind === "mcu") continue;

        // Servos / Motors
        if (comp.properties?.stallCurrentA) {
          const iStall = Number(comp.properties.stallCurrentA);
          totalCurrentA += iStall;
          consumerBreakdown.push(`${comp.id} (${(iStall * 1000).toFixed(0)}mA stall)`);
        } else if (comp.properties?.activeCurrentA) {
          const iActive = Number(comp.properties.activeCurrentA);
          totalCurrentA += iActive;
          consumerBreakdown.push(`${comp.id} (${(iActive * 1000).toFixed(0)}mA)`);
        } else if (comp.kind === "led") {
          totalCurrentA += 0.015;
          consumerBreakdown.push(`${comp.id} (~15mA)`);
        } else if (comp.kind === "resistor") {
          const valStr = comp.value || (comp.properties?.resistance as string);
          if (valStr) {
            try {
              const ohms = parseEngineering(valStr);
              if (ohms > 0) {
                const iR = 5.0 / ohms;
                if (iR > 0.01) {
                  totalCurrentA += iR;
                  consumerBreakdown.push(`${comp.id} (${(iR * 1000).toFixed(0)}mA)`);
                }
              }
            } catch {
              // ignore
            }
          }
        }
      }

      if (totalCurrentA > DEFAULT_USB_POWER_BUDGET_A) {
        const total_mA = totalCurrentA * 1000;
        const limit_mA = DEFAULT_USB_POWER_BUDGET_A * 1000;
        diagnostics.push({
          ruleId: "erc.power-budget",
          severity: "warning",
          message: `Total estimated current on power net '${net.id}' (${total_mA.toFixed(0)}mA) exceeds standard USB budget (${limit_mA.toFixed(0)}mA).`,
          explanation: `The circuit loads on '${net.id}' require an estimated ${total_mA.toFixed(0)}mA peak current [${consumerBreakdown.join(", ")}]. This exceeds the 500mA current limit of standard USB 2.0 host ports by ${(total_mA - limit_mA).toFixed(0)}mA, which can trip USB port polyfuses or cause supply voltage drop.`,
          target: { type: "net", id: net.id },
          suggestion: `Supply power through an external 7V-12V DC power adapter (VIN barrel jack) or an externally powered 5V 2A regulator rail.`,
        });
      }
    }

    return diagnostics;
  },
};
