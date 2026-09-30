# Tracked Implementation Gaps & Action Items

This document tracks technical gaps identified during Milestone reviews. 

---

## GAP-01: KiCad Netlist Exporter Golden-File & S-Expression AST Validation

- **Status**: OPEN (Documented Limitation — Awaiting Real KiCad Export)
- **Component**: `@s2c/export` (`packages/export/src/sexpr.ts`, `packages/export/src/kicad.ts`, `packages/export/test/kicad-validation.test.ts`)
- **Severity**: Quality Assurance / Compliance
- **Limitation Note**: Golden KiCad netlist fixture is hand-written per the S-expr spec, not exported from real KiCad, due to no KiCad binary in this sandbox. Needs a real export to fully close.
- **Implementation State**:
  1. **S-Expression AST Validator**: Implemented a recursive-descent parser (`parseSExpr`) in `@s2c/export` that parses netlist `.net` text into a structured tree of `(tag ...children)`. Strictly validates balanced parentheses, escaped string literals (`\"`, `\\`), and enforces KiCad Version "E" schema (`(export (version "E") (design ...) (components ...) (nets ...))`). Rejects corrupted netlists and flags dangling component references.
  2. **Golden File Differential Test**: Added reference netlist `packages/export/test/fixtures/kicad_blink_golden.net` constructed per the KiCad Version "E" S-expression specification. Vitest asserts structural, component designator, value, footprint, and topological net node pin equivalence.
  3. **Verification**: 5 dedicated tests in `packages/export/test/kicad-validation.test.ts` pass cleanly against the current specification model. Real KiCad 7/8 machine export will be swapped in once provided.

---

## GAP-02: Physical Header Pin GND Resolution in Wiring Table

- **Status**: RESOLVED & TESTED
- **Component**: `@s2c/arduino` & `@s2c/export` (`packages/arduino/src/gnd-allocator.ts`, `packages/parts/src/catalog.ts`, `packages/export/src/wiring-table.ts`, `packages/export/test/gnd-allocation.test.ts`)
- **Severity**: Usability / Hardware Accuracy
- **Hardware Ground Pin Reality (Arduino Uno R3 Schematic Pinout)**:
  An authentic Arduino Uno R3 has exactly 3 female header ground pins accessible to breadboard jumper wires:
  - `POWER.GND.1` (Power header JP2 pin 6, between 5V and GND.2)
  - `POWER.GND.2` (Power header JP2 pin 7, between GND.1 and VIN)
  - `DIGITAL.GND` (Digital header JP1 pin 4, between AREF and D13)
- **Implementation**:
  1. **Physical Pin Allocator**: Implemented `PhysicalGndAllocator` in `@s2c/arduino`. As circuits allocate ground connections, distinct physical header pins are assigned in rotation (`POWER.GND.1` -> `POWER.GND.2` -> `DIGITAL.GND`).
  2. **Graceful Rail Fallback**: When a circuit requires >3 ground connections, the allocator never double-books or errors out. Instead, it designates `POWER.GND.1` to tie into the breadboard blue ground rail and assigns subsequent connections to `Breadboard.GND_RAIL` with explicit instructional wiring notes.
  3. **Wiring Table Surface**: `generateWiringTable` in `@s2c/export` automatically maps MCU grounds to `POWER.GND.1`, `POWER.GND.2`, `DIGITAL.GND`, and `Breadboard.GND_RAIL` with header pin locations in `notes`.
  4. **Verification**: 4 dedicated tests in `packages/export/test/gnd-allocation.test.ts` pass cleanly.

---

## GAP-03: Grid Router Escape Routing, Dense Header Routing & Rip-Up/Reroute

- **Status**: OPEN (Documented Limitation for M11 — Follow-up Enhancements Planned)
- **Component**: `@s2c/pcb-layout` (`packages/pcb-layout/src/router.ts`, `packages/pcb-layout/src/drc.ts`, `packages/pcb-layout/test/routing-metrics.golden.json`)
- **Severity**: Layout Quality & Routing Completion Rate
- **Observed Behavior**:
  1. On dense multi-peripheral circuits (`user_multi_peripheral.ino` and `multi_peripheral_benchmark`), the deterministic 2-layer orthogonal grid router achieves a **55.2% routing completion rate** (16 of 29 connections routed, 13 unrouted). Simple circuits like HC-SR04, Piezo Buzzer, and Dynamic Loop achieve **100% completion**.
  2. 14 of 15 DRC violations on the user circuit are `DRC_CLEARANCE_TRACE_PAD` (trace passing within 0.254mm of a pad) and 1 is `DRC_CLEARANCE_VIA_TRACE` (via at (39.37, 45.72) within 0.008mm of another net's trace).
     Measured benchmark DRC errors on user_multi_peripheral.ino:
     ```
     Violation A (Trace-to-Pad):
       Net: 5V
       Foreign Pad: POT1.1
       Coordinates: (x = 33.020 mm, y = 10.240 mm)
       Measured Clearance: 0.000 mm (Required: >= 0.254 mm)

     Violation B (Trace-to-Pad):
       Net: GND
       Foreign Pad: POT1.2
       Coordinates: (x = 33.020 mm, y = 15.240 mm)
       Measured Clearance: 0.043 mm (Required: >= 0.254 mm)

     Violation C (Trace-to-Pad):
       Net: N$9
       Foreign Pad: LDR1.1
       Coordinates: (x = 46.560 mm, y = 12.700 mm)
       Measured Clearance: 0.138 mm (Required: >= 0.254 mm)

     Violation 4 (Via-to-Trace):
       Via Net: N$12
       Conflicting Trace Net: N$6 (Top Layer)
       Coordinates: (x = 39.370 mm, y = 45.720 mm)
       Measured Clearance: 0.008 mm (Required: >= 0.254 mm)
     ```
  3. The unrouted rate (44.8%) stems from three primary factors:
     - **Coarse 0.635mm (25 mil) Routing Grid**: At 0.635mm pitch with 0.254mm traces and 0.254mm clearances, tracks cannot pass between standard 2.54mm header pins without consuming 2 adjacent grid cells, creating congestion bottlenecks.
     - **Lack of Dedicated Escape Routing**: Pads without dedicated escape vectors block adjacent grid avenues immediately upon first-net routing.
     - **Absence of Rip-Up & Reroute**: Connections are currently routed in single-pass deterministic order; early nets consume straight-line corridors that lock out later nets.
- **Action Plan & Follow-Up Enhancements**:
  1. **UI Transparency**: Display an honest status badge in the UI showing routing completion (`"16/29 routed (55.2%), 13 unrouted, 15 DRC warnings"`).
  2. **Dedicated Escape Vector Pass**: Implement perpendicular escape stubs from header pins and dense component clusters before launching global 2-layer A* maze search.
  3. **Multi-Tier Grid Pitch**: Support fine-pitch routing (0.3175mm / 12.5 mil or 0.254mm / 10 mil) in high-density corridors while retaining 0.635mm for macro segments to keep search times fast.
  4. **Negotiated Congestion / Rip-Up & Reroute (PathFinder-style)**: Allow initial overlapping routing with progressive penalty inflation until all nets decouple cleanly.

---

### GAP-04: Arduino Uno Shield Board Outline Polygon Simplification
- **Context**: The canonical Uno shield board outline in `@s2c/footprints` (`ARDUINO_UNO_R3_SHIELD_OUTLINE`) models the outer board boundary as a 13-point polygon with symmetric bevels at standard corners and stepped cutouts for connector clearances.
- **Current Limitation**: Real Arduino Uno R3 PCB shields have an asymmetric profile, specifically a deeper relief notch on the left edge around the USB Type-B jack and DC barrel jack, and rounded corner radii (2.54mm radius fillets) rather than pure 45-degree chamfers.
- **Impact**: Board outline collision detection and keepout bounding are functionally conservative and structurally correct for 99% of shield designs, but the outline is visually simplified compared to the exact mechanical DXF profile of an official Arduino shield.
- **Follow-Up**: When mechanical enclosure export or Step/3D CAD integration is implemented, upgrade `ARDUINO_UNO_R3_SHIELD_OUTLINE` to include full G2 arc fillets and true asymmetric connector relief contours.

---

## Integrity & Verification Logging

All project verification incidents and operational rules are strictly recorded in [`docs/INTEGRITY_NOTES.md`](./INTEGRITY_NOTES.md), including:
- **INC-001 (Milestone 12)**: Prohibition of image-generation models for application screenshots; mandatory use of raw execution evidence (JSON, standalone SVG, shell command output).
