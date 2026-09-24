/**
 * @license Apache-2.0
 * @s2c/rules — ERC: MCU Total Rail Current Verification (Doc §9.1: erc.total-current).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import { parseEngineering } from "@s2c/units";
import type { RuleContext, RuleDefinition } from "../types.js";

const DEFAULT_MCU_TOTAL_CURRENT_LIMIT_A = 0.2; // 200mA total VCC/GND current for ATmega328P

export const totalCurrentRule: RuleDefinition = {
  id: "erc.total-current",
  name: "Microcontroller Total Package Current Budget Verification",
  description:
    "Verifies that the aggregate current sourced or sunk across all GPIO pins combined does not exceed total package power rail ratings.",
  category: "power",
  defaultSeverity: "warning",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const mcus = circuit.components.filter((c) => c.kind === "mcu");

    for (const mcu of mcus) {
      const vOperating = mcu.properties?.operatingVoltage
        ? Number(mcu.properties.operatingVoltage)
        : 5.0;
      const totalLimitA = mcu.properties?.totalCurrentLimitA
        ? Number(mcu.properties.totalCurrentLimitA)
        : DEFAULT_MCU_TOTAL_CURRENT_LIMIT_A;

      let totalCurrentA = 0;
      const loadBreakdown: string[] = [];

      for (const port of mcu.ports) {
        const isGpio =
          port.pinCapabilities?.includes("GPIO") ||
          port.pinCapabilities?.includes("PWM") ||
          port.kind === "output" ||
          port.kind === "bidirectional";

        if (!isGpio) continue;

        const net = context.portToNet.get(port.id);
        if (!net) continue;

        // Sum current from connected loads on this GPIO
        const connectedPorts = context.netToPorts.get(net.id) ?? [];
        for (const cp of connectedPorts) {
          if (cp.id === port.id) continue;
          const comp = context.portToComponent.get(cp.id);

          // LED loads
          if (comp?.kind === "led") {
            const iLed = comp.properties?.forwardCurrentA
              ? Number(comp.properties.forwardCurrentA)
              : 0.015; // 15mA default
            totalCurrentA += iLed;
            loadBreakdown.push(`${comp.id} (${(iLed * 1000).toFixed(0)}mA)`);
          } else if (comp?.kind === "resistor") {
            const valStr = comp.value || (comp.properties?.resistance as string);
            if (valStr) {
              try {
                const ohms = parseEngineering(valStr);
                if (ohms > 0) {
                  const iLoad = vOperating / ohms;
                  if (iLoad > 0.005) {
                    totalCurrentA += iLoad;
                    loadBreakdown.push(`${comp.id} (${(iLoad * 1000).toFixed(0)}mA)`);
                  }
                }
              } catch {
                // ignore
              }
            }
          }
        }
      }

      if (totalCurrentA > totalLimitA) {
        const total_mA = totalCurrentA * 1000;
        const limit_mA = totalLimitA * 1000;
        diagnostics.push({
          ruleId: "erc.total-current",
          severity: "warning",
          message: `Aggregate MCU GPIO load current (${total_mA.toFixed(1)}mA) exceeds package limit (${limit_mA.toFixed(1)}mA).`,
          explanation: `The sum of currents drawn across all I/O pins on '${mcu.id}' is ${total_mA.toFixed(1)}mA [loads: ${loadBreakdown.join(", ")}]. This exceeds the microcontroller package total VCC/GND rail rating of ${limit_mA.toFixed(1)}mA by ${(total_mA - limit_mA).toFixed(1)}mA, risking silicon thermal throttling or voltage drop.`,
          target: { type: "component", id: mcu.id },
          suggestion: `Offload heavy output loads to transistor drivers (MOSFET/ULN2003) or active shift registers (74HC595) powered directly from supply rails.`,
        });
      }
    }

    return diagnostics;
  },
};
