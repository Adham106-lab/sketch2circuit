/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Reserved Hardware Pin Usage Verification (Doc §9.1: erc.reserved-pin).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const reservedPinRule: RuleDefinition = {
  id: "erc.reserved-pin",
  name: "Hardware Reserved Pin Usage Verification",
  description:
    "Verifies that dedicated hardware pins (such as Arduino UART D0/D1 or RESET) are not unintentionally allocated to general-purpose I/O.",
  category: "signal-integrity",
  defaultSeverity: "warning",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const mcus = circuit.components.filter((c) => c.kind === "mcu");

    for (const mcu of mcus) {
      for (const port of mcu.ports) {
        const portUpper = port.name.toUpperCase();
        const isUartD0D1 =
          portUpper === "D0" ||
          portUpper === "D1" ||
          port.pinCapabilities?.includes("UART_RX") ||
          port.pinCapabilities?.includes("UART_TX");

        const isReset = portUpper === "RESET" || port.pinCapabilities?.includes("RESET");

        if (!isUartD0D1 && !isReset) continue;

        const net = context.portToNet.get(port.id);
        if (!net) continue;

        // Check if net connects to non-UART / non-programmer peripherals
        const netPorts = context.netToPorts.get(net.id) ?? [];
        const externalPeripheralPorts = netPorts.filter((p) => {
          if (p.id === port.id) return false;
          const comp = context.portToComponent.get(p.id);
          return comp && comp.kind !== "mcu";
        });

        if (externalPeripheralPorts.length > 0) {
          if (isUartD0D1) {
            diagnostics.push({
              ruleId: "erc.reserved-pin",
              severity: "warning",
              message: `Hardware UART pin '${mcu.id}.${port.name}' is allocated to general peripheral net '${net.id}'.`,
              explanation: `Pins D0 (RX) and D1 (TX) are directly wired to the onboard USB-to-Serial interface. Attaching external sensors or actuators to these pins interferes with bootloader sketch uploads and disrupts Serial.begin() communication.`,
              target: { type: "port", id: port.id },
              suggestion: `Move connection from '${mcu.id}.${port.name}' to an unreserved general-purpose pin (e.g. D2–D12, or A0–A5).`,
            });
          } else if (isReset) {
            diagnostics.push({
              ruleId: "erc.reserved-pin",
              severity: "warning",
              message: `Hardware RESET pin '${mcu.id}.${port.name}' is connected to peripheral net '${net.id}'.`,
              explanation: `The RESET pin holds the microcontroller in hardware reset when driven LOW. Connecting active loads or signals risks accidental CPU resets.`,
              target: { type: "port", id: port.id },
              suggestion: `Verify that connection to '${mcu.id}.${port.name}' is exclusively intended for an external reset pushbutton or dedicated programmer.`,
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
