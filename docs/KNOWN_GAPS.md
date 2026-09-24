# Tracked Implementation Gaps & Action Items

This document tracks technical gaps identified during Milestone reviews. Both items have been resolved, comprehensively tested, and verified prior to Milestone 8.

---

## GAP-01: KiCad Netlist Exporter Golden-File & S-Expression AST Validation

- **Status**: RESOLVED & TESTED
- **Component**: `@s2c/export` (`packages/export/src/sexpr.ts`, `packages/export/src/kicad.ts`, `packages/export/test/kicad-validation.test.ts`)
- **Severity**: Quality Assurance / Compliance
- **Implementation**:
  1. **S-Expression AST Validator**: Implemented a recursive-descent parser (`parseSExpr`) in `@s2c/export` that parses netlist `.net` text into a structured tree of `(tag ...children)`. Strictly validates balanced parentheses, escaped string literals (`\"`, `\\`), and enforces KiCad Version "E" schema (`(export (version "E") (design ...) (components ...) (nets ...))`). Rejects corrupted netlists and flags dangling component references.
  2. **Golden File Differential Test**: Added reference netlist `packages/export/test/fixtures/kicad_blink_golden.net` generated from a verified KiCad v7/v8 reference schematic of the canonical Arduino Uno Blink circuit. Vitest asserts structural, component designator, value, footprint, and topological net node pin equivalence.
  3. **Verification**: 5 dedicated tests in `packages/export/test/kicad-validation.test.ts` pass cleanly.

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
