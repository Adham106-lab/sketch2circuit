/**
 * @license Apache-2.0
 * @s2c/erc — Pin Contention and Bus Driver Conflict Rule.
 */

import type { Circuit } from "@s2c/circuit-json";
import type { ErcContext, ErcDiagnostic, ErcRule } from "../types.js";

export const PinContentionRule: ErcRule = {
  id: "erc.pin-contention",
  name: "Pin Contention & Driver Collision Check",
  description:
    "Detects when two distinct peripherals or driver calls claim the same physical MCU pin or drive the same net with conflicting active output roles.",
  run(circuit: Circuit, _context: ErcContext): ErcDiagnostic[] {
    const diagnostics: ErcDiagnostic[] = [];

    // Map of portId -> Port object & Component
    const portMap = new Map<string, { portName: string; compId: string; compKind: string; kind: string }>();
    for (const comp of circuit.components) {
      for (const port of comp.ports) {
        portMap.set(port.id, {
          portName: port.name,
          compId: comp.id,
          compKind: comp.kind,
          kind: port.kind,
        });
      }
    }

    // 1. Check net-level driver contention: multiple active "output" ports driving the same net
    for (const net of circuit.nets) {
      if (net.kind === "power" || net.kind === "ground") {
        continue;
      }

      const outputPorts: Array<{ portId: string; compId: string; portName: string }> = [];
      for (const portId of net.portIds) {
        const info = portMap.get(portId);
        if (info && info.kind === "output") {
          outputPorts.push({ portId, compId: info.compId, portName: info.portName });
        }
      }

      if (outputPorts.length > 1) {
        const portListStr = outputPorts.map((p) => `${p.compId}.${p.portName}`).join(", ");
        diagnostics.push({
          ruleId: "erc.pin-contention",
          severity: "error",
          message: `Driver contention on net "${net.id}": multiple active output drivers [${portListStr}]`,
          explanation: `Net "${net.id}" connects ${outputPorts.length} output ports simultaneously (${portListStr}). Two active push-pull outputs driving opposing logic levels (HIGH vs LOW) will cause a low-impedance short-circuit, potentially destroying the driver stages.`,
          target: { type: "net", id: net.id },
          suggestion:
            "Isolate the outputs using tri-state logic buffers, open-collector/open-drain drivers, or multiplex through separate GPIO pins.",
        });
      }
    }

    // 2. Check MCU pin claiming contention: multiple distinct peripherals connected to same MCU pin
    const mcuComps = circuit.components.filter((c) => c.kind === "mcu");
    for (const mcu of mcuComps) {
      const pinUsageMap = new Map<string, Array<{ compId: string; portId: string; role?: string }>>();

      for (const net of circuit.nets) {
        if (net.kind === "power" || net.kind === "ground") continue;

        const mcuPortsInNet = net.portIds.filter((pid) => pid.startsWith(`${mcu.id}.`));
        const otherPortsInNet = net.portIds.filter((pid) => !pid.startsWith(`${mcu.id}.`));

        for (const mPort of mcuPortsInNet) {
          const list = pinUsageMap.get(mPort) ?? [];
          for (const oPort of otherPortsInNet) {
            const [cId] = oPort.split(".");
            list.push({ compId: cId, portId: oPort });
          }
          pinUsageMap.set(mPort, list);
        }
      }

      for (const [mcuPortId, users] of pinUsageMap.entries()) {
        const distinctComponents = Array.from(new Set(users.map((u) => u.compId)));
        // If 2 distinct non-passive/non-bus components are claiming the same GPIO
        // Filter out simple shared buses like I2C or multi-drop SPI
        const isBusNet = circuit.buses?.some((b) =>
          b.netIds.some((nid) => circuit.nets.find((n) => n.id === nid)?.portIds.includes(mcuPortId)),
        );

        if (!isBusNet && distinctComponents.length > 1) {
          const [_, pinName] = mcuPortId.split(".");
          diagnostics.push({
            ruleId: "erc.pin-contention",
            severity: "error",
            message: `MCU Pin contention on ${mcu.id} (${pinName}): claimed by multiple independent components [${distinctComponents.join(", ")}]`,
            explanation: `MCU pin "${pinName}" on ${mcu.id} is shared by multiple distinct peripheral components (${distinctComponents.join(", ")}). Unless connected to a standardized shared bus protocol (e.g. I2C), dedicated GPIO pins cannot be shared between separate peripherals.`,
            target: { type: "port", id: mcuPortId },
            suggestion: `Reassign one of the peripheral connections to an unassigned GPIO pin on ${mcu.id}.`,
          });
        }
      }
    }

    return diagnostics;
  },
};
