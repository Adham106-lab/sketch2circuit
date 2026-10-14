/**
 * @license Apache-2.0
 * @s2c/pcb-json — Zod schemas and validation for PCB Layout specification v0.1.0.
 */

import { z } from "zod";
import type {
  Body3D,
  DesignRules,
  DrcRuleCitation,
  DrcRuleVerification,
  DrcViolation,
  FootprintDef,
  FootprintPad,
  FootprintVerification,
  PadShape,
  PcbBoard,
  PcbLayer,
  PcbLayout,
  Placement,
  Point,
  SilkItem,
  Trace,
  UnroutedConnection,
  Via,
} from "./types.js";

export const PointSchema: z.ZodType<Point> = z.object({
  x: z.number(),
  y: z.number(),
});

export const FootprintVerificationSchema: z.ZodType<FootprintVerification> = z.enum([
  "datasheet-checked",
  "cross-checked-kicad-lib",
  "convention",
  "unverified",
]);

export const PadShapeSchema: z.ZodType<PadShape> = z.enum(["circle", "rect", "oval"]);

export const PcbLayerSchema: z.ZodType<PcbLayer> = z.enum(["top", "bottom"]);

export const FootprintPadSchema: z.ZodType<FootprintPad> = z.object({
  number: z.string(),
  shape: PadShapeSchema,
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  h: z.number().positive(),
  drill: z.number().positive().optional(),
  layers: z.array(PcbLayerSchema).min(1),
});

export const SilkItemSchema: z.ZodType<SilkItem> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("line"),
    x1: z.number(),
    y1: z.number(),
    x2: z.number(),
    y2: z.number(),
    strokeWidth: z.number().positive().optional(),
    layer: PcbLayerSchema.optional(),
  }),
  z.object({
    kind: z.literal("rect"),
    x: z.number(),
    y: z.number(),
    w: z.number().positive(),
    h: z.number().positive(),
    strokeWidth: z.number().positive().optional(),
    layer: PcbLayerSchema.optional(),
  }),
  z.object({
    kind: z.literal("circle"),
    cx: z.number(),
    cy: z.number(),
    r: z.number().positive(),
    strokeWidth: z.number().positive().optional(),
    layer: PcbLayerSchema.optional(),
  }),
  z.object({
    kind: z.literal("arc"),
    cx: z.number(),
    cy: z.number(),
    r: z.number().positive(),
    startAngle: z.number(),
    endAngle: z.number(),
    strokeWidth: z.number().positive().optional(),
    layer: PcbLayerSchema.optional(),
  }),
  z.object({
    kind: z.literal("text"),
    text: z.string(),
    x: z.number(),
    y: z.number(),
    fontSize: z.number().positive(),
    rotation: z.number().optional(),
    layer: PcbLayerSchema.optional(),
  }),
]);

export const Body3DSchema: z.ZodType<Body3D> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("box"),
      w: z.number().positive(),
      d: z.number().positive(),
      h: z.number().positive(),
      z: z.number().optional(),
      color: z.string().optional(),
    }),
    z.object({
      kind: z.literal("cylinder"),
      r: z.number().positive(),
      h: z.number().positive(),
      z: z.number().optional(),
      color: z.string().optional(),
    }),
    z.object({
      kind: z.literal("led5mm"),
      color: z.string().optional(),
    }),
    z.object({
      kind: z.literal("header"),
      pins: z.number().int().positive(),
      pitch: z.number().positive(),
      color: z.string().optional(),
    }),
    z.object({
      kind: z.literal("composite"),
      parts: z.array(Body3DSchema),
    }),
  ]),
);

export const FootprintDefSchema: z.ZodType<FootprintDef> = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  source: z.string().min(1),
  verification: FootprintVerificationSchema,
  verified: z.boolean(),
  pads: z.array(FootprintPadSchema).min(1),
  courtyard: z.array(PointSchema),
  silk: z.array(SilkItemSchema),
  body3d: Body3DSchema,
});

export const PlacementSchema: z.ZodType<Placement> = z.object({
  componentId: z.string().min(1),
  footprintId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  rotation: z.number(),
  side: PcbLayerSchema,
});

export const TraceSchema: z.ZodType<Trace> = z.object({
  id: z.string().optional(),
  netId: z.string().min(1),
  layer: PcbLayerSchema,
  width: z.number().positive(),
  points: z.array(PointSchema).min(2),
});

export const ViaSchema: z.ZodType<Via> = z.object({
  id: z.string().optional(),
  netId: z.string().min(1),
  x: z.number(),
  y: z.number(),
  drill: z.number().positive(),
  diameter: z.number().positive(),
});

export const DrcRuleVerificationSchema: z.ZodType<DrcRuleVerification> = z.enum([
  "matches-published-jlcpcb-standard",
  "conservative-default",
  "unverified",
]);

export const DrcRuleCitationSchema: z.ZodType<DrcRuleCitation> = z.object({
  verification: DrcRuleVerificationSchema,
  fabValueMm: z.number(),
  ruleValueMm: z.number(),
  relation: z.enum(["more-conservative", "equal"]),
  citation: z.string(),
});

export const DesignRulesSchema = z.object({
  minTraceWidthMm: z.number().positive(),
  minClearanceMm: z.number().positive(),
  minDrillDiameterMm: z.number().positive(),
  minAnnularRingMm: z.number().positive(),
  boardEdgeClearanceMm: z.number().positive(),
  source: z.string().min(1),
  verification: DrcRuleVerificationSchema.optional(),
  ruleCitations: z.record(z.string(), DrcRuleCitationSchema).optional(),
}) satisfies z.ZodType<DesignRules>;

export const DrcViolationSchema: z.ZodType<DrcViolation> = z.object({
  code: z.string().min(1),
  severity: z.enum(["error", "warning"]),
  message: z.string().min(1),
  location: PointSchema.optional(),
  netId: z.string().optional(),
  componentId: z.string().optional(),
});

export const UnroutedConnectionSchema: z.ZodType<UnroutedConnection> = z.object({
  netId: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
});

export const PcbBoardSchema: z.ZodType<PcbBoard> = z.object({
  outline: z.array(PointSchema).min(3),
  thicknessMm: z.number().positive(),
  layers: z.literal(2),
});

export const PcbLayoutSchema: z.ZodType<PcbLayout> = z.object({
  schemaVersion: z.literal("0.1.0"),
  circuitHash: z.string().min(1),
  board: PcbBoardSchema,
  rules: DesignRulesSchema,
  footprints: z.array(FootprintDefSchema),
  placements: z.array(PlacementSchema),
  traces: z.array(TraceSchema),
  vias: z.array(ViaSchema),
  silkscreen: z.array(SilkItemSchema),
  unplaced: z.array(z.string()),
  unrouted: z.array(UnroutedConnectionSchema),
  drc: z.array(DrcViolationSchema),
});

/**
 * Standard conservative PCB design rules for two-layer fabrication, cross-referenced
 * against JLCPCB's published capabilities (https://jlcpcb.com/capabilities/pcb-capabilities, fetched 2026-10-11).
 * All rules equal or exceed published standard capabilities for 1oz copper 2-layer rigid PCBs.
 */
export const DEFAULT_DESIGN_RULES: DesignRules = {
  minTraceWidthMm: 0.254, // 10 mil (JLCPCB standard min: 0.127mm / 5 mil)
  minClearanceMm: 0.254, // 10 mil (JLCPCB standard min: 0.127mm / 5 mil)
  minDrillDiameterMm: 0.6, // 24 mil (JLCPCB standard min: 0.3mm / 12 mil)
  minAnnularRingMm: 0.2, // ~8 mil (JLCPCB absolute min: 0.18mm, recommended: 0.25mm)
  boardEdgeClearanceMm: 0.5, // ~20 mil (JLCPCB recommended: 0.5mm, min routed: 0.2mm, V-cut: 0.3mm)
  source:
    "matches-published-jlcpcb-standard (https://jlcpcb.com/capabilities/pcb-capabilities, 2026-10-11)",
  verification: "matches-published-jlcpcb-standard",
  ruleCitations: {
    minTraceWidthMm: {
      verification: "matches-published-jlcpcb-standard",
      fabValueMm: 0.127,
      ruleValueMm: 0.254,
      relation: "more-conservative",
      citation:
        "JLCPCB standard min trace width for 1oz copper is 0.127mm (5 mil) / 0.15mm (6 mil); 0.254mm is 2x more conservative.",
    },
    minClearanceMm: {
      verification: "matches-published-jlcpcb-standard",
      fabValueMm: 0.127,
      ruleValueMm: 0.254,
      relation: "more-conservative",
      citation:
        "JLCPCB standard min clearance for 1oz copper is 0.127mm (5 mil) / 0.15mm (6 mil); 0.254mm is 2x more conservative.",
    },
    minDrillDiameterMm: {
      verification: "matches-published-jlcpcb-standard",
      fabValueMm: 0.3,
      ruleValueMm: 0.6,
      relation: "more-conservative",
      citation:
        "JLCPCB standard min via drill is 0.3mm; 0.6mm is 2x more conservative for high manufacturing yield.",
    },
    minAnnularRingMm: {
      verification: "matches-published-jlcpcb-standard",
      fabValueMm: 0.18,
      ruleValueMm: 0.2,
      relation: "more-conservative",
      citation:
        "JLCPCB absolute min annular ring for 2-layer 1oz is 0.18mm (recommended 0.25mm); 0.2mm exceeds the 0.18mm absolute limit.",
    },
    boardEdgeClearanceMm: {
      verification: "matches-published-jlcpcb-standard",
      fabValueMm: 0.5,
      ruleValueMm: 0.5,
      relation: "equal",
      citation:
        "JLCPCB requires 0.2mm (tab-routed) / 0.3mm (milled/V-cut) and recommends 0.5mm to avoid cutting damage; 0.5mm matches recommended margin.",
    },
  },
};

/**
 * JLCPCB standard production rules for 2-layer rigid FR4 PCBs (1 oz copper).
 */
export const JLCPCB_STANDARD_2LAYER_RULES: DesignRules = {
  minTraceWidthMm: 0.127,
  minClearanceMm: 0.127,
  minDrillDiameterMm: 0.3,
  minAnnularRingMm: 0.18,
  boardEdgeClearanceMm: 0.3,
  source:
    "matches-published-jlcpcb-standard (https://jlcpcb.com/capabilities/pcb-capabilities, 2026-10-11)",
  verification: "matches-published-jlcpcb-standard",
};

/**
 * Validates and parses raw PCB layout object into typed PcbLayout.
 * Throws ZodError if invalid.
 */
export function parsePcbLayout(data: unknown): PcbLayout {
  return PcbLayoutSchema.parse(data);
}

/**
 * Safely parses raw PCB layout object without throwing.
 */
export function safeParsePcbLayout(
  data: unknown,
): { success: true; data: PcbLayout } | { success: false; error: z.ZodError } {
  return PcbLayoutSchema.safeParse(data);
}
