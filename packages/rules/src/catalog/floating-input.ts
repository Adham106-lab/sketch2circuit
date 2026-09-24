/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Floating High-Impedance Input Detection (Doc §9).
 */

import type { Circuit, Diagnostic, Net } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const floatingInputRule: RuleDefinition = {
  id: "erc.floating-input",
  name: "Floating Digital Input Detection",
  description:
    "Detects digital input pins connected to momentary switches/buttons without pull-up/pull-down bias or left floating in high-impedance state.",
  category: "signal-integrity",
  defaultSeverity: "warning",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Find all MCU and IC digital input ports
    for (const comp of circuit.components) {
      if (comp.kind !== "mcu" && comp.kind !== "ic") continue;

      for (const port of comp.ports) {
        // Only evaluate digital inputs or GPIOs
        const isDigitalInput =
          port.kind === "input" ||
          port.kind === "bidirectional" ||
          port.pinCapabilities?.includes("GPIO") ||
          port.pinCapabilities?.includes("INTERRUPT");

        if (!isDigitalInput) continue;

        // Skip if port explicitly has internal pull-up / pull-down configured
        if (port.pull === "up" || port.pull === "down") continue;

        const net = context.portToNet.get(port.id);
        if (!net) {
          // Unconnected digital input
          diagnostics.push({
            ruleId: "erc.floating-input",
            severity: "info",
            message: `Digital input port '${comp.id}.${port.name}' is unconnected and floating.`,
            explanation: `Port '${comp.id}.${port.name}' has CMOS high-impedance input (>10MΩ). Unconnected inputs can float between logic thresholds (0.8V - 2.0V), resulting in unwanted oscillation and increased static power draw.`,
            target: { type: "port", id: port.id },
            suggestion: `Tie '${comp.id}.${port.name}' to GND or VCC, or configure pin mode as INPUT_PULLUP in firmware.`,
          });
          continue;
        }

        // Check if net connects to a button or switch
        const isConnectedToButton = hasSwitchOnNet(net, context);
        if (isConnectedToButton) {
          // Check if net has a pull-up to power or pull-down to GND
          const hasPullResistor = hasPullResistorOnNet(net, context);
          if (!hasPullResistor) {
            diagnostics.push({
              ruleId: "erc.floating-input",
              severity: "warning",
              message: `Digital input '${comp.id}.${port.name}' connected to button lacks a pull-up or pull-down resistor.`,
              explanation: `Port '${comp.id}.${port.name}' is connected to a mechanical switch with high CMOS impedance (>10MΩ). When the switch is open, the pin floats at indeterminate voltage, causing spurious button presses and contact noise.`,
              target: { type: "port", id: port.id },
              suggestion: `Add a 10kΩ pull-up resistor between '${comp.id}.${port.name}' and VCC (or pull-down to GND), or enable MCU internal pull-up pinMode(${port.name}, INPUT_PULLUP).`,
            });
          }
        }
      }
    }

    return diagnostics;
  },
};

function hasSwitchOnNet(net: Net, context: RuleContext): boolean {
  const ports = context.netToPorts.get(net.id) ?? [];
  for (const p of ports) {
    const comp = context.portToComponent.get(p.id);
    if (comp?.kind === "button" || comp?.kind === "switch") {
      return true;
    }
  }
  return false;
}

function hasPullResistorOnNet(net: Net, context: RuleContext): boolean {
  const ports = context.netToPorts.get(net.id) ?? [];
  for (const p of ports) {
    const comp = context.portToComponent.get(p.id);
    if (comp?.kind === "resistor") {
      // Find the resistor's other port
      const otherPort = comp.ports.find((rp) => rp.id !== p.id);
      if (otherPort) {
        const otherNet = context.portToNet.get(otherPort.id);
        if (otherNet) {
          const upper = otherNet.id.toUpperCase();
          if (
            otherNet.kind === "power" ||
            otherNet.kind === "ground" ||
            upper === "GND" ||
            upper === "5V" ||
            upper === "3V3" ||
            upper === "VCC"
          ) {
            return true;
          }
        }
      }
    }
  }
  return false;
}
