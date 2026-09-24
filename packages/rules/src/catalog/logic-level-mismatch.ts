/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Logic Voltage Level Mismatch (Doc §9.1: erc.logic-level-mismatch).
 */

import type { Circuit, Diagnostic, Port } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const logicLevelMismatchRule: RuleDefinition = {
  id: "erc.logic-level-mismatch",
  name: "Logic Voltage Level Compatibility Verification",
  description:
    "Verifies that signal driving voltages do not exceed the maximum input voltage ratings of receiving components.",
  category: "electrical-safety",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const net of circuit.nets) {
      if (
        net.kind === "power" ||
        net.kind === "ground" ||
        net.id.toUpperCase() === "GND" ||
        net.id.toUpperCase() === "5V" ||
        net.id.toUpperCase() === "3V3" ||
        net.id.toUpperCase() === "VCC"
      ) {
        continue;
      }

      const ports = context.netToPorts.get(net.id) ?? [];
      if (ports.length < 2) continue;

      let maxDriveVoltage = 0;
      let driverPort: Port | null = null;

      for (const p of ports) {
        const comp = context.portToComponent.get(p.id);
        const operatingV = comp?.properties?.operatingVoltage
          ? Number(comp.properties.operatingVoltage)
          : undefined;

        const vMax = p.voltageRange ? p.voltageRange[1] : (operatingV ?? 5.0);

        if (
          p.kind === "output" ||
          p.pinCapabilities?.includes("PWM") ||
          p.pinCapabilities?.includes("GPIO")
        ) {
          if (vMax > maxDriveVoltage) {
            maxDriveVoltage = vMax;
            driverPort = p;
          }
        }
      }

      if (maxDriveVoltage <= 0 || !driverPort) continue;

      for (const receiverPort of ports) {
        if (receiverPort.id === driverPort.id) continue;
        const receiverComp = context.portToComponent.get(receiverPort.id);
        const receiverV = receiverComp?.properties?.operatingVoltage
          ? Number(receiverComp.properties.operatingVoltage)
          : undefined;

        const receiverMaxV = receiverPort.voltageRange
          ? receiverPort.voltageRange[1]
          : (receiverV ?? (receiverComp?.kind === "mcu" ? 5.0 : 5.0));

        if (maxDriveVoltage > receiverMaxV + 0.3) {
          const deltaV = maxDriveVoltage - receiverMaxV;
          diagnostics.push({
            ruleId: "erc.logic-level-mismatch",
            severity: "error",
            message: `Voltage level mismatch on net '${net.id}': ${maxDriveVoltage.toFixed(1)}V output drives ${receiverMaxV.toFixed(1)}V input.`,
            explanation: `Driver port '${driverPort.id}' outputs ${maxDriveVoltage.toFixed(1)}V, which exceeds receiving port '${receiverPort.id}' maximum voltage rating of ${receiverMaxV.toFixed(1)}V by ${deltaV.toFixed(1)}V. Overvoltage causes ESD diode forward conduction, excessive substrate current, and silicon degradation.`,
            target: { type: "port", id: receiverPort.id },
            suggestion: `Add a logic level shifter or resistor voltage divider (e.g. 1kΩ and 2kΩ) between '${driverPort.id}' and '${receiverPort.id}' to safely convert ${maxDriveVoltage.toFixed(1)}V to ${receiverMaxV.toFixed(1)}V.`,
          });
        }
      }
    }

    return diagnostics;
  },
};
