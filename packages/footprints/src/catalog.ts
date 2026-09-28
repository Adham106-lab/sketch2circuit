/**
 * @license Apache-2.0
 * @s2c/footprints — Standard PCB Footprint Catalog & Resolver.
 */

import type { FootprintDef } from "@s2c/pcb-json";
import { generateTactileButtonFootprint } from "./generators/button.js";
import { generateBuzzerFootprint } from "./generators/buzzer.js";
import {
  generateCeramicCapFootprint,
  generateRadialElectrolyticCapFootprint,
} from "./generators/capacitor.js";
import { generateDo41Footprint } from "./generators/diode.js";
import { generatePinHeaderFootprint } from "./generators/header.js";
import { generateLdrFootprint } from "./generators/ldr.js";
import { generateLed5mmFootprint } from "./generators/led.js";
import { generatePotentiometerFootprint } from "./generators/potentiometer.js";
import { generateAxialResistorFootprint } from "./generators/resistor.js";
import { generateScrewTerminalFootprint } from "./generators/screw-terminal.js";
import { generateTo92Footprint } from "./generators/transistor.js";
import {
  generateUnoAnalogHeaderFootprint,
  generateUnoDigitalHighHeaderFootprint,
  generateUnoDigitalLowHeaderFootprint,
  generateUnoPowerHeaderFootprint,
  generateUnoShieldFootprint,
} from "./generators/uno-shield.js";

export const FOOTPRINT_CATALOG: Record<string, FootprintDef> = {
  // Resistors
  "resistor:axial-0.3in": generateAxialResistorFootprint({
    id: "resistor:axial-0.3in",
    pitchMm: 7.62,
    name: "Resistor Axial 0.3in (7.62mm)",
  }),
  "resistor:axial-0.4in": generateAxialResistorFootprint({
    id: "resistor:axial-0.4in",
    pitchMm: 10.16,
    name: "Resistor Axial 0.4in (10.16mm)",
  }),

  // Capacitors
  "capacitor:radial-can": generateRadialElectrolyticCapFootprint({
    id: "capacitor:radial-can",
    canDiameterMm: 5.0,
    pitchMm: 2.0,
    name: "Electrolytic Capacitor 5mm Can (2.0mm Pitch)",
  }),
  "capacitor:radial-d5-p2mm": generateRadialElectrolyticCapFootprint({
    id: "capacitor:radial-d5-p2mm",
    canDiameterMm: 5.0,
    pitchMm: 2.0,
    name: "Electrolytic Cap ø5mm (2.0mm Pitch)",
  }),
  "capacitor:radial-d6.3-p2.5mm": generateRadialElectrolyticCapFootprint({
    id: "capacitor:radial-d6.3-p2.5mm",
    canDiameterMm: 6.3,
    pitchMm: 2.5,
    name: "Electrolytic Cap ø6.3mm (2.5mm Pitch)",
  }),
  "capacitor:radial-0.1in": generateCeramicCapFootprint({
    id: "capacitor:radial-0.1in",
    pitchMm: 2.54,
    name: "Ceramic Disc Capacitor 0.1in (2.54mm)",
  }),

  // LEDs
  "led:5mm": generateLed5mmFootprint({
    id: "led:5mm",
    name: "5mm Through-Hole LED (Red)",
  }),

  // Buttons
  "button:tact-6mm": generateTactileButtonFootprint({
    id: "button:tact-6mm",
    name: "6x6mm Tactile Pushbutton (Omron B3F)",
  }),

  // Pin Headers
  "header:1-pin-0.1in": generatePinHeaderFootprint({
    pinCount: 1,
    id: "header:1-pin-0.1in",
  }),
  "header:2-pin-0.1in": generatePinHeaderFootprint({
    pinCount: 2,
    id: "header:2-pin-0.1in",
  }),
  "header:3-pin-0.1in": generatePinHeaderFootprint({
    pinCount: 3,
    id: "header:3-pin-0.1in",
  }),
  "header:4-pin-0.1in": generatePinHeaderFootprint({
    pinCount: 4,
    id: "header:4-pin-0.1in",
  }),
  "header:6-pin-0.1in": generatePinHeaderFootprint({
    pinCount: 6,
    id: "header:6-pin-0.1in",
  }),
  "header:8-pin-0.1in": generatePinHeaderFootprint({
    pinCount: 8,
    id: "header:8-pin-0.1in",
  }),
  "header:10-pin-0.1in": generatePinHeaderFootprint({
    pinCount: 10,
    id: "header:10-pin-0.1in",
  }),

  // Screw Terminals
  "terminal:screw-2pos": generateScrewTerminalFootprint({
    positions: 2,
    id: "terminal:screw-2pos",
  }),
  "terminal:screw-3pos": generateScrewTerminalFootprint({
    positions: 3,
    id: "terminal:screw-3pos",
  }),

  // Potentiometer
  "pot:3-pin-rotary": generatePotentiometerFootprint({
    id: "pot:3-pin-rotary",
  }),

  // Photoresistor (LDR)
  "sensor:ldr-5mm": generateLdrFootprint({
    id: "sensor:ldr-5mm",
  }),

  // Buzzer
  "buzzer:12mm": generateBuzzerFootprint({
    id: "buzzer:12mm",
  }),

  // Transistor
  "transistor:to-92": generateTo92Footprint({
    id: "transistor:to-92",
  }),

  // Diode
  "diode:do-41": generateDo41Footprint({
    id: "diode:do-41",
  }),

  // Arduino Uno Shield Headers
  "uno:power-header-8pin": generateUnoPowerHeaderFootprint(),
  "uno:analog-header-6pin": generateUnoAnalogHeaderFootprint(),
  "uno:digital-low-header-8pin": generateUnoDigitalLowHeaderFootprint(),
  "uno:digital-high-header-10pin": generateUnoDigitalHighHeaderFootprint(),

  // Module footprints (represented by pin header footprints on shield)
  "module:hc-sr04": generatePinHeaderFootprint({
    pinCount: 4,
    id: "module:hc-sr04",
    name: "HC-SR04 4-Pin Header (VCC, TRIG, ECHO, GND)",
    pinLabels: ["VCC", "TRIG", "ECHO", "GND"],
  }),
  "motor:dc-hobby": generateScrewTerminalFootprint({
    positions: 2,
    id: "motor:dc-hobby",
    name: "DC Motor Screw Terminal (+, -)",
  }),
  "module:relay-1ch": generatePinHeaderFootprint({
    pinCount: 6,
    id: "module:relay-1ch",
    name: "1-Channel Relay Interface Header",
    pinLabels: ["VCC", "IN", "GND", "NO", "COM", "NC"],
  }),
  "module:i2c-4pin": generatePinHeaderFootprint({
    pinCount: 4,
    id: "module:i2c-4pin",
    name: "I2C 4-Pin Breakout Header (VCC, GND, SDA, SCL)",
    pinLabels: ["VCC", "GND", "SDA", "SCL"],
  }),
  "module:arduino-uno-r3": generateUnoShieldFootprint(),
  "module:arduino-nano": generatePinHeaderFootprint({
    pinCount: 30,
    id: "module:arduino-nano",
    name: "Arduino Nano V3.0 (30-pin DIP layout)",
  }),
  "module:esp32-devkit": generatePinHeaderFootprint({
    pinCount: 30,
    id: "module:esp32-devkit",
    name: "ESP32 DevKit V1 (30-pin DIP layout)",
  }),
};

/**
 * Resolves a footprint by ID from the catalog, with fallback options.
 */
export function getFootprintDefinition(id: string): FootprintDef | undefined {
  return FOOTPRINT_CATALOG[id];
}
