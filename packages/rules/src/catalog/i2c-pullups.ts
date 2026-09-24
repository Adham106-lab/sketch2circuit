/**
 * @license Apache-2.0
 * @s2c/rules — ERC: I2C Open-Drain Pull-Up Resistor Verification (Doc §9).
 */

import type { Circuit, Component, Diagnostic, Net } from "@s2c/circuit-json";
import { parseEngineering } from "@s2c/units";
import type { RuleContext, RuleDefinition } from "../types.js";

const MIN_RECOMMENDED_PULLUP_OHMS = 1000; // 1kΩ
const MAX_RECOMMENDED_PULLUP_OHMS = 10000; // 10kΩ

export const i2cPullupsRule: RuleDefinition = {
  id: "erc.i2c-pullups",
  name: "I2C Open-Drain Pull-Up Resistor Verification",
  description:
    "Verifies that I2C bus lines (SDA and SCL) have appropriate pull-up resistors connected to a power rail.",
  category: "signal-integrity",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Identify I2C nets
    const i2cNets = new Set<Net>();

    for (const net of circuit.nets) {
      const upper = net.id.toUpperCase();
      if (
        upper === "SDA" ||
        upper === "SCL" ||
        upper.includes("I2C_SDA") ||
        upper.includes("I2C_SCL")
      ) {
        i2cNets.add(net);
      }
    }

    // Also check ports with I2C capabilities
    for (const comp of circuit.components) {
      for (const port of comp.ports) {
        const portUpper = port.name.toUpperCase();
        const hasI2cCap =
          port.pinCapabilities?.includes("I2C_SDA") ||
          port.pinCapabilities?.includes("I2C_SCL") ||
          portUpper === "SDA" ||
          portUpper === "SCL" ||
          portUpper.includes("I2C");

        if (hasI2cCap) {
          const net = context.portToNet.get(port.id);
          if (net) {
            i2cNets.add(net);
          }
        }
      }
    }

    // Evaluate each I2C net for a pull-up resistor to power
    for (const net of i2cNets) {
      const pullup = findPullupToPower(net, context);

      if (!pullup) {
        const isSda = net.id.toUpperCase().includes("SDA");
        const lineType = isSda ? "SDA (Serial Data)" : "SCL (Serial Clock)";

        diagnostics.push({
          ruleId: "erc.i2c-pullups",
          severity: "error",
          message: `I2C bus line '${net.id}' lacks a pull-up resistor to VCC.`,
          explanation: `I2C line '${net.id}' (${lineType}) utilizes open-drain topology and cannot drive HIGH autonomously. Without a pull-up resistor, the line remains permanently at 0V or indeterminate floating state, preventing bus communication (rise time tr → ∞).`,
          target: { type: "net", id: net.id },
          suggestion: `Add a 4.7kΩ (or 2.2kΩ - 10kΩ) pull-up resistor between '${net.id}' and the 3.3V/5V power rail.`,
        });
        continue;
      }

      // Check pull-up value range
      const rValueStr = pullup.resistor.value || (pullup.resistor.properties?.resistance as string);
      if (rValueStr) {
        try {
          const rOhms = parseEngineering(rValueStr);
          if (rOhms < MIN_RECOMMENDED_PULLUP_OHMS) {
            diagnostics.push({
              ruleId: "erc.i2c-pullups",
              severity: "warning",
              message: `I2C pull-up resistor '${pullup.resistor.id}' (${rValueStr}) is too strong (< 1kΩ).`,
              explanation: `Pull-up resistor '${pullup.resistor.id}' is ${rOhms}Ω. On a 5V bus, open-drain drivers must sink I_OL = 5V / ${rOhms}Ω = ${(5000 / rOhms).toFixed(1)}mA, which may exceed the standard 3.0mA I2C driver sink limit (VOL > 0.4V).`,
              target: { type: "component", id: pullup.resistor.id },
              suggestion: `Increase pull-up resistor '${pullup.resistor.id}' to 2.2kΩ - 4.7kΩ.`,
            });
          } else if (rOhms > MAX_RECOMMENDED_PULLUP_OHMS) {
            diagnostics.push({
              ruleId: "erc.i2c-pullups",
              severity: "warning",
              message: `I2C pull-up resistor '${pullup.resistor.id}' (${rValueStr}) is too weak (> 10kΩ).`,
              explanation: `Pull-up resistor '${pullup.resistor.id}' is ${rOhms}Ω. Combined with bus capacitance (e.g. 100pF-400pF), RC rise time tr = 2.2 * R * C exceeds standard I2C timing specifications (1000ns for 100kHz standard mode, 300ns for 400kHz fast mode).`,
              target: { type: "component", id: pullup.resistor.id },
              suggestion: `Decrease pull-up resistor '${pullup.resistor.id}' to 4.7kΩ for reliable rise times.`,
            });
          }
        } catch {
          // ignore unparseable
        }
      }
    }

    return diagnostics;
  },
};

function findPullupToPower(
  net: Net,
  context: RuleContext,
): { resistor: Component; powerNet: Net } | null {
  const ports = context.netToPorts.get(net.id) ?? [];
  for (const p of ports) {
    const comp = context.portToComponent.get(p.id);
    if (comp?.kind === "resistor") {
      const otherPort = comp.ports.find((rp) => rp.id !== p.id);
      if (otherPort) {
        const otherNet = context.portToNet.get(otherPort.id);
        if (otherNet) {
          const upper = otherNet.id.toUpperCase();
          if (
            otherNet.kind === "power" ||
            upper === "5V" ||
            upper === "3V3" ||
            upper === "VCC" ||
            upper === "VIN"
          ) {
            return { resistor: comp, powerNet: otherNet };
          }
        }
      }
    }
  }
  return null;
}
