/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Power-to-Ground & Power Rail Short Detection (Doc §9.1: erc.power-short).
 */

import type { Circuit, Diagnostic, Port } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

/**
 * Resolves the supplied power rail voltage of a source port, or null if the port is a power consumer/load.
 */
function getSourceRailVoltage(port: Port, context: RuleContext): number | null {
  const comp = context.portToComponent.get(port.id);
  if (!comp) return null;

  // MCU supply rails
  if (comp.kind === "mcu") {
    const name = port.name.toUpperCase();
    if (name === "5V") return 5.0;
    if (name === "3V3" || name === "3.3V") return 3.3;
    if (name === "12V") return 12.0;
    if (
      port.voltageRange &&
      port.voltageRange[0] === port.voltageRange[1] &&
      port.voltageRange[0] > 0
    ) {
      return port.voltageRange[0];
    }
    return null;
  }

  // External connectors or IC regulators supplying power rails
  if (comp.kind === "connector" || comp.kind === "ic") {
    if (comp.properties?.voltage) {
      const v = Number(comp.properties.voltage);
      if (!Number.isNaN(v)) return v;
    }
    if (
      port.voltageRange &&
      port.voltageRange[0] === port.voltageRange[1] &&
      port.voltageRange[0] > 0
    ) {
      return port.voltageRange[0];
    }
  }

  return null;
}

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
      if (net.voltage !== undefined) {
        powerVoltages.add(net.voltage);
      }

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
          // Only compare actual source rail voltages from supplies/MCUs, never tolerance ranges of consumers
          const sourceV = getSourceRailVoltage(p, context);
          if (sourceV !== null) {
            powerVoltages.add(sourceV);
          }
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
