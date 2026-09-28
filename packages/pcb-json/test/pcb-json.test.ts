/**
 * @license Apache-2.0
 * @s2c/pcb-json — Test suite for PCB Layout data model, Zod validation, and JSON Schema export.
 */

import { describe, expect, expectTypeOf, it } from "vitest";
import {
  DEFAULT_DESIGN_RULES,
  getPcbJsonSchema,
  PCB_JSON_VERSION,
  type PcbLayout,
  parsePcbLayout,
  safeParsePcbLayout,
} from "../src/index.js";

const VALID_SAMPLE_LAYOUT: PcbLayout = {
  schemaVersion: "0.1.0",
  circuitHash: "sha256-abc123mockhash",
  board: {
    outline: [
      { x: 0, y: 0 },
      { x: 68.58, y: 0 },
      { x: 68.58, y: 53.34 },
      { x: 0, y: 53.34 },
    ],
    thicknessMm: 1.6,
    layers: 2,
  },
  rules: DEFAULT_DESIGN_RULES,
  footprints: [
    {
      id: "resistor:axial-0.3in",
      name: "Through-Hole Resistor 0.3in",
      source: "convention (IPC-2221 generic through-hole 0.3in)",
      verification: "convention",
      verified: true,
      pads: [
        {
          number: "1",
          shape: "circle",
          x: -3.81,
          y: 0,
          w: 1.6,
          h: 1.6,
          drill: 0.8,
          layers: ["top", "bottom"],
        },
        {
          number: "2",
          shape: "circle",
          x: 3.81,
          y: 0,
          w: 1.6,
          h: 1.6,
          drill: 0.8,
          layers: ["top", "bottom"],
        },
      ],
      courtyard: [
        { x: -5.0, y: -2.0 },
        { x: 5.0, y: -2.0 },
        { x: 5.0, y: 2.0 },
        { x: -5.0, y: 2.0 },
      ],
      silk: [
        {
          kind: "rect",
          x: -2.5,
          y: -1.0,
          w: 5.0,
          h: 2.0,
          strokeWidth: 0.15,
          layer: "top",
        },
      ],
      body3d: {
        kind: "cylinder",
        r: 1.15,
        h: 6.0,
      },
    },
  ],
  placements: [
    {
      componentId: "R1",
      footprintId: "resistor:axial-0.3in",
      x: 20.0,
      y: 25.0,
      rotation: 0,
      side: "top",
    },
  ],
  traces: [
    {
      netId: "NET_LED_ANODE",
      layer: "top",
      width: 0.254,
      points: [
        { x: 23.81, y: 25.0 },
        { x: 30.0, y: 25.0 },
      ],
    },
  ],
  vias: [
    {
      netId: "GND",
      x: 15.0,
      y: 20.0,
      drill: 0.6,
      diameter: 1.0,
    },
  ],
  silkscreen: [
    {
      kind: "text",
      text: "R1",
      x: 20.0,
      y: 27.5,
      fontSize: 1.2,
      layer: "top",
    },
  ],
  unplaced: [],
  unrouted: [],
  drc: [],
};

describe("@s2c/pcb-json data model and validation", () => {
  it("exports package version constant", () => {
    expect(PCB_JSON_VERSION).toBe("0.1.0");
  });

  it("validates round-trip parse of a complete valid PcbLayout", () => {
    const parsed = parsePcbLayout(VALID_SAMPLE_LAYOUT);
    expect(parsed.schemaVersion).toBe("0.1.0");
    expect(parsed.circuitHash).toBe("sha256-abc123mockhash");
    expect(parsed.board.layers).toBe(2);
    expect(parsed.footprints).toHaveLength(1);
    expect(parsed.placements).toHaveLength(1);
    expect(parsed.traces).toHaveLength(1);
    expect(parsed.vias).toHaveLength(1);
  });

  it("exports Draft-07 JSON Schema with title and description", () => {
    const jsonSchema = getPcbJsonSchema();
    expect(jsonSchema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(jsonSchema.title).toBe("PcbLayout");
    expect(typeof jsonSchema).toBe("object");
  });

  it("rejects invalid schema version", () => {
    const invalid = { ...VALID_SAMPLE_LAYOUT, schemaVersion: "0.2.0" };
    const result = safeParsePcbLayout(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects negative drill sizes or negative pad widths", () => {
    const invalid = JSON.parse(JSON.stringify(VALID_SAMPLE_LAYOUT)) as PcbLayout;
    const fp0 = invalid.footprints[0];
    if (fp0?.pads[0]) {
      fp0.pads[0].w = -1.0;
    }
    const result = safeParsePcbLayout(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid verification level outside the 3-level taxonomy", () => {
    const invalid = JSON.parse(JSON.stringify(VALID_SAMPLE_LAYOUT)) as {
      footprints: Array<{ verification: string }>;
    };
    if (invalid.footprints[0]) {
      invalid.footprints[0].verification = "maybe-verified";
    }
    const result = safeParsePcbLayout(invalid);
    expect(result.success).toBe(false);
  });

  it("supports all 4 verification levels: datasheet-checked, cross-checked-kicad-lib, convention, unverified", () => {
    const levels = [
      "datasheet-checked",
      "cross-checked-kicad-lib",
      "convention",
      "unverified",
    ] as const;
    for (const level of levels) {
      const copy = JSON.parse(JSON.stringify(VALID_SAMPLE_LAYOUT)) as PcbLayout;
      const fp0 = copy.footprints[0];
      if (fp0) {
        fp0.verification = level;
      }
      const res = safeParsePcbLayout(copy);
      expect(res.success).toBe(true);
    }
  });

  it("verifies strict TypeScript types", () => {
    expectTypeOf(VALID_SAMPLE_LAYOUT).toEqualTypeOf<PcbLayout>();
  });
});
