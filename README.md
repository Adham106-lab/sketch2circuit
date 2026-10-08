# sketch2circuit (`s2c`)

> **Electronics-as-code toolchain and evidence-based Arduino sketch $\to$ circuit synthesizer with Electrical Rules Checking (ERC).**

[![CI](https://github.com/sketch2circuit/sketch2circuit/actions/workflows/ci.yml/badge.svg)](https://github.com/sketch2circuit/sketch2circuit/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

---

## What is sketch2circuit?

`sketch2circuit` bridges the gap between microcontroller software and hardware design through three tightly integrated capabilities sharing one common **Circuit IR (v0.1.0)**:

1. **Electronics-as-Code Framework (TypeScript):** Describe electronic circuits programmatically using a fluent builder API or JSX (`<board>`, `<resistor>`, `<led>`), compiling deterministically into Circuit IR.
2. **Electrical Rules Checking (ERC) Engine:** Statically analyze circuit schematics to detect physical errors—floating inputs, power shorts, driver contention, missing current-limiting resistors, I2C pull-up absences, and supply budget overruns—complete with quantitative explanations and computable fixes.
3. **Evidence-Based Arduino Synthesizer:** Statically inspect `.ino` sketches via tree-sitter AST parsing, extract pin operations and peripheral signatures, infer hardware devices with confidence scores, apply verified engineering recipes (e.g. LED resistor sizing via E24 series, physical MCU ground allocation), and emit breadboard wiring tables, SVG schematics, BOMs, and KiCad netlists.

---

## Core Philosophy

- **Evidence, Not Magic:** Arduino sketches do not contain circuits; they contain *evidence* of circuits. Every inferred component details its confidence score, source code references, and assumptions.
- **No Silently Guessed Electrical Values:** Resistor values, pin capabilities, and current thresholds derive strictly from verified component datasheets and deterministic formulas (Ohm's law, standard E24 series).
- **User Agency:** Annotations (`// @s2c:`) enable authors to override or pin inferences directly in code without breaking standard Arduino IDE compilation.
- **Purity & Portability:** Pure functional packages run identically in the Node.js CLI and in client-side WebAssembly browser sandboxes.

---

## Monorepo Architecture

```
sketch2circuit/
├── packages/
│   ├── units/              # Engineering notation ("4.7k", "100nF") & E12/E24/E96 series
│   ├── circuit-json/       # Canonical Circuit IR schema, types & Zod validation
│   ├── parts/              # Datasheet-verified component specifications catalog
│   ├── core/               # Circuit builder & JSX runtime (@s2c/core/jsx-runtime)
│   ├── rules/              # Pure ERC rules engine (18+ electrical rules)
│   ├── render-schematic/   # Deterministic SVG schematic generator (net-label architecture)
│   ├── export/             # Breadboard wiring tables, BOM CSV, KiCad netlists, reports
│   ├── arduino/            # Sketch parser, fact extraction, GND allocator & synthesizer
│   └── cli/                # Command-line interface (`s2c`)
├── apps/
│   └── playground/         # Browser playground & synthesis studio (Vite + React)
├── fixtures/
│   ├── sketches/           # Arduino sketch test corpus (20+ canonical sketches)
│   └── expected/           # Golden Circuit IR & diagnostic snapshots
└── docs/                   # Technical documentation, breadboard builds & rule references
```

---

## Quick Start

```bash
# Clone and install dependencies
git clone https://github.com/Adham106-lab/sketch2circuit
cd sketch2circuit
pnpm install

# Run strict verification suite (100% green across 127 tests)
pnpm typecheck
pnpm lint
pnpm test

# Launch the interactive web playground & docs studio
pnpm dev
```

---

## Ecosystem Comparison (Doc §16)

*Full comparative analysis is available in [`docs/COMPARISONS.md`](docs/COMPARISONS.md).*

| Feature | `sketch2circuit` (`s2c`) | `tscircuit` | `atopile` | `Fritzing` | `KiCad` | `Wokwi` |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Input Source** | **Arduino C++ (`.ino`) or TSX** | TypeScript / React Components | Python-like (`.ato`) Code | Drag-and-Drop GUI | Schematic Capture GUI | Virtual Circuit Diagram (`diagram.json`) |
| **Inference from Code** | **Yes** (Tree-sitter AST) | No | No | No | No | No |
| **Circuit IR Contract** | **Circuit IR v0.1.0** (Pure JSON) | Circuit JSON | Compiler AST / Graph | XML / FZ | S-Expressions (`.kicad_sch`) | Custom JSON |
| **Electrical Rules Check** | **18+ Quantitative Rules** | Basic DRC / Connectivity | Type Constraints | None / Basic | Basic Pin Types | None |
| **Schematic Rendering** | **Deterministic SVG** (Net labels) | Vector / Canvas | KiCad export | Schematic view | Native vector rendering | 2D breadboard art |
| **KiCad Netlist Export** | **Yes** (Version "E" S-expr) | No | Yes | No | Native | No |
| **Breadboard Guide** | **Physical Pin Allocator & Table** | No | No | Breadboard view (manual) | No | Visual breadboard |
| **Target Audience** | Embedded developers, educators, makers | Web engineers building PCBs | Hardware engineers | Beginners & hobbyists | Professional EE engineers | Firmware developers |
| **License** | **Apache-2.0** | MIT | Apache-2.0 | Proprietary ($) | GPLv3+ | Proprietary / Web |

---

## Demo Video Script & Walkthrough (Doc §16)

A complete 3-minute video presentation storyboard and screen-recording timeline is detailed in [`docs/DEMO_VIDEO_WALKTHROUGH.md`](docs/DEMO_VIDEO_WALKTHROUGH.md):
1. **The Disconnect (0:00–0:30)**: Why firmware code contains electrical intent that traditional EDA tools ignore.
2. **Interactive Studio (0:30–1:15)**: Live Tree-sitter C++ AST parsing, evidence extraction, and real-time SVG schematic rendering.
3. **Quantitative ERC (1:15–2:00)**: Catching unbuffered LEDs, missing I2C pullups, and pin current overdraws with actionable math.
4. **Physical Ground & Breadboard Export (2:00–2:40)**: Multi-GND allocation (`POWER.GND.1`, `POWER.GND.2`, `DIGITAL.GND`) and KiCad netlist export.
5. **Summary & CLI Workflow (2:40–3:15)**: CLI commands, open architecture, and transition to physical assembly.

---

## Known Limitations & Tracked Technical Gaps

All project constraints, benchmark metrics, and operational rules are strictly tracked in [`docs/KNOWN_GAPS.md`](docs/KNOWN_GAPS.md) and [`docs/INTEGRITY_NOTES.md`](docs/INTEGRITY_NOTES.md):

1. **KiCad Golden-File Fixture (GAP-01)**:
   > **Golden KiCad netlist fixture is hand-written per the S-expr spec, not exported from real KiCad, due to no KiCad binary in this sandbox. Needs a real export to fully close.**  
   The recursive-descent S-expression AST validator (`parseSExpr`) and test suite verify compliance against the official KiCad Version "E" specification. Once an authentic KiCad 7/8 desktop export is provided, the reference fixture will be updated.
2. **Physical Hardware Bench Testing (Doc §15 Point 7)**:
   Physical assembly and electrical verification with test instruments (oscilloscope, multimeter, breadboards) requires physical hardware bench testing by a human engineer. It cannot be performed or measured directly within this headless software development sandbox.
3. **2-Layer Grid Router Density & Completion (GAP-03)**:
   The deterministic 2-layer orthogonal grid router achieves **55.2% routing completion** (16/29 routed, 13 unrouted ratsnest lines, 15 DRC violations) on dense multi-peripheral circuits (`user_multi_peripheral.ino`). A coarse 0.635 mm (25 mil) grid pitch and single-pass ordering without rip-up/reroute create corridor bottlenecks. Simple circuits achieve 100% completion.
4. **Arduino Uno Shield Board Outline Polygon Simplification (GAP-04)**:
   The canonical shield outline in `@s2c/footprints` models the outer board boundary as a 13-point polygon with symmetric bevels rather than the full asymmetric profile with USB Type-B deep relief notches.
5. **No AI-Synthesized Images for Application Screenshots (INC-001)**:
   Under **INC-001**, using image-generation models to simulate application screenshots or EDA canvas renders is strictly prohibited. All UI verification is performed via direct code paths, pure headless scene descriptions, raw SVG outputs, and binary file byte counts.

---

## Roadmap

- [x] **M0: Setup** — Monorepo scaffolding, base TypeScript configurations, CI workflows, and test harnesses.
- [x] **M1: Circuit IR & Units** — Zod schemas, JSON Schema generation, engineering units parser, and E-series rounding.
- [x] **M2: Parts & Core Engine** — 25+ verified part library definitions, builder API, and JSX runtime with union-find net generation.
- [x] **M3: Schematic Renderer** — Net-label SVG schematic generation with component clustering.
- [x] **M4: Electrical Rules Check (ERC)** — 18+ rules with quantitative diagnostics and computable fixes.
- [x] **M5: Arduino Synthesizer** — Tree-sitter C++ AST parser, constant folder, peripheral inference, and recipe synthesizer.
- [x] **M6: Exporters & CLI** — Breadboard wiring guides, BOM, KiCad netlists, and `s2c` CLI.
- [x] **M7: Interactive Playground** — Browser-based IDE with live schematic preview, AST evidence inspection, and ERC diagnostics.
- [x] **M8: Polish** — Documentation site, ecosystem comparisons, demo walkthrough script, and open gap tracking.
- [x] **M9: PCB IR & Footprints** — `@s2c/pcb-json` schema, footprint library with 3D metadata (`body3d`), keepouts, and Uno/Nano shield outlines.
- [x] **M10: Auto-Placement Engine** — Constrained force-directed placer with header pin anchoring and keepout preservation.
- [x] **M11: 2-Layer Grid Router & DRC** — Orthogonal A* maze router, plated through-hole via generator, and 7 DRC validation checks.
- [x] **M12: 2D PCB Layout Workbench** — Dark oscilloscope vector canvas, multi-layer toggles, ratsnest lines, and honest routing status badge.
- [x] **M13: 3D PCB CAD Viewer** — Pure 3D scene description generator, Three.js WebGL renderer, OrbitControls, interactive View-Cube widget, and GLB export.
- [x] **M14: Multi-Domain Playground Polish** — Integrated Schematic | PCB | 3D | BOM workbench sharing debounced synthesis, routing/DRC badges, dual themes, and documentation.

---

## License

Apache-2.0
