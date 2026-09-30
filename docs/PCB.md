# 2D & 3D PCB Design Engine Documentation

> **Complete architectural reference for `@s2c/footprints`, `@s2c/pcb-json`, `@s2c/pcb-layout`, 2D EDA rendering, and 3D WebGL CAD visualization in sketch2circuit.**

---

## 1. Overview & Monorepo Architecture

`sketch2circuit` expands beyond schematic synthesis and Electrical Rules Checking (ERC) into physical layout synthesis, automated board placement, 2-layer track routing, Design Rule Checking (DRC), and interactive 3D WebGL CAD inspection.

```
packages/
├── footprints/         # Datasheet-accurate PCB footprints with 3D body models & board outlines
├── pcb-json/           # Canonical PCB Layout IR specification & Zod validation schemas
└── pcb-layout/         # Auto-placer, 2-layer grid router, DRC engine, SVG renderer & 3D scene builder
    ├── placer.ts       # Constrained force-directed component placer with header anchoring
    ├── router.ts       # 2-layer orthogonal A* maze router with plated through-hole vias
    ├── drc.ts          # Comprehensive Design Rule Checking (DRC) engine (7 validation checks)
    ├── svg-renderer.ts # Standalone vector EDA renderer (traces, pads, keepouts, ratsnest)
    ├── scene3d.ts      # Pure 3D scene-description generator (Node.js & browser portable)
    └── three-builder.ts# Three.js PBR mesh and layer-group hierarchy builder
```

---

## 2. Package Specifications

### 2.1 `@s2c/footprints`
- **Board Outlines**:
  - `ARDUINO_UNO_R3_SHIELD_OUTLINE`: Standard 68.58 × 53.34 mm shield outline with connector cutouts, mounting holes (Ø3.2 mm), and keepouts for USB Type-B and DC barrel jacks.
  - `ARDUINO_NANO_V3_SHIELD_OUTLINE`: Compact 43.18 × 17.78 mm breadboard / carrier board outline.
- **Footprint Library**:
  - `R_AXIAL_0.3`: Through-hole axial resistor (7.62 mm pitch, Ø0.8 mm drill).
  - `LED_5MM_THT`: Standard 5 mm round LED with Ø2.54 mm pin spacing and 3D dome lens.
  - `C_RADIAL_D6.3`: Radial electrolytic capacitor with polarity index.
  - `C_DISC_D5.0`: Ceramic disc capacitor with 2.54 mm pitch.
  - `DIP_8_W7.62` / `DIP_16_W7.62`: Standard dual-in-line IC footprints with pin-1 notch.
  - `HDR_FEMALE_1X8` / `HDR_FEMALE_1X10`: Arduino shield stacking headers.
  - `SW_TACT_6X6`: 4-pin tactile push-button with mechanical retention tabs.
  - `POT_3PIN_PTH`: Rotary potentiometer with 5.0 mm terminal pitch.
  - `BUZZER_12MM_PTH`: Active/passive piezo buzzer.
- **Parametric 3D Model Metadata (`body3d`)**:
  - Every footprint embeds a `body3d` descriptor defining geometric primitives (`box`, `cylinder`, `composite`, `header`, `dome`) and PBR material colors.

### 2.2 `@s2c/pcb-json`
Defines the `PcbLayout` schema:
```typescript
export interface PcbLayout {
  schemaVersion: "0.1.0";
  boardOutline: {
    width: number;
    height: number;
    polygon: Array<{ x: number; y: number }>;
    cutouts?: Array<Array<{ x: number; y: number }>>;
    mountingHoles?: Array<{ x: number; y: number; diameter: number }>;
    thicknessMm?: number;
  };
  footprints: FootprintDef[];
  placements: ComponentPlacement[];
  traces: PcbTraceSegment[];
  vias: PcbVia[];
  keepouts?: KeepoutZone[];
  layers: string[];
}
```

---

## 3. Placement & Routing Engines

### 3.1 Constrained Auto-Placer (`placer.ts`)
1. **Header Anchor Pass**: Fixed shield headers (`POWER`, `ANALOG`, `DIGITAL_LOW`, `DIGITAL_HIGH`) are locked to their standard mechanical coordinates.
2. **Peripheral Clustering**: Peripheral components are initially positioned near their respective microcontroller interface pins (e.g. `D13` LED placed near digital pin 13).
3. **Collision Relaxation**: Iterative bounding-box repulsion separates component bodies while respecting board edge margins ($\ge 2.54\,\text{mm}$) and mechanical keepout zones.

### 3.2 2-Layer Orthogonal Grid Router (`router.ts`)
- **Layer Stacking**:
  - **Top Copper (`top`)**: Color-coded red (`#ef4444`); preferred horizontal routing direction.
  - **Bottom Copper (`bottom`)**: Color-coded blue (`#3b82f6`); preferred vertical routing direction.
- **Routing Algorithm**:
  - 2-layer orthogonal A* maze router operating on a configurable discrete grid (default $0.635\,\text{mm}$ / 25 mil).
  - Layer change penalty discourages unnecessary vias.
  - Via insertion connects top and bottom traces through plated barrels ($0.6\,\text{mm}$ drill, $1.2\,\text{mm}$ annular pad diameter).
- **Ratsnest & Routing Completion**:
  - Unrouted connections are preserved as cyan dashed ratsnest lines (`#06b6d4`) connecting closest pins.
  - The UI displays an honest routing status badge with exact routed/total connection counts and completion percentage.

---

## 4. Design Rule Checking (DRC) Engine (`drc.ts`)

The DRC engine evaluates 7 independent physical rules:

| Rule Code | Description | Default Threshold |
|:---|:---|:---|
| `DRC_CLEARANCE_TRACE_PAD` | Minimum copper track to foreign pad clearance | $\ge 0.254\,\text{mm}$ (10 mil) |
| `DRC_CLEARANCE_TRACE_TRACE` | Minimum spacing between adjacent copper tracks | $\ge 0.254\,\text{mm}$ (10 mil) |
| `DRC_CLEARANCE_VIA_TRACE` | Minimum spacing between via pad and foreign copper track | $\ge 0.254\,\text{mm}$ (10 mil) |
| `DRC_CLEARANCE_VIA_VIA` | Minimum clearance between adjacent via pads | $\ge 0.254\,\text{mm}$ (10 mil) |
| `DRC_MIN_ANNULAR_RING` | Minimum copper width surrounding drill holes | $\ge 0.150\,\text{mm}$ (6 mil) |
| `DRC_MIN_DRILL_SIZE` | Minimum allowable hole diameter for manufacturing | $\ge 0.300\,\text{mm}$ (12 mil) |
| `DRC_BOARD_BOUNDARY` | Minimum setback between copper and board edge | $\ge 0.500\,\text{mm}$ (20 mil) |

Violations are marked directly on the 2D layout canvas with red diamond glyphs (`#ef4444`) and listed in an interactive drawer.

---

## 5. 3D WebGL CAD Visualization

### 5.1 Pure Scene-Description Generator (`scene3d.ts`)
- Evaluates in pure TypeScript without browser canvas or WebGL dependencies (fully testable in Node.js/Vitest).
- Generates a scene graph tree containing:
  - Board substrate slab with chamfers and mounting hole cavities.
  - Top and bottom annular rings for through-hole pins (double mesh: $z = +0.0175\,\text{mm}$ top, $z = -1.6175\,\text{mm}$ bottom).
  - Trace extrusion tubes and via cylinders.
  - High-fidelity component bodies: LED translucent domes, axial resistors with color code bands, electrolytic canisters, DIP packages with pin 1 index, and tactile buttons.

### 5.2 Three.js Renderer (`three-builder.ts` & `Pcb3DViewer.tsx`)
- **PBR Materials**: Physically based rendering with roughness, metalness, and emissive glow.
- **Controls & HUD**:
  - Orbit controls (rotate, pan, zoom with damping).
  - Interactive **3D View-Cube Orientation Widget** in the top-right corner (Top, Bottom, Front, Back, Left, Right, Isometric view presets).
  - Layer toggles (Board, Top Copper, Bottom Copper, Vias, Pads, Components, Wireframe).
  - Cursor raycaster identifying hovered component reference designator and package kind.
- **Export**:
  - `*_scene3d.json`: Pure scene-description JSON export.
  - `*_pcb_model.glb`: Industry-standard binary glTF export via Three.js `GLTFExporter`.

---

## 6. Known Limitations & Technical Gaps

All open limitations are formally logged in [`docs/KNOWN_GAPS.md`](./KNOWN_GAPS.md):
- **GAP-03 (Routing Density)**: Single-pass orthogonal A* achieves 55.2% completion on the 16-component `user_multi_peripheral` benchmark due to coarse 0.635 mm grid pitch and lack of rip-up/reroute.
- **GAP-04 (Shield Contour)**: The Arduino Uno shield outline is currently modeled as a symmetric octagon rather than an asymmetric profile with deep USB jack relief.
- **INC-001 (Verification Integrity)**: Prohibition of image-generation models to simulate application screenshots. All project verifications require raw reproducible artifacts (JSON files, shell command output, binary byte counts).
