/**
 * @license Apache-2.0
 * @s2c/pcb-layout — M12 2D PCB SVG Renderer Test Suite.
 */

import fs from "node:fs";
import path from "node:path";
import { synthesizeSketch } from "@s2c/arduino";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import { describe, expect, it } from "vitest";
import { placeCircuit, renderPcbSvg, routeCircuit } from "../src/index.js";

describe("M12 2D PCB SVG Renderer", () => {
  const fixturePath = path.resolve(
    __dirname,
    "../../../fixtures/sketches/user_multi_peripheral.ino",
  );
  const userCode = fs.readFileSync(fixturePath, "utf-8");
  const syn = synthesizeSketch(userCode, { boardId: "ARDUINO_UNO_R3" });
  const placementRes = placeCircuit(syn.circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
  const routingRes = routeCircuit(placementRes.layout, syn.circuit, {
    gridPitchMm: 0.635,
  });

  it("renders 2D PCB SVG for user_multi_peripheral with all required visual layers", () => {
    const res = renderPcbSvg(routingRes.layout, syn.circuit, {
      showGrid: true,
      showOriginCrosshair: true,
      showTopCopper: true,
      showBottomCopper: true,
      showPads: true,
      showVias: true,
      showSilkscreen: true,
      showRatsnest: true,
      showDrcMarkers: true,
    });

    expect(res.svg).toBeDefined();
    expect(res.width).toBeGreaterThan(50);
    expect(res.height).toBeGreaterThan(40);
    expect(res.viewBox).toBeDefined();

    // 1. Black canvas background
    expect(res.svg).toContain('fill="#050505"');

    // 2. Green grid pattern
    expect(res.svg).toContain('id="pcb-grid"');
    expect(res.svg).toContain('fill="#166534"');

    // 3. Origin crosshair at (0, 0)
    expect(res.svg).toContain('id="origin-crosshair"');
    expect(res.svg).toContain("(0,0)");
    expect(res.svg).toContain('stroke="#22c55e"');

    // 4. Top copper (red #ef4444)
    expect(res.svg).toContain('id="layer-copper-top"');
    expect(res.svg).toContain('stroke="#ef4444"');

    // 5. Bottom copper (blue #3b82f6)
    expect(res.svg).toContain('id="layer-copper-bottom"');
    expect(res.svg).toContain('stroke="#3b82f6"');

    // 6. Pads (magenta #d946ef)
    expect(res.svg).toContain('id="layer-pads"');
    expect(res.svg).toContain('fill="#d946ef"');

    // 7. Vias (amber #f59e0b)
    expect(res.svg).toContain('id="layer-vias"');
    expect(res.svg).toContain('fill="#f59e0b"');

    // 8. Silkscreen (yellow #facc15) with refdes text
    expect(res.svg).toContain('id="layer-silkscreen"');
    expect(res.svg).toContain('fill="#facc15"');
    expect(res.svg).toContain(">U1<");
    expect(res.svg).toContain(">R1<");
    expect(res.svg).toContain(">SW1<");
    expect(res.svg).toContain(">C_SERVO1<");

    // 9. Ratsnest (dashed lines for unrouted connections)
    expect(res.svg).toContain('id="layer-ratsnest"');
    expect(res.svg).toContain('class="pcb-ratsnest"');
    expect(res.svg).toContain('stroke-dasharray="1.5,1.0"');

    // 10. DRC violation markers (red diamonds)
    expect(res.svg).toContain('id="layer-drc-violations"');
    expect(res.svg).toContain('fill="#dc2626"');
    expect(res.svg).toContain('class="pcb-drc-marker"');

    // 11. Stats check
    expect(res.stats.unroutedConnections).toBe(13);
    expect(res.stats.routedConnections).toBe(16);
    expect(res.stats.totalConnections).toBe(29);
    expect(res.stats.completionRatePercent).toBe(55.2);
    expect(res.stats.drcErrorCount).toBe(15);
  });

  it("is 100% deterministic (multiple calls produce identical SVG string)", () => {
    const res1 = renderPcbSvg(routingRes.layout, syn.circuit);
    const res2 = renderPcbSvg(routingRes.layout, syn.circuit);
    expect(res1.svg).toBe(res2.svg);
  });

  it("honors layer visibility options", () => {
    const noCopper = renderPcbSvg(routingRes.layout, syn.circuit, {
      showTopCopper: false,
      showBottomCopper: false,
      showRatsnest: false,
    });
    expect(noCopper.svg).not.toContain('id="layer-copper-top"');
    expect(noCopper.svg).not.toContain('id="layer-copper-bottom"');
    expect(noCopper.svg).not.toContain('id="layer-ratsnest"');
  });

  it("applies net highlight filtering when highlightNet is passed", () => {
    const highlighted = renderPcbSvg(routingRes.layout, syn.circuit, {
      highlightNet: "5V",
    });
    expect(highlighted.svg).toContain('opacity="1" filter="url(#net-glow)" data-net="5V"');
  });
});
