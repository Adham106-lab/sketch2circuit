# Contributing to sketch2circuit

Thank you for your interest in contributing to **sketch2circuit**!

This project is a high-assurance electronics-as-code toolchain and evidence-based Arduino sketch synthesizer. Quality, deterministic output, strict typing, and verified electrical data take priority over feature volume.

---

## 1. Ground Rules & Principles

1. **Read `docs/DOCUMENTATION.md` first.** It is the source of truth for architecture, IR types, rule catalog, inference rules, and recipes.
2. **Never invent electrical facts.** Any voltage, current, or pin capability placed into a part file or recipe must include a datasheet URL or a `// TODO(verify)` marker with `"verified": false`. Never present unverified electrical numbers as fact.
3. **Determinism.** Same input $\to$ byte-identical output. Stable IDs, sorted collections, and no non-deterministic timestamps in Circuit IR.
4. **Purity.** All packages except `cli` and `playground` are pure functions over data (no filesystem, no network, no global mutable state).
5. **Never throw on bad user input.** The parser and resolver must return diagnostics or `Unresolved` items instead of halting abruptly.
6. **Tests first-class.** Every feature, recipe, and ERC rule ships with unit tests. Behavior changes are captured by golden fixture diffs.
7. **Strict TypeScript.** `strict: true`, `noUncheckedIndexedAccess: true`, ESM only, no `any` (`unknown` + Zod schema validation at boundaries).

---

## 2. Monorepo Structure

```
packages/
  units/              # parse/format engineering values ("4.7k", "100nF", "3.3V")
  circuit-json/       # IR types + Zod schemas + generated JSON Schema
  parts/              # Part library (JSON) + loader + validation
  core/               # Builder API + JSX runtime -> Circuit IR
  rules/              # ERC engine + rule catalog
  render-schematic/   # Circuit IR -> SVG schematic with net labels
  export/             # KiCad netlist, BOM CSV, wiring table, IR JSON
  arduino/            # Sketch AST analysis + inference + recipe synthesis
  cli/                # s2c command-line utility
apps/
  playground/         # Interactive browser-based IDE (Vite + React + Monaco)
fixtures/
  sketches/           # .ino sketch corpus
  expected/           # Golden Circuit IR & diagnostic snapshots
docs/                 # Architecture, rule specs, and guides
```

---

## 3. Development Workflow

### Prerequisites
- Node.js LTS (v22+)
- `pnpm` (via Corepack: `corepack enable pnpm`)

### Commands
```bash
# Install dependencies
pnpm install

# Run typecheck across all workspaces
pnpm typecheck

# Lint and format code with Biome
pnpm lint
pnpm format

# Run full test suite with Vitest
pnpm test

# Start the interactive playground dev server
pnpm dev
```

### Commit and Pull Request Guidelines
- Work milestone by milestone.
- Run `pnpm typecheck && pnpm lint && pnpm test` before opening a pull request.
- Keep commits focused and include unit tests for all new behaviors.
