/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Servo Power Rail Verification (Doc §9.1: erc.servo-power).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const servoPowerRule: RuleDefinition = {
  id: "erc.servo-power",
  name: "Servo Power Supply & Brownout Risk Verification",
  description:
    "Verifies that positional servo motors are powered from appropriate dedicated power sources rather than the MCU onboard logic regulator.",
  category: "power",
  defaultSeverity: "warning",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Find servo components
    const servos = circuit.components.filter((c) => {
      const idUpper = c.id.toUpperCase();
      const nameUpper = (c.name || "").toUpperCase();
      const partUpper = (c.partNumber || "").toUpperCase();
      return (
        idUpper.includes("SERVO") ||
        nameUpper.includes("SERVO") ||
        partUpper.includes("SERVO") ||
        partUpper.includes("SG90")
      );
    });

    for (const servo of servos) {
      const vccPort = servo.ports.find(
        (p) => p.kind === "power" || p.name.toUpperCase() === "VCC" || p.name === "+",
      );
      if (!vccPort) continue;

      const net = context.portToNet.get(vccPort.id);
      if (!net) continue;

      // Check if net connects directly to MCU 5V or onboard regulator
      const netPorts = context.netToPorts.get(net.id) ?? [];
      const mcuPowerPort = netPorts.find((p) => {
        const comp = context.portToComponent.get(p.id);
        return comp?.kind === "mcu" && (p.name === "5V" || p.name === "3V3" || p.kind === "power");
      });

      if (mcuPowerPort) {
        const mcu = context.portToComponent.get(mcuPowerPort.id);
        const stallCurrentA = servo.properties?.stallCurrentA
          ? Number(servo.properties.stallCurrentA)
          : 0.65; // 650mA typical SG90 stall
        const stallCurrentmA = stallCurrentA * 1000;

        diagnostics.push({
          ruleId: "erc.servo-power",
          severity: "warning",
          message: `Servo '${servo.id}' is powered directly from MCU '${mcu?.id || "MCU"}' ${mcuPowerPort.name} supply rail.`,
          explanation: `Servo motors exhibit high inductive starting and stall currents (~${stallCurrentmA.toFixed(0)}mA for SG90). Powering directly from the onboard microcontroller regulator or USB supply risks exceeding 500mA USB current limits, causing supply voltage brownout and unintended CPU resets.`,
          target: { type: "component", id: servo.id },
          suggestion: `Power '${servo.id}' from a dedicated external 5V/6V supply (sharing a common GND with the MCU) and place a 100µF–470µF bulk electrolytic capacitor across servo power terminals.`,
        });
      }
    }

    return diagnostics;
  },
};
