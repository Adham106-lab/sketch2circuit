/**
 * @license Apache-2.0
 * @s2c/arduino — Arduino sketch analysis and circuit synthesis engine.
 */

export const ARDUINO_SYNTH_VERSION = "0.1.0";

export * from "./extract-facts.js";
export * from "./gnd-allocator.js";
export * from "./infer.js";
export * from "./pin-graph.js";
export * from "./preprocess.js";
export * from "./recipes/index.js";
export * from "./resolve.js";
export * from "./synthesizer.js";
export * from "./types.js";
