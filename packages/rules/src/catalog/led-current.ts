/**
 * @license Apache-2.0
 * @s2c/rules — ERC: LED Current Limiting & Resistor Analysis (Doc §9.1).
 */

import type { Circuit, Component, Diagnostic, Net } from "@s2c/circuit-json";
import { calculateLedResistor, parseEngineering } from "@s2c/units";
import type { RuleContext, RuleDefinition } from "../types.js";

const DEFAULT_V_FORWARD = 2.0; // Typical red/green LED drop: 2.0V
const MAX_SAFE_LED_CURRENT_MA = 25.0; // Typical 5mm/0805 indicator LED max
const MIN_VISIBLE_LED_CURRENT_MA = 1.0; // Typical human eye visibility threshold

/**
 * Checks for LEDs connected directly between supply and ground without series resistance.
 */
export const ledNoResistorRule: RuleDefinition = {
  id: "erc.led-no-resistor",
  name: "LED Missing Current-Limiting Resistor Verification",
  description:
    "Verifies that LEDs are not connected directly across power rails without a series current-limiting resistor.",
  category: "electrical-safety",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const leds = circuit.components.filter((c) => c.kind === "led");

    for (const led of leds) {
      const anodePort = led.ports.find((p) => p.name === "A" || p.name.includes("anode"));
      const cathodePort = led.ports.find((p) => p.name === "K" || p.name.includes("cathode"));
      if (!anodePort || !cathodePort) continue;

      const anodeNet = context.portToNet.get(anodePort.id);
      const cathodeNet = context.portToNet.get(cathodePort.id);
      if (!anodeNet || !cathodeNet) continue;

      const seriesResistor =
        findSeriesResistor(anodeNet, anodePort.id, context) ||
        findSeriesResistor(cathodeNet, cathodePort.id, context);

      if (!seriesResistor) {
        const isAnodePowered = isPowerOrGpioNet(anodeNet, context);
        const isCathodeGrounded = isGroundNet(cathodeNet);

        if (isAnodePowered && isCathodeGrounded) {
          const vSource = resolveSupplyVoltage(anodeNet, null, context) ?? 5.0;
          const vForward = led.properties?.forwardVoltage
            ? Number(led.properties.forwardVoltage)
            : DEFAULT_V_FORWARD;
          const rec = calculateLedResistor(vSource, vForward, 0.015);

          diagnostics.push({
            ruleId: "erc.led-no-resistor",
            severity: "error",
            message: `LED '${led.id}' is connected directly across supply and ground without a current-limiting resistor.`,
            explanation: `LED '${led.id}' has forward voltage Vf = ${vForward.toFixed(1)}V on a ${vSource.toFixed(1)}V supply rail. Without a series resistor, forward current is unconstrained (I >> 100mA, exceeding absolute maximum limit of ${MAX_SAFE_LED_CURRENT_MA.toFixed(1)}mA), which causes immediate thermal destruction.`,
            target: { type: "component", id: led.id },
            suggestion: `Add a ${rec.recommendedResistance}Ω series resistor between '${led.id}' and ${vSource.toFixed(1)}V supply (calculated for safe 15mA operation).`,
          });
        }
      }
    }
    return diagnostics;
  },
};

/**
 * Checks that the LED current I = (Vsrc - Vf)/R is within safe and visible bounds.
 */
export const ledCurrentRule: RuleDefinition = {
  id: "erc.led-current",
  name: "LED Forward Current Rating Verification",
  description:
    "Verifies that calculated forward current I = (Vsrc - Vf)/R does not exceed LED ifMax or drop below visible threshold.",
  category: "component-ratings",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const leds = circuit.components.filter((c) => c.kind === "led");

    for (const led of leds) {
      const anodePort = led.ports.find((p) => p.name === "A" || p.name.includes("anode"));
      const cathodePort = led.ports.find((p) => p.name === "K" || p.name.includes("cathode"));
      if (!anodePort || !cathodePort) continue;

      const anodeNet = context.portToNet.get(anodePort.id);
      const cathodeNet = context.portToNet.get(cathodePort.id);
      if (!anodeNet || !cathodeNet) continue;

      const seriesResistor =
        findSeriesResistor(anodeNet, anodePort.id, context) ||
        findSeriesResistor(cathodeNet, cathodePort.id, context);

      if (!seriesResistor) continue;

      const rComp = seriesResistor.resistor;
      const rValueStr = rComp.value || (rComp.properties?.resistance as string) || "0";
      let rOhms = 0;
      try {
        rOhms = parseEngineering(rValueStr);
      } catch {
        continue;
      }
      if (rOhms <= 0) continue;

      const vSource = resolveSupplyVoltage(anodeNet, seriesResistor, context) ?? 5.0;
      const vForward = led.properties?.forwardVoltage
        ? Number(led.properties.forwardVoltage)
        : DEFAULT_V_FORWARD;
      const vDrop = vSource - vForward;

      if (vDrop <= 0) {
        diagnostics.push({
          ruleId: "erc.led-current",
          severity: "warning",
          message: `Supply voltage (${vSource.toFixed(1)}V) is insufficient to turn on LED '${led.id}' (Vf = ${vForward.toFixed(1)}V).`,
          explanation: `LED '${led.id}' requires Vf = ${vForward.toFixed(1)}V to forward bias, but source voltage is only ${vSource.toFixed(1)}V. The diode will not conduct.`,
          target: { type: "component", id: led.id },
          suggestion: `Increase supply voltage above ${vForward.toFixed(1)}V or use an LED with lower forward voltage drop.`,
        });
        continue;
      }

      const actualCurrentA = vDrop / rOhms;
      const actualCurrentmA = actualCurrentA * 1000;

      if (actualCurrentmA > MAX_SAFE_LED_CURRENT_MA) {
        const rec = calculateLedResistor(vSource, vForward, 0.015);
        diagnostics.push({
          ruleId: "erc.led-current",
          severity: "error",
          message: `Resistor '${rComp.id}' (${rValueStr}) allows excessive forward current through LED '${led.id}'.`,
          explanation: `Calculated forward current I = (${vSource.toFixed(1)}V - ${vForward.toFixed(1)}V) / ${rOhms}Ω = ${actualCurrentmA.toFixed(1)}mA. This exceeds the maximum safe rating of ${MAX_SAFE_LED_CURRENT_MA.toFixed(1)}mA by ${(actualCurrentmA - MAX_SAFE_LED_CURRENT_MA).toFixed(1)}mA, causing excessive heat and reduced LED lifespan.`,
          target: { type: "component", id: led.id },
          suggestion: `Increase series resistor '${rComp.id}' to at least ${Math.ceil(vDrop / (MAX_SAFE_LED_CURRENT_MA / 1000))}Ω (recommended ${rec.recommendedResistance}Ω E24 for 15mA operation).`,
        });
      } else if (actualCurrentmA < MIN_VISIBLE_LED_CURRENT_MA) {
        const rec = calculateLedResistor(vSource, vForward, 0.01);
        diagnostics.push({
          ruleId: "erc.led-current",
          severity: "warning",
          message: `Resistor '${rComp.id}' (${rValueStr}) restricts forward current through LED '${led.id}' below visible threshold.`,
          explanation: `Calculated forward current I = (${vSource.toFixed(1)}V - ${vForward.toFixed(1)}V) / ${rOhms}Ω = ${actualCurrentmA.toFixed(2)}mA. This is below the typical minimum visible threshold of ${MIN_VISIBLE_LED_CURRENT_MA.toFixed(1)}mA; the LED will appear unlit or very dim.`,
          target: { type: "component", id: led.id },
          suggestion: `Decrease series resistor '${rComp.id}' to ${rec.recommendedResistance}Ω (or between 220Ω and 2.2kΩ) to provide sufficient illumination.`,
        });
      }
    }

    return diagnostics;
  },
};

function findSeriesResistor(
  net: Net,
  excludePortId: string,
  context: RuleContext,
): { resistor: Component; net: Net } | null {
  const portsInNet = context.netToPorts.get(net.id) ?? [];
  for (const port of portsInNet) {
    if (port.id === excludePortId) continue;
    const comp = context.portToComponent.get(port.id);
    if (comp?.kind === "resistor") {
      return { resistor: comp, net };
    }
  }
  return null;
}

function isPowerOrGpioNet(net: Net, context: RuleContext): boolean {
  const upper = net.id.toUpperCase();
  if (
    net.kind === "power" ||
    upper === "5V" ||
    upper === "3V3" ||
    upper === "VCC" ||
    upper === "VIN"
  ) {
    return true;
  }
  const ports = context.netToPorts.get(net.id) ?? [];
  for (const p of ports) {
    if (
      p.kind === "output" ||
      p.pinCapabilities?.includes("GPIO") ||
      p.pinCapabilities?.includes("PWM")
    ) {
      return true;
    }
  }
  return false;
}

function isGroundNet(net: Net): boolean {
  const upper = net.id.toUpperCase();
  return (
    net.kind === "ground" ||
    upper === "GND" ||
    upper === "VSS" ||
    upper === "0V" ||
    upper.startsWith("GND.")
  );
}

function resolveSupplyVoltage(
  anodeNet: Net,
  seriesResistor: { resistor: Component; net: Net } | null,
  context: RuleContext,
): number | null {
  const checkNet = (net: Net): number | null => {
    const upper = net.id.toUpperCase();
    if (upper === "5V" || upper.includes("5V")) return 5.0;
    if (upper === "3V3" || upper === "3.3V") return 3.3;

    const ports = context.netToPorts.get(net.id) ?? [];
    for (const p of ports) {
      if (p.voltageRange) return p.voltageRange[1];
      const comp = context.portToComponent.get(p.id);
      if (comp?.properties?.operatingVoltage) {
        return Number(comp.properties.operatingVoltage);
      }
    }
    return null;
  };

  const vAnode = checkNet(anodeNet);
  if (vAnode !== null) return vAnode;

  if (seriesResistor) {
    const rComp = seriesResistor.resistor;
    for (const p of rComp.ports) {
      const net = context.portToNet.get(p.id);
      if (net && net.id !== anodeNet.id) {
        const v = checkNet(net);
        if (v !== null) return v;
      }
    }
  }

  return 5.0;
}
