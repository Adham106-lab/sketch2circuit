/**
 * @license Apache-2.0
 * Unit test for @s2c/export-gerber zip generator and M20c archive creation.
 */

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { placeCircuit, routeCircuit } from "@s2c/pcb-layout";
import { describe, expect, it } from "vitest";
import { exportGerber } from "../src/export.js";
import { createGerberZip, createZipFromFiles } from "../src/zip.js";

const BLINK_SKETCH = `
void setup() {
  pinMode(13, OUTPUT);
}
void loop() {
  digitalWrite(13, HIGH);
  delay(1000);
  digitalWrite(13, LOW);
  delay(1000);
}
`;

describe("Gerber ZIP Archive Export (M20c)", () => {
  it("packs GerberFileSet into valid PKZip archive with all 8 files", () => {
    const synth = synthesizeSketch(BLINK_SKETCH, { boardId: "ARDUINO_UNO_R3" });
    const placed = placeCircuit(synth.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const routed = routeCircuit(placed.layout, synth.circuit, { gridPitchMm: 0.635 });
    const fileSet = exportGerber(routed.layout, { boardName: "blink" });

    const zipBytes = createGerberZip(fileSet);

    // 1. Verify PKZip magic header: 0x50 0x4B 0x03 0x04 ('PK\x03\x04')
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);
    expect(zipBytes.byteLength).toBeGreaterThan(1000);

    // 2. Write to temp file and extract with python3 zipfile to verify standard conformity
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "s2c-zip-test-"));
    const zipPath = path.join(tmpDir, "blink_gerbers.zip");
    fs.writeFileSync(zipPath, Buffer.from(zipBytes));

    const pyScript = `
import zipfile, sys

with zipfile.ZipFile(r"${zipPath}", "r") as z:
    names = z.namelist()
    expected = [
        "blink.drl",
        "blink.gbl",
        "blink.gbo",
        "blink.gbs",
        "blink.gko",
        "blink.gtl",
        "blink.gto",
        "blink.gts"
    ]
    for exp in expected:
        if exp not in names:
            print(f"Missing file: {exp}", file=sys.stderr)
            sys.exit(1)
        data = z.read(exp).decode("utf-8")
        if len(data) == 0:
            print(f"Empty file: {exp}", file=sys.stderr)
            sys.exit(1)
    print("ALL_8_FILES_EXTRACTED_SUCCESSFULLY")
`;

    const out = execSync(`python3 -c '${pyScript}'`).toString();
    expect(out).toContain("ALL_8_FILES_EXTRACTED_SUCCESSFULLY");

    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("produces deterministic byte-identical zip archives for identical inputs", () => {
    const files = {
      "test_a.txt": "Hello world A",
      "test_b.txt": "Hello world B",
    };
    const zip1 = createZipFromFiles(files);
    const zip2 = createZipFromFiles(files);

    expect(zip1.length).toBe(zip2.length);
    expect(Buffer.from(zip1).equals(Buffer.from(zip2))).toBe(true);
  });

  it("analyzes blink.gto top silkscreen contents and verifies @hpcreery/tracespace-parser", async () => {
    const { createParser } = await import("@hpcreery/tracespace-parser");
    const synth = synthesizeSketch(BLINK_SKETCH, { boardId: "ARDUINO_UNO_R3" });
    const placed = placeCircuit(synth.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
    const routed = routeCircuit(placed.layout, synth.circuit, { gridPitchMm: 0.635 });
    const fileSet = exportGerber(routed.layout, { boardName: "blink" });

    const gto = fileSet.topSilkscreen;
    const gbo = fileSet.bottomSilkscreen;

    console.log("\n=== BLINK.GTO FILE SIZE & STRUCTURE ANALYSIS ===");
    console.log(`Top silkscreen (blink.gto) byte length: ${gto.length} bytes`);
    console.log(`Bottom silkscreen (blink.gbo) byte length: ${gbo.length} bytes`);
    console.log(`Placements count: ${routed.layout.placements.length}`);
    console.log(`Placements:`, routed.layout.placements.map((p) => p.componentId));
    console.log(`Board silkscreen items count: ${routed.layout.silkscreen.length}`);

    // Print first 60 lines of blink.gto
    const lines = gto.split("\n");
    console.log(`Total lines in blink.gto: ${lines.length}`);
    console.log("\n=== FIRST 60 LINES OF BLINK.GTO ===");
    console.log(lines.slice(0, 60).join("\n"));

    // Parse blink.gto specifically with @hpcreery/tracespace-parser
    const parser = createParser();
    parser.feed(gto);
    const result = parser.result();

    console.log("\n=== TRACESPACE PARSER AST FOR BLINK.GTO ===");
    console.log(`AST root type: ${result.type}`);
    console.log(`AST children count: ${result.children.length}`);

    // Print breakdown of lines in blink.gto
    let d01Count = 0;
    let d02Count = 0;
    for (const l of lines) {
      if (l.endsWith("D01*")) d01Count++;
      if (l.endsWith("D02*")) d02Count++;
    }
    console.log(`D01 (draw) commands: ${d01Count}`);
    console.log(`D02 (move) commands: ${d02Count}`);

    // Detail what was drawn
    for (const pl of routed.layout.placements) {
      console.log(`Placement ${pl.componentId}: fp=${pl.footprintId}`);
    }
    for (const s of routed.layout.silkscreen) {
      console.log(`Board silk: kind=${s.kind}, text=${(s as any).text}`);
    }

    expect(result.type).toBe("root");
    expect(result.children.length).toBeGreaterThan(50);
  });
});
