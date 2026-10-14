/**
 * @license Apache-2.0
 * @s2c/erc — Protocol & Pull-Up Validation Rule with Virtual Auto-Injection.
 */

import type { Circuit, Component, Net, Port } from "@s2c/circuit-json";
import type { ErcContext, ErcDiagnostic, ErcRule } from "../types.js";

/**
 * Checks whether an I2C line has an external pull-up resistor connected to a power rail.
 */
function hasExternalPullupToPower(circuit: Circuit, signalNetId: string, powerNetIds: Set<string>): boolean {
  // Find all resistors connected to signalNetId
  const resistors = circuit.components.filter((c) => c.kind === "resistor");
  for (const r of resistors) {
    const portIds = r.ports.map((p) => p.id);
    // Find nets connected to this resistor's ports
    const connectedNets = new Set<string>();
    for (const net of circuit.nets) {
      for (const p of portIds) {
        if (net.portIds.includes(p)) {
          connectedNets.add(net.id);
        }
      }
    }
    // If this resistor connects signalNetId to one of powerNetIds
    if (connectedNets.has(signalNetId)) {
      for (const pNet of powerNetIds) {
        if (connectedNets.has(pNet)) {
          return true;
        }
      }
    }
  }
  return false;
}

export const I2CPullUpRule: ErcRule = {
  id: "erc.i2c-missing-pullup",
  name: "I2C Bus Missing Pull-Up Resistor Check",
  description:
    "Detects open-drain I2C buses (SDA/SCL) lacking either internal pull-ups (INPUT_PULLUP) or external pull-up resistors to VCC.",
  run(circuit: Circuit, context: ErcContext): ErcDiagnostic[] {
    const diagnostics: ErcDiagnostic[] = [];

    // Identify power nets
    const powerNets = new Set<string>(
      circuit.nets
        .filter((n) => n.kind === "power" || /^(VCC|5V|3V3|3\.3V|\+5V|\+3V3)$/i.test(n.id))
        .map((n) => n.id),
    );

    // Identify I2C signals:
    // 1. Through Bus definitions
    const i2cNetsToCheck = new Set<string>();
    if (circuit.buses) {
      for (const bus of circuit.buses) {
        if (bus.type === "I2C_BUS") {
          for (const nid of bus.netIds) {
            i2cNetsToCheck.add(nid);
          }
        }
      }
    }

    // 2. Through Net or Port naming / capabilities
    for (const net of circuit.nets) {
      if (
        /sda/i.test(net.id) ||
        /scl/i.test(net.id) ||
        net.name?.toLowerCase().includes("sda") ||
        net.name?.toLowerCase().includes("scl")
      ) {
        i2cNetsToCheck.add(net.id);
      }
    }

    // Also inspect MCU ports with I2C capabilities
    for (const comp of circuit.components) {
      if (comp.kind === "mcu") {
        for (const port of comp.ports) {
          if (
            port.pinCapabilities?.includes("I2C_SDA") ||
            port.pinCapabilities?.includes("I2C_SCL") ||
            /^(sda|scl)$/i.test(port.name)
          ) {
            const net = circuit.nets.find((n) => n.portIds.includes(port.id));
            if (net) {
              i2cNetsToCheck.add(net.id);
            }
          }
        }
      }
    }

    // Now validate each I2C net
    for (const netId of i2cNetsToCheck) {
      const net = circuit.nets.find((n) => n.id === netId);
      if (!net) continue;

      // Check if any connected MCU port has internal pull-up enabled
      let hasInternalPullup = false;
      for (const portId of net.portIds) {
        const [cId, pName] = portId.split(".");
        const comp = circuit.components.find((c) => c.id === cId);
        const port = comp?.ports.find((p) => p.name === pName || p.id === portId);
        if (port?.pull === "up") {
          hasInternalPullup = true;
          break;
        }
      }

      // Check if external pull-up resistor exists
      const hasExternalPullup = hasExternalPullupToPower(circuit, net.id, powerNets);

      if (!hasInternalPullup && !hasExternalPullup) {
        const lineRole = /scl/i.test(net.id) ? "SCL (Clock)" : "SDA (Data)";
        diagnostics.push({
          ruleId: "erc.i2c-missing-pullup",
          severity: context.strict ? "error" : "warning",
          message: `Missing pull-up resistor on I2C ${lineRole} net "${net.id}"`,
          explanation: `I2C protocol specification requires open-drain signaling with passive pull-up termination. Net "${net.id}" lacks both internal pull-ups (INPUT_PULLUP) and external pull-up resistors to VCC. Without pull-ups, the line will float indefinitely at high impedance (Hi-Z), causing I2C bus hangs and communication timeouts.`,
          target: { type: "net", id: net.id },
          suggestion:
            "Add a 4.7kΩ pull-up resistor from this net to VCC, or configure MCU internal pull-up pinMode(pin, INPUT_PULLUP).",
        });
      }
    }

    return diagnostics;
  },
};

/**
 * Auto-injects virtual 4.7kΩ pull-up resistors between un-terminated I2C nets and the VCC rail.
 */
export function injectVirtualI2CPullups(circuit: Circuit, pullupValue = "4.7kΩ"): { circuit: Circuit; count: number } {
  // Find power net
  const powerNet =
    circuit.nets.find((n) => n.kind === "power" || /^(VCC|5V|3V3|3\.3V)$/i.test(n.id)) ??
    circuit.nets.find((n) => n.id.toUpperCase() === "5V") ??
    circuit.nets.find((n) => n.id.toUpperCase() === "3V3");

  if (!powerNet) {
    return { circuit, count: 0 };
  }

  const powerNetIds = new Set<string>([powerNet.id]);
  const newComponents: Component[] = [...circuit.components];
  const newNets: Net[] = circuit.nets.map((n) => ({ ...n, portIds: [...n.portIds] }));
  let injectedCount = 0;

  // Find I2C nets that lack pullups
  for (const net of circuit.nets) {
    if (!/sda|scl/i.test(net.id) && !net.name?.match(/sda|scl/i)) {
      continue;
    }

    const hasExt = hasExternalPullupToPower(circuit, net.id, powerNetIds);
    if (!hasExt) {
      injectedCount++;
      const tag = /scl/i.test(net.id) ? "SCL" : "SDA";
      const resId = `R_VIRT_PU_${tag}_${injectedCount}`;
      const p1Id = `${resId}.1`;
      const p2Id = `${resId}.2`;

      const resComp: Component = {
        id: resId,
        kind: "resistor",
        name: `Virtual ${tag} Pull-Up Resistor`,
        value: pullupValue,
        footprint: "0805",
        ports: [
          { id: p1Id, name: "1", kind: "passive" },
          { id: p2Id, name: "2", kind: "passive" },
        ],
        provenance: {
          evidenceType: "TEMPLATE_AUTO_INJECTED",
          confidence: 1.0,
          notes: `Auto-injected 4.7kΩ pull-up resistor for I2C ${tag} bus compliance`,
        },
      };

      newComponents.push(resComp);

      // Connect port 1 to I2C signal net
      const sigNet = newNets.find((n) => n.id === net.id);
      if (sigNet && !sigNet.portIds.includes(p1Id)) {
        sigNet.portIds.push(p1Id);
      }

      // Connect port 2 to power rail
      const pNet = newNets.find((n) => n.id === powerNet.id);
      if (pNet && !pNet.portIds.includes(p2Id)) {
        pNet.portIds.push(p2Id);
      }
    }
  }

  return {
    circuit: {
      ...circuit,
      components: newComponents,
      nets: newNets,
    },
    count: injectedCount,
  };
}
