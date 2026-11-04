/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Milestone 13: Scientific 3D Scene-Description Generator.
 * Architectural Separation:
 * 1. ON-BOARD PCB COMPONENTS: THT/SMD parts soldered directly to pads (Resistors, LEDs, Caps, ICs, Pin Headers).
 * 2. OFF-BOARD TRANSDUCERS & ACTUATORS: Heavy modules (HC-SR04 Ultrasonic, SG90 Servo, Motors) mount an
 *    on-board PCB Pin Header / JST receptacle at their pad location, while the physical 3D module is positioned
 *    in an external Off-Board Peripherals Bay connected via color-coded 3D wire harnesses.
 */

import type { Circuit } from "@s2c/circuit-json";
import type { FootprintDef, PcbLayout, Placement, Point } from "@s2c/pcb-json";
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
      width: number;
      depth: number;
      height: number;
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
      depth: number;
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
  rotation: Vec3;
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
  boardThicknessMm?: number;
  copperThicknessMm?: number;
  solderMaskColor?: string;
  silkscreenColor?: string;
  copperColor?: string;
  padColor?: string;
  includeTraces?: boolean;
  includeVias?: boolean;
  includePads?: boolean;
  includeComponents?: boolean;
}

export const PCB_3D_PALETTE = {
  solderMaskGreen: "#0b4624",
  fr4Core: "#a3a279",
  copperTop: "#d97706",
  copperBottom: "#2563eb",
  padEnigGold: "#eab308",
  viaAnnular: "#f59e0b",
  drillCavity: "#090d16",
  silkscreenWhite: "#f8fafc",
  silkscreenYellow: "#facc15",
  componentPlasticBlack: "#111827",
  componentMetalCan: "#cbd5e1",
  leadSilver: "#e2e8f0",
  resistorTan: "#dfbe99",
  servoBlue: "#0284c7",
  sonarBlue: "#1d4ed8",
  ledRed: "#ef4444",
  ledGreen: "#22c55e",
  ledBlue: "#3b82f6",
  ledYellow: "#eab308",
};

function rotateLocalOffset(
  placement: Placement,
  lx: number,
  ly: number,
): { x: number; y: number; rotZ: number } {
  const rotZ = (placement.rotation * Math.PI) / 180;
  return {
    x: placement.x + lx * Math.cos(rotZ) - ly * Math.sin(rotZ),
    y: placement.y + lx * Math.sin(rotZ) + ly * Math.cos(rotZ),
    rotZ,
  };
}

/**
 * Helper to build a clean on-board PCB Male/Female Pin Header along the actual pad positions
 */
function buildOnBoardHeaderForPads(
  componentId: string,
  fp: FootprintDef,
  placement: Placement,
  boardThickness: number,
  shroudColor = "#111827",
): Scene3DNode[] {
  const nodes: Scene3DNode[] = [];
  const baseZ = 0;

  for (const pad of fp.pads) {
    const pos = rotateLocalOffset(placement, pad.x, pad.y);

    // Individual 2.54mm black plastic insulator block per pin (always aligns 100% with pads regardless of orientation)
    nodes.push({
      id: `${componentId}-hdr-plastic-${pad.number}`,
      name: `${componentId} Header Pin ${pad.number} Insulator`,
      kind: "component",
      geometry: { kind: "box", width: 2.5, depth: 2.5, height: 2.54 },
      material: { color: shroudColor, roughness: 0.55, metalness: 0.1 },
      position: { x: pos.x, y: pos.y, z: baseZ + 1.27 },
      rotation: { x: 0, y: 0, z: (placement.rotation * Math.PI) / 180 },
    });

    // Gold square mating post
    nodes.push({
      id: `${componentId}-hdr-post-${pad.number}`,
      name: `${componentId} Header Post ${pad.number}`,
      kind: "pin",
      geometry: { kind: "box", width: 0.64, depth: 0.64, height: boardThickness + 8.0 },
      material: { color: PCB_3D_PALETTE.padEnigGold, metalness: 0.9, roughness: 0.18 },
      position: { x: pos.x, y: pos.y, z: baseZ + 2.5 },
      rotation: { x: 0, y: 0, z: (placement.rotation * Math.PI) / 180 },
    });
  }

  return nodes;
}

/**
 * Builds an arching 3D jumper wire connecting an on-board header pad to an off-board module pin
 */
function buildJumperWireNodes(
  wireId: string,
  wireName: string,
  startXY: { x: number; y: number; z: number },
  endXY: { x: number; y: number; z: number },
  colorHex: string,
): Scene3DNode[] {
  const nodes: Scene3DNode[] = [];
  const segments = 8;
  const peakZ = Math.max(startXY.z, endXY.z) + 8.5;

  let prevPt = startXY;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const x = startXY.x + (endXY.x - startXY.x) * t;
    const y = startXY.y + (endXY.y - startXY.y) * t;
    // Parabolic arch in Z
    const z =
      (1 - t) * startXY.z + t * endXY.z + 4 * t * (1 - t) * (peakZ - 0.5 * (startXY.z + endXY.z));

    const dx = x - prevPt.x;
    const dy = y - prevPt.y;
    const dz = z - prevPt.z;
    const len = Math.hypot(dx, dy, dz);

    if (len > 0.01) {
      const midX = (prevPt.x + x) / 2;
      const midY = (prevPt.y + y) / 2;
      const midZ = (prevPt.z + z) / 2;

      // Approximate segment with small spheres/cylinders for pure Scene3D compatibility
      nodes.push({
        id: `${wireId}-seg-${i}`,
        name: wireName,
        kind: "component",
        geometry: { kind: "sphere", radius: 0.42 },
        material: { color: colorHex, roughness: 0.4, metalness: 0.1 },
        position: { x: midX, y: midY, z: midZ },
        rotation: { x: 0, y: 0, z: 0 },
      });
      nodes.push({
        id: `${wireId}-pt-${i}`,
        name: wireName,
        kind: "component",
        geometry: { kind: "sphere", radius: 0.42 },
        material: { color: colorHex, roughness: 0.4, metalness: 0.1 },
        position: { x, y, z },
        rotation: { x: 0, y: 0, z: 0 },
      });
    }
    prevPt = { x, y, z };
  }

  return nodes;
}

/**
 * Generates component 3D subnodes with strict scientific separation:
 * - On-board parts stay on the PCB
 * - Off-board modules (HC-SR04, SG90 Servo) mount a PCB header on-board and place the module outside the PCB outline
 */
function buildComponentBodyNodes(
  componentId: string,
  fp: FootprintDef,
  placement: Placement,
  boardThickness: number,
  circuit?: Circuit,
  offBoardSlotIndex = 0,
): Scene3DNode[] {
  const nodes: Scene3DNode[] = [];
  const b3d = fp.body3d;
  const rotZRad = (placement.rotation * Math.PI) / 180;
  const baseZ = 0;

  const compIdLower = componentId.toLowerCase();
  const circuitComp = circuit?.components.find((c) => c.id === componentId);
  const partInfo =
    `${componentId} ${fp.id} ${circuitComp?.partNumber ?? ""} ${circuitComp?.kind ?? ""}`.toLowerCase();

  // 1. MCU / Arduino Shield Header Pins -> Render clean on-board pin headers at every pad
  if (
    compIdLower === "u1" ||
    partInfo.includes("arduino") ||
    partInfo.includes("mcu") ||
    b3d.kind === "header"
  ) {
    return buildOnBoardHeaderForPads(componentId, fp, placement, boardThickness, "#0f172a");
  }

  // 2. OFF-BOARD MODULE A: HC-SR04 Ultrasonic Distance Sensor
  // Solder a 4-pin header on the PCB, and place the Upright Sensor Module OFF-BOARD (outside PCB edge)
  if (
    partInfo.includes("hc-sr04") ||
    partInfo.includes("ultrasonic") ||
    partInfo.includes("sonar")
  ) {
    // A. On-Board 4-Pin Male Header Receptacle (Navy Blue Shroud)
    nodes.push(...buildOnBoardHeaderForPads(componentId, fp, placement, boardThickness, "#1e3a8a"));

    // B. Off-Board Upright HC-SR04 Module positioned neatly outside the top-left of the PCB
    const bayX = -22.0;
    const bayY = 28.0 + offBoardSlotIndex * 24.0;
    const bayZ = 0;

    // Upright Blue Sensor PCB (standing vertically on Z, facing +X/-X)
    nodes.push({
      id: `${componentId}-sonar-pcb`,
      name: `${componentId} HC-SR04 Ultrasonic Module (Off-Board)`,
      kind: "component",
      geometry: { kind: "box", width: 1.6, depth: 45.0, height: 20.0 },
      material: { color: PCB_3D_PALETTE.sonarBlue, roughness: 0.35, metalness: 0.15 },
      position: { x: bayX, y: bayY, z: bayZ + 11.0 },
      rotation: { x: 0, y: 0, z: 0 },
    });

    // Dual Horizontal Ultrasonic Transducer Cans (pointing outward along -X)
    for (const dy of [-12.5, 12.5]) {
      const tag = dy < 0 ? "TX" : "RX";
      nodes.push({
        id: `${componentId}-sonar-can-${tag}`,
        name: `${componentId} Ultrasonic Transducer (${tag})`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: 8.0,
          radiusBottom: 8.0,
          height: 12.0,
          radialSegments: 28,
        },
        material: { color: "#e2e8f0", metalness: 0.88, roughness: 0.18 },
        position: { x: bayX - 6.5, y: bayY + dy, z: bayZ + 11.0 },
        rotation: { x: 0, y: 0, z: Math.PI / 2 },
      });

      // Dark acoustic mesh face
      nodes.push({
        id: `${componentId}-sonar-mesh-${tag}`,
        name: `${componentId} Transducer Mesh (${tag})`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: 6.5,
          radiusBottom: 6.5,
          height: 0.5,
          radialSegments: 24,
        },
        material: { color: "#0f172a", metalness: 0.3, roughness: 0.8 },
        position: { x: bayX - 12.6, y: bayY + dy, z: bayZ + 11.0 },
        rotation: { x: 0, y: 0, z: Math.PI / 2 },
      });
    }

    // 4MHz Silver Crystal between cans
    nodes.push({
      id: `${componentId}-sonar-xtal`,
      name: `${componentId} 4MHz Crystal Oscillator`,
      kind: "component",
      geometry: { kind: "box", width: 3.2, depth: 10.0, height: 4.0 },
      material: { color: "#cbd5e1", metalness: 0.92, roughness: 0.15 },
      position: { x: bayX - 2.0, y: bayY, z: bayZ + 17.5 },
      rotation: { x: 0, y: 0, z: 0 },
    });

    // C. 4 Color-Coded 3D Harness Wires from On-Board Header to Off-Board Module
    const wireColors = ["#ef4444", "#38bdf8", "#facc15", "#1e293b"]; // VCC, TRIG, ECHO, GND
    for (let i = 0; i < Math.min(fp.pads.length, 4); i++) {
      const pad = fp.pads[i]!;
      const pPos = rotateLocalOffset(placement, pad.x, pad.y);
      nodes.push(
        ...buildJumperWireNodes(
          `${componentId}-wire-${i}`,
          `${componentId} Harness Wire ${i + 1}`,
          { x: pPos.x, y: pPos.y, z: 5.5 },
          { x: bayX + 1.5, y: bayY + (i - 1.5) * 2.54, z: 2.5 },
          wireColors[i]!,
        ),
      );
    }

    return nodes;
  }

  // 3. OFF-BOARD MODULE B: SG90 Micro Servo Motor
  // Solder a 3-pin header on the PCB, and place the SG90 Servo in the Off-Board Peripherals Bay
  if (partInfo.includes("servo") || partInfo.includes("sg90") || compIdLower.startsWith("srv")) {
    // A. On-Board 3-Pin Servo Header (Amber/Gold Shroud)
    nodes.push(...buildOnBoardHeaderForPads(componentId, fp, placement, boardThickness, "#78350f"));

    // B. Off-Board SG90 Servo positioned neatly outside the right edge of the PCB
    const bayX = 86.0;
    const bayY = 26.0 + offBoardSlotIndex * 22.0;
    const bayZ = 0;

    // Translucent Blue Servo Body
    nodes.push({
      id: `${componentId}-servo-body`,
      name: `${componentId} SG90 Servo Motor (Off-Board Actuator)`,
      kind: "component",
      geometry: { kind: "box", width: 22.5, depth: 11.8, height: 16.0 },
      material: {
        color: PCB_3D_PALETTE.servoBlue,
        roughness: 0.25,
        metalness: 0.1,
        opacity: 0.92,
        transparent: true,
      },
      position: { x: bayX, y: bayY, z: bayZ + 8.0 },
      rotation: { x: 0, y: 0, z: 0 },
    });

    // Mounting Flange Ears
    nodes.push({
      id: `${componentId}-servo-flange`,
      name: `${componentId} Servo Mounting Tabs`,
      kind: "component",
      geometry: { kind: "box", width: 32.0, depth: 11.8, height: 2.2 },
      material: { color: PCB_3D_PALETTE.servoBlue, roughness: 0.3, metalness: 0.1 },
      position: { x: bayX, y: bayY, z: bayZ + 11.5 },
      rotation: { x: 0, y: 0, z: 0 },
    });

    // Output Gear Cylinder Boss
    const shaftX = bayX - 5.5;
    nodes.push({
      id: `${componentId}-servo-gearbox`,
      name: `${componentId} Servo Gear Boss`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 5.5,
        radiusBottom: 5.5,
        height: 4.0,
        radialSegments: 24,
      },
      material: { color: PCB_3D_PALETTE.servoBlue, roughness: 0.25, metalness: 0.1 },
      position: { x: shaftX, y: bayY, z: bayZ + 18.0 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
    });

    // Brass Drive Spline Shaft
    nodes.push({
      id: `${componentId}-servo-shaft`,
      name: `${componentId} Servo Output Shaft`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 2.0,
        radiusBottom: 2.0,
        height: 2.5,
        radialSegments: 16,
      },
      material: { color: PCB_3D_PALETTE.padEnigGold, metalness: 0.88, roughness: 0.2 },
      position: { x: shaftX, y: bayY, z: bayZ + 20.8 },
      rotation: { x: Math.PI / 2, y: 0, z: 0 },
    });

    // Interactive White Servo Horn Arm
    nodes.push({
      id: `${componentId}-servo-horn`,
      name: `${componentId} SG90 Rotor Horn (Live Physics)`,
      kind: "component",
      geometry: { kind: "box", width: 19.0, depth: 3.6, height: 1.8 },
      material: { color: "#f8fafc", roughness: 0.25, metalness: 0.05 },
      position: { x: shaftX, y: bayY, z: bayZ + 22.2 },
      rotation: { x: 0, y: 0, z: 0 },
      metadata: { role: "servo-horn", baseRotZ: 0 },
    });

    // C. 3 Servo Ribbon Wires (Orange PWM, Red VCC, Brown GND)
    const servoWireColors = ["#f97316", "#ef4444", "#78350f"];
    for (let i = 0; i < Math.min(fp.pads.length, 3); i++) {
      const pad = fp.pads[i]!;
      const pPos = rotateLocalOffset(placement, pad.x, pad.y);
      nodes.push(
        ...buildJumperWireNodes(
          `${componentId}-srv-wire-${i}`,
          `${componentId} Servo Harness ${i + 1}`,
          { x: pPos.x, y: pPos.y, z: 5.5 },
          { x: bayX - 11.5, y: bayY + (i - 1) * 2.0, z: 3.0 },
          servoWireColors[i]!,
        ),
      );
    }

    return nodes;
  }

  // Add standard through-hole leads for all remaining On-Board components
  for (const pad of fp.pads) {
    if (pad.layers.includes("bottom")) {
      const pos = rotateLocalOffset(placement, pad.x, pad.y);
      nodes.push({
        id: `${componentId}-lead-${pad.number}`,
        name: `${componentId} Lead ${pad.number}`,
        kind: "pin",
        geometry: {
          kind: "cylinder",
          radiusTop: 0.28,
          radiusBottom: 0.28,
          height: boardThickness + 2.0,
          radialSegments: 12,
        },
        material: {
          color: PCB_3D_PALETTE.leadSilver,
          metalness: 0.92,
          roughness: 0.18,
        },
        position: { x: pos.x, y: pos.y, z: baseZ - boardThickness / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      });
    }
  }

  // 4. ON-BOARD: 5mm Through-Hole LED
  if (b3d.kind === "led5mm" || partInfo.includes("led")) {
    const propColor = String(circuitComp?.properties?.color ?? "").toLowerCase();
    let ledColor = b3d.kind === "led5mm" && b3d.color ? b3d.color : PCB_3D_PALETTE.ledRed;
    if (propColor.includes("green") || compIdLower.includes("grn"))
      ledColor = PCB_3D_PALETTE.ledGreen;
    else if (propColor.includes("blue") || compIdLower.includes("blu"))
      ledColor = PCB_3D_PALETTE.ledBlue;
    else if (propColor.includes("yellow") || compIdLower.includes("ylw"))
      ledColor = PCB_3D_PALETTE.ledYellow;

    for (const pad of fp.pads) {
      const pos = rotateLocalOffset(placement, pad.x, pad.y);
      nodes.push({
        id: `${componentId}-standoff-${pad.number}`,
        name: `${componentId} LED Lead`,
        kind: "pin",
        geometry: {
          kind: "cylinder",
          radiusTop: 0.28,
          radiusBottom: 0.28,
          height: 1.8,
          radialSegments: 10,
        },
        material: { color: PCB_3D_PALETTE.leadSilver, metalness: 0.9, roughness: 0.2 },
        position: { x: pos.x, y: pos.y, z: baseZ + 0.9 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      });
    }

    nodes.push({
      id: `${componentId}-rim`,
      name: `${componentId} LED 5mm Rim`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 2.8,
        radiusBottom: 2.8,
        height: 1.0,
        radialSegments: 24,
      },
      material: {
        color: ledColor,
        roughness: 0.15,
        metalness: 0.05,
        opacity: 0.9,
        transparent: true,
        emissive: ledColor,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + 2.2 },
      rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      metadata: { role: "led-emitter", ledColor },
    });

    nodes.push({
      id: `${componentId}-dome`,
      name: `${componentId} LED 5mm Body`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 2.45,
        radiusBottom: 2.45,
        height: 4.5,
        radialSegments: 24,
      },
      material: {
        color: ledColor,
        roughness: 0.12,
        metalness: 0.05,
        opacity: 0.85,
        transparent: true,
        emissive: ledColor,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + 4.95 },
      rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      metadata: { role: "led-emitter", ledColor },
    });

    nodes.push({
      id: `${componentId}-lens`,
      name: `${componentId} LED 5mm Lens`,
      kind: "component",
      geometry: { kind: "sphere", radius: 2.44 },
      material: {
        color: ledColor,
        roughness: 0.1,
        metalness: 0.05,
        opacity: 0.88,
        transparent: true,
        emissive: ledColor,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + 7.15 },
      rotation: { x: 0, y: 0, z: rotZRad },
      metadata: { role: "led-emitter", ledColor },
    });

    return nodes;
  }

  // 5. ON-BOARD: Rotary Trimmer Potentiometer (Compact 9mm Bourns Trimpot)
  if (partInfo.includes("pot") || compIdLower.startsWith("rv") || compIdLower.startsWith("pot")) {
    nodes.push({
      id: `${componentId}-pot-base`,
      name: `${componentId} Trimmer Potentiometer`,
      kind: "component",
      geometry: { kind: "box", width: 9.2, depth: 9.2, height: 4.5 },
      material: { color: "#0369a1", roughness: 0.4, metalness: 0.15 },
      position: { x: placement.x, y: placement.y, z: baseZ + 2.25 },
      rotation: { x: 0, y: 0, z: rotZRad },
    });

    nodes.push({
      id: `${componentId}-pot-knob`,
      name: `${componentId} Rotary Dial Rotor`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 2.6,
        radiusBottom: 2.6,
        height: 4.5,
        radialSegments: 24,
      },
      material: { color: "#cbd5e1", metalness: 0.8, roughness: 0.25 },
      position: { x: placement.x, y: placement.y, z: baseZ + 6.75 },
      rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      metadata: { role: "pot-knob", baseRotZ: rotZRad },
    });

    nodes.push({
      id: `${componentId}-pot-marker`,
      name: `${componentId} Rotor Arrow Slot`,
      kind: "component",
      geometry: { kind: "box", width: 0.7, depth: 3.6, height: 0.5 },
      material: { color: "#0f172a", roughness: 0.3, metalness: 0.1 },
      position: { x: placement.x, y: placement.y, z: baseZ + 9.1 },
      rotation: { x: 0, y: 0, z: rotZRad },
      metadata: { role: "pot-knob", baseRotZ: rotZRad },
    });

    return nodes;
  }

  // 6. ON-BOARD: CdS Photoresistor (LDR)
  if (partInfo.includes("ldr") || partInfo.includes("photo") || compIdLower.includes("ldr")) {
    for (const pad of fp.pads) {
      const pos = rotateLocalOffset(placement, pad.x, pad.y);
      nodes.push({
        id: `${componentId}-ldr-leg-${pad.number}`,
        name: `${componentId} LDR Lead`,
        kind: "pin",
        geometry: {
          kind: "cylinder",
          radiusTop: 0.25,
          radiusBottom: 0.25,
          height: 3.2,
          radialSegments: 10,
        },
        material: { color: PCB_3D_PALETTE.leadSilver, metalness: 0.9, roughness: 0.2 },
        position: { x: pos.x, y: pos.y, z: baseZ + 1.6 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      });
    }

    nodes.push({
      id: `${componentId}-ldr-wafer`,
      name: `${componentId} CdS Photoresistor Disc`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 2.4,
        radiusBottom: 2.4,
        height: 1.6,
        radialSegments: 24,
      },
      material: { color: "#f8fafc", roughness: 0.3, metalness: 0.1 },
      position: { x: placement.x, y: placement.y, z: baseZ + 3.8 },
      rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
    });

    nodes.push({
      id: `${componentId}-ldr-track`,
      name: `${componentId} CdS Active Cell`,
      kind: "component",
      geometry: {
        kind: "cylinder",
        radiusTop: 2.0,
        radiusBottom: 2.0,
        height: 0.3,
        radialSegments: 24,
      },
      material: { color: "#ea580c", roughness: 0.2, metalness: 0.2, emissive: "#ea580c" },
      position: { x: placement.x, y: placement.y, z: baseZ + 4.7 },
      rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
    });

    return nodes;
  }

  // 7. ON-BOARD: Cylinders (Electrolytic Cap, Piezo Buzzer, or Axial Resistor with 4 Color Bands)
  if (b3d.kind === "cylinder") {
    const isElectrolytic =
      compIdLower.includes("c_") || compIdLower.includes("cap") || compIdLower.startsWith("c");
    const isBuzzer =
      compIdLower.includes("spk") || compIdLower.includes("buzz") || compIdLower.includes("pz");

    if (isElectrolytic) {
      nodes.push({
        id: `${componentId}-can`,
        name: `${componentId} Electrolytic Capacitor`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: b3d.r,
          radiusBottom: b3d.r,
          height: b3d.h,
          radialSegments: 24,
        },
        material: { color: "#1e3a8a", metalness: 0.35, roughness: 0.3 },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.h / 2 + 0.3 },
        rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      });

      nodes.push({
        id: `${componentId}-cap-top`,
        name: `${componentId} Aluminum Vent Top`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: b3d.r * 0.82,
          radiusBottom: b3d.r * 0.82,
          height: 0.2,
          radialSegments: 20,
        },
        material: { color: "#cbd5e1", metalness: 0.9, roughness: 0.2 },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.h + 0.35 },
        rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      });
    } else if (isBuzzer) {
      nodes.push({
        id: `${componentId}-piezo`,
        name: `${componentId} Magnetic Piezo Buzzer`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: b3d.r,
          radiusBottom: b3d.r,
          height: b3d.h,
          radialSegments: 28,
        },
        material: { color: "#0f172a", roughness: 0.45, metalness: 0.2 },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.h / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      });

      nodes.push({
        id: `${componentId}-piezo-hole`,
        name: `${componentId} Acoustic Sound Port`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: b3d.r * 0.25,
          radiusBottom: b3d.r * 0.25,
          height: 0.25,
          radialSegments: 16,
        },
        material: { color: "#d97706", metalness: 0.8, roughness: 0.3 },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.h + 0.05 },
        rotation: { x: Math.PI / 2, y: 0, z: rotZRad },
      });
    } else {
      // Axial Resistor aligned directly along its 2 pads
      const resZ = baseZ + b3d.r + 0.6;
      const bodyLen = b3d.h;

      nodes.push({
        id: `${componentId}-resistor-body`,
        name: `${componentId} Axial Resistor`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: b3d.r,
          radiusBottom: b3d.r,
          height: bodyLen,
          radialSegments: 20,
        },
        material: {
          color: b3d.color ?? PCB_3D_PALETTE.resistorTan,
          roughness: 0.35,
          metalness: 0.08,
        },
        position: { x: placement.x, y: placement.y, z: resZ },
        rotation: { x: 0, y: 0, z: rotZRad + Math.PI / 2 },
      });

      nodes.push({
        id: `${componentId}-resistor-axial-wire`,
        name: `${componentId} Axial Lead`,
        kind: "pin",
        geometry: {
          kind: "cylinder",
          radiusTop: 0.26,
          radiusBottom: 0.26,
          height: bodyLen + 2.8,
          radialSegments: 12,
        },
        material: { color: PCB_3D_PALETTE.leadSilver, metalness: 0.9, roughness: 0.2 },
        position: { x: placement.x, y: placement.y, z: resZ },
        rotation: { x: 0, y: 0, z: rotZRad + Math.PI / 2 },
      });

      const bandColors = ["#ea580c", "#ea580c", "#78350f", "#eab308"];
      const bandOffsets = [-bodyLen * 0.28, -bodyLen * 0.1, bodyLen * 0.08, bodyLen * 0.28];

      for (let bIdx = 0; bIdx < 4; bIdx++) {
        const off = bandOffsets[bIdx]!;
        const bandPos = rotateLocalOffset(placement, off, 0);
        nodes.push({
          id: `${componentId}-band-${bIdx}`,
          name: `${componentId} EIA Color Band ${bIdx + 1}`,
          kind: "component",
          geometry: {
            kind: "cylinder",
            radiusTop: b3d.r * 1.03,
            radiusBottom: b3d.r * 1.03,
            height: 0.42,
            radialSegments: 20,
          },
          material: {
            color: bandColors[bIdx]!,
            metalness: bIdx === 3 ? 0.85 : 0.1,
            roughness: 0.25,
          },
          position: { x: bandPos.x, y: bandPos.y, z: resZ },
          rotation: { x: 0, y: 0, z: rotZRad + Math.PI / 2 },
        });
      }
    }
    return nodes;
  }

  // 8. ON-BOARD: Box / DIP IC / Tactile Switch
  if (b3d.kind === "box") {
    const isSwitch =
      compIdLower.startsWith("sw") || compIdLower.includes("btn") || partInfo.includes("button");

    nodes.push({
      id: `${componentId}-body`,
      name: `${componentId} Package Body`,
      kind: "component",
      geometry: { kind: "box", width: b3d.w, depth: b3d.d, height: b3d.h },
      material: {
        color: isSwitch ? "#cbd5e1" : (b3d.color ?? PCB_3D_PALETTE.componentPlasticBlack),
        roughness: isSwitch ? 0.35 : 0.5,
        metalness: isSwitch ? 0.6 : 0.2,
      },
      position: { x: placement.x, y: placement.y, z: baseZ + b3d.h / 2 },
      rotation: { x: 0, y: 0, z: rotZRad },
    });

    if (isSwitch) {
      nodes.push({
        id: `${componentId}-actuator`,
        name: `${componentId} Pushbutton Plunger`,
        kind: "component",
        geometry: {
          kind: "cylinder",
          radiusTop: 1.5,
          radiusBottom: 1.5,
          height: 1.8,
          radialSegments: 20,
        },
        material: { color: "#dc2626", roughness: 0.3, metalness: 0.1 },
        position: { x: placement.x, y: placement.y, z: baseZ + b3d.h + 0.9 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      });
    }
    return nodes;
  }

  // Fallback
  nodes.push({
    id: `${componentId}-generic`,
    name: `${componentId} Body`,
    kind: "component",
    geometry: { kind: "box", width: 5.0, depth: 5.0, height: 3.0 },
    material: { color: PCB_3D_PALETTE.componentPlasticBlack, roughness: 0.6, metalness: 0.1 },
    position: { x: placement.x, y: placement.y, z: baseZ + 1.5 },
    rotation: { x: 0, y: 0, z: rotZRad },
  });

  return nodes;
}

/**
 * Builds a pure 3D scene representation from a PcbLayout.
 */
export function buildPcbScene3D(
  layout: PcbLayout,
  circuit?: Circuit,
  options: Scene3DOptions = {},
): PcbScene3D {
  const boardThickness = options.boardThicknessMm ?? 1.6;
  const copperThickness = options.copperThicknessMm ?? 0.035;
  const maskColor = options.solderMaskColor ?? PCB_3D_PALETTE.solderMaskGreen;
  const topCuColor = options.copperColor ?? PCB_3D_PALETTE.copperTop;
  const bottomCuColor = PCB_3D_PALETTE.copperBottom;
  const padColor = options.padColor ?? PCB_3D_PALETTE.padEnigGold;

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
        { x: 13.97, y: 2.54, radius: 1.6 },
        { x: 15.24, y: 50.8, radius: 1.6 },
        { x: 66.04, y: 7.62, radius: 1.6 },
        { x: 66.04, y: 35.56, radius: 1.6 },
      ],
    },
    material: {
      color: maskColor,
      roughness: 0.32,
      metalness: 0.12,
    },
    position: { x: 0, y: 0, z: -boardThickness },
    rotation: { x: 0, y: 0, z: 0 },
    metadata: {
      thicknessMm: boardThickness,
      widthMm: boardWidth,
      heightMm: boardHeight,
    },
  };

  // 2. Copper Traces
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
          roughness: 0.22,
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

  // 3. Vias
  const viaNodes: Scene3DNode[] = [];
  if (options.includeVias !== false) {
    for (let i = 0; i < layout.vias.length; i++) {
      const via = layout.vias[i]!;

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
          metalness: 0.88,
          roughness: 0.25,
        },
        position: { x: via.x, y: via.y, z: -boardThickness / 2 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        metadata: {
          netId: via.netId,
          drillMm: via.drill,
          diameterMm: via.diameter,
        },
      });

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
    let offBoardCount = 0;
    for (const pl of layout.placements) {
      const fp = fpMap.get(pl.footprintId);
      if (!fp) continue;

      const compSubnodes = buildComponentBodyNodes(
        pl.componentId,
        fp,
        pl,
        boardThickness,
        circuit,
        offBoardCount,
      );
      if (compSubnodes.some((n) => n.id.includes("-sonar-") || n.id.includes("-servo-"))) {
        offBoardCount++;
      }
      componentNodes.push(...compSubnodes);
    }
  }

  const totalNodeCount =
    1 + traceNodes.length + viaNodes.length + padNodes.length + componentNodes.length;

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