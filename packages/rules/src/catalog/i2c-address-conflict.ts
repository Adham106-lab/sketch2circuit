/**
 * @license Apache-2.0
 * @s2c/rules — ERC: I2C Slave Address Collision Verification (Doc §9.1: erc.i2c-address-conflict).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const i2cAddressConflictRule: RuleDefinition = {
  id: "erc.i2c-address-conflict",
  name: "I2C Bus Slave Address Collision Detection",
  description:
    "Detects address collisions where two or more peripheral devices share the same 7-bit I2C address on the same bus.",
  category: "signal-integrity",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Find I2C SDA nets
    const sdaNets = circuit.nets.filter(
      (n) => n.id.toUpperCase() === "SDA" || n.id.toUpperCase().includes("I2C_SDA"),
    );

    for (const sdaNet of sdaNets) {
      const addressToComponents = new Map<string, string[]>();

      const ports = context.netToPorts.get(sdaNet.id) ?? [];
      for (const p of ports) {
        const comp = context.portToComponent.get(p.id);
        if (!comp || comp.kind === "mcu") continue;

        // Check for i2cAddress property
        const addrProp =
          comp.properties?.i2cAddress || comp.properties?.address || comp.properties?.i2c_addr;

        if (addrProp !== undefined && addrProp !== null) {
          const addrStr = String(addrProp).toLowerCase();
          const list = addressToComponents.get(addrStr) ?? [];
          list.push(comp.id);
          addressToComponents.set(addrStr, list);
        }
      }

      for (const [addr, compIds] of addressToComponents.entries()) {
        if (compIds.length > 1) {
          diagnostics.push({
            ruleId: "erc.i2c-address-conflict",
            severity: "error",
            message: `I2C bus address collision on net '${sdaNet.id}': multiple devices [${compIds.join(", ")}] share address ${addr}.`,
            explanation: `Components [${compIds.join(", ")}] are both configured with 7-bit I2C slave address ${addr} on bus '${sdaNet.id}'. When the master addresses ${addr}, both slaves simultaneously drive ACK bits and return colliding data, rendering communication unusable.`,
            target: { type: "net", id: sdaNet.id },
            suggestion: `Change hardware address select pin (e.g. tie AD0/ADDR pin to VCC on one device) or use an I2C multiplexer such as TCA9548A.`,
          });
        }
      }
    }

    return diagnostics;
  },
};
