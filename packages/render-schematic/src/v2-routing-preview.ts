/**
 * @license Apache-2.0
 * @s2c/render-schematic — V2 / Post-V1 Roadmap Feature (Experimental).
 * Orthogonal wire routing and junction generation per Doc §16.
 * Kept separate from the V1 Net-Label-Only renderer (Doc §10).
 */

import type { Circuit } from "@s2c/circuit-json";
import type { PinPosition, PlacedNet, Point } from "./types.js";

/**
 * Experimental Manhattan net router for v2 roadmap exploration.
 * Not active in the default v1 Net-Label-Only renderer.
 */
export function routeNetsExperimental(
  circuit: Circuit,
  portPositions: Map<string, PinPosition>,
  gridSize = 20,
): PlacedNet[] {
  const placedNets: PlacedNet[] = [];

  for (const net of circuit.nets) {
    const isGround = net.kind === "ground" || net.id.toUpperCase() === "GND";
    const isPower =
      net.kind === "power" ||
      net.id.toUpperCase() === "5V" ||
      net.id.toUpperCase() === "3V3" ||
      net.id.toUpperCase() === "VCC";

    const points: Point[] = [];
    for (const portId of net.portIds) {
      const pin = portPositions.get(portId);
      if (pin) {
        points.push(pin.worldPos);
      }
    }

    if (points.length < 2) {
      placedNets.push({
        net,
        points,
        pathData: "",
        isGround,
        isPower,
        label: net.id,
      });
      continue;
    }

    const sortedPoints = [...points].sort((a, b) => a.x - b.x);
    const pathSegments: string[] = [];

    for (let i = 0; i < sortedPoints.length - 1; i++) {
      const p1 = sortedPoints[i];
      const p2 = sortedPoints[i + 1];
      const midX = Math.round((p1.x + p2.x) / (2 * gridSize)) * gridSize;

      if (p1.y === p2.y) {
        pathSegments.push(`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`);
      } else {
        pathSegments.push(
          `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`,
        );
      }
    }

    placedNets.push({
      net,
      points,
      pathData: pathSegments.join(" "),
      isGround,
      isPower,
      label: net.id,
    });
  }

  return placedNets;
}
