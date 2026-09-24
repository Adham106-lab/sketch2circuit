/**
 * @license Apache-2.0
 * @s2c/rules — ERC: MCU Pin Current Limit Verification (Doc §9.1: erc.pin-current).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import { parseEngineering } from "@s2c/units";
import type { RuleContext, RuleDefinition } from "../types.js";

const DEFAULT_MCU_PIN_LIMIT_A = 0.04; // 40mA absolute max for ATmega328P

export const pinCurrentRule: RuleDefinition = {
  id: "erc.pin-current",
  name: "MCU Pin Source/Sink Current Limit Verification",
  description:
    "Verifies that current drawn from or sunk into microcontroller GPIO pins does not exceed maximum datasheet ratings.",
  category: "component-ratings",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const mcus = circuit.components.filter((c) => c.kind === "mcu");

    for (const mcu of mcus) {
      const vOperating = mcu.properties?.operatingVoltage
        ? Number(mcu.properties.operatingVoltage)
        : 5.0;

      for (const port of mcu.ports) {
        const isGpio =
          port.pinCapabilities?.includes("GPIO") ||
          port.pinCapabilities?.includes("PWM") ||
          port.kind === "output" ||
          port.kind === "bidirectional";

        if (!isGpio) continue;

        const maxCurrentA = port.currentLimit ?? DEFAULT_MCU_PIN_LIMIT_A;
        const net = context.portToNet.get(port.id);
        if (!net) continue;

        // Check if pin is driving a low-resistance path directly to GND or VCC
        const connectedPorts = context.netToPorts.get(net.id) ?? [];
        for (const cp of connectedPorts) {
          if (cp.id === port.id) continue;
          const otherComp = context.portToComponent.get(cp.id);

          if (otherComp?.kind === "resistor") {
            const rValStr = otherComp.value || (otherComp.properties?.resistance as string);
            if (!rValStr) continue;

            try {
              const rOhms = parseEngineering(rValStr);
              // Find other terminal of resistor
              const rOtherPort = otherComp.ports.find((p) => p.id !== cp.id);
              if (rOtherPort) {
                const rOtherNet = context.portToNet.get(rOtherPort.id);
                const isGnd = rOtherNet?.kind === "ground" || rOtherNet?.id.toUpperCase() === "GND";
                const isPower =
                  rOtherNet?.kind === "power" ||
                  rOtherNet?.id.toUpperCase() === "5V" ||
                  rOtherNet?.id.toUpperCase() === "3V3";

                if (isGnd || isPower) {
                  const drawnCurrentA = vOperating / rOhms;
                  if (drawnCurrentA > maxCurrentA) {
                    const drawn_mA = drawnCurrentA * 1000;
                    const limit_mA = maxCurrentA * 1000;
                    diagnostics.push({
                      ruleId: "erc.pin-current",
                      severity: "error",
                      message: `Output current through port '${mcu.id}.${port.name}' exceeds safe limit.`,
                      explanation: `Port '${mcu.id}.${port.name}' drives resistor '${otherComp.id}' (${rOhms}Ω) directly to ${isGnd ? "GND" : "VCC"} at ${vOperating}V. Calculated pin current I = ${vOperating}V / ${rOhms}Ω = ${drawn_mA.toFixed(1)}mA, which exceeds the absolute maximum pin drive rating of ${limit_mA.toFixed(1)}mA by ${(drawn_mA - limit_mA).toFixed(1)}mA.`,
                      target: { type: "port", id: port.id },
                      suggestion: `Increase series load resistance to at least ${Math.ceil(vOperating / maxCurrentA)}Ω or use a transistor buffer stage (e.g. 2N2222 NPN or MOSFET).`,
                    });
                  }
                }
              }
            } catch {
              // Ignore unparseable
            }
          }
        }
      }
    }

    return diagnostics;
  },
};
