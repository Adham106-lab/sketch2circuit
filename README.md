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
3. **Evidence-Based Arduino Synthesizer:** Statically inspect `.ino` sketches via tree-sitter AST parsing, extract pin operations and peripheral signatures, infer hardware devices with confidence scores, apply verified engineering recipes (e.g. LED resistor sizing via E24 series), and emit breadboard wiring tables, SVG schematics, BOMs, and KiCad netlists.

---

## Core Philosophy

- **Evidence, Not Magic:** Arduino sketches do not contain circuits; they contain *evidence* of circuits. Every inferred component details its confidence score, source code references, and assumptions.
- **No Silently Guessed Electrical Values:** Resistor values, pin capabilities, and current thresholds derive strictly from verified component datasheets and deterministic formulas.
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
│   ├── rules/              # Pure ERC rules engine and catalog
│   ├── render-schematic/   # Deterministic SVG schematic generator (net-label architecture)
│   ├── export/             # Breadboard wiring tables, BOM CSV, KiCad netlists
│   ├── arduino/            # Sketch parser, fact extraction & recipe synthesizer
│   └── cli/                # Command-line interface (`s2c`)
├── apps/
│   └── playground/         # Browser playground (Vite + React + Monaco)
├── fixtures/
│   ├── sketches/           # Arduino sketch test corpus
│   └── expected/           # Golden Circuit IR & diagnostic snapshots
└── docs/                   # Technical documentation and rule references
```

---

## Quick Start

```bash
# Clone and install dependencies
git clone https://github.com/sketch2circuit/sketch2circuit.git
cd sketch2circuit
pnpm install

# Run verification suite
pnpm typecheck
pnpm lint
pnpm test

# Launch the interactive playground
pnpm dev
```

---

## Roadmap

- [x] **M0: Setup** — Monorepo scaffolding, base TypeScript configurations, CI workflows, and test harnesses.
- [ ] **M1: Circuit IR & Units** — Zod schemas, JSON Schema generation, engineering units parser, and E-series rounding.
- [ ] **M2: Parts & Core Engine** — 25+ verified part library definitions, builder API, and JSX runtime with union-find net generation.
- [ ] **M3: Schematic Renderer** — Net-label SVG schematic generation with component clustering.
- [ ] **M4: Electrical Rules Check (ERC)** — 10+ rules with quantitative diagnostics.
- [ ] **M5: Arduino Synthesizer** — Tree-sitter C++ AST parser, constant folder, peripheral inference, and recipe synthesizer.
- [ ] **M6: Exporters & CLI** — Breadboard wiring guides, BOM, KiCad netlists, and `s2c` CLI.
- [ ] **M7: Interactive Playground** — Browser-based IDE with live schematic preview and inference review controls.
- [ ] **M8: Documentation & Physical Validation** — Corpus verification and real-world breadboard circuit testing.

---

## License

Apache-2.0
