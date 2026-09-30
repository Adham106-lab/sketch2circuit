/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Milestone 13: Pure 3D Scene-Description Generator.
 * Deterministic, unit-testable 3D scene model without requiring WebGL/browser DOM.
 * Generates:
 * - Extruded FR4 PCB board slab with mounting holes and edge chamfers
 * - Top and bottom copper traces, pads, and through-hole vias
 * - Component 3D bodies generated from footprint body3d specs (LEDs, headers, resistors, cans, etc.)
 */

import type { Circuit } from "@s2c/circuit-json";
import type { Body3D, FootprintDef, PcbLayout, Placement, Point } from "@s2c/pcb-json";
import { getBoundingBox } from "./geometry.js";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Material3D {
  color: string;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  transparent?: boolean;
  emissive?: string;
  wireframe?: boolean;
}

export type Geometry3D =
  | {
      kind: "box";
      width: number; // X size in mm
      depth: number; // Y size in mm
      height: number; // Z size in mm
    }
  | {
      kind: "cylinder";
      radiusTop: number;
      radiusBottom: number;
      height: number;
      radialSegments?: number;
    }
  | {
      kind: "extruded-polygon";
      polygon: Point[];
      depth: number; // Extrusion depth (Z) in mm
      holes?: Array<{ x: number; y: number; radius: number }>;
    }
  | {
      kind: "tube";
      path: Point[];
      radius: number;
      layer: "top" | "bottom";
    }
  | {
      kind: "sphere";
      radius: number;
    };

export interface Scene3DNode {
  id: string;
  name: string;
  kind: "board" | "trace" | "via" | "pad" | "component" | "pin" | "group";
  geometry?: Geometry3D;
  material: Material3D;
  position: Vec3;
  rotation: Vec3; // Euler angles in radians (rx, ry, rz)
  scale?: Vec3;
  children?: Scene3DNode[];
  metadata?: Record<string, string | number | boolean>;
}

export interface PcbScene3D {
  metadata: {
    title: string;
    boardWidthMm: number;
    boardHeightMm: number;
    thicknessMm: number;
    componentCount: number;
    padCount: number;
    traceCount: number;
    viaCount: number;
    totalNodeCount: number;
  };
  board: Scene3DNode;
  traces: Scene3DNode[];
  vias: Scene3DNode[];
  pads: Scene3DNode[];
  components: Scene3DNode[];
}

export interface Scene3DOptions {
  boardThicknessMm?: number; // Default 1.6 mm
  copperThicknessMm?: number; // Default 0.035 mm (1 oz Cu)
  solderMaskColor?: string; // Default #0a3d1c (Classic Green)
  silkscreenColor?: string; // Default #facc15 (Yellow)
  copperColor?: string; // Default #b87333 (Copper) / #ef4444
  padColor?: string; // Default #d97706 (Gold ENIG) / #e2e8f0 (HASL)
  includeTraces?: boolean; // Default true
  includeVias?: boolean; // Default true
  includePads?: boolean; // Default true
  includeComponents?: boolean; // Default true
}

/**
 * Standard colors for high-fidelity 3D PCB rendering
 */
export const PCB_3D_PALETTE = {
  solderMaskGreen: "#124e28",
  fr4Core: "#a3a279",
  copperTop: "#d97706", // Polished copper
  copperBottom: "#2563eb", // Blue tinted for bottom distinction in preview
  padEnigGold: "#eab308",
  viaAnnular: "#f59e0b",
  drillCavity: "#111827",
  silkscreenWhite: "#f8fafc",
  silkscreenYellow: "#facc15",
  componentPlasticBlack: "#1e293b",
  componentMetalCan: "#94a3b8",
  leadSilver: "#cbd5e1",
  resistorTan: "#d4a373",
  ledRed: "#ef4444",
  ledGreen: "#22c55e",
  ledBlue: "#3b82f6",
  ledYellow: "#eab308",
};

/**
 * Generates component 3D subnodes from a FootprintDef body3d specification.
 */
function buildComponentBodyNodes(
  componentId: string,
  fp: FootprintDef,
  placement: Placement,
  boardThickness: number,
): Scene3DNode[] {
  const nodes: Scene3DNode[] = [];
  const b3d = fp.body3d;
  const rotZRad = (placement.rotation * Math.PI) / 180;
  const baseZ = 0; // Surface of PCB top side

  const compIdLower = componentId.toLowerCase();

  if (b3d.kind === "led5mm") {
    // 5mm Through-Hole LED:
    // Cylindrical rim base (5.8mm dia, 1mm height)
    // Main cylinder body (5mm dia, 5mm height)
    // Hemispherical dome top (radius 2.5mm)
    const ledColor = b3d.color ?? (compIdLower.includes("d2") ? PCB_3D_PALETTE.ledRed : PCB_3D_PALETTE.ledGreen);

    // Rim Base
    nodes.push({
      id: `${componentId}-rim`,
      name: `${componentId} LED 5mm Rim Base`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 2.9,
        radiusBottom: 2.9,
        height: 1.0,
        radialSegments: 24,
      },
      material: {
        color: ledColor,
        roughness: 0.2,
        metalness: 0.1,
        opacity: 0.9,
        transparent: true,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + 0.5 },
      rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
    });

    // Main Dome Body
    nodes.push({
      id: `${componentId}-dome`,
      name: `${componentId} LED 5mm Dome`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 2.5,
        radiusBottom: 2.5,
        height: 6.5,
        radialSegments: 24,
      },
      material: {
        color: ledColor,
        roughness: 0.15,
        metalness: 0.1,
        opacity: 0.88,
        transparent: true,
        emissive: ledColor,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + 4.25 },
      rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
    });

    // Anode / Cathode Wire Leads
    for (const pad of fp.pads) {
      nodes.push({
        id: `${componentId}-lead-${pad.number}`,
        name: `${componentId} Lead ${pad.number}`,
        kind: "pin",
        geometry: {
          kind: "cylinder",
          radiusTop: 0.3,
          radiusBottom: 0.3,
          height: boardThickness + 2.0,
          radialSegments: 12,
        },
        material: {
          color: PCB_3D_PALETTE.leadSilver,
          metalness: 0.9,
          roughness: 0.2,
        },
        position: {
          x: placement.x + pad.x * Math.cos(rotZRad) - pad.y * Math.sin(rotZRad),
          y: placement.y + pad.x * Math.sin(rotZRad) + pad.y * Math.cos(rotZRad),
          z: baseZ - boardThickness / 2,
        },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      });
    }
  } else if (b3d.kind === "header") {
    // Pin Header: Plastic shroud block + square brass/gold pins
    const pinCount = b3d.pins;
    const pitch = b3d.pitch ?? 2.54;
    const totalLen = pinCount * pitch;
    const plasticWidth = 2.54;
    const plasticHeight = 2.54;

    // Plastic Base Shroud
    nodes.push({
      id: `${componentId}-shroud`,
      name: `${componentId} Header Insulator`,
      kind: "component",
      geometry: {
        kind: "box",
        width: plasticWidth,
        depth: totalLen,
        height: plasticHeight,
      },
      material: {
        color: b3d.color ?? PCB_3D_PALETTE.componentPlasticBlack,
        roughness: 0.6,
        metalness: 0.1,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + plasticHeight / 2 },
      rotation: { x: 0, y: 0, z: rotZRad },
    });

    // Square Pin Posts
    for (let i = 0; i < pinCount; i++) {
      const pinYOffset = (i - (pinCount - 1) / 2) * pitch;
      const px = placement.x - pinYOffset * Math.sin(rotZRad);
      const py = placement.y + pinYOffset * Math.cos(rotZRad);

      nodes.push({
        id: `${componentId}-pin-${i + 1}`,
        name: `${componentId} Pin ${i + 1}`,
        kind: "pin",
        geometry: {
          kind: "box",
          width: 0.64,
          depth: 0.64,
          height: 11.5, // 6mm above, 2.5mm shroud, 3mm tail
        },
        material: {
          color: PCB_3D_PALETTE.padEnigGold,
          metalness: 0.85,
          roughness: 0.25,
        },
        position: { x: px, y: py, z: baseZ + 3.0 },
        rotation: { x: 0, y: 0, z: rotZRad },
      });
    }
  } else if (b3d.kind === "cylinder") {
    // Axial Resistor, Electrolytic Can Capacitor, or Piezo Buzzer
    const isElectrolytic = compIdLower.includes("c_") || compIdLower.includes("cap");
    const isBuzzer = compIdLower.includes("spk") || compIdLower.includes("buzz");

    if (isElectrolytic) {
      // Aluminum Can Capacitor
      nodes.push({
        id: `${componentId}-can`,
        name: `${componentId} Electrolytic Can`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: b3d.r,
          radiusBottom: b3d.r,
          height: b3d.h,
          radialSegments: 24,
        },
        material: {
          color: "#1e3a8a", // Navy blue sleeve
          metalness: 0.4,
          roughness: 0.3,
        },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.h / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      });
    } else if (isBuzzer) {
      // Piezo Buzzer Cylinder
      nodes.push({
        id: `${componentId}-piezo`,
        name: `${componentId} Buzzer Casing`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: b3d.r,
          radiusBottom: b3d.r,
          height: b3d.h,
          radialSegments: 28,
        },
        material: {
          color: "#0f172a",
          roughness: 0.5,
          metalness: 0.2,
        },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.h / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      });
    } else {
      // Horizontal Axial Resistor
      nodes.push({
        id: `${componentId}-resistor-body`,
        name: `${componentId} Resistor Body`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: b3d.r,
          radiusBottom: b3d.r,
          height: b3d.h,
          radialSegments: 20,
        },
        material: {
          color: b3d.color ?? PCB_3D_PALETTE.resistorTan,
          roughness: 0.4,
          metalness: 0.1,
        },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.r + 0.5 },
        rotation: { x: 0, y: 0, z: rotZRad + Math.PI / 2 },
      });
    }
  } else if (b3d.kind === "box") {
    // Tactile Switch (Pushbutton), Potentiometer, or DIP IC
    nodes.push({
      id: `${componentId}-body`,
      name: `${componentId} Housing`,
      kind: "component",
      geometry: {
        kind: "box",
        width: b3d.w,
        depth: b3d.d,
        height: b3d.h,
      },
      material: {
        color: b3d.color ?? PCB_3D_PALETTE.componentPlasticBlack,
        roughness: 0.5,
        metalness: 0.2,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + b3d.h / 2 },
      rotation: { x: 0, y: 0, z: rotZRad },
    });

    // Actuator button on tactile switches
    if (compIdLower.startsWith("sw")) {
      nodes.push({
        id: `${componentId}-actuator`,
        name: `${componentId} Button Cap`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: 1.5,
          radiusBottom: 1.5,
          height: 1.8,
          radialSegments: 20,
        },
        material: {
          color: "#334155",
          roughness: 0.3,
          metalness: 0.2,
        },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.h + 0.9 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      });
    }
  } else {
    // Fallback: Component Bounding Box
    nodes.push({
      id: `${componentId}-generic`,
      name: `${componentId} Body`,
      kind: "component",
      geometry: {
        kind: "box",
        width: 6.0,
        depth: 6.0,
        height: 3.5,
      },
      material: {
        color: PCB_3D_PALETTE.componentPlasticBlack,
        roughness: 0.6,
        metalness: 0.1,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + 1.75 },
      rotation: { x: 0, y: 0, z: rotZRad },
    });
  }

  return nodes;
}

/**
 * Builds a pure 3D scene representation from a PcbLayout.
 * Unit-testable without WebGL or browser APIs.
 */
export function buildPcbScene3D(
  layout: PcbLayout,
  _circuit?: Circuit,
  options: Scene3DOptions = {},
): PcbScene3D {
  const boardThickness = options.boardThicknessMm ?? 1.6;
  const copperThickness = options.copperThicknessMm ?? 0.035;
  const maskColor = options.solderMaskColor ?? PCB_3D_PALETTE.solderMaskGreen;
  const topCuColor = options.copperColor ?? PCB_3D_PALETTE.copperTop;
  const bottomCuColor = PCB_3D_PALETTE.copperBottom;
  const padColor = options.padColor ?? PCB_3D_PALETTE.padEnigGold;

  // Board outline and mounting holes
  const outline = layout.board.outline;
  const bb = getBoundingBox(outline);
  const boardWidth = Number((bb.maxX - bb.minX).toFixed(2));
  const boardHeight = Number((bb.maxY - bb.minY).toFixed(2));

  // 1. Board Substrate Slab
  const boardNode: Scene3DNode = {
    id: "pcb-substrate-slab",
    name: "FR4 Board Substrate",
    kind: "board",
    geometry: {
      kind: "extruded-polygon",
      polygon: outline,
      depth: boardThickness,
      holes: [
        // Standard Uno mounting holes
        { x: 13.97, y: 2.54, radius: 1.6 },
        { x: 15.24, y: 50.8, radius: 1.6 },
        { x: 66.04, y: 7.62, radius: 1.6 },
        { x: 66.04, y: 35.56, radius: 1.6 },
      ],
    },
    material: {
      color: maskColor,
      roughness: 0.35,
      metalness: 0.1,
    },
    position: { x: 0, y: 0, z: -boardThickness },
    rotation: { x: 0, y: 0, z: 0 },
    metadata: {
      thicknessMm: boardThickness,
      widthMm: boardWidth,
      heightMm: boardHeight,
    },
  };

  // 2. Copper Traces (Top & Bottom)
  const traceNodes: Scene3DNode[] = [];
  if (options.includeTraces !== false) {
    for (let i = 0; i < layout.traces.length; i++) {
      const trace = layout.traces[i]!;
      const isTop = trace.layer === "top";
      const zPos = isTop ? copperThickness / 2 : -boardThickness - copperThickness / 2;

      traceNodes.push({
        id: trace.id ?? `trace-${i}`,
        name: `Trace ${trace.netId} (${trace.layer})`,
        kind: "trace",
        geometry: {
          kind: "tube",
          path: trace.points,
          radius: trace.width / 2,
          layer: trace.layer,
        },
        material: {
          color: isTop ? topCuColor : bottomCuColor,
          metalness: 0.85,
          roughness: 0.25,
        },
        position: { x: 0, y: 0, z: zPos },
        rotation: { x: 0, y: 0, z: 0 },
        metadata: {
          netId: trace.netId,
          layer: trace.layer,
          widthMm: trace.width,
        },
      });
    }
  }

  // 3. Vias (Annular Rings + Central Drill)
  const viaNodes: Scene3DNode[] = [];
  if (options.includeVias !== false) {
    for (let i = 0; i < layout.vias.length; i++) {
      const via = layout.vias[i]!;

      // Through-hole barrel
      viaNodes.push({
        id: via.id ?? `via-${i}`,
        name: `Via ${via.netId}`,
        kind: "via",
        geometry: {
          kind: "cylinder",
          radiusTop: via.diameter / 2,
          radiusBottom: via.diameter / 2,
          height: boardThickness + copperThickness * 2,
          radialSegments: 16,
        },
        material: {
          color: PCB_3D_PALETTE.viaAnnular,
          metalness: 0.85,
          roughness: 0.3,
        },
        position: { x: via.x, y: via.y, z: -boardThickness / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        metadata: {
          netId: via.netId,
          drillMm: via.drill,
          diameterMm: via.diameter,
        },
      });

      // Central Drill Hole Core (Dark)
      viaNodes.push({
        id: `via-drill-${i}`,
        name: `Via Drill Core ${via.netId}`,
        kind: "via",
        geometry: {
          kind: "cylinder",
          radiusTop: via.drill / 2,
          radiusBottom: via.drill / 2,
          height: boardThickness + copperThickness * 2.2,
          radialSegments: 12,
        },
        material: {
          color: PCB_3D_PALETTE.drillCavity,
          roughness: 0.9,
          metalness: 0.0,
        },
        position: { x: via.x, y: via.y, z: -boardThickness / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      });
    }
  }

  // 4. Placed Pads
  const padNodes: Scene3DNode[] = [];
  const fpMap = new Map<string, FootprintDef>();
  for (const fp of layout.footprints) {
    fpMap.set(fp.id, fp);
  }

  if (options.includePads !== false) {
    for (const pl of layout.placements) {
      const fp = fpMap.get(pl.footprintId);
      if (!fp) continue;
      const rotZRad = (pl.rotation * Math.PI) / 180;

      for (const pad of fp.pads) {
        const px = pl.x + pad.x * Math.cos(rotZRad) - pad.y * Math.sin(rotZRad);
        const py = pl.y + pad.x * Math.sin(rotZRad) + pad.y * Math.cos(rotZRad);

        // Top Pad Ring
        padNodes.push({
          id: `pad-${pl.componentId}-${pad.number}-top`,
          name: `Pad ${pl.componentId}.${pad.number} [Top]`,
          kind: "pad",
          geometry:
            pad.shape === "rect"
              ? { kind: "box", width: pad.w, depth: pad.h, height: copperThickness }
              : {
                  kind: "cylinder",
                  radiusTop: pad.w / 2,
                  radiusBottom: pad.w / 2,
                  height: copperThickness,
                  radialSegments: 16,
                },
          material: {
            color: padColor,
            metalness: 0.9,
            roughness: 0.2,
          },
          position: { x: px, y: py, z: copperThickness / 2 },
          rotation: {
            x: pad.shape === "rect" ? 0 : Math.PI / 2,
            y: 0,
            z: rotZRad,
          },
          metadata: {
            componentId: pl.componentId,
            padNumber: pad.number,
            drillMm: pad.drill ?? 0,
          },
        });

        // Bottom Pad Ring if through-hole
        if (pad.layers.includes("bottom")) {
          padNodes.push({
            id: `pad-${pl.componentId}-${pad.number}-bot`,
            name: `Pad ${pl.componentId}.${pad.number} [Bottom]`,
            kind: "pad",
            geometry:
              pad.shape === "rect"
                ? { kind: "box", width: pad.w, depth: pad.h, height: copperThickness }
                : {
                    kind: "cylinder",
                    radiusTop: pad.w / 2,
                    radiusBottom: pad.w / 2,
                    height: copperThickness,
                    radialSegments: 16,
                  },
            material: {
              color: padColor,
              metalness: 0.9,
              roughness: 0.2,
            },
            position: { x: px, y: py, z: -boardThickness - copperThickness / 2 },
            rotation: {
              x: pad.shape === "rect" ? 0 : Math.PI / 2,
              y: 0,
              z: rotZRad,
            },
          });
        }
      }
    }
  }

  // 5. Component 3D Bodies
  const componentNodes: Scene3DNode[] = [];
  if (options.includeComponents !== false) {
    for (const pl of layout.placements) {
      const fp = fpMap.get(pl.footprintId);
      if (!fp) continue;

      const compSubnodes = buildComponentBodyNodes(pl.componentId, fp, pl, boardThickness);
      componentNodes.push(...compSubnodes);
    }
  }

  const totalNodeCount =
    1 + // Board slab
    traceNodes.length +
    viaNodes.length +
    padNodes.length +
    componentNodes.length;

  return {
    metadata: {
      title: "3D PCB Scene Representation",
      boardWidthMm: boardWidth,
      boardHeightMm: boardHeight,
      thicknessMm: boardThickness,
      componentCount: layout.placements.length,
      padCount: padNodes.length,
      traceCount: traceNodes.length,
      viaCount: layout.vias.length,
      totalNodeCount,
    },
    board: boardNode,
    traces: traceNodes,
    vias: viaNodes,
    pads: padNodes,
    components: componentNodes,
  };
}
