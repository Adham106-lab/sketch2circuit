/**
 * @license Apache-2.0
 * @s2c/exporters — Wokwi diagram.json Exporter.
 *
 * Serializes Circuit IR to valid Wokwi diagram format for instant in-browser simulation.
 */

import type { Circuit, Component } from "@s2c/circuit-json";
import type { WokwiConnection, WokwiDiagram, WokwiExportOptions, WokwiPart } from "./types.js";

/**
 * Normalizes an internal component port name to the corresponding Wokwi pin name.
 */
function toWokwiPin(comp: Component, portName: string): string {
  const norm = portName.trim();

  // MCU Pin mappings
  if (comp.kind === "mcu") {
    // Uno D13 -> "13"
    if (/^D\d+$/i.test(norm)) return norm.replace(/^D/i, "");
    // ESP32 GPIO21 -> "21"
    if (/^GPIO\d+$/i.test(norm)) return norm.replace(/^GPIO/i, "");
    if (/^GND$/i.test(norm)) return "GND.1";
    if (/^(5V|\+5V)$/i.test(norm)) return "5V";
    if (/^(3V3|3\.3V|\+3V3)$/i.test(norm)) return "3.3V";
    return norm;
  }

  // LED: Wokwi uses "A" (Anode) and "C" (Cathode)
  if (comp.kind === "led") {
    if (norm === "K" || norm === "CATHODE" || norm === "2") return "C";
    if (norm === "A" || norm === "ANODE" || norm === "1") return "A";
  }

  // Resistor / Capacitor: "1", "2"
  if (comp.kind === "resistor" || comp.kind === "capacitor") {
    if (norm === "1" || norm === "POS") return "1";
    if (norm === "2" || norm === "NEG") return "2";
  }

  // Button
  if (comp.kind === "button" || comp.kind === "switch") {
    if (norm === "1" || norm === "A") return "1.1";
    if (norm === "2" || norm === "B") return "2.1";
  }

  // Potentiometer
  if (comp.kind === "potentiometer") {
    if (/^sig|out$/i.test(norm)) return "SIG";
    if (/^vcc|5v$/i.test(norm)) return "VCC";
    if (/^gnd|0v$/i.test(norm)) return "GND";
  }

  // Buzzer
  if (comp.kind === "buzzer") {
    if (/pos|1|\+/i.test(norm)) return "1";
    if (/neg|2|-/i.test(norm)) return "2";
  }

  return norm;
}

/**
 * Maps a Circuit IR component kind and properties to a Wokwi part descriptor.
 */
function mapToWokwiPart(comp: Component, index: number, spacing: number): WokwiPart {
  let type = "wokwi-resistor";
  let attrs: Record<string, string | number | boolean> | undefined;

  const row = Math.floor(index / 3);
  const col = index % 3;
  const left = 50 + col * (spacing + 120);
  const top = 50 + row * (spacing + 100);

  if (comp.kind === "mcu") {
    const isEsp32 = /esp32/i.test(comp.name || comp.id);
    type = isEsp32 ? "board-esp32-devkit-c-v4" : "wokwi-arduino-uno";
    return { type, id: comp.id, top: 100, left: 250 };
  }

  switch (comp.kind) {
    case "led":
      type = "wokwi-led";
      attrs = { color: comp.value?.toLowerCase() || "red" };
      break;
    case "resistor":
      type = "wokwi-resistor";
      attrs = { value: comp.value?.replace(/[Ω\s]/g, "") || "330" };
      break;
    case "button":
    case "switch":
      type = "wokwi-pushbutton";
      attrs = { color: "green" };
      break;
    case "potentiometer":
      type = "wokwi-potentiometer";
      break;
    case "buzzer":
      type = "wokwi-buzzer";
      break;
    case "module":
    case "sensor":
      if (/hc-?sr04/i.test(comp.name || comp.partNumber || comp.id)) {
        type = "wokwi-hc-sr04";
      } else if (/ds3231|ds1307|rtc/i.test(comp.name || comp.partNumber || comp.id)) {
        type = "wokwi-ds1307";
      } else if (/ssd1306|oled/i.test(comp.name || comp.partNumber || comp.id)) {
        type = "wokwi-ssd1306";
      } else {
        type = "wokwi-resistor";
      }
      break;
    default:
      type = "wokwi-resistor";
  }

  return {
    type,
    id: comp.id,
    top,
    left,
    attrs,
  };
}

/**
 * Chooses an intuitive wire color for Wokwi simulation diagram readability.
 */
function chooseWireColor(netId: string, defaultColor: string): string {
  const upper = netId.toUpperCase();
  if (upper === "GND" || upper === "0V") return "black";
  if (upper === "5V" || upper === "VCC" || upper === "+5V" || upper === "12V") return "red";
  if (upper === "3V3" || upper === "3.3V") return "orange";
  if (upper.includes("SDA") || upper.includes("DATA") || upper.includes("DIN")) return "green";
  if (upper.includes("SCL") || upper.includes("CLK") || upper.includes("SCK")) return "blue";
  if (upper.includes("TX") || upper.includes("MOSI")) return "purple";
  if (upper.includes("RX") || upper.includes("MISO")) return "cyan";
  return defaultColor;
}

/**
 * Serializes a Circuit IR to a valid Wokwi diagram.json structure.
 */
export function toWokwiDiagram(circuit: Circuit, options: WokwiExportOptions = {}): WokwiDiagram {
  const author = options.author || "sketch2circuit";
  const defaultWireColor = options.defaultWireColor || "gold";
  const spacing = options.spacing || 140;

  // 1. Build parts list
  const parts: WokwiPart[] = circuit.components.map((c, idx) => mapToWokwiPart(c, idx, spacing));

  // Map portId -> Component & Wokwi Pin
  const portToWokwiMap = new Map<string, string>();
  for (const comp of circuit.components) {
    for (const port of comp.ports) {
      const pinName = toWokwiPin(comp, port.name);
      portToWokwiMap.set(port.id, `${comp.id}:${pinName}`);
    }
  }

  // 2. Build connections from nets
  const connections: WokwiConnection[] = [];

  for (const net of circuit.nets) {
    if (net.portIds.length < 2) continue;

    const wireColor = chooseWireColor(net.id, defaultWireColor);

    // Chain connections: Port 0 -> Port 1 -> Port 2 ...
    for (let i = 0; i < net.portIds.length - 1; i++) {
      const srcPortId = net.portIds[i];
      const tgtPortId = net.portIds[i + 1];

      const srcWokwi = portToWokwiMap.get(srcPortId);
      const tgtWokwi = portToWokwiMap.get(tgtPortId);

      if (srcWokwi && tgtWokwi && srcWokwi !== tgtWokwi) {
        connections.push([srcWokwi, tgtWokwi, wireColor, ["v0"]]);
      }
    }
  }

  return {
    version: 1,
    author,
    editor: "wokwi",
    parts,
    connections,
  };
}
