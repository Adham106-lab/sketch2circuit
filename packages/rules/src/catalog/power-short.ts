/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Power-to-Ground & Power Rail Short Detection (Doc §9.1: erc.power-short).
 */

import type { Circuit, Diagnostic, Port } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const powerShortRule: RuleDefinition = {
  id: "erc.power-short",
  name: "Power Supply Short Circuit Detection",
  description:
    "Detects catastrophic low-impedance short circuits between two different power nets or between power rails and ground.",
  category: "electrical-safety",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const net of circuit.nets) {
      const ports = context.netToPorts.get(net.id) ?? [];
      let hasPowerPort = false;
      let hasGroundPort = false;
      let powerPortDef: Port | null = null;
      let groundPortDef: Port | null = null;

      const powerVoltages = new Set<number>();

      for (const p of ports) {
        const upper = p.name.toUpperCase();
        if (
          p.kind === "power" ||
          upper === "VCC" ||
          upper === "5V" ||
          upper === "3V3" ||
          upper === "VIN" ||
          upper === "VDD"
        ) {
          hasPowerPort = true;
          powerPortDef = p;
          if (p.voltageRange) powerVoltages.add(p.voltageRange[1]);
        } else if (p.kind === "ground" || upper === "GND" || upper === "VSS" || upper === "0V") {
          hasGroundPort = true;
          groundPortDef = p;
        }
      }

      const netUpper = net.id.toUpperCase();
      const isNamedShort =
        (netUpper.includes("5V") || netUpper.includes("VCC") || netUpper.includes("3V3")) &&
        (netUpper.includes("GND") || netUpper.includes("GROUND"));

      if ((hasPowerPort && hasGroundPort) || isNamedShort) {
        diagnostics.push({
          ruleId: "erc.power-short",
          severity: "error",
          message: `Catastrophic short circuit detected on net '${net.id}' between power and ground.`,
          explanation: `Power terminal '${powerPortDef?.id || "Power"}' and ground terminal '${groundPortDef?.id || "GND"}' share the same electrical net with ~0Ω resistance. Under Ohm's Law (I = V / R), current approaches infinity, triggering power supply overcurrent protection or permanent hardware destruction.`,
          target: { type: "net", id: net.id },
          suggestion: `Separate the power rail and ground return paths into independent isolated nets.`,
        });
      } else if (powerVoltages.size > 1) {
        diagnostics.push({
          ruleId: "erc.power-short",
          severity: "error",
          message: `Direct collision between distinct power rails (${Array.from(powerVoltages).join("V and ")}V) on net '${net.id}'.`,
          explanation: `Two different supply voltages are tied together directly without regulation or diode-OR isolation, causing cross-conduction current into the lower voltage rail.`,
          target: { type: "net", id: net.id },
          suggestion: `Isolate distinct power rails into separate nets.`,
        });
      }
    }

    return diagnostics;
  },
};
