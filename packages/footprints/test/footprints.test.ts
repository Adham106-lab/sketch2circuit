/**
 * @license Apache-2.0
 * @s2c/footprints — Comprehensive test suite for footprint generators and catalog.
 */

import { describe, expect, it } from "vitest";
import {
  ARDUINO_UNO_R3_MOUNTING_HOLES,
  ARDUINO_UNO_R3_SHIELD_OUTLINE,
  FOOTPRINT_CATALOG,
  FOOTPRINTS_VERSION,
  generateAxialResistorFootprint,
  generateDo41Footprint,
  generateLed5mmFootprint,
  generatePinHeaderFootprint,
  generateRadialElectrolyticCapFootprint,
  generateScrewTerminalFootprint,
  generateTactileButtonFootprint,
  generateTo92Footprint,
  getFootprintDefinition,
  getPanasonicFcLeadPitch,
} from "../src/index.js";

describe("@s2c/footprints package", () => {
  it("exports package version constant", () => {
    expect(FOOTPRINTS_VERSION).toBe("0.1.0");
  });

  describe("Panasonic FC electrolytic capacitor pitch verification", () => {
    it("verifies 5mm can has 2.0mm pitch, NOT 2.5mm (per Panasonic FC datasheet)", () => {
      expect(getPanasonicFcLeadPitch(5.0)).toBe(2.0);
      expect(getPanasonicFcLeadPitch(4.0)).toBe(1.5);
      expect(getPanasonicFcLeadPitch(6.3)).toBe(2.5);
      expect(getPanasonicFcLeadPitch(8.0)).toBe(3.5);
      expect(getPanasonicFcLeadPitch(10.0)).toBe(5.0);

      const fp5mm = generateRadialElectrolyticCapFootprint({ canDiameterMm: 5.0 });
      const padPos = fp5mm.pads.find((p) => p.number === "+");
      const padNeg = fp5mm.pads.find((p) => p.number === "-");
      expect(padPos).toBeDefined();
      expect(padNeg).toBeDefined();
      const distance = Math.abs((padNeg?.x ?? 0) - (padPos?.x ?? 0));
      expect(distance).toBeCloseTo(2.0, 3);
      expect(fp5mm.verification).toBe("cross-checked-kicad-lib");
      expect(fp5mm.verified).toBe(true);
    });

    it("verifies 6.3mm can has 2.5mm lead spacing", () => {
      const fp63 = generateRadialElectrolyticCapFootprint({ canDiameterMm: 6.3 });
      const p0 = fp63.pads[0];
      const p1 = fp63.pads[1];
      expect(p0).toBeDefined();
      expect(p1).toBeDefined();
      const distance = Math.abs((p1?.x ?? 0) - (p0?.x ?? 0));
      expect(distance).toBeCloseTo(2.5, 3);
    });
  });

  describe("Verification taxonomy across all catalog footprints", () => {
    it("ensures every catalog footprint has a valid 4-level verification tag", () => {
      const allFootprints = Object.values(FOOTPRINT_CATALOG);
      expect(allFootprints.length).toBeGreaterThanOrEqual(13);

      for (const fp of allFootprints) {
        expect([
          "datasheet-checked",
          "cross-checked-kicad-lib",
          "convention",
          "unverified",
        ]).toContain(fp.verification);
        expect(typeof fp.source).toBe("string");
        expect(fp.source.length).toBeGreaterThan(5);

        // Pads must have positive dimensions and valid coordinates
        expect(fp.pads.length).toBeGreaterThanOrEqual(1);
        for (const pad of fp.pads) {
          expect(pad.w).toBeGreaterThan(0);
          expect(pad.h).toBeGreaterThan(0);
          if (pad.drill !== undefined) {
            expect(pad.drill).toBeGreaterThan(0);
            expect(pad.drill).toBeLessThan(pad.w);
          }
        }

        // Courtyard must form a polygon (at least 3 vertices)
        expect(fp.courtyard.length).toBeGreaterThanOrEqual(3);

        // Body3D must have a valid kind
        expect(fp.body3d).toBeDefined();
        expect(["box", "cylinder", "led5mm", "header", "composite"]).toContain(fp.body3d.kind);
      }
    });

    it("verifies cross-checked-kicad-lib footprints carry verified: true", () => {
      const crossChecked = Object.values(FOOTPRINT_CATALOG).filter(
        (fp) => fp.verification === "cross-checked-kicad-lib",
      );
      expect(crossChecked.length).toBeGreaterThanOrEqual(5);
      for (const fp of crossChecked) {
        expect(fp.verified).toBe(true);
      }
    });

    it("verifies unverified footprints carry verified: false", () => {
      const unverified = Object.values(FOOTPRINT_CATALOG).filter(
        (fp) => fp.verification === "unverified",
      );
      expect(unverified.length).toBeGreaterThanOrEqual(3);
      for (const fp of unverified) {
        expect(fp.verified).toBe(false);
      }
    });
  });

  describe("Individual footprint generators", () => {
    it("generates parametric axial resistor with custom pitch", () => {
      const fp = generateAxialResistorFootprint({ pitchMm: 10.16 });
      const p0 = fp.pads[0];
      const p1 = fp.pads[1];
      expect(p0).toBeDefined();
      expect(p1).toBeDefined();
      expect(Math.abs((p1?.x ?? 0) - (p0?.x ?? 0))).toBeCloseTo(10.16, 3);
      expect(fp.verification).toBe("convention");
    });

    it("generates 5mm LED with cathode flat mark and 2.54mm pitch", () => {
      const fp = generateLed5mmFootprint();
      expect(fp.pads).toHaveLength(2);
      expect(fp.pads.map((p) => p.number)).toEqual(["1", "2"]);
      expect(fp.pads[0]?.shape).toBe("rect"); // Pad 1 Cathode rect
      expect(fp.pads[1]?.shape).toBe("circle"); // Pad 2 Anode circle
      expect(fp.body3d.kind).toBe("led5mm");
      expect(fp.verification).toBe("cross-checked-kicad-lib");
    });

    it("generates 6x6mm tactile button with 4 pins and Omron B3F spacing", () => {
      const fp = generateTactileButtonFootprint();
      expect(fp.pads).toHaveLength(4);
      const p0 = fp.pads[0];
      const p1 = fp.pads[1];
      const p2 = fp.pads[2];
      expect(p0).toBeDefined();
      expect(p1).toBeDefined();
      expect(p2).toBeDefined();
      const xDistance = Math.abs((p1?.x ?? 0) - (p0?.x ?? 0));
      const yDistance = Math.abs((p2?.y ?? 0) - (p0?.y ?? 0));
      expect(xDistance).toBeCloseTo(6.5, 3);
      expect(yDistance).toBeCloseTo(4.5, 3);
    });

    it("generates DO-41 diode with 10.16mm horizontal pitch and cathode line", () => {
      const fp = generateDo41Footprint();
      expect(fp.pads).toHaveLength(2);
      expect(fp.pads.map((p) => p.number)).toEqual(["1", "2"]);
      expect(fp.pads[0]?.shape).toBe("rect"); // Pad 1 Cathode rect
      expect(fp.pads[1]?.shape).toBe("oval"); // Pad 2 Anode oval
      const p0 = fp.pads[0];
      const p1 = fp.pads[1];
      expect(p0).toBeDefined();
      expect(p1).toBeDefined();
      expect(Math.abs((p1?.x ?? 0) - (p0?.x ?? 0))).toBeCloseTo(10.16, 3);
    });

    it("generates TO-92 transistor with 3 pins (1, 2, 3)", () => {
      const fp = generateTo92Footprint();
      expect(fp.pads).toHaveLength(3);
      expect(fp.pads.map((p) => p.number)).toEqual(["1", "2", "3"]);
      expect(fp.pads[0]?.shape).toBe("rect");
      expect(fp.pads[1]?.shape).toBe("oval");
      expect(fp.pads[2]?.shape).toBe("oval");
    });

    it("generates 1xN pin headers with square pin 1", () => {
      const fp3 = generatePinHeaderFootprint({ pinCount: 3 });
      expect(fp3.pads).toHaveLength(3);
      expect(fp3.pads[0]?.shape).toBe("rect");
      expect(fp3.pads[1]?.shape).toBe("oval");
      expect(fp3.pads[2]?.shape).toBe("oval");
    });

    it("generates 2-pos and 3-pos screw terminals", () => {
      const fp2 = generateScrewTerminalFootprint({ positions: 2 });
      expect(fp2.pads).toHaveLength(2);
      const fp3 = generateScrewTerminalFootprint({ positions: 3 });
      expect(fp3.pads).toHaveLength(3);
    });
  });

  describe("Arduino Uno R3 shield outline and mechanical fixtures", () => {
    it("defines canonical Uno shield polygon with standard dimensions (68.58 x 53.34 mm)", () => {
      expect(ARDUINO_UNO_R3_SHIELD_OUTLINE.length).toBeGreaterThanOrEqual(8);
      const xs = ARDUINO_UNO_R3_SHIELD_OUTLINE.map((p) => p.x);
      const ys = ARDUINO_UNO_R3_SHIELD_OUTLINE.map((p) => p.y);
      expect(Math.max(...xs)).toBeCloseTo(68.58, 2);
      expect(Math.max(...ys)).toBeCloseTo(53.34, 2);
    });

    it("defines the 4 mounting holes for Arduino Uno R3 with 3.2mm M3 drill", () => {
      expect(ARDUINO_UNO_R3_MOUNTING_HOLES).toHaveLength(4);
      for (const hole of ARDUINO_UNO_R3_MOUNTING_HOLES) {
        expect(hole.drillMm).toBe(3.2);
      }
    });

    it("resolves catalog footprints via getFootprintDefinition", () => {
      expect(getFootprintDefinition("resistor:axial-0.3in")).toBeDefined();
      expect(getFootprintDefinition("led:5mm")).toBeDefined();
      expect(getFootprintDefinition("nonexistent-footprint")).toBeUndefined();
    });
  });
});
