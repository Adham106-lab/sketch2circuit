/**
 * @license Apache-2.0
 * @s2c/erc — Electrical Rule Check (ERC) Pass for sketch2circuit.
 */

export * from "./pass.js";
export * from "./rules/current-protection.js";
export * from "./rules/i2c-pullup.js";
export * from "./rules/pin-contention.js";
export * from "./rules/strapping-restricted-pins.js";
export * from "./types.js";

export const ERC_VERSION = "0.1.0";
