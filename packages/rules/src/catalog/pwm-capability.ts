/**
 * @license Apache-2.0
 * @s2c/rules — ERC: PWM Hardware Capability Verification (Doc §9.1: erc.pwm-capability).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const pwmCapabilityRule: RuleDefinition = {
  id: "erc.pwm-capability",
  name: "PWM Hardware Capability Verification",
  description:
    "Verifies that pins driving PWM signals or peripherals (servos, dimmers, motor speed control) possess hardware PWM timer capabilities.",
  category: "signal-integrity",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const net of circuit.nets) {
      const ports = context.netToPorts.get(net.id) ?? [];
      const netUpper = net.id.toUpperCase();

      // Check if net requires PWM:
      // 1. Net name contains PWM / SERVO / FADE / DIM
      // 2. Net is connected to a peripheral port that requires PWM (e.g. SG90 PWM port)
      const hasPwmSink = ports.some((p) => {
        const pUpper = p.name.toUpperCase();
        return (
          (p.pinCapabilities?.includes("PWM") && p.kind === "input") ||
          pUpper === "PWM" ||
          pUpper === "SERVO"
        );
      });

      const isPwmNet =
        hasPwmSink ||
        netUpper.includes("PWM") ||
        netUpper.includes("SERVO") ||
        netUpper.includes("FADE");

      if (!isPwmNet) continue;

      // Find driver pin on MCU
      for (const p of ports) {
        const comp = context.portToComponent.get(p.id);
        if (comp?.kind !== "mcu") continue;

        // Skip input-only pins
        if (p.kind === "input" || p.kind === "power" || p.kind === "ground") continue;

        const hasPwmCap = p.pinCapabilities?.includes("PWM");
        if (!hasPwmCap) {
          // Identify available PWM pins on this MCU for helpful suggestion
          const availablePwmPins = comp.ports
            .filter((port) => port.pinCapabilities?.includes("PWM"))
            .map((port) => port.name);

          diagnostics.push({
            ruleId: "erc.pwm-capability",
            severity: "error",
            message: `Pin '${comp.id}.${p.name}' connected to PWM net '${net.id}' lacks hardware PWM capability.`,
            explanation: `Pin '${comp.id}.${p.name}' is an ordinary digital GPIO without internal hardware timer/counter output compare registers (OCR). Invoking analogWrite() or PWM generation on this pin produces constant DC HIGH or LOW instead of modulated pulses.`,
            target: { type: "port", id: p.id },
            suggestion:
              availablePwmPins.length > 0
                ? `Move PWM connection from '${comp.id}.${p.name}' to a PWM-capable pin: [${availablePwmPins.join(", ")}].`
                : `Use a microcontroller with hardware timer PWM outputs.`,
          });
        }
      }
    }

    return diagnostics;
  },
};
