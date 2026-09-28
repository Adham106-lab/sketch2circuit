/**
 * @license Apache-2.0
 * @s2c/parts — Comprehensive footprint coverage and pin-to-pad completeness test suite.
 */

import { FOOTPRINT_CATALOG, getFootprintDefinition } from "@s2c/footprints";
import { describe, expect, it } from "vitest";
import { PARTS_CATALOG } from "../src/index.js";

describe("Parts Footprint Coverage & Pin-to-Pad Completeness (M9 Non-Negotiable)", () => {
  it("ensures every catalog part has an assigned footprintId resolving in the footprint catalog", () => {
    const parts = Object.values(PARTS_CATALOG);
    expect(parts.length).toBeGreaterThanOrEqual(18);

    for (const part of parts) {
      const footprintId = part.footprintId ?? part.defaultFootprint;
      expect(
        footprintId,
        `Part '${part.id}' must specify footprintId or defaultFootprint`,
      ).toBeDefined();

      if (footprintId) {
        const fpDef = getFootprintDefinition(footprintId);
        expect(
          fpDef,
          `Footprint '${footprintId}' for part '${part.id}' must resolve in FOOTPRINT_CATALOG`,
        ).toBeDefined();
      }
    }
  });

  it("ensures every port of every catalog part has a valid mapping to an existing pad in the footprint", () => {
    const parts = Object.values(PARTS_CATALOG);

    for (const part of parts) {
      const footprintId = part.footprintId ?? part.defaultFootprint;
      expect(footprintId).toBeDefined();
      if (!footprintId) continue;

      const fpDef = getFootprintDefinition(footprintId);
      expect(fpDef).toBeDefined();
      if (!fpDef) continue;

      const availablePadNumbers = new Set(fpDef.pads.map((p) => p.number));

      expect(
        part.pinMap,
        `Part '${part.id}' must define a complete pinMap dictionary`,
      ).toBeDefined();

      const pinMap = part.pinMap ?? {};
      for (const port of part.ports) {
        const mappedPad = pinMap[port.name];
        expect(
          mappedPad,
          `Port '${port.name}' on part '${part.id}' must be mapped in pinMap`,
        ).toBeDefined();

        if (mappedPad) {
          expect(
            availablePadNumbers.has(mappedPad),
            `Port '${port.name}' on part '${part.id}' mapped to pad '${mappedPad}', which must exist in footprint '${fpDef.id}' (available: [${[...availablePadNumbers].join(", ")}])`,
          ).toBe(true);
        }
      }
    }
  });

  it("ensures all footprint definitions used by parts catalog have valid 3-level verification metadata", () => {
    const parts = Object.values(PARTS_CATALOG);
    for (const part of parts) {
      const footprintId = part.footprintId ?? part.defaultFootprint;
      expect(footprintId).toBeDefined();
      if (!footprintId) continue;

      const fp = FOOTPRINT_CATALOG[footprintId];
      expect(fp).toBeDefined();
      if (!fp) continue;

      expect([
        "datasheet-checked",
        "cross-checked-kicad-lib",
        "convention",
        "unverified",
      ]).toContain(fp.verification);
      expect(fp.pads.length).toBeGreaterThan(0);
      expect(fp.courtyard.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("ensures no two ports of the same part share a pad (no merged pins or shorted terminals)", () => {
    const parts = Object.values(PARTS_CATALOG);
    for (const part of parts) {
      const footprintId = part.footprintId ?? part.defaultFootprint;
      expect(footprintId).toBeDefined();
      if (!footprintId) continue;

      const fpDef = getFootprintDefinition(footprintId);
      expect(fpDef).toBeDefined();
      if (!fpDef) continue;

      const pinMap = part.pinMap ?? {};
      const mappedPads: string[] = [];

      for (const port of part.ports) {
        const padNumber = pinMap[port.name];
        expect(
          padNumber,
          `Port '${port.name}' on part '${part.id}' must map to a pad`,
        ).toBeDefined();
        if (padNumber) {
          mappedPads.push(padNumber);
        }
      }

      // Discrete components (potentiometers, servos, sensors, transistors, ICs, passives):
      // Must have strictly unique 1-to-1 port-to-pad mappings (no merged pins on 2-pin headers)
      if (part.kind !== "mcu") {
        const uniqueMappedPads = new Set(mappedPads);
        expect(
          uniqueMappedPads.size,
          `Discrete part '${part.id}' has port collision: ${part.ports.length} ports mapped to only ${uniqueMappedPads.size} unique pads ([${mappedPads.join(", ")}])`,
        ).toBe(part.ports.length);

        // Footprint must provide at least as many physical pads as part ports
        expect(
          fpDef.pads.length,
          `Footprint '${fpDef.id}' for part '${part.id}' has fewer physical pads (${fpDef.pads.length}) than part ports (${part.ports.length})`,
        ).toBeGreaterThanOrEqual(part.ports.length);
      }
    }
  });
});
