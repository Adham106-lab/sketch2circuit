/**
 * @license Apache-2.0
 * @s2c/erc — Current & Load Protection Rule.
 */

import type { Circuit } from "@s2c/circuit-json";
import type { ErcContext, ErcDiagnostic, ErcRule } from "../types.js";

const HIGH_CURRENT_KINDS = new Set(["relay", "solenoid", "motor", "buzzer"]);

export const CurrentProtectionRule: ErcRule = {
  id: "erc.direct-actuator-gpio",
  name: "Direct High-Current Actuator on MCU GPIO Check",
  description:
    "Flags high-current actuators (solenoids, relays, motors, WS2812 strips) connected directly to MCU GPIO pins without an intervening MOSFET, transistor driver stage, or current-limiting stage.",
  run(circuit: Circuit, context: ErcContext): ErcDiagnostic[] {
    const diagnostics: ErcDiagnostic[] = [];
    const maxGpioMa = context.board?.maxGpioCurrentMa ?? 20.0;

    // Find MCU components
    const mcuIds = new Set(circuit.components.filter((c) => c.kind === "mcu").map((c) => c.id));
    if (mcuIds.size === 0) return diagnostics;

    // Find all high current components
    const highCurrentComps = circuit.components.filter((comp) => {
      if (HIGH_CURRENT_KINDS.has(comp.kind)) return true;
      if (comp.properties?.isHighCurrentActuator === true) return true;
      if (comp.properties?.peakCurrentMa && Number(comp.properties.peakCurrentMa) > maxGpioMa) return true;
      if (comp.name && /solenoid|relay|motor|ws2812|neopixel/i.test(comp.name)) return true;
      return false;
    });

    for (const actuator of highCurrentComps) {
      // Find all nets connected to this actuator
      const actuatorPortIds = new Set(actuator.ports.map((p) => p.id));

      for (const net of circuit.nets) {
        if (net.kind === "power" || net.kind === "ground") continue;

        const hasActuatorPort = net.portIds.some((pid) => actuatorPortIds.has(pid));
        if (!hasActuatorPort) continue;

        // Check if an MCU GPIO pin is directly connected to this net
        const mcuPortsInNet = net.portIds.filter((pid) => {
          const [compId] = pid.split(".");
          return mcuIds.has(compId);
        });

        if (mcuPortsInNet.length > 0) {
          // Check if there is already a transistor / MOSFET or driver buffer on this net
          const otherCompKinds = net.portIds
            .map((pid) => {
              const [cId] = pid.split(".");
              return circuit.components.find((c) => c.id === cId)?.kind;
            })
            .filter(Boolean);

          const hasTransistorDriver = otherCompKinds.includes("transistor") || otherCompKinds.includes("ic");

          if (!hasTransistorDriver) {
            const mcuPortStr = mcuPortsInNet.join(", ");
            const estCurrent = actuator.properties?.peakCurrentMa ?? (actuator.kind === "relay" || actuator.kind === "solenoid" ? 500 : 60);

            diagnostics.push({
              ruleId: "erc.direct-actuator-gpio",
              severity: "error",
              message: `High-current actuator "${actuator.id}" (${actuator.name ?? actuator.kind}) directly connected to MCU GPIO [${mcuPortStr}]`,
              explanation: `Actuator "${actuator.id}" draws an estimated ${estCurrent}mA, which severely exceeds the microcontroller's safe continuous GPIO limit of ${maxGpioMa}mA per pin. Directly sinking or sourcing coil/motor current through the MCU silicon will cause thermal shutdown, latch-up, or permanent destruction of output FETs.`,
              target: { type: "component", id: actuator.id },
              suggestion:
                "Insert a low-side N-channel MOSFET (e.g. IRLZ44N) or NPN transistor (e.g. 2N2222) with a gate/base resistor and anti-parallel flyback diode across inductive terminals.",
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
