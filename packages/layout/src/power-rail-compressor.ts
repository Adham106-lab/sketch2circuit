/**
 * @license Apache-2.0
 * @s2c/layout — Power Rail Compression Pass.
 *
 * Replaces global sprawling power/ground hyper-edges with local port-label stubs
 * attached directly to NORTH (VCC) and SOUTH (GND) ports.
 */

import type { Circuit, Net } from "@s2c/circuit-json";
import type { PowerRailStub } from "./types.js";

const DEFAULT_POWER_RAIL_NAMES = new Set([
  "VCC",
  "5V",
  "3V3",
  "3.3V",
  "+5V",
  "+3V3",
  "+12V",
  "VIN",
  "RAW",
  "GND",
  "VSS",
  "0V",
]);

export interface CompressionResult {
  signalNets: Net[];
  compressedPowerNets: Net[];
  powerStubs: PowerRailStub[];
}

export function compressPowerRails(
  circuit: Circuit,
  options?: { powerRailNames?: string[] },
): CompressionResult {
  const powerNames = options?.powerRailNames
    ? new Set(options.powerRailNames.map((s) => s.toUpperCase()))
    : DEFAULT_POWER_RAIL_NAMES;

  const signalNets: Net[] = [];
  const compressedPowerNets: Net[] = [];
  const powerStubs: PowerRailStub[] = [];

  for (const net of circuit.nets) {
    const isGround =
      net.kind === "ground" ||
      net.id.toUpperCase() === "GND" ||
      net.name?.toUpperCase() === "GND";

    const isPower =
      net.kind === "power" ||
      powerNames.has(net.id.toUpperCase()) ||
      (net.name && powerNames.has(net.name.toUpperCase()));

    if (isGround || isPower) {
      compressedPowerNets.push(net);
      // Generate individual stubs for each attached port
      for (const portId of net.portIds) {
        const [compId] = portId.split(".");
        powerStubs.push({
          componentId: compId,
          portId,
          railName: net.name || net.id,
          side: isGround ? "SOUTH" : "NORTH",
          symbol: isGround ? "GND_ARROW" : "VCC_FLAG",
        });
      }
    } else {
      signalNets.push(net);
    }
  }

  return {
    signalNets,
    compressedPowerNets,
    powerStubs,
  };
}
