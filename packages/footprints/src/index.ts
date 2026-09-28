/**
 * @license Apache-2.0
 * @s2c/footprints — Entry point for footprint generators and standard catalog.
 */

export * from "./catalog.js";
export * from "./generators/button.js";
export * from "./generators/buzzer.js";
export * from "./generators/capacitor.js";
export * from "./generators/diode.js";
export * from "./generators/header.js";
export * from "./generators/ldr.js";
export * from "./generators/led.js";
export * from "./generators/potentiometer.js";
export * from "./generators/resistor.js";
export * from "./generators/screw-terminal.js";
export * from "./generators/transistor.js";
export * from "./generators/uno-shield.js";

export const FOOTPRINTS_VERSION = "0.1.0";
