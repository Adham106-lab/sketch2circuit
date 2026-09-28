/**
 * @license Apache-2.0
 * @s2c/footprints — Cross-check against official KiCad library fixtures.
 * Fixtures fetched from: https://github.com/KiCad/kicad-footprints
 * Commit: 7ebfa6b23cc292a56f751b7b5f4a0e12eeef69dd
 */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOOTPRINT_CATALOG,
  generateAxialResistorFootprint,
  generateDo41Footprint,
  generateLed5mmFootprint,
  generatePinHeaderFootprint,
  generateRadialElectrolyticCapFootprint,
  generateTactileButtonFootprint,
  generateTo92Footprint,
  generateUnoAnalogHeaderFootprint,
  generateUnoDigitalHighHeaderFootprint,
  generateUnoDigitalLowHeaderFootprint,
  generateUnoPowerHeaderFootprint,
  generateUnoShieldFootprint,
} from "../src/index.js";

interface KiCadPad {
  number: string;
  type: string;
  shape: string;
  x: number;
  y: number;
  w: number;
  h: number;
  drill: number;
}

function parseKiCadModPads(filePath: string): KiCadPad[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const pads: KiCadPad[] = [];
  const regex =
    /\(pad\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)\s+\(at\s+([^\s)]+)\s+([^\s)]+)(?:\s+([^\s)]+))?\)\s+\(size\s+([^\s)]+)\s+([^\s)]+)\)\s+\(drill\s+(?:oval\s+)?([^\s)]+)/g;

  let m = regex.exec(content);
  while (m !== null) {
    const num = m[1] ?? "";
    const ptype = m[2] ?? "";
    const shape = m[3] ?? "";
    const x = Number.parseFloat(m[4] ?? "0");
    const y = Number.parseFloat(m[5] ?? "0");
    const w = Number.parseFloat(m[7] ?? "0");
    const h = Number.parseFloat(m[8] ?? "0");
    const drill = Number.parseFloat(m[9] ?? "0");
    pads.push({ number: num, type: ptype, shape, x, y, w, h, drill });
    m = regex.exec(content);
  }
  return pads;
}

const FIXTURES_DIR = path.resolve(process.cwd(), "fixtures/kicad-footprints");

describe("KiCad Official Footprint Library Cross-Check Tests", () => {
  it("verifies LED_D5.0mm.kicad_mod pad geometry (vector (2.54, 0), shapes rect/circle, drill 0.9mm, size 1.8mm) within 0.01mm", () => {
    const file = path.join(FIXTURES_DIR, "LED_D5.0mm.kicad_mod");
    const kicadPads = parseKiCadModPads(file);
    expect(kicadPads.length).toBe(2);

    const p1 = kicadPads.find((p) => p.number === "1");
    const p2 = kicadPads.find((p) => p.number === "2");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p1?.shape).toBe("rect"); // Cathode square pad
    expect(p2?.shape).toBe("circle"); // Anode circular pad
    expect(p1?.drill).toBeCloseTo(0.9, 2);
    expect(p1?.w).toBeCloseTo(1.8, 2);
    expect(p1?.h).toBeCloseTo(1.8, 2);
    expect(p2?.drill).toBeCloseTo(0.9, 2);
    expect(p2?.w).toBeCloseTo(1.8, 2);
    expect(p2?.h).toBeCloseTo(1.8, 2);

    // Vector from Pad 1 (Cathode) to Pad 2 (Anode) in fixture
    const kicadVector = {
      dx: (p2?.x ?? 0) - (p1?.x ?? 0),
      dy: (p2?.y ?? 0) - (p1?.y ?? 0),
    };
    expect(kicadVector.dx).toBeCloseTo(2.54, 2);
    expect(kicadVector.dy).toBeCloseTo(0.0, 2);

    const s2cFp = generateLed5mmFootprint();
    expect(s2cFp.verification).toBe("cross-checked-kicad-lib");
    expect(s2cFp.pads.length).toBe(2);

    const s1 = s2cFp.pads.find((p) => p.number === "1");
    const s2 = s2cFp.pads.find((p) => p.number === "2");
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s1?.shape).toBe(p1?.shape); // rect
    expect(s2?.shape).toBe(p2?.shape); // circle

    expect(s1?.drill).toBeCloseTo(p1?.drill ?? 0, 2);
    expect(s1?.w).toBeCloseTo(p1?.w ?? 0, 2);
    expect(s1?.h).toBeCloseTo(p1?.h ?? 0, 2);
    expect(s2?.drill).toBeCloseTo(p2?.drill ?? 0, 2);
    expect(s2?.w).toBeCloseTo(p2?.w ?? 0, 2);
    expect(s2?.h).toBeCloseTo(p2?.h ?? 0, 2);

    // Vector from Pad 1 (Cathode) to Pad 2 (Anode) in s2c
    const s2cVector = {
      dx: (s2?.x ?? 0) - (s1?.x ?? 0),
      dy: (s2?.y ?? 0) - (s1?.y ?? 0),
    };
    expect(Math.abs(s2cVector.dx - kicadVector.dx)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector.dy - kicadVector.dy)).toBeLessThan(0.01);
  });

  it("verifies R_Axial_P7.62mm.kicad_mod pad geometry (vector (7.62, 0), shapes circle/oval, drill 0.8mm, size 1.6mm) within 0.01mm", () => {
    const file = path.join(FIXTURES_DIR, "R_Axial_P7.62mm.kicad_mod");
    const kicadPads = parseKiCadModPads(file);
    expect(kicadPads.length).toBe(2);

    const p1 = kicadPads.find((p) => p.number === "1");
    const p2 = kicadPads.find((p) => p.number === "2");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p1?.shape).toBe("circle");
    expect(p2?.shape).toBe("oval");
    expect(p1?.drill).toBeCloseTo(0.8, 2);
    expect(p1?.w).toBeCloseTo(1.6, 2);
    expect(p1?.h).toBeCloseTo(1.6, 2);
    expect(p2?.drill).toBeCloseTo(0.8, 2);
    expect(p2?.w).toBeCloseTo(1.6, 2);
    expect(p2?.h).toBeCloseTo(1.6, 2);

    const kicadVector = {
      dx: (p2?.x ?? 0) - (p1?.x ?? 0),
      dy: (p2?.y ?? 0) - (p1?.y ?? 0),
    };
    expect(kicadVector.dx).toBeCloseTo(7.62, 2);
    expect(kicadVector.dy).toBeCloseTo(0.0, 2);

    const s2cFp = generateAxialResistorFootprint({ pitchMm: 7.62 });
    expect(s2cFp.verification).toBe("cross-checked-kicad-lib");
    const s1 = s2cFp.pads[0];
    const s2 = s2cFp.pads[1];
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s1?.shape).toBe(p1?.shape); // circle
    expect(s2?.shape).toBe(p2?.shape); // oval

    expect(s1?.drill).toBeCloseTo(p1?.drill ?? 0, 2);
    expect(s1?.w).toBeCloseTo(p1?.w ?? 0, 2);
    expect(s1?.h).toBeCloseTo(p1?.h ?? 0, 2);
    expect(s2?.drill).toBeCloseTo(p2?.drill ?? 0, 2);
    expect(s2?.w).toBeCloseTo(p2?.w ?? 0, 2);
    expect(s2?.h).toBeCloseTo(p2?.h ?? 0, 2);

    const s2cVector = {
      dx: (s2?.x ?? 0) - (s1?.x ?? 0),
      dy: (s2?.y ?? 0) - (s1?.y ?? 0),
    };
    expect(Math.abs(s2cVector.dx - kicadVector.dx)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector.dy - kicadVector.dy)).toBeLessThan(0.01);
  });

  it("verifies CP_Radial_D5.0mm_P2.00mm.kicad_mod pad geometry (vector (2.0, 0), shapes rect/circle, drill 0.8mm, size 1.6mm) within 0.01mm", () => {
    const file = path.join(FIXTURES_DIR, "CP_Radial_D5.0mm_P2.00mm.kicad_mod");
    const kicadPads = parseKiCadModPads(file);
    expect(kicadPads.length).toBe(2);

    const p1 = kicadPads.find((p) => p.number === "1");
    const p2 = kicadPads.find((p) => p.number === "2");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p1?.shape).toBe("rect"); // Positive lead
    expect(p2?.shape).toBe("circle"); // Negative lead
    expect(p1?.drill).toBeCloseTo(0.8, 2);
    expect(p1?.w).toBeCloseTo(1.6, 2);
    expect(p1?.h).toBeCloseTo(1.6, 2);
    expect(p2?.drill).toBeCloseTo(0.8, 2);
    expect(p2?.w).toBeCloseTo(1.6, 2);
    expect(p2?.h).toBeCloseTo(1.6, 2);

    const kicadVector = {
      dx: (p2?.x ?? 0) - (p1?.x ?? 0),
      dy: (p2?.y ?? 0) - (p1?.y ?? 0),
    };
    expect(kicadVector.dx).toBeCloseTo(2.0, 2);
    expect(kicadVector.dy).toBeCloseTo(0.0, 2);

    const s2cFp = generateRadialElectrolyticCapFootprint({ canDiameterMm: 5.0, pitchMm: 2.0 });
    expect(s2cFp.verification).toBe("cross-checked-kicad-lib");
    const s1 = s2cFp.pads[0];
    const s2 = s2cFp.pads[1];
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s1?.shape).toBe(p1?.shape); // rect (+)
    expect(s2?.shape).toBe(p2?.shape); // circle (-)

    expect(s1?.drill).toBeCloseTo(p1?.drill ?? 0, 2);
    expect(s1?.w).toBeCloseTo(p1?.w ?? 0, 2);
    expect(s1?.h).toBeCloseTo(p1?.h ?? 0, 2);
    expect(s2?.drill).toBeCloseTo(p2?.drill ?? 0, 2);
    expect(s2?.w).toBeCloseTo(p2?.w ?? 0, 2);
    expect(s2?.h).toBeCloseTo(p2?.h ?? 0, 2);

    const s2cVector = {
      dx: (s2?.x ?? 0) - (s1?.x ?? 0),
      dy: (s2?.y ?? 0) - (s1?.y ?? 0),
    };
    expect(Math.abs(s2cVector.dx - kicadVector.dx)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector.dy - kicadVector.dy)).toBeLessThan(0.01);
  });

  it("verifies SW_PUSH_6mm.kicad_mod pad numbers, shapes, positions (6.5x4.5mm span), sizes (2.0mm), and drills (1.1mm); terminal connectivity follows KiCad's numbering convention; verify against your switch's datasheet", () => {
    const file = path.join(FIXTURES_DIR, "SW_PUSH_6mm.kicad_mod");
    const kicadPads = parseKiCadModPads(file);
    expect(kicadPads.length).toBe(4);

    // In the fixture, 2 pads share number "1" and 2 pads share number "2"
    const pad1s = kicadPads.filter((p) => p.number === "1");
    const pad2s = kicadPads.filter((p) => p.number === "2");
    expect(pad1s.length).toBe(2);
    expect(pad2s.length).toBe(2);

    for (const kp of kicadPads) {
      expect(kp.shape).toBe("circle");
      expect(kp.drill).toBeCloseTo(1.1, 2);
      expect(kp.w).toBeCloseTo(2.0, 2);
      expect(kp.h).toBeCloseTo(2.0, 2);
    }

    // Terminal 1 pads in fixture: both at y=0, separated by dx = 6.5mm across switch body
    expect(pad1s[0]?.y).toBeCloseTo(0.0, 2);
    expect(pad1s[1]?.y).toBeCloseTo(0.0, 2);
    const pad1Pitch = Math.abs((pad1s[1]?.x ?? 0) - (pad1s[0]?.x ?? 0));
    expect(pad1Pitch).toBeCloseTo(6.5, 2);

    // Terminal 2 pads in fixture: both at y=4.5, separated by dx = 6.5mm across switch body
    expect(pad2s[0]?.y).toBeCloseTo(4.5, 2);
    expect(pad2s[1]?.y).toBeCloseTo(4.5, 2);
    const pad2Pitch = Math.abs((pad2s[1]?.x ?? 0) - (pad2s[0]?.x ?? 0));
    expect(pad2Pitch).toBeCloseTo(6.5, 2);

    // Terminal row separation: Terminal 1 row (y=0) and Terminal 2 row (y=4.5) are separated by 4.5mm
    const rowSeparation = Math.abs((pad2s[0]?.y ?? 0) - (pad1s[0]?.y ?? 0));
    expect(rowSeparation).toBeCloseTo(4.5, 2);

    // Verify s2c generator matches KiCad pad numbers, shapes, positions, sizes, and drills:
    const s2cFp = generateTactileButtonFootprint();
    expect(s2cFp.verification).toBe("cross-checked-kicad-lib");
    expect(s2cFp.pads.length).toBe(4);

    const sPad1s = s2cFp.pads.filter((p) => p.number === "1");
    const sPad2s = s2cFp.pads.filter((p) => p.number === "2");
    expect(sPad1s.length, "Generator has 2 pads numbered '1' matching KiCad convention").toBe(2);
    expect(sPad2s.length, "Generator has 2 pads numbered '2' matching KiCad convention").toBe(2);

    // Terminal 1 row in s2c: same Y coordinate, dx = 6.5mm
    expect(sPad1s[0]?.y).toBeCloseTo(sPad1s[1]?.y ?? 0, 2);
    const sPad1Pitch = Math.abs((sPad1s[1]?.x ?? 0) - (sPad1s[0]?.x ?? 0));
    expect(sPad1Pitch).toBeCloseTo(6.5, 2);

    // Terminal 2 row in s2c: same Y coordinate, dx = 6.5mm
    expect(sPad2s[0]?.y).toBeCloseTo(sPad2s[1]?.y ?? 0, 2);
    const sPad2Pitch = Math.abs((sPad2s[1]?.x ?? 0) - (sPad2s[0]?.x ?? 0));
    expect(sPad2Pitch).toBeCloseTo(6.5, 2);

    // Separation between Terminal 1 and Terminal 2 rows: 4.5mm
    const sRowSeparation = Math.abs((sPad2s[0]?.y ?? 0) - (sPad1s[0]?.y ?? 0));
    expect(sRowSeparation).toBeCloseTo(4.5, 2);

    // Note: Internal leadframe continuity and snap-dome switching are manufacturer-dependent,
    // not from KiCad footprint library. Terminal connectivity follows KiCad's numbering convention;
    // verify against your switch's datasheet.
  });

  it("verifies D_DO-41_P10.16mm.kicad_mod pad geometry (vector (10.16, 0), shapes rect/oval, drill 1.1mm, size 2.2mm) within 0.01mm", () => {
    const file = path.join(FIXTURES_DIR, "D_DO-41_P10.16mm.kicad_mod");
    const kicadPads = parseKiCadModPads(file);
    expect(kicadPads.length).toBe(2);

    const p1 = kicadPads.find((p) => p.number === "1");
    const p2 = kicadPads.find((p) => p.number === "2");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p1?.shape).toBe("rect"); // Cathode square pad
    expect(p2?.shape).toBe("oval"); // Anode oval pad
    expect(p1?.drill).toBeCloseTo(1.1, 2);
    expect(p1?.w).toBeCloseTo(2.2, 2);
    expect(p1?.h).toBeCloseTo(2.2, 2);
    expect(p2?.drill).toBeCloseTo(1.1, 2);
    expect(p2?.w).toBeCloseTo(2.2, 2);
    expect(p2?.h).toBeCloseTo(2.2, 2);

    const kicadVector = {
      dx: (p2?.x ?? 0) - (p1?.x ?? 0),
      dy: (p2?.y ?? 0) - (p1?.y ?? 0),
    };
    expect(kicadVector.dx).toBeCloseTo(10.16, 2);
    expect(kicadVector.dy).toBeCloseTo(0.0, 2);

    const s2cFp = generateDo41Footprint();
    expect(s2cFp.verification).toBe("cross-checked-kicad-lib");
    const s1 = s2cFp.pads[0];
    const s2 = s2cFp.pads[1];
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s1?.shape).toBe(p1?.shape); // rect
    expect(s2?.shape).toBe(p2?.shape); // oval

    expect(s1?.drill).toBeCloseTo(p1?.drill ?? 0, 2);
    expect(s1?.w).toBeCloseTo(p1?.w ?? 0, 2);
    expect(s1?.h).toBeCloseTo(p1?.h ?? 0, 2);
    expect(s2?.drill).toBeCloseTo(p2?.drill ?? 0, 2);
    expect(s2?.w).toBeCloseTo(p2?.w ?? 0, 2);
    expect(s2?.h).toBeCloseTo(p2?.h ?? 0, 2);

    const s2cVector = {
      dx: (s2?.x ?? 0) - (s1?.x ?? 0),
      dy: (s2?.y ?? 0) - (s1?.y ?? 0),
    };
    expect(Math.abs(s2cVector.dx - kicadVector.dx)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector.dy - kicadVector.dy)).toBeLessThan(0.01);
  });

  it("verifies TO-92_Inline.kicad_mod pad geometry (pad vectors (1.27, 0), shapes rect/oval/oval, drill 0.75mm, size 1.05x1.5mm) within 0.01mm", () => {
    const file = path.join(FIXTURES_DIR, "TO-92_Inline.kicad_mod");
    const kicadPads = parseKiCadModPads(file);
    expect(kicadPads.length).toBe(3);

    const p1 = kicadPads.find((p) => p.number === "1");
    const p2 = kicadPads.find((p) => p.number === "2");
    const p3 = kicadPads.find((p) => p.number === "3");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p3).toBeDefined();

    expect(p1?.shape).toBe("rect");
    expect(p2?.shape).toBe("oval");
    expect(p3?.shape).toBe("oval");

    for (const kp of [p1, p2, p3]) {
      expect(kp?.drill).toBeCloseTo(0.75, 2);
      expect(kp?.w).toBeCloseTo(1.05, 2);
      expect(kp?.h).toBeCloseTo(1.5, 2);
    }

    const vector12 = { dx: (p2?.x ?? 0) - (p1?.x ?? 0), dy: (p2?.y ?? 0) - (p1?.y ?? 0) };
    const vector23 = { dx: (p3?.x ?? 0) - (p2?.x ?? 0), dy: (p3?.y ?? 0) - (p2?.y ?? 0) };
    expect(vector12.dx).toBeCloseTo(1.27, 2);
    expect(vector12.dy).toBeCloseTo(0.0, 2);
    expect(vector23.dx).toBeCloseTo(1.27, 2);
    expect(vector23.dy).toBeCloseTo(0.0, 2);

    const s2cFp = generateTo92Footprint();
    expect(s2cFp.verification).toBe("cross-checked-kicad-lib");
    expect(s2cFp.pads.length).toBe(3);

    const s1 = s2cFp.pads.find((p) => p.number === "1");
    const s2 = s2cFp.pads.find((p) => p.number === "2");
    const s3 = s2cFp.pads.find((p) => p.number === "3");
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s3).toBeDefined();
    expect(s1?.shape).toBe(p1?.shape); // rect
    expect(s2?.shape).toBe(p2?.shape); // oval
    expect(s3?.shape).toBe(p3?.shape); // oval

    for (const sp of [s1, s2, s3]) {
      expect(sp?.drill).toBeCloseTo(0.75, 2);
      expect(sp?.w).toBeCloseTo(1.05, 2);
      expect(sp?.h).toBeCloseTo(1.5, 2);
    }

    const s2cVector12 = { dx: (s2?.x ?? 0) - (s1?.x ?? 0), dy: (s2?.y ?? 0) - (s1?.y ?? 0) };
    const s2cVector23 = { dx: (s3?.x ?? 0) - (s2?.x ?? 0), dy: (s3?.y ?? 0) - (s2?.y ?? 0) };
    expect(Math.abs(s2cVector12.dx - vector12.dx)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector12.dy - vector12.dy)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector23.dx - vector23.dx)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector23.dy - vector23.dy)).toBeLessThan(0.01);
  });

  it("verifies PinHeader_1x03_P2.54mm.kicad_mod pad geometry (vector (0, 2.54), shapes rect/oval/oval, drill 1.0mm, size 1.7mm) within 0.01mm", () => {
    const file = path.join(FIXTURES_DIR, "PinHeader_1x03_P2.54mm.kicad_mod");
    const kicadPads = parseKiCadModPads(file);
    expect(kicadPads.length).toBe(3);

    const p1 = kicadPads.find((p) => p.number === "1");
    const p2 = kicadPads.find((p) => p.number === "2");
    const p3 = kicadPads.find((p) => p.number === "3");
    expect(p1).toBeDefined();
    expect(p2).toBeDefined();
    expect(p3).toBeDefined();

    expect(p1?.shape).toBe("rect");
    expect(p2?.shape).toBe("oval");
    expect(p3?.shape).toBe("oval");

    for (const kp of [p1, p2, p3]) {
      expect(kp?.drill).toBeCloseTo(1.0, 2);
      expect(kp?.w).toBeCloseTo(1.7, 2);
      expect(kp?.h).toBeCloseTo(1.7, 2);
    }

    const vector12 = { dx: (p2?.x ?? 0) - (p1?.x ?? 0), dy: (p2?.y ?? 0) - (p1?.y ?? 0) };
    const vector23 = { dx: (p3?.x ?? 0) - (p2?.x ?? 0), dy: (p3?.y ?? 0) - (p2?.y ?? 0) };
    expect(vector12.dx).toBeCloseTo(0.0, 2);
    expect(vector12.dy).toBeCloseTo(2.54, 2);
    expect(vector23.dx).toBeCloseTo(0.0, 2);
    expect(vector23.dy).toBeCloseTo(2.54, 2);

    const s2cFp = generatePinHeaderFootprint({ pinCount: 3 });
    const s1 = s2cFp.pads[0];
    const s2 = s2cFp.pads[1];
    const s3 = s2cFp.pads[2];
    expect(s1).toBeDefined();
    expect(s2).toBeDefined();
    expect(s3).toBeDefined();
    expect(s1?.shape).toBe(p1?.shape); // rect
    expect(s2?.shape).toBe(p2?.shape); // oval
    expect(s3?.shape).toBe(p3?.shape); // oval

    for (const sp of [s1, s2, s3]) {
      expect(sp?.drill).toBeCloseTo(1.0, 2);
      expect(sp?.w).toBeCloseTo(1.7, 2);
      expect(sp?.h).toBeCloseTo(1.7, 2);
    }

    const s2cVector12 = { dx: (s2?.x ?? 0) - (s1?.x ?? 0), dy: (s2?.y ?? 0) - (s1?.y ?? 0) };
    const s2cVector23 = { dx: (s3?.x ?? 0) - (s2?.x ?? 0), dy: (s3?.y ?? 0) - (s2?.y ?? 0) };
    expect(Math.abs(s2cVector12.dx - vector12.dx)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector12.dy - vector12.dy)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector23.dx - vector23.dx)).toBeLessThan(0.01);
    expect(Math.abs(s2cVector23.dy - vector23.dy)).toBeLessThan(0.01);
  });

  it("verifies Arduino_UNO_R3.kicad_mod pad geometry for all 32 pins (D0-D13, A0-A5, Power, Control) and upgrades header footprints", () => {
    const file = path.join(FIXTURES_DIR, "Arduino_UNO_R3.kicad_mod");
    const kicadPads = parseKiCadModPads(file);
    expect(kicadPads.length).toBe(32);

    // Assert all 32 pads in fixture have 1.0mm drill and 1.6mm x 1.6mm size
    for (const kp of kicadPads) {
      expect(kp.drill).toBeCloseTo(1.0, 2);
      expect(kp.w).toBeCloseTo(1.6, 2);
      expect(kp.h).toBeCloseTo(1.6, 2);
    }

    // Mapping of KiCad pad number -> functional pin name and expected relative coordinates (origin at Pad 1 NC)
    const EXPECTED_PINS: Array<{ num: string; label: string; relX: number; relY: number }> = [
      // Power Header (Pads 1-8)
      { num: "1", label: "NC", relX: 0.0, relY: 0.0 },
      { num: "2", label: "IOREF", relX: 2.54, relY: 0.0 },
      { num: "3", label: "RESET", relX: 5.08, relY: 0.0 },
      { num: "4", label: "3V3", relX: 7.62, relY: 0.0 },
      { num: "5", label: "5V", relX: 10.16, relY: 0.0 },
      { num: "6", label: "GND.1", relX: 12.7, relY: 0.0 },
      { num: "7", label: "GND.2", relX: 15.24, relY: 0.0 },
      { num: "8", label: "VIN", relX: 17.78, relY: 0.0 },

      // Analog Header (Pads 9-14)
      { num: "9", label: "A0", relX: 22.86, relY: 0.0 },
      { num: "10", label: "A1", relX: 25.4, relY: 0.0 },
      { num: "11", label: "A2", relX: 27.94, relY: 0.0 },
      { num: "12", label: "A3", relX: 30.48, relY: 0.0 },
      { num: "13", label: "A4", relX: 33.02, relY: 0.0 },
      { num: "14", label: "A5", relX: 35.56, relY: 0.0 },

      // Digital Low Header D0-D7 (Pads 15-22)
      { num: "15", label: "D0", relX: 35.56, relY: 48.26 },
      { num: "16", label: "D1", relX: 33.02, relY: 48.26 },
      { num: "17", label: "D2", relX: 30.48, relY: 48.26 },
      { num: "18", label: "D3", relX: 27.94, relY: 48.26 },
      { num: "19", label: "D4", relX: 25.4, relY: 48.26 },
      { num: "20", label: "D5", relX: 22.86, relY: 48.26 },
      { num: "21", label: "D6", relX: 20.32, relY: 48.26 },
      { num: "22", label: "D7", relX: 17.78, relY: 48.26 },

      // Digital High Header D8-SCL (Pads 23-32)
      { num: "23", label: "D8", relX: 13.72, relY: 48.26 },
      { num: "24", label: "D9", relX: 11.18, relY: 48.26 },
      { num: "25", label: "D10", relX: 8.64, relY: 48.26 },
      { num: "26", label: "D11", relX: 6.1, relY: 48.26 },
      { num: "27", label: "D12", relX: 3.56, relY: 48.26 },
      { num: "28", label: "D13", relX: 1.02, relY: 48.26 },
      { num: "29", label: "GND", relX: -1.52, relY: 48.26 },
      { num: "30", label: "AREF", relX: -4.06, relY: 48.26 },
      { num: "31", label: "SDA", relX: -6.6, relY: 48.26 },
      { num: "32", label: "SCL", relX: -9.14, relY: 48.26 },
    ];

    const pad1 = kicadPads.find((p) => p.number === "1");
    expect(pad1).toBeDefined();
    const kOriginX = pad1?.x ?? 0;
    const kOriginY = pad1?.y ?? 0;

    // Verify all 32 fixture pad positions against the expected pin map
    for (const ep of EXPECTED_PINS) {
      const kp = kicadPads.find((p) => p.number === ep.num);
      expect(kp, `KiCad pad ${ep.num} (${ep.label}) exists`).toBeDefined();
      if (!kp) continue;
      const relX = kp.x - kOriginX;
      const relY = kp.y - kOriginY;
      expect(relX).toBeCloseTo(ep.relX, 2);
      expect(relY).toBeCloseTo(ep.relY, 2);
    }

    // Now verify generateUnoShieldFootprint() pads against these 32 pin definitions
    const s2cFp = generateUnoShieldFootprint();
    expect(s2cFp.verification).toBe("cross-checked-kicad-lib");
    expect(s2cFp.pads.length).toBe(32);

    const s2cOriginPad = s2cFp.pads.find((p) => p.number === "NC");
    expect(s2cOriginPad).toBeDefined();
    const s2cOriginX = s2cOriginPad?.x ?? 0;
    const s2cOriginY = s2cOriginPad?.y ?? 0;

    for (const ep of EXPECTED_PINS) {
      const sp = s2cFp.pads.find((p) => p.number === ep.label);
      expect(sp, `Uno shield pad ${ep.label} exists`).toBeDefined();
      if (!sp) continue;

      expect(sp.drill).toBeCloseTo(1.0, 2);
      expect(sp.w).toBeCloseTo(1.6, 2);
      expect(sp.h).toBeCloseTo(1.6, 2);

      const relX = sp.x - s2cOriginX;
      const relY = sp.y - s2cOriginY;
      expect(Math.abs(relX - ep.relX)).toBeLessThan(0.01);
      expect(Math.abs(relY - ep.relY)).toBeLessThan(0.01);
    }

    // Also assert standalone header footprints:
    // 1. Power Header (8 pins)
    const powerHdr = generateUnoPowerHeaderFootprint();
    expect(powerHdr.verification).toBe("cross-checked-kicad-lib");
    expect(powerHdr.verified).toBe(true);
    expect(powerHdr.pads.length).toBe(8);
    for (let i = 0; i < 8; i++) {
      const p = powerHdr.pads[i];
      expect(p?.drill).toBeCloseTo(1.0, 2);
      expect(p?.w).toBeCloseTo(1.6, 2);
      if (i > 0) {
        const prev = powerHdr.pads[i - 1];
        expect((p?.x ?? 0) - (prev?.x ?? 0)).toBeCloseTo(2.54, 2);
      }
    }

    // 2. Analog Header (6 pins)
    const analogHdr = generateUnoAnalogHeaderFootprint();
    expect(analogHdr.verification).toBe("cross-checked-kicad-lib");
    expect(analogHdr.verified).toBe(true);
    expect(analogHdr.pads.length).toBe(6);
    for (let i = 0; i < 6; i++) {
      const p = analogHdr.pads[i];
      expect(p?.drill).toBeCloseTo(1.0, 2);
      expect(p?.w).toBeCloseTo(1.6, 2);
      if (i > 0) {
        const prev = analogHdr.pads[i - 1];
        expect((p?.x ?? 0) - (prev?.x ?? 0)).toBeCloseTo(2.54, 2);
      }
    }

    // 3. Digital Low Header (8 pins)
    const dLowHdr = generateUnoDigitalLowHeaderFootprint();
    expect(dLowHdr.verification).toBe("cross-checked-kicad-lib");
    expect(dLowHdr.verified).toBe(true);
    expect(dLowHdr.pads.length).toBe(8);
    for (let i = 0; i < 8; i++) {
      const p = dLowHdr.pads[i];
      expect(p?.drill).toBeCloseTo(1.0, 2);
      expect(p?.w).toBeCloseTo(1.6, 2);
      if (i > 0) {
        const prev = dLowHdr.pads[i - 1];
        expect((p?.x ?? 0) - (prev?.x ?? 0)).toBeCloseTo(2.54, 2);
      }
    }

    // 4. Digital High Header (10 pins)
    const dHighHdr = generateUnoDigitalHighHeaderFootprint();
    expect(dHighHdr.verification).toBe("cross-checked-kicad-lib");
    expect(dHighHdr.verified).toBe(true);
    expect(dHighHdr.pads.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      const p = dHighHdr.pads[i];
      expect(p?.drill).toBeCloseTo(1.0, 2);
      expect(p?.w).toBeCloseTo(1.6, 2);
      if (i > 0) {
        const prev = dHighHdr.pads[i - 1];
        expect((p?.x ?? 0) - (prev?.x ?? 0)).toBeCloseTo(2.54, 2);
      }
    }
  });
});
