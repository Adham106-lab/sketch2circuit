/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Unconnected Essential Power/Ground Pin Verification (Doc §9).
 */

import type { Circuit, Diagnostic, Port } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const unconnectedPowerPinRule: RuleDefinition = {
  id: "erc.unconnected-power-pin",
  name: "Unconnected Essential Power and Ground Pin Verification",
  description:
    "Verifies that microcontrollers, ICs, and active modules have essential power and ground terminals connected to supply nets.",
  category: "connectivity",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const activeComponents = circuit.components.filter(
      (c) => c.kind === "mcu" || c.kind === "ic" || c.kind === "module",
    );

    for (const comp of activeComponents) {
      const powerPorts: Port[] = [];
      const groundPorts: Port[] = [];

      for (const port of comp.ports) {
        const upper = port.name.toUpperCase();
        if (
          port.kind === "power" ||
          upper === "VCC" ||
          upper === "VDD" ||
          upper === "5V" ||
          upper === "3V3" ||
          upper === "VIN"
        ) {
          powerPorts.push(port);
        } else if (port.kind === "ground" || upper === "GND" || upper === "VSS" || upper === "0V") {
          groundPorts.push(port);
        }
      }

      // If component defines power ports, check if at least one is connected
      if (powerPorts.length > 0) {
        const hasConnectedPower = powerPorts.some((p) => context.portToNet.has(p.id));
        if (!hasConnectedPower) {
          const repPort = powerPorts[0];
          diagnostics.push({
            ruleId: "erc.unconnected-power-pin",
            severity: "error",
            message: `Component '${comp.id}' (${comp.name || comp.kind}) has no positive power supply connection.`,
            explanation: `Component '${comp.id}' requires active positive supply potential for internal transistor and substrate biasing. Floating supply pins prevent circuit operation and may cause erratic phantom powering through I/O clamp diodes.`,
            target: { type: "component", id: comp.id },
            suggestion: `Connect '${repPort.id}' (or available supply pins [${powerPorts.map((p) => p.name).join(", ")}]) to an appropriate supply rail (5V or 3.3V).`,
          });
        }
      }

      // If component defines ground return ports, check if at least one is connected
      if (groundPorts.length > 0) {
        const hasConnectedGround = groundPorts.some((p) => context.portToNet.has(p.id));
        if (!hasConnectedGround) {
          const repPort = groundPorts[0];
          diagnostics.push({
            ruleId: "erc.unconnected-power-pin",
            severity: "error",
            message: `Component '${comp.id}' (${comp.name || comp.kind}) has no ground return connection.`,
            explanation: `Component '${comp.id}' requires an active 0V ground reference return path. Without ground return, substrate isolation fails and no return current loop exists.`,
            target: { type: "component", id: comp.id },
            suggestion: `Connect '${repPort.id}' (or available ground pins [${groundPorts.map((p) => p.name).join(", ")}]) to circuit GND (0V).`,
          });
        }
      }
    }

    return diagnostics;
  },
};
