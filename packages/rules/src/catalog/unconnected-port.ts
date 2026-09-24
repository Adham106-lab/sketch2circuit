/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Unconnected Component Port Verification (Doc §9.1: erc.unconnected-port).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const unconnectedPortRule: RuleDefinition = {
  id: "erc.unconnected-port",
  name: "Unconnected Component Port Verification",
  description:
    "Identifies component ports that are not connected to any electrical net and not explicitly designated as no-connect.",
  category: "connectivity",
  defaultSeverity: "info",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const comp of circuit.components) {
      // Passive 2-terminal parts (resistors, caps, LEDs, diodes) must have both pins connected
      const isPassive2Terminal =
        comp.kind === "resistor" ||
        comp.kind === "capacitor" ||
        comp.kind === "led" ||
        comp.kind === "diode";

      for (const port of comp.ports) {
        if (port.kind === "no_connect") continue;

        const isConnected = context.portToNet.has(port.id);
        if (!isConnected) {
          const isEssential =
            isPassive2Terminal ||
            port.kind === "power" ||
            port.name.toUpperCase() === "VCC" ||
            port.kind === "ground";

          diagnostics.push({
            ruleId: "erc.unconnected-port",
            severity: isEssential ? "warning" : "info",
            message: `Port '${comp.id}.${port.name}' is unconnected.`,
            explanation: `Port '${comp.id}.${port.name}' on component '${comp.id}' (${comp.name || comp.kind}) is not wired into any net in the schematic.`,
            target: { type: "port", id: port.id },
            suggestion: `Connect '${comp.id}.${port.name}' to the intended signal/power net or designate kind as 'no_connect' if unused.`,
          });
        }
      }
    }

    return diagnostics;
  },
};
