/**
 * @license Apache-2.0
 * @s2c/layout — Fixed Port-Side Classifier for ELK Schematics.
 *
 * Rules:
 * - NORTH: VCC, 5V, 3V3, VDD, VIN, Power rails
 * - SOUTH: GND, VSS, 0V, Ground rails
 * - WEST:  Inputs, Analog sensors, Clock in, Receiver (RX), Reset, SPI MOSI/SCK (slaves)
 * - EAST:  Outputs, PWM drivers, DAC, Transmitter (TX), Data Out, Bidirectional signals
 */

import type { Component, Port } from "@s2c/circuit-json";
import type { ElkPortSide } from "./types.js";

const POWER_NAMES = /^(vcc|vdd|5v|3v3|3\.3v|vin|raw|pos|\+5v|\+3v3|\+12v|power)$/i;
const GROUND_NAMES = /^(gnd|vss|0v|neg|ground|earth)$/i;
const INPUT_NAMES = /^(in|din|rx|scl|sck|clk|clock|adc|analog|trig|echo|reset|en|cs|ss)$/i;
const OUTPUT_NAMES = /^(out|dout|tx|pwm|dac|q|sig|signal)$/i;

export function classifyPortSide(port: Port, component?: Component): ElkPortSide {
  const name = port.name.trim();

  // 1. Mandatory NORTH for Power
  if (port.kind === "power" || POWER_NAMES.test(name)) {
    return "NORTH";
  }

  // 2. Mandatory SOUTH for Ground
  if (port.kind === "ground" || GROUND_NAMES.test(name)) {
    return "SOUTH";
  }

  // 3. PortKind-driven assignments
  if (port.kind === "input") {
    return "WEST";
  }
  if (port.kind === "output") {
    return "EAST";
  }

  // 4. Pin Capabilities-driven assignments
  if (port.pinCapabilities) {
    if (port.pinCapabilities.includes("ADC") || port.pinCapabilities.includes("RESET")) {
      return "WEST";
    }
    if (port.pinCapabilities.includes("PWM") || port.pinCapabilities.includes("DAC") || port.pinCapabilities.includes("UART_TX")) {
      return "EAST";
    }
  }

  // 5. Name heuristics
  if (INPUT_NAMES.test(name)) {
    return "WEST";
  }
  if (OUTPUT_NAMES.test(name)) {
    return "EAST";
  }

  // 6. Two-terminal passives (e.g. Resistors, Capacitors, LEDs)
  if (component && (component.kind === "resistor" || component.kind === "capacitor" || component.kind === "diode" || component.kind === "led")) {
    if (name === "1" || name === "A" || name === "POS") {
      return "WEST";
    }
    if (name === "2" || name === "K" || name === "NEG") {
      return "EAST";
    }
  }

  // 7. Default bidirectional / generic signals flow WEST (in) or EAST (out)
  if (port.kind === "bidirectional") {
    // SDA or data lines on east side
    return "EAST";
  }

  // Default fallback: WEST
  return "WEST";
}
