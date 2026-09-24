/**
 * @license Apache-2.0
 * @s2c/rules — ERC: ADC Hardware Capability Verification (Doc §9.1: erc.adc-capability).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const adcCapabilityRule: RuleDefinition = {
  id: "erc.adc-capability",
  name: "ADC Hardware Capability Verification",
  description:
    "Verifies that pins sampling analog voltages (potentiometers, light sensors, thermistors) possess analog-to-digital converter (ADC) capabilities.",
  category: "signal-integrity",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const net of circuit.nets) {
      const ports = context.netToPorts.get(net.id) ?? [];
      const netUpper = net.id.toUpperCase();

      // Check if net carries an analog sensor signal:
      // 1. Potentiometer wiper (port 2)
      // 2. Sensor output labeled analog
      // 3. Net name contains ADC / ANALOG / SENSOR / POT
      let hasAnalogSource =
        netUpper.includes("ADC") ||
        netUpper.includes("ANALOG") ||
        netUpper.includes("POT") ||
        netUpper.includes("WIPER");

      for (const p of ports) {
        const comp = context.portToComponent.get(p.id);
        if (
          comp?.kind === "potentiometer" &&
          (p.name === "2" || p.name.toUpperCase().includes("WIPER"))
        ) {
          hasAnalogSource = true;
        } else if (comp?.kind === "sensor" && p.pinCapabilities?.includes("ADC")) {
          hasAnalogSource = true;
        }
      }

      if (!hasAnalogSource) continue;

      // Verify MCU receiving pin
      for (const p of ports) {
        const comp = context.portToComponent.get(p.id);
        if (comp?.kind !== "mcu") continue;

        // Skip power/ground pins
        if (p.kind === "power" || p.kind === "ground") continue;

        const hasAdcCap = p.pinCapabilities?.includes("ADC");
        if (!hasAdcCap) {
          const availableAdcPins = comp.ports
            .filter((port) => port.pinCapabilities?.includes("ADC"))
            .map((port) => port.name);

          diagnostics.push({
            ruleId: "erc.adc-capability",
            severity: "error",
            message: `Pin '${comp.id}.${p.name}' connected to analog signal net '${net.id}' lacks ADC capability.`,
            explanation: `Pin '${comp.id}.${p.name}' is digital-only and lacks an internal Successive Approximation Register (SAR) ADC channel and analog multiplexer. Invoking analogRead() will return meaningless digital bit states or fail compilation.`,
            target: { type: "port", id: p.id },
            suggestion:
              availableAdcPins.length > 0
                ? `Connect analog net '${net.id}' to an ADC-capable analog pin: [${availableAdcPins.join(", ")}].`
                : `Use a microcontroller with onboard ADC channels or attach an external I2C/SPI ADC (e.g. ADS1115).`,
          });
        }
      }
    }

    return diagnostics;
  },
};
