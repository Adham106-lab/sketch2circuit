/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Push-Pull Output Contention Verification (Doc §9.1: erc.output-contention).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const outputContentionRule: RuleDefinition = {
  id: "erc.output-contention",
  name: "Push-Pull Driver Output Contention Detection",
  description:
    "Detects bus contention caused by two or more active push-pull output drivers connected to the same electrical net.",
  category: "electrical-safety",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const net of circuit.nets) {
      if (
        net.kind === "power" ||
        net.kind === "ground" ||
        net.id.toUpperCase() === "5V" ||
        net.id.toUpperCase() === "GND"
      ) {
        continue;
      }

      const ports = context.netToPorts.get(net.id) ?? [];
      const outputDrivers = ports.filter((p) => p.kind === "output");

      if (outputDrivers.length > 1) {
        const driverList = outputDrivers.map((p) => p.id).join(", ");
        diagnostics.push({
          ruleId: "erc.output-contention",
          severity: "error",
          message: `Bus output contention detected on net '${net.id}': multiple drivers connected [${driverList}].`,
          explanation: `Net '${net.id}' is driven simultaneously by ${outputDrivers.length} push-pull output stages (${driverList}). If one driver attempts to assert logic HIGH while another asserts logic LOW, a direct VCC-to-GND contention path is established, resulting in excessive shoot-through currents (>100mA) and signal degradation.`,
          target: { type: "net", id: net.id },
          suggestion: `Ensure only one active driver outputs to '${net.id}' at any given time, or use tri-state buffers, open-collector drivers with pull-ups, or multiplexer gating.`,
        });
      }
    }

    return diagnostics;
  },
};
