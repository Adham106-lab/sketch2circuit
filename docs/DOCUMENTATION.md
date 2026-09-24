# sketch2circuit — Full Technical Documentation

> Working title. A TypeScript "electronics as code" toolchain (in the spirit of tscircuit) plus an
> **Arduino-sketch → circuit** synthesizer, with a rules engine that verifies the result.
>
> Status: design document v0.1. Every electrical number in this document is a *default to be
> verified against the relevant datasheet* before being hard-coded into the part library.

---

## 1. Vision and honest scope

### 1.1 What the project is
Three products sharing one core:

1. **Circuit-as-code framework (TypeScript).** Describe a circuit with a builder API or JSX,
   compile it to a JSON intermediate representation (the **Circuit IR**), render a schematic,
   and export to other tools.
2. **Rules engine (ERC).** Analyzes the Circuit IR and reports electrical mistakes with a
   human-readable explanation and a suggested fix.
3. **Sketch → Circuit synthesizer.** Reads an Arduino sketch (`.ino`), statically analyzes it,
   infers which peripherals it drives, and generates a circuit (Arduino board + peripherals +
   the support components they need), then runs the rules engine on it.

### 1.2 What "convert ANY Arduino code into a complete circuit" can and cannot mean
Source code does not contain a circuit. It contains *evidence* of one. Be explicit about this in
the README and in the UI, because it is the difference between a credible tool and a toy.

| Can be inferred reliably | Can be inferred with hints | Cannot be inferred |
|---|---|---|
| Which pins are used, and as input/output/PWM/analog/interrupt | Which physical device is on a pin (LED vs relay vs buzzer) — from names, library includes, call patterns | Exact part numbers with no library/comment evidence |
| Bus usage (I2C/SPI/UART) | I2C device identity — from library + address constants | Analog front-end design (op-amps, filters) |
| Devices bound to well-known libraries (Servo, DHT, LiquidCrystal, NeoPixel…) | Analog sensor type (pot vs LDR vs thermistor) — from names/comments | Power supply choice, enclosure, mechanical constraints |
| Support components implied by the device (LED resistor, I2C pull-ups, decoupling) | | Anything hidden behind runtime-computed pin numbers |

**Design principle:** the synthesizer is *deterministic and evidence-based*. Every inferred
element carries a **confidence score**, the **evidence** that produced it, and a list of
**assumptions**. Low-confidence items are shown to the user for confirmation. Users can override
anything with **annotations** in the sketch (Section 12.6).

### 1.3 Two output levels ("complete circuit")
- **Level A — Board-level circuit (v1).** An Arduino board (Uno first) + peripherals + resistors,
  pull-ups, decoupling, flyback diodes, etc. Output: schematic, wiring table, BOM, netlist.
- **Level B — Standalone circuit (v2).** Replace the Arduino board by a minimal ATmega328P
  reference design (MCU, 16 MHz crystal + two load capacitors, reset pull-up, decoupling, AVCC
  filter, regulator, programming header). Verify against the official datasheet reference circuit.

### 1.4 Non-goals for v1
PCB layout/autorouting, simulation (SPICE), 3D preview, supporting every MCU, parsing every C++
feature. These are roadmap items (Section 16).

---

## 2. Electronics glossary (for software engineers)

- **Component** — a physical part (resistor, LED, IC). Has a *reference designator* (R1, C2, U1, D3).
- **Port / Pin** — a connection point on a component.
- **Net** — a set of ports that are electrically connected (one wire = one net). Names like `GND`, `5V`, `SDA`.
- **Trace** — a copper connection on a PCB (in the IR we describe *nets*; traces come with PCB layout).
- **Footprint** — the copper/pad pattern a component is soldered onto (e.g. `0805`, `SOIC-8`).
- **Symbol** — the schematic drawing of a component.
- **Schematic** — logical diagram of components and nets. **PCB layout** — physical arrangement.
- **ERC** (Electrical Rules Check) — checks the *schematic* (floating pins, shorts, over-current).
  **DRC** (Design Rules Check) — checks the *PCB* (clearance, trace width). v1 does ERC only.
- **Pull-up / pull-down resistor** — resistor tying a signal to VCC / GND so it has a defined level.
- **Decoupling (bypass) capacitor** — typically 100 nF next to an IC's power pin to absorb switching noise.
- **Current-limiting resistor** — resistor in series with an LED: `R = (Vsupply − Vf) / If`.
- **Flyback diode** — diode across an inductive load (relay coil, motor) to clamp voltage spikes.
- **Logic level** — 5 V (Uno) vs 3.3 V (ESP32, RP2040). Mixing them needs level shifting.
- **I2C** — two-wire bus (SDA, SCL) needing pull-ups. **SPI** — four-wire bus (MOSI, MISO, SCK, CS).
- **PWM** — pulse-width modulation; on Uno only pins 3, 5, 6, 9, 10, 11.
- **BOM** — bill of materials.

---

## 3. Architecture overview

```
                 ┌────────────────────────┐
  .ino sketch ──►│  @s2c/arduino          │
                 │  parse → resolve →     │
                 │  infer → synthesize    │──┐
                 └────────────────────────┘  │
                                             ▼
  TS/JSX code ──► @s2c/core (builder/JSX) ──► Circuit IR (JSON, validated by zod)
                                             │
              ┌──────────────┬───────────────┼───────────────┬──────────────┐
              ▼              ▼               ▼               ▼              ▼
        @s2c/rules    @s2c/render-     @s2c/export-    @s2c/export-    (future)
        (ERC engine)  schematic (SVG)  kicad (netlist) bom/wiring      PCB layout
              │
              ▼
        Diagnostics (severity, explanation, suggested fix)
                                             │
                                             ▼
                              @s2c/cli   and   apps/playground (Vite + React)
```

**Key architectural decision:** everything communicates through the **Circuit IR**. The framework,
the synthesizer, the rules engine, the renderers, and the exporters never talk to each other
directly. This is the same idea that makes tscircuit extensible (code → Circuit JSON → renderers).

**Purity rule:** all packages except `cli` and `playground` are pure functions over data
(no filesystem, no network, no globals). This makes them testable, deterministic, and usable in
both Node and the browser.

---

## 4. Monorepo layout and tooling

```
sketch2circuit/
├─ packages/
│  ├─ circuit-json/       # IR types + zod schemas + generated JSON Schema
│  ├─ units/              # parse/format engineering values ("4.7k", "100nF", "3.3V")
│  ├─ parts/              # part library (JSON) + loader + validation
│  ├─ core/               # builder API + JSX runtime -> IR
│  ├─ rules/              # ERC engine + rule catalog
│  ├─ render-schematic/   # IR -> SVG
│  ├─ export/             # kicad-netlist, bom-csv, wiring-table, ir-json
│  ├─ arduino/            # sketch analysis + synthesis (the differentiator)
│  └─ cli/                # `s2c` command
├─ apps/
│  └─ playground/         # Vite + React + Monaco + live preview
├─ fixtures/
│  ├─ sketches/           # .ino inputs (corpus)
│  └─ expected/           # golden IR/diagnostics snapshots
├─ docs/
└─ package.json, pnpm-workspace.yaml, tsconfig.base.json
```

Tooling (recommended defaults):
- **Node LTS**, **pnpm** workspaces, TypeScript 5.x with `"strict": true`,
  `"noUncheckedIndexedAccess": true`, ESM only.
- **tsup** for building packages, **Vitest** for tests, **Biome** (or ESLint+Prettier) for lint/format.
- **zod** for runtime validation and to generate JSON Schema (`zod-to-json-schema`).
- **web-tree-sitter** + the C++ grammar (WASM) for parsing sketches in both Node and browser.
  *(Verify current package names/API before starting.)*
- **Changesets** for versioning, **GitHub Actions** for CI (typecheck, lint, test on every PR).

Dependency direction (no cycles):
`units` ← `circuit-json` ← `parts` ← `core` ← (`rules`, `render-schematic`, `export`, `arduino`) ← `cli`, `playground`.

---

## 5. Circuit IR specification (v0.1)

The IR is the product's public contract. Version it (`schemaVersion`) from day one.

```ts
export interface Circuit {
  schemaVersion: "0.1.0";
  meta: { name: string; generator: string; sourceHash?: string };
  components: Component[];
  nets: Net[];
  assumptions: Assumption[];   // what the synthesizer guessed
  diagnostics: Diagnostic[];   // filled by the rules engine
}

export interface Component {
  id: string;                  // stable unique id, e.g. "cmp_led_1"
  ref: string;                 // reference designator: "R1", "D2", "U1"
  partId: string;              // key into the part library: "led.5mm.red"
  kind: ComponentKind;         // "resistor" | "capacitor" | "led" | "mcu_board" | "ic" | ...
  value?: Quantity;            // resistance / capacitance / etc.
  props: Record<string, unknown>;
  ports: Port[];
  provenance: Provenance;
}

export interface Port {
  id: string;                  // "cmp_led_1.anode"
  name: string;                // "anode"
  number?: string;             // "1" (physical pin number if applicable)
  aliases: string[];           // ["A", "+"]
  electrical: PortElectrical;
}

export type PortType =
  | "power_in" | "power_out" | "input" | "output" | "bidirectional"
  | "passive" | "open_collector" | "no_connect";

export interface PortElectrical {
  type: PortType;
  vMin?: number; vMax?: number;        // voltage window in volts
  iMaxSource?: number; iMaxSink?: number; // amps
  logicLevel?: number;                 // 3.3 or 5
  capabilities?: string[];             // ["pwm","adc","i2c.sda","interrupt"]
}

export interface Net {
  id: string;
  name: string;                        // "GND", "5V", "D9", "I2C_SDA"
  class: "ground" | "power" | "signal";
  connections: string[];               // Port ids
}

export interface Quantity {
  value: number;                       // SI base units (ohm, farad, volt, amp...)
  unit: "ohm" | "F" | "H" | "V" | "A" | "Hz" | "W";
  tolerance?: number;                  // fraction, e.g. 0.05 = ±5 %
}

export interface Provenance {
  source: "user" | "inferred";
  confidence?: number;                 // 0..1, only for inferred
  evidence?: Evidence[];
  sketchRange?: { startLine: number; startCol: number; endLine: number; endCol: number };
}

export interface Evidence {
  kind: "include" | "call" | "identifier" | "constant" | "comment" | "annotation" | "pattern";
  detail: string;
  sketchRange?: Provenance["sketchRange"];
}

export interface Assumption { id: string; message: string; affects: string[]; confidence: number }

export interface Diagnostic {
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;                     // one line
  explanation: string;                 // why it matters, with numbers
  suggestion?: string;                 // "Use 150 Ω instead of 47 Ω"
  refs: string[];                      // component/port/net ids
}
```

Rules for the IR:
- All values in **SI base units** as numbers (never strings). Strings like `"4.7k"` exist only at the API boundary (Section 6).
- IDs are **stable and deterministic** (derived from content), so golden-file tests don't flake.
- The IR must round-trip: `parse(JSON.stringify(ir))` validates against the zod schema.
- Publish the generated JSON Schema so other tools can consume the IR.

---

## 6. Units package

`parseQuantity("4.7k", "ohm") → { value: 4700, unit: "ohm" }`

Support: SI prefixes `p n µ/u m k M G`, the resistor-notation `4k7`, unit suffixes (`Ω`, `ohm`, `F`, `V`, `A`, `Hz`),
tolerance syntax `"10k ±5%"`. Provide `formatQuantity` that picks the best prefix and
`nearestStandardValue(value, series)` for **E12 / E24 / E96** series (used when the synthesizer
computes a resistor and must choose a purchasable value).

E12 base values: 1.0 1.2 1.5 1.8 2.2 2.7 3.3 3.9 4.7 5.6 6.8 8.2 (× decade).

---

## 7. Part library

A part is a JSON file validated by a zod schema. Keep the v1 library small (≈30–40 parts) and
**accurate**, each with a datasheet URL and a `verified: true|false` flag.

```jsonc
// parts/led.5mm.red.json
{
  "id": "led.5mm.red",
  "category": "led",
  "description": "5 mm red LED",
  "pins": [
    { "name": "anode",   "number": "1", "aliases": ["A", "+"], "type": "passive" },
    { "name": "cathode", "number": "2", "aliases": ["K", "-"], "type": "passive" }
  ],
  "electrical": { "vf": 2.0, "ifTypical": 0.010, "ifMax": 0.020 },
  "footprints": ["LED_D5.0mm"],
  "symbol": "led",
  "datasheet": "",
  "verified": false
}
```

Minimum v1 library:
- **Passives:** resistor, capacitor (ceramic/electrolytic), diode (1N4148, 1N4007), LED (red/green/blue/white), potentiometer.
- **Semiconductors:** NPN transistor (2N2222/BC547), N-MOSFET (2N7000 / IRLZ44N), optionally ULN2003.
- **Boards/MCUs:** Arduino Uno R3 (header-level model, Section 7.1).
- **Modules:** servo (SG90), HC-SR04, DHT11/DHT22, 16×2 HD44780 LCD (parallel), I2C LCD backpack, WS2812B strip, relay module, piezo buzzer, push button, LDR, NTC thermistor, MPU6050 breakout, SD card SPI breakout.

### 7.1 Arduino Uno model (defaults to verify against the ATmega328P datasheet)
- Header pins: `D0–D13`, `A0–A5` (also usable as digital 14–19), `5V`, `3V3`, `VIN`, `GND` (multiple), `AREF`, `RESET`, `IOREF`.
- Capabilities: PWM on `D3 D5 D6 D9 D10 D11`; external interrupts on `D2 D3`; I2C `SDA=A4`, `SCL=A5`;
  SPI `SS=D10 MOSI=D11 MISO=D12 SCK=D13`; UART `RX=D0 TX=D1`; ADC on `A0–A5`; `LED_BUILTIN = D13`.
- Logic level 5 V. Recommended per-pin current ≈ 20 mA; datasheet absolute maximum ≈ 40 mA per I/O pin;
  ≈ 200 mA total across VCC/GND pins. **Verify before publishing.**
- `D0/D1` are shared with USB serial; warn if used while `Serial` is active.

---

## 8. Core package: builder API and JSX

Two front-ends, one output (the IR).

**Builder API**
```ts
import { circuit } from "@s2c/core";

const c = circuit("blink");
const uno = c.add("arduino.uno");
const r1  = c.add("resistor", { value: "330" });
const d1  = c.add("led.5mm.red");

c.connect(uno.pin("D13"), r1.pin(1));
c.connect(r1.pin(2), d1.pin("anode"));
c.connect(d1.pin("cathode"), uno.pin("GND"));

export default c.build();   // -> Circuit IR
```

**JSX (via a custom `jsx-runtime`, no React reconciler required for v1)**
```tsx
/** @jsxImportSource @s2c/core */
export default () => (
  <board name="blink">
    <arduino.uno name="U1" />
    <resistor name="R1" resistance="330" />
    <led name="D1" color="red" />
    <trace from="U1.D13" to="R1.1" />
    <trace from="R1.2" to="D1.anode" />
    <trace from="D1.cathode" to="U1.GND" />
  </board>
);
```

Implementation notes:
- `tsconfig`: `"jsx": "react-jsx", "jsxImportSource": "@s2c/core"`. Implement `jsx()`/`jsxs()`/`Fragment`
  in `@s2c/core/jsx-runtime`. Elements return plain descriptors `{ type, props, children }`.
- A `render(descriptor) → Circuit` function walks the tree, resolves parts from the library,
  allocates reference designators (`R1, R2…`, per-prefix counters), resolves selectors like `"U1.D13"`,
  builds nets with **union-find** (each `connect` unions two ports; net = connected component),
  names nets (explicit name wins; else `GND`/`5V` for power ports; else `N$1…`), and validates with zod.
- **Custom components** are just functions returning elements (like React function components), which is
  what enables reusable sub-circuits (e.g. `<I2cPullups />`).
- A React reconciler (as tscircuit does) is an optional later upgrade; the descriptor approach is simpler and
  enough to prove the concept.

Errors must be actionable: unknown part id → suggest closest match (Levenshtein); unknown pin →
list valid pins; duplicate ref → point to both locations.

---

## 9. Rules engine (ERC)

```ts
export interface Rule {
  id: string;                          // "erc.led-current"
  title: string;
  severity: "error" | "warning" | "info";
  check(ctx: RuleContext): Diagnostic[];
}
export interface RuleContext {
  circuit: Circuit;
  parts: PartLibrary;
  net(id: string): NetView;            // helpers: members, driver, loads
  componentsByKind(kind: ComponentKind): Component[];
  neighbors(portId: string): Port[];   // ports on the same net
}
export function runRules(circuit: Circuit, rules: Rule[]): Diagnostic[];
```

Design points: rules are pure and independent; every diagnostic must include **numbers** in `explanation`
(“7 mA drawn vs 20 mA limit”) and a **suggestion** when a fix is computable.

### 9.1 v1 rule catalog

| ID | Severity | What it checks |
|---|---|---|
| `erc.floating-input` | warning | Input pin on a net with no driver/pull. |
| `erc.unconnected-port` | info/warn | Non-`no_connect` port with no net. |
| `erc.power-short` | error | Two different power nets (or power and ground) merged. |
| `erc.output-contention` | error | Two `output` ports on the same net. |
| `erc.led-no-resistor` | error | LED connected directly between a source and ground without a series resistance. |
| `erc.led-current` | error/warn | `I = (Vsrc − Vf)/R` exceeds LED `ifMax` or the MCU pin's recommended source limit. |
| `erc.pin-current` | error | Sum of load currents on one MCU pin > limit. |
| `erc.total-current` | warning | Sum across pins > MCU total budget (≈200 mA on Uno). |
| `erc.i2c-pullups` | warning | `SDA`/`SCL` nets lack pull-ups (unless the breakout is flagged as having them). |
| `erc.i2c-address-conflict` | error | Two devices with the same address on one bus. |
| `erc.decoupling` | warning | IC power pin without a capacitor to ground on the same net segment. |
| `erc.logic-level-mismatch` | error/warn | 5 V output driving a 3.3 V-only input (no divider/shifter). |
| `erc.inductive-load-no-flyback` | error | Relay coil/motor driven by a switch with no flyback diode. |
| `erc.servo-power` | warning | Servo powered from the MCU 5 V pin (stall current risk); recommend external supply + common ground. |
| `erc.pwm-capability` | error | `analogWrite` used on a non-PWM pin (from sketch evidence). |
| `erc.adc-capability` | error | `analogRead` on a pin that isn't an ADC pin. |
| `erc.reserved-pin` | warning | Use of D0/D1 alongside `Serial`. |
| `erc.power-budget` | warning | Total estimated supply current > source capability (USB ≈ 500 mA nominal). |

Example diagnostic:
```
[error] erc.led-current  D1
  LED D1 would draw 63 mA ((5.0 V − 2.0 V) / 47 Ω) — LED max is 20 mA and Uno pin
  recommended max is 20 mA.
  Suggestion: use 150 Ω (≈20 mA) or 330 Ω (≈9 mA, typical brightness).
```

---

## 10. Schematic renderer (IR → SVG)

**v1 strategy: net labels instead of routed wires.** Like KiCad often does, draw each component with short
stubs and put the **net name label** on each pin. This avoids wire routing entirely and produces readable
diagrams, which is a huge simplification.

Pipeline:
1. **Symbols:** a small library of SVG symbol definitions (resistor, capacitor, LED, diode, transistor,
   IC box, connector). ICs/boards are drawn as generic rectangles with pins grouped left/right.
2. **Grouping & placement:** deterministic layout. Place the MCU/board box in the center, then place each
   *peripheral cluster* (peripheral + its support components, as produced by the synthesizer) in a grid around it.
   Cluster membership comes from provenance (`peripheralId`).
3. **Pin anchors:** each symbol exposes anchor coordinates per port; label text goes at the anchor.
4. **Render:** template strings → SVG; `viewBox` computed from bounding box; light/dark theme via CSS variables.
5. **Interactivity (playground):** hover a net label → highlight all pins of that net; click a diagnostic → highlight `refs`.

v2: real orthogonal wire routing (grid A*), then PCB footprints + placement + autorouting.

---

## 11. Exporters

- **`ir-json`** — the IR itself.
- **`wiring-table` (markdown/CSV)** — *the most valuable output for Arduino users*: 
  `Arduino pin → device pin → wire note` plus a step-by-step breadboard list.
- **`bom-csv`** — reference, value, part id, footprint, quantity, optional supplier link column.
- **`kicad-netlist`** — KiCad netlist (`.net`, S-expression) so the design can continue in KiCad
  (*verify the exact format against KiCad docs; keep exporter tests with real files opened in KiCad*).
- **`ato-skeleton` (stretch)** — emit an atopile `.ato` skeleton so the tool complements atopile instead of competing.
- **`report-html`** — single-page report: schematic, BOM, wiring, diagnostics, assumptions.

---

## 12. Arduino → Circuit pipeline (`@s2c/arduino`)

```
sketch text
  1. preprocess      (strip comments but keep annotations; collect #define/#include)
  2. parse           (tree-sitter C++ → syntax tree)
  3. extract facts   (calls, declarations, constants, constructors)
  4. resolve         (constant-fold pin expressions, arrays, aliases)
  5. pin usage graph (per-pin modes/ops/names)
  6. infer           (peripherals with confidence + evidence)
  7. review gate     (low-confidence → user confirmation / annotations)
  8. synthesize      (peripherals → components + support recipes → IR)
  9. validate        (rules engine) → diagnostics, then report
```

### 12.1 Preprocess
- Collect `#include <X.h>` → library hints.
- Collect `#define NAME value` and `const int/byte/uint8_t NAME = value;` → constant table.
- Keep comments with the `@s2c:` prefix (annotations) and *non-annotation comments as low-weight hints*
  (e.g. `// red LED`).
- Arduino `.ino` is C++ with an implicit `#include <Arduino.h>` and auto-generated prototypes; tree-sitter
  parsing of raw text is fine, but tolerate syntax errors (partial trees) — never crash on bad input.

### 12.2 Extract facts
Walk the tree and collect (with source ranges):

| Pattern | Fact |
|---|---|
| `pinMode(p, MODE)` | `PinMode(p, INPUT/OUTPUT/INPUT_PULLUP)` |
| `digitalWrite(p, v)` / `digitalRead(p)` | digital output / input usage |
| `analogWrite(p, v)` | PWM output usage |
| `analogRead(p)` | ADC usage |
| `tone(p, f)` / `noTone(p)` | tone output (buzzer/speaker) |
| `pulseIn(p, level)` | pulse measurement (ultrasonic, IR, etc.) |
| `attachInterrupt(digitalPinToInterrupt(p), fn, mode)` | interrupt pin |
| `shiftOut(data, clk, order, val)` / `shiftIn` | 74HC595/165-style shift register |
| `Serial.begin(baud)` | UART in use (reserve D0/D1) |
| `Wire.begin()` / `Wire.beginTransmission(0x..)` | I2C in use + device address |
| `SPI.begin()` / `SPI.transfer` | SPI in use (+ CS pin via `pinMode`) |
| `Type name(args…);` constructor | object binding: `Servo s;`, `DHT dht(2, DHT11);`, `LiquidCrystal lcd(12,11,5,4,3,2);`, `Adafruit_NeoPixel strip(8, 6, NEO_GRB + NEO_KHZ800);` |
| `obj.attach(p)` | object bound to pin (`Servo`) |
| direct register access `DDRB \|= _BV(5)`, `PORTD = …` | port-manipulation (map port/bit → Arduino pin; mark **medium confidence**) |

### 12.3 Resolve
- **Constant folding** for integer expressions: literals, `#define`/`const` names, `+ - * / %`,
  `A0…A5`, `LED_BUILTIN`, simple `enum`.
- **Arrays and loops (v1.5):** `int leds[] = {2,3,4};` with `for (i…) pinMode(leds[i], OUTPUT)` → expand to pins
  2,3,4. Anything not statically resolvable becomes an **Unresolved** fact: report it, don't guess.
- Track the **identifier name** the pin came from (`ledPin`, `BUTTON_PIN`, `trigPin`) — used as an inference hint.

### 12.4 Pin usage graph
```ts
interface PinUse {
  pin: PinId;                       // "D9", "A0"
  modes: Set<"INPUT"|"OUTPUT"|"INPUT_PULLUP">;
  ops: Set<"digitalWrite"|"digitalRead"|"analogWrite"|"analogRead"|"tone"|"pulseIn"|"interrupt"|"library">;
  nameHints: string[];              // identifiers that resolved to this pin
  ranges: SourceRange[];
}
```
Conflict detection at this stage: same pin as OUTPUT and INPUT_PULLUP, `analogWrite` on non-PWM,
`analogRead` on non-ADC, D0/D1 with `Serial`, two libraries claiming one pin.

### 12.4a Inference rules (knowledge base)
Each rule = *evidence pattern → peripheral + confidence*. Rules are data + small functions, unit-tested individually.

| Evidence | Peripheral | Confidence | Notes |
|---|---|---|---|
| `pinMode(p,OUTPUT)` + `digitalWrite`, name matches `/led/i` | LED (+ series resistor) | 0.9 | Resistor from formula, E24 rounding. |
| `pinMode(p,OUTPUT)` + `digitalWrite`, no name hint | LED | 0.55 | Default; flag as assumption. |
| `analogWrite(p, …)` (PWM), name `/led\|fade\|bright/i` | LED dimmed by PWM | 0.85 | Check PWM-capable pin. |
| `pinMode(p,INPUT_PULLUP)` + `digitalRead` | Push button to GND | 0.9 | **No external resistor**; internal pull-up used. |
| `pinMode(p,INPUT)` + `digitalRead` | Button/switch with external 10 kΩ pull-down (or pull-up) | 0.7 | Warn: floating without resistor. Ask which. |
| `#include <Servo.h>` + `s.attach(p)` | Servo (SG90) | 0.95 | Power warning, bulk capacitor, common GND. |
| `tone(p, …)` | Piezo buzzer / speaker | 0.85 | Series resistor (≈100 Ω) for a bare piezo; note passive vs active. |
| `analogWrite(p, …)` (PWM), name `/buzzer\|piezo\|beep/i` | PWM-driven piezo / tone dimmer | 0.80 | Series resistor (≈100 Ω); PWM duty cycle volume/tone control on PWM-capable pin. |
| `pulseIn(echo)` + `digitalWrite(trig,…)` pair | HC-SR04 | 0.85 | 5 V device; VCC/GND/Trig/Echo. |
| `#include <DHT.h>` + `DHT d(pin, DHT11\|DHT22)` | DHT11/DHT22 | 0.95 | 10 kΩ pull-up (data→VCC) unless module. |
| `#include <LiquidCrystal.h>` + ctor of 6 pins | HD44780 16×2 parallel LCD | 0.95 | 10 kΩ contrast pot, backlight resistor, R/W→GND. |
| `#include <LiquidCrystal_I2C.h>` | I2C LCD backpack (0x27/0x3F) | 0.9 | I2C pull-ups usually on backpack; note. |
| `#include <Adafruit_NeoPixel.h>` | WS2812 strip | 0.95 | 330–470 Ω data resistor, 1000 µF across supply, worst-case 60 mA/LED. |
| `#include <Wire.h>` + address constant | I2C device | 0.6 | Identify by library (`MPU6050`, `Adafruit_BMP280`…) or address table. |
| `#include <SD.h>` / `SPI` + CS pin | SD card SPI module | 0.85 | 3.3 V logic on many bare modules; warn. |
| `#include <Stepper.h>` | Stepper + driver | 0.8 | Needs driver (ULN2003 / A4988); external motor supply. |
| output pin, name `/relay/i` | Relay module (or transistor + relay + flyback diode) | 0.8 | Coil current ≫ pin limit. |
| `analogRead(p)`, name `/pot\|knob\|volume/i` | Potentiometer (10 kΩ) | 0.85 | Wiper → pin, ends → 5V/GND. |
| `analogRead(p)`, name `/ldr\|light/i` | LDR + 10 kΩ divider | 0.8 | |
| `analogRead(p)`, name `/temp\|therm/i` | NTC thermistor + 10 kΩ divider | 0.6 | Or LM35/TMP36 — low confidence, ask. |
| `analogRead(p)`, no hint | Generic analog sensor / pot | 0.4 | Flag for user confirmation. |

Rules are evaluated in **priority order**; library evidence beats identifier hints beats defaults.
Every fired rule appends to `evidence[]`; conflicting rules lower confidence and create an `Assumption`.

### 12.5 Synthesis: recipes
A **recipe** turns a peripheral into components + connections. Recipes are the "engineering knowledge" of the tool.

```ts
type Recipe<P extends Peripheral> = (p: P, ctx: SynthContext) => SubCircuit;
interface SubCircuit { components: ComponentSpec[]; connections: Connection[]; notes: string[]; clusterId: string }
```

Examples (all numeric defaults to be verified):

- **LED:** `R = (Vsrc − Vf) / If`. Uno: `(5 − 2.0)/0.010 = 300 Ω` → nearest E24 = **330 Ω** (≈9 mA).
  Connect `Dxx → R → LED anode`, `LED cathode → GND`. Vf depends on color (red≈2.0, green≈2.1–3.0, blue/white≈3.0–3.3).
- **Button (INPUT_PULLUP):** pin ↔ one leg, other leg ↔ GND. Nothing else.
- **Button (INPUT):** pin ↔ 10 kΩ ↔ GND (pull-down) and button between pin and 5 V. (Offer pull-up variant.)
- **I2C bus:** connect `SDA`/`SCL`; add **4.7 kΩ** pull-ups to VCC on each line once per bus (not per device);
  skip if the chosen breakout is flagged `hasPullups`.
- **IC decoupling:** 100 nF ceramic from each IC VCC pin to GND.
- **Servo:** signal → pin, VCC → 5 V (warn) or external 5 V rail, GND common; 100–470 µF across servo supply.
- **Relay (bare coil):** MCU pin → 1 kΩ → NPN base; emitter → GND; coil between 5 V and collector;
  1N4007 flyback across coil. (For relay *modules*, wire VCC/GND/IN only and note isolation.)
- **HC-SR04:** VCC 5 V, GND, Trig/Echo to the two inferred pins.
- **NeoPixel:** data → 330 Ω → DIN; 1000 µF across power; power budget = N × 60 mA worst case.
- **Piezo:** pin → 100 Ω → piezo → GND.
- **Power net:** create `5V` and `GND` nets from the board header; sum peripheral currents into a **power budget**.

Component ordering and IDs must be deterministic (sort by pin, then by peripheral type) so snapshots are stable.

### 12.6 Annotations (user override language)
Inline comments beat inference:
```cpp
const int STATUS = 9;   // @s2c: led(color=green) on D9
int sensor = A0;        // @s2c: ldr on A0
// @s2c: i2c device=mpu6050 addr=0x68
// @s2c: ignore D13
```
Grammar (one line): `@s2c: <type>[(k=v,…)] [on <pin>] [key=value …]`. Unknown keys → warning, not failure.
Annotations produce evidence with confidence 1.0.

### 12.7 Optional LLM assist (off by default)
- Interface `Inferrer { infer(facts: SketchFacts): Promise<PeripheralGuess[]> }` so any provider can plug in.
- The LLM only **proposes** peripheral guesses as JSON, validated by zod; guesses are capped at
  confidence 0.6 and always require user confirmation. **The deterministic engine never trusts the LLM for
  electrical values** — resistor values, currents, and pinouts come from the part library and recipes.
- Reason: reproducibility and safety. A wrong resistor value from a hallucination is a burnt part.

### 12.8 Known limitations (document them in the README)
Runtime-computed pin numbers, pins passed through function parameters, heavy macro metaprogramming, custom
drivers written against raw registers (partially supported), timing/analog design, multiple MCUs.
The tool must report these as **Unresolved** items rather than silently ignoring them.

### 12.9 Output of the pipeline
```ts
interface SynthesisResult {
  circuit: Circuit;
  peripherals: Peripheral[];
  unresolved: UnresolvedItem[];   // e.g. "pin computed at runtime at line 42"
  needsConfirmation: Peripheral[];// confidence < 0.7
  wiringTable: WiringRow[];
  bom: BomRow[];
}
```

---

## 13. CLI (`s2c`)

```
s2c build circuit.tsx            -> IR JSON + SVG + BOM
s2c check circuit.json           -> run ERC, exit code 1 on errors (CI-friendly)
s2c sketch blink.ino             -> synthesize circuit from a sketch
  --board uno                    (v1: uno only)
  --format json|svg|report|wiring|bom|netlist
  --annotations-only             (disable heuristics)
  --interactive                  (ask to confirm low-confidence guesses)
  --out ./out
s2c explain <ruleId>             -> full documentation of a rule
```
Exit codes: 0 ok, 1 ERC errors, 2 unresolved items in `--strict`, 3 usage error.

---

## 14. Playground (`apps/playground`)

Vite + React + TypeScript + Monaco editor. Three tabs: **Circuit code (TSX)**, **Arduino sketch**, **Report**.
Layout: editor left; right = schematic (SVG) with hover-highlighting, diagnostics panel, assumptions panel
(with Confirm/Change controls), wiring table, BOM. Everything runs **in the browser** (pure packages + WASM parser),
so it deploys as a static site with shareable URLs (state encoded in the URL hash, compressed).

Confirmation UI for low-confidence inferences: each peripheral card shows evidence lines
(“`#include <Servo.h>`, line 1”, “`servo.attach(9)`, line 14”) and a dropdown to change its type.

---

## 15. Testing strategy

1. **Unit tests** — units parsing, E-series rounding, union-find nets, each rule, each inference rule, each recipe.
2. **Golden/snapshot tests** — `fixtures/sketches/*.ino` → `fixtures/expected/*.json`. Any behavior change shows up as a diff to review.
3. **Corpus** — start with the classic tutorial sketches (Blink, Button, Fade, AnalogReadSerial, Knob, Sweep,
   HC-SR04 distance, DHT read, LCD hello world, NeoPixel strandtest, I2C scanner, MPU6050 read…). Write your own
   versions or verify licenses before copying anyone's code. Target 40+ sketches.
4. **Negative tests** — sketches with deliberate mistakes (PWM on non-PWM pin, LED with no resistor, I2C address clash);
   assert the exact diagnostics.
5. **Property tests (fast-check)** — resolving constants never throws; parser tolerates arbitrary garbage; IR always validates.
6. **Determinism test** — running synthesis twice yields byte-identical IR.
7. **Real-world physical validation (Human physical action required)** — An engineer must build at least 3 circuits on a physical breadboard following the tool's generated wiring tables and confirm they operate on real hardware (record findings in the README). Note: This step requires a human engineer with physical hardware, multimeters, and test equipment; it cannot be executed or measured in a headless software sandbox.
8. **CI** — typecheck + lint + tests on every PR; publish playground preview.

Quality metrics to track: inference precision/recall on the corpus (labelled peripherals), % of sketches with zero
Unresolved items, ERC false-positive rate.

---

## 16. Roadmap and milestones (≈12 weeks, adjust to your pace)

| Milestone | Deliverable | Acceptance criteria |
|---|---|---|
| **M0 — Setup (wk 1)** | Monorepo, CI, lint, test harness, README skeleton | `pnpm test` green in CI |
| **M1 — IR + units (wk 1–2)** | `circuit-json`, `units`, JSON Schema | Round-trip tests pass; E24 rounding correct |
| **M2 — Parts + core (wk 2–4)** | Part library (≈25 parts), builder + JSX runtime, net union-find | Blink circuit builds from TSX and from builder API, identical IR |
| **M3 — Renderer (wk 4–5)** | Schematic SVG with net labels | Blink + 3 other circuits render readably |
| **M4 — Rules (wk 5–7)** | 10+ rules, diagnostics with numbers/suggestions | Negative-test suite passes |
| **M5 — Arduino front-end (wk 7–9)** | Parser, facts, resolver, inference rules, recipes, annotations | 20 corpus sketches produce correct circuits |
| **M6 — Outputs + CLI (wk 9–10)** | Wiring table, BOM, KiCad netlist, CLI | Netlist opens in KiCad; wiring table verified on breadboard |
| **M7 — Playground (wk 10–12)** | Web UI, shareable links, confirmation UI | Public demo URL |
| **M8 — Polish** | Docs site, demo video, comparison notes, 3 real builds documented | README ready to send to companies |

Post-v1: more boards (Nano, Mega, ESP32, RP2040 with 3.3 V rules), wire routing, PCB footprints/placement/autorouter,
standalone ATmega328P output (Level B), `.ato` export, SPICE-lite checks, reverse check (circuit → sketch pin consistency).

---

## 17. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Wrong electrical data in the part library | `verified` flag + datasheet URL per part; CI lint fails on unverified parts used in rules; cite sources |
| Over-promising “any sketch” | Documented limits, confidence scores, Unresolved list, confirmation UI |
| Scope explosion | Uno-only v1, net-label schematics, no PCB in v1 |
| Parser edge cases | Tolerant parsing, fuzz tests, never throw on user input |
| False positives in ERC annoy users | Severity levels, per-rule disable via annotations, track FP rate |
| Time | M0–M5 alone is already a credible portfolio project; later milestones are additive |

---

## 18. References to consult (verify current versions/links)

- ATmega328P datasheet (I/O current limits, reference circuit for Level B) and the Arduino Uno R3 schematic/pinout.
- Datasheets: SG90 servo, HC-SR04, DHT11/DHT22, HD44780, WS2812B, MPU6050, chosen relay/transistor parts.
- I2C specification summary for pull-up sizing; E-series standard values.
- KiCad documentation for the netlist file format.
- tscircuit docs and blog (architecture ideas), atopile docs (package model and validation ideas).
- tree-sitter and the tree-sitter C++ grammar documentation.

---

## Appendix A — Worked example

Sketch:
```cpp
const int LED_PIN = 9;
const int BTN_PIN = 2;
void setup() { pinMode(LED_PIN, OUTPUT); pinMode(BTN_PIN, INPUT_PULLUP); }
void loop()  { analogWrite(LED_PIN, digitalRead(BTN_PIN) ? 40 : 255); }
```
Pipeline result:
- Facts: `PinMode(9,OUTPUT)`, `PinMode(2,INPUT_PULLUP)`, `analogWrite(9)`, `digitalRead(2)`.
- Resolved names: `D9 ← LED_PIN`, `D2 ← BTN_PIN`. D9 is PWM-capable ✔.
- Inference: LED on D9 (0.9, evidence: name `LED_PIN`, OUTPUT, PWM); Button on D2 to GND (0.9, evidence: INPUT_PULLUP + digitalRead).
- Synthesis: `R1 = 330 Ω` (D9 → R1 → D1 anode, D1 cathode → GND); `SW1` between D2 and GND.
- ERC: LED current ≈ 9 mA ✔; no floating inputs ✔; 0 errors.
- Wiring table: `D9 → 330 Ω → LED long leg`, `LED short leg → GND`, `D2 → button → GND`.

## Appendix B — Coding conventions

- Small pure functions; no classes unless needed; no default exports in packages.
- Public API of each package exported from a single `index.ts`; everything else internal.
- Errors: typed error classes with `code`, `message`, and `hint`; never throw strings.
- Never hard-code a magic electrical value inline — put it in the part library or a named constant with a datasheet comment.
- Every rule and recipe has a docs entry (`docs/rules/<id>.md`) with rationale and an example.
