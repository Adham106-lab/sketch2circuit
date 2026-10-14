/**
 * @license Apache-2.0
 * @s2c/erc — Board Strapping & Restricted Pin Validation Rule.
 */

import type { Circuit } from "@s2c/circuit-json";
import type { ErcContext, ErcDiagnostic, ErcRule } from "../types.js";

export const StrappingAndRestrictedPinsRule: ErcRule = {
  id: "erc.board-strapping-and-restricted-pins",
  name: "MCU Board Strapping & Restricted Pin Rules",
  description:
    "Flags usage of restricted MCU pins (e.g., ESP32 input-only pins GPIO34-39 configured as outputs, or boot-strapping pins GPIO0, GPIO2, GPIO12 pulled into unsafe states).",
  run(circuit: Circuit, context: ErcContext): ErcDiagnostic[] {
    const diagnostics: ErcDiagnostic[] = [];
    const board = context.board;
    if (!board) return diagnostics;

    // Find all MCU components
    const mcuComps = circuit.components.filter((c) => c.kind === "mcu");

    for (const mcu of mcuComps) {
      for (const port of mcu.ports) {
        // Strip prefixes: e.g. "U1.GPIO34" -> "GPIO34", "U1.34" -> "GPIO34"
        const rawPinName = port.name.toUpperCase();
        let pinDef = board.pins[rawPinName];
        if (!pinDef && !rawPinName.startsWith("GPIO")) {
          pinDef = board.pins[`GPIO${rawPinName}`];
        }

        if (!pinDef) continue;

        // 1. Check Input-Only Pins Violation
        if (pinDef.inputOnly) {
          const isOutput =
            port.kind === "output" ||
            port.provenance?.direction === "OUTPUT" ||
            circuit.nets.some((net) => {
              if (!net.portIds.includes(port.id)) return false;
              // Check if driving an LED, buzzer, relay, etc.
              return net.portIds.some((pid) => {
                const [cId] = pid.split(".");
                const targetComp = circuit.components.find((c) => c.id === cId);
                return (
                  targetComp &&
                  (targetComp.kind === "led" ||
                    targetComp.kind === "relay" ||
                    targetComp.kind === "buzzer" ||
                    targetComp.kind === "transistor")
                );
              });
            });

          if (isOutput) {
            diagnostics.push({
              ruleId: "erc.restricted-pin.input-only",
              severity: "error",
              message: `Input-only pin "${pinDef.id}" on ${mcu.id} (${board.name}) cannot be configured as an OUTPUT`,
              explanation: `Pin "${pinDef.id}" is a physical GPI (General Purpose Input) on the ${board.mcuFamily} silicon with no output push-pull FET drivers. Attempting to write digital HIGH/LOW or drive an output device from this pin will fail silently or leave the pin floating.`,
              target: { type: "port", id: port.id },
              suggestion: `Move the output connection to a general-purpose GPIO pin (e.g. GPIO4, GPIO13, GPIO18, GPIO21).`,
            });
          }
        }

        // 2. Check Strapping Pin Boot State Violations
        if (pinDef.strappingRule) {
          const rule = pinDef.strappingRule;

          // Find the net connected to this strapping pin
          const net = circuit.nets.find((n) => n.portIds.includes(port.id));
          if (!net) continue;

          // Check if net is tied directly or pulled to GND or Power
          const isTiedToGnd =
            net.kind === "ground" ||
            net.id.toUpperCase() === "GND" ||
            net.portIds.some((pid) => pid.toUpperCase().endsWith(".GND"));

          const isTiedToVcc =
            net.kind === "power" ||
            /^(VCC|5V|3V3|3\.3V)$/i.test(net.id) ||
            net.portIds.some((pid) => /VCC|3V3|3\.3V|5V/i.test(pid));

          // Check for pull resistors
          const hasPullDown = circuit.components.some((c) => {
            if (c.kind !== "resistor") return false;
            const rPorts = c.ports.map((p) => p.id);
            const inNet = rPorts.some((rp) => net.portIds.includes(rp));
            if (!inNet) return false;
            // Check if other port of resistor is in GND net
            const gndNet = circuit.nets.find((n) => n.id.toUpperCase() === "GND" || n.kind === "ground");
            return rPorts.some((rp) => gndNet?.portIds.includes(rp));
          });

          const hasPullUp = circuit.components.some((c) => {
            if (c.kind !== "resistor") return false;
            const rPorts = c.ports.map((p) => p.id);
            const inNet = rPorts.some((rp) => net.portIds.includes(rp));
            if (!inNet) return false;
            // Check if other port of resistor is in VCC net
            const pwrNet = circuit.nets.find((n) => n.kind === "power");
            return rPorts.some((rp) => pwrNet?.portIds.includes(rp));
          });

          // Evaluate violation against safeBootState
          let isViolated = false;
          let actualState = "UNKNOWN";

          if (rule.safeBootState === "HIGH") {
            if (isTiedToGnd || hasPullDown) {
              isViolated = true;
              actualState = isTiedToGnd ? "HARD_GROUND" : "PULLED_LOW";
            }
          } else if (rule.safeBootState === "LOW") {
            if (isTiedToVcc || hasPullUp) {
              isViolated = true;
              actualState = isTiedToVcc ? "HARD_VCC" : "PULLED_HIGH";
            }
          }

          if (isViolated) {
            diagnostics.push({
              ruleId: "erc.strapping-pin-violation",
              severity: "error",
              message: `Unsafe strapping state on ${mcu.id} pin "${pinDef.id}": held ${actualState} (expected ${rule.safeBootState})`,
              explanation: `${rule.riskDescription}`,
              target: { type: "port", id: port.id },
              suggestion: `Do not pull pin "${pinDef.id}" into the ${actualState} state during power-on/reset. Leave floating or reassign to an unconstrained GPIO pin.`,
            });
          }
        }
      }
    }

    return diagnostics;
  },
};
