/**
 * @license Apache-2.0
 * M20c Verification Test Suite:
 * - "Export Gerbers" action in PCB view
 * - DRC panel rule provenance & one-line summary claim
 * - Raw DOM evidence extraction (INC-001 compliant)
 */

import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { placeCircuit, routeCircuit } from "@s2c/pcb-layout";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PcbViewer } from "../../../src/components/PcbViewer.js";

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

describe("M20c: PCB View Gerber Export Action & DRC Provenance Panel", () => {
  const synth = synthesizeSketch(BLINK_SKETCH, { boardId: "ARDUINO_UNO_R3" });
  const placed = placeCircuit(synth.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
  const routed = routeCircuit(placed.layout, synth.circuit, { gridPitchMm: 0.635 });

  it("renders the 'EXPORT GERBERS' button in the PCB view top toolbar", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PcbViewer, {
        circuit: synth.circuit,
        layout: routed.layout,
        sketchName: "blink",
        defaultShowDrcDrawer: false,
      }),
    );

    // 1. Check for Export Gerbers button in toolbar
    expect(html).toContain('data-testid="export-gerber-btn"');
    expect(html).toContain("EXPORT GERBERS");
    expect(html).toContain('id="export-gerber-btn"');

    // Extract raw DOM snippet of the export button
    const btnMatch = html.match(/<button[^>]*data-testid="export-gerber-btn"[^>]*>[\s\S]*?<\/button>/);
    console.log("\n=== RAW DOM EVIDENCE: EXPORT GERBERS BUTTON (INC-001) ===");
    console.log(btnMatch ? btnMatch[0] : "BUTTON NOT FOUND");
    expect(btnMatch).toBeTruthy();
  });

  it("renders the DRC audit drawer with one-line summary and per-rule provenance labels", () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(PcbViewer, {
        circuit: synth.circuit,
        layout: routed.layout,
        sketchName: "blink",
        defaultShowDrcDrawer: true,
      }),
    );

    // 1. Drawer modal presence
    expect(html).toContain('data-testid="drc-panel-modal"');

    // 2. One-line summary claim in DRC panel
    expect(html).toContain(
      "5/5 design rules verified against JLCPCB’s published 2-layer capabilities (fetched 2026-10-11)",
    );
    expect(html).toContain('data-testid="drc-summary-claim"');

    // 3. Per-rule provenance badges and fab details for all 5 rules
    expect(html).toContain('data-testid="drc-rule-card-minTraceWidthMm"');
    expect(html).toContain('data-testid="drc-rule-card-minClearanceMm"');
    expect(html).toContain('data-testid="drc-rule-card-minDrillDiameterMm"');
    expect(html).toContain('data-testid="drc-rule-card-minAnnularRingMm"');
    expect(html).toContain('data-testid="drc-rule-card-boardEdgeClearanceMm"');

    // 4. Provenance badges using verified styling
    expect(html).toContain("✓ matches-published-jlcpcb-standard");

    // 5. Drawer action button for exporting Gerbers
    expect(html).toContain('data-testid="drc-drawer-export-gerber-btn"');
    expect(html).toContain("EXPORT 8-FILE GERBERS (.ZIP)");

    // Extract raw DOM snippet of the DRC audit panel
    const drcModalMatch = html.match(/<div[^>]*data-testid="drc-panel-modal"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/);
    console.log("\n=== RAW DOM EVIDENCE: DRC PROVENANCE PANEL (INC-001) ===");
    console.log(drcModalMatch ? drcModalMatch[0] : "DRC MODAL NOT FOUND");
    expect(drcModalMatch).toBeTruthy();
  });
});
