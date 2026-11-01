# sketch2circuit — Comprehensive Technical Handoff & Context Document

> **Confidential & Comprehensive Technical Handoff**  
> **Project:** `sketch2circuit` (`@s2c`)  
> **Repository:** [https://github.com/Adham106-lab/sketch2circuit](https://github.com/Adham106-lab/sketch2circuit)  
> **Version:** 0.1.0 (Milestones M0 through M20 complete)  
> **Target Microcontrollers:** Arduino Uno R3 (ATmega328P), ESP32 DevKit V1 (Xtensa dual-core)

---

## 1. Project Overview & Core Architecture

### 1.1 Mission & Product Goal
`sketch2circuit` is a production-grade, in-browser and CLI TypeScript "Electronics as Code" Electronic Design Automation (EDA) compiler toolchain. Its primary capability is **Arduino C/C++ Sketch & Simulink Embedded Coder Code-to-Circuit Synthesis**:
- Statically analyzes embedded firmware source code via WebAssembly Tree-sitter.
- Extracts syntactic hardware facts (pin configurations, bus protocols, driver calls, `#include` directives).
- Builds an intermediate pin-usage graph and resolves constant variables, mathematical expressions, and array mappings.
- Deterministically infers connected peripheral hardware with confidence scoring and assumption tracking.
- Applies verified electrical engineering synthesis recipes (Ohm's law, standard E24 resistor values, decoupling, flyback protection).
- Enforces an 18-rule Electrical Rules Check (ERC) middle-end.
- Autoplaces footprints and routes 2-layer PCBs via an orthogonal A* grid maze router.
- Renders interactive vector schematics and compiles to downstream EDA formats: KiCad S-expression netlists (`.net`), Wokwi browser simulation (`diagram.json`), Atopile modules (`.ato`), RS-274X Gerbers, and Excellon drill sets.

### 1.2 Technology Stack
- **Monorepo Architecture:** `pnpm` workspaces / Node.js 22+ with `vitest` unit/property test suites and `biome` code style/linting.
- **Frontend Applet:** React 19 SPA running on Vite 8, Tailwind CSS v4, Monaco Editor (`@monaco-editor/react`), and Lucide React icons.
- **WASM Parsing:** `web-tree-sitter` and `tree-sitter-cpp` for zero-server C++ AST parsing in the browser and CLI.
- **Math & Physics Solvers:** `mathjs` expression parsing and custom 4th-order Runge-Kutta (RK4) / Runge-Kutta-Fehlberg (RKF45) numerical ODE integration engines for analog circuit dynamics.
- **Schema & Validation:** `zod` for Circuit IR structural and referential integrity; `@hpcreery/tracespace-parser` for Gerber RS-274X independent round-trip AST validation.
- **PCB Routing & Geometry:** Custom deterministic A* maze router with Lee/Hadlock orthogonal expansion, Euclidean distance transforms, and vector polygon math.
- **Web Analytics:** `@vercel/analytics/react`.

### 1.3 End-to-End Compiler Data Flow

```
                      +---------------------------------------+
                      | Input: Arduino Sketch (.ino / .cpp)   |
                      |   or Simulink Embedded Coder C Code   |
                      +---------------------------------------+
                                          │
                                          ▼
                      +---------------------------------------+
                      | 1. Lexical & Comment Preprocessing    |
                      |    - Extract @s2c annotations         |
                      |    - Inline pin/macro normalization   |
                      +---------------------------------------+
                                          │
                                          ▼
                      +---------------------------------------+
                      | 2. Tree-sitter AST Fact Extraction    |
                      |    - Calls: pinMode, digitalWrite,    |
                      |      analogRead, analogWrite, tone... |
                      |    - Object constructors & includes   |
                      +---------------------------------------+
                                          │
                                          ▼
                      +---------------------------------------+
                      | 3. Constant & Array Index Resolution  |
                      |    - Evaluate const int, #define      |
                      |    - Resolve pin variables & arrays   |
                      +---------------------------------------+
                                          │
                                          ▼
                      +---------------------------------------+
                      | 4. Pin Usage Graph Builder            |
                      |    - Map MCU pins to ops and modes    |
                      |    - Detect dynamic unresolved pins   |
                      +---------------------------------------+
                                          │
                                          ▼
                      +---------------------------------------+
                      | 5. Deterministic Peripheral Inference |
                      |    (Priority: Annotations -> Libs ->  |
                      |     Multi-pin Sonar -> Pin Heuristics)|
                      +---------------------------------------+
                                          │
                                          ▼
                      +---------------------------------------+
                      | 6. Engineering Recipe Application     |
                      |    - Instantiate parts from catalog   |
                      |    - Calculate E24 resistor values    |
                      |    - Add decoupling caps, flyback     |
                      |      diodes, and bulk capacitors      |
                      +---------------------------------------+
                                          │
                                          ▼
                      +---------------------------------------+
                      | 7. Circuit IR Synthesis (@s2c/core)   |
                      |    - Disjoint-Set Union (DSU) nets    |
                      |    - Referential integrity check      |
                      +---------------------------------------+
                                          │
                                          ▼
                      +---------------------------------------+
                      | 8. 18-Rule ERC Validation Engine      |
                      |    (@s2c/rules & @s2c/erc)            |
                      +---------------------------------------+
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            │                             │                             │
            ▼                             ▼                             ▼
+-----------------------+     +-----------------------+     +-----------------------+
| 9a. Schematic Viewer  |     | 9b. PCB Layout & DRC  |     | 9c. Export Bridges    |
| - Orthogonal layout   |     | - Footprint placement |     | - KiCad .net netlist  |
| - Net-label stubs     |     | - 2-layer grid router |     | - Wokwi diagram.json  |
| - SVG visualizer      |     | - Gerber RS-274X      |     | - Atopile .ato module |
| - Title block         |     | - Excellon drill      |     | - BOM & Wiring Table  |
+-----------------------+     +-----------------------+     +-----------------------+
```

### 1.4 Monorepo Package Directory Structure

```
.
├── apps/
│   └── playground/               # Vite + React 19 interactive browser playground IDE
│       └── test/                 # Playground and end-to-end integration tests
├── packages/
│   ├── circuit-json/             # Core Circuit IR v0.1.0 Zod schemas, types, and DSU models
│   ├── core/                     # Fluent programmatic CircuitBuilder & Disjoint-Set Union
│   ├── units/                    # Engineering notation parsing, E-series (E12/E24) rounding
│   ├── parts/                    # Verified hardware part catalog (ATmega328P, HC-SR04, SG90...)
│   ├── rules/                    # 18-rule Electrical Rules Check (ERC) validation engine
│   ├── arduino/                  # Tree-sitter AST extractor, pin graph, and inference engine
│   ├── manifests/                # Declarative board manifests (Uno, ESP32) & template passives
│   ├── erc/                      # Middle-end ERC pass, strapping rules, and auto-injectors
│   ├── layout/                   # Port-aware schematic layout engine & power-rail compressor
│   ├── pcb-json/                 # PCB Layout IR (layers, pads, traces, vias, keepouts, DRC)
│   ├── footprints/               # Physical footprint definitions (SMD/THT, DIP, Uno shield)
│   ├── pcb-layout/               # Autoplacer, 2-layer A* grid maze router & DRC geometry engine
│   ├── render-schematic/         # SVG schematic generator with net-label stub architecture
│   ├── sim-engine/               # RK4 & RKF45 ODE numerical solvers & circuit dynamics presets
│   ├── block-diagram/            # React Flow node-based Simulink/Simscape style block wiring canvas
│   ├── export/                   # BOM aggregator, wiring table, and synthesis report generator
│   ├── export-ato/               # Atopile (.ato) declarative compiler export module
│   ├── export-gerber/            # RS-274X Gerber & Excellon drill file generator with zip archive
│   ├── exporters/                # Universal export bridges (Wokwi diagram.json & KiCad S-expr)
│   └── cli/                      # s2c command-line executable (build, check, sketch, explain)
├── src/                          # Main React UI workbench application components
│   ├── App.tsx                   # Main 10-tab workbench layout & top navigation ribbon
│   └── components/               # Viewers: Schematic, PCB 2D, PCB 3D, Simulink, Sim, BOM, Docs
├── docs/                         # Technical documentation, gap trackers, and integrity logs
└── fixtures/                     # Test corpus Arduino sketches (.ino) and golden verification files
```

---

## 2. Completed Milestones & Core Logic

### 2.1 Complete Milestone Catalog (M0 through M20)

| Milestone | Package / Component | Core Technical Delivery |
|:---|:---|:---|
| **M0–M1** | `@s2c/circuit-json`, `@s2c/units` | Circuit IR v0.1.0, Zod schema validation, Engineering unit parser (e.g., `4.7k` -> `4700`), E12/E24 resistor rounding algorithms. |
| **M2** | `@s2c/core` | Programmatic fluent `CircuitBuilder`, Disjoint-Set Union (DSU) net merging, duplicate ref-des prevention. |
| **M3** | `@s2c/parts` | Verified component catalog with pin capabilities (`GPIO`, `PWM`, `ADC`, `I2C_SDA`, `I2C_SCL`, `SPI_*`, `UART_*`), pin electrical ranges, and package thermal ratings. |
| **M4** | `@s2c/rules` | 18-rule Electrical Rules Check (ERC) engine with quantitative error messages, limit comparisons, and computable suggestions. |
| **M5** | `@s2c/render-schematic` | Deterministic SVG schematic visualizer implementing a net-label-only architecture (no sprawling diagonal wires). |
| **M6** | `@s2c/export` | Bill of Materials (BOM) grouping, CSV/Markdown formatting, point-to-point breadboard wiring table with physical ground pin rotation. |
| **M7** | `@s2c/arduino` | Tree-sitter C++ AST fact extractor, constant propagator, pin usage graph, peripheral inference engine, and synthesis pipeline. |
| **M8** | `apps/playground` | Dual-theme (Oscilloscope Dark / Drafting Sheet Light) React playground, Monaco C++ editor, live ERC diagnostics drawer, assumptions panel. |
| **M9** | `@s2c/cli` | Production CLI `s2c` (`build`, `check`, `sketch`, `export`, `explain`) supporting exit codes `0` (clean), `1` (ERC fail), `2` (unresolved in `--strict`). |
| **M10** | `@s2c/pcb-json`, `@s2c/footprints` | Standard PCB IR schema, physical pad definitions, solder mask/paste expansions, keepout boundaries, and Arduino Uno R3 shield outline polygon. |
| **M11** | `@s2c/pcb-layout` | Deterministic 2-layer orthogonal grid maze router (0.635mm grid) with Lee/Hadlock A* search, via penalty optimization, and automated DRC checking. |
| **M12** | `PcbViewer.tsx` | Interactive 2D vector canvas for PCB layouts featuring copper top/bottom toggle, ratsnest rendering, live DRC violation markers, and layer filters. |
| **M13** | `Pcb3DViewer.tsx` | WebGL Three.js 3D board visualizer featuring realistic FR4 substrate, copper traces, solder mask coloring, drilled vias, and 3D component models. |
| **M14** | MathWorks Simulink Ingestion | Parser support for MATLAB/Simulink Embedded Coder generated C code (`MW_pinMode`, `MW_digitalIO_write`, `MW_analogIn_read`). |
| **M15** | `@s2c/export-ato` | Compiler bridge generating clean, idiomatic Atopile (`.ato`) declarative hardware description modules. |
| **M16** | Corpus Metrics Benchmark | Corpus-wide test harness running 13 canonical Arduino sketches to measure routing completion rates, wirelength, and DRC violations. |
| **M17** | `@s2c/sim-engine` | High-precision numerical ODE simulation engine (RK4 & adaptive RKF45) simulating LDR dividers, pot dividers, RC filters, and servo/motor step responses. |
| **M18** | `@s2c/block-diagram` | Interactive Simulink-style graphical block-diagram editor with continuous signal flow wiring, algebraic loop detection, and oscilloscope wave plotter. |
| **M19** | Architectural Upgrades | Strict bipartite net-centric graph IR, declarative board manifests (Uno, ESP32), template passives auto-injector, port-aware ELK layout, and export bridges. |
| **M20a–c** | `@s2c/export-gerber` | Complete RS-274X Gerber & Excellon drill file exporter (8-file manufacturing archive) verified against `@hpcreery/tracespace-parser`. |

---

### 2.2 Deep-Dive into Core Algorithms & Technical Decisions

#### 1. Union-Find Disjoint Set Net Resolution (`@s2c/core/src/disjoint-set.ts`)
Instead of tracking wire segments individually or maintaining complex adjacency matrices, `CircuitBuilder` utilizes a disjoint-set data structure with path compression and union-by-rank.
- **Sentinel Net Priority:** Explicitly named nets (e.g., `GND`, `5V`, `3V3`, `VCC`) use a sentinel identifier (`__NET__:GND`). When unifying a component port with a named net, the sentinel root always overrides transient port roots:
```ts
const netSentinel = `__NET__:${netId}`;
this.portDsu.makeSet(netSentinel);

for (const portRef of ports) {
  const portId = this.resolvePortId(portRef);
  this.portExplicitNets.set(portId, netId);
  this.portDsu.union(netSentinel, portId, (rootA, rootB) => {
    // Sentinel or named net root always takes priority
    if (rootA.startsWith("__NET__:")) return rootA;
    if (rootB.startsWith("__NET__:")) return rootB;
    return rootA;
  });
}
```
- **Result:** Net unification operates in near-constant time $O(\alpha(N))$, guaranteeing deterministic net consolidation regardless of connection order.

#### 2. Physical Ground Pin Rotation & Allocation (`@s2c/arduino/src/gnd-allocator.ts`)
An authentic Arduino Uno R3 header only provides 3 physical female ground pin locations:
1. `POWER.GND.1` (Power Header JP2, pin 6)
2. `POWER.GND.2` (Power Header JP2, pin 7)
3. `DIGITAL.GND` (Digital Header JP1, pin 4)
- **Algorithm:** The `PhysicalGndAllocator` assigns ground pins sequentially across these 3 physical locations.
- **Overflow Graceful Fallback:** When a circuit connects $\ge 4$ ground loads, the allocator does not crash or double-book headers. It designates `POWER.GND.1` as the primary bridge to the breadboard ground rail and assigns subsequent grounds to `Breadboard.GND_RAIL`, generating explicit wiring instructions in the wiring table.

#### 3. Deterministic 2-Layer A* Grid Maze Router (`@s2c/pcb-layout/src/router.ts`)
- **Grid Representation:** A 3D discrete grid `(gx, gy, layer)` with pitch $0.635\text{ mm}$ (25 mil).
- **Layer Direction Bias:** Layer 0 (Top Copper) prefers horizontal traces; Layer 1 (Bottom Copper) prefers vertical traces. Non-preferred movement incurs a `wrongDirectionPenalty` ($3\times$).
- **Via Cost Penalty:** Layer transitions incur a high heuristic penalty (`viaCostMultiplier = 8`) to minimize parasitic inductance and PCB manufacturing drill count.
- **Priority Queue Determinism:** The priority queue breaks cost ties using a monotonic sequence counter, guaranteeing 100% byte-identical trace generation across compiler runs.

#### 4. The 18-Rule Electrical Rules Check (ERC) Catalog (`@s2c/rules/src/catalog/`)
1. `erc.floating-input`: Detects inputs not connected to any driving source or pull resistor.
2. `erc.unconnected-port`: Identifies mandatory peripheral ports left floating.
3. `erc.power-short`: Identifies low-impedance shorts between power rails (e.g., `5V` to `GND`).
4. `erc.output-contention`: Detects multiple active push-pull outputs driving the same net simultaneously.
5. `erc.led-no-resistor`: Flags LEDs connected directly across digital pins or power rails without current-limiting resistors.
6. `erc.led-current`: Quantitative verification of forward current: calculates $I = (V_{\text{supply}} - V_f) / R$, flagging $I > 20\text{ mA}$ or $I < 1\text{ mA}$.
7. `erc.pin-current`: Sums total current drawn through each GPIO pin against MCU limits (20 mA safe, 40 mA absolute max).
8. `erc.total-current`: Sums total package current across all GPIOs against the ATmega328P limit ($200\text{ mA}$).
9. `erc.i2c-pullups`: Flags open-drain I2C buses (`SDA`/`SCL`) lacking pull-up resistors to $V_{CC}$.
10. `erc.i2c-address-conflict`: Detects multiple I2C slave devices hardcoded to the same 7-bit bus address.
11. `erc.decoupling`: Checks that active ICs have a local $100\text{ nF}$ ceramic decoupling capacitor.
12. `erc.logic-level-mismatch`: Flags direct connections between 5V outputs and 3.3V-only inputs without level shifting.
13. `erc.inductive-load`: Flags coils, relays, and DC motors lacking an anti-parallel flyback clamp diode ($V = -L \frac{di}{dt}$).
14. `erc.servo-power`: Warns when high-torque servo motors are powered directly from MCU board regulators rather than an external power supply.
15. `erc.pwm-capability`: Flags `analogWrite()` or PWM timer operations mapped to non-PWM pins (Uno only supports pins 3, 5, 6, 9, 10, 11).
16. `erc.adc-capability`: Flags `analogRead()` operations mapped to digital-only pins (pins outside A0–A5 / 14–19).
17. `erc.reserved-pin`: Flags user circuits attempting to use pins 0 and 1 while Serial communication (`Serial.begin()`) is active.
18. `erc.power-budget`: Computes total worst-case continuous DC current consumption against the 5V linear regulator budget ($500\text{ mA}$).

---

## 3. Prompt Engineering & AI Pipeline

### 3.1 Why the Compiler Uses a Hybrid "Deterministic-First" AI Architecture
A critical design philosophy of `sketch2circuit` is that **LLMs must never be trusted with electrical calculations**:
- If an LLM hallucinates an LED resistor value as $10\,\Omega$ instead of $330\,\Omega$, real hardware burns out.
- If an LLM hallucinates a pinout, an ATmega328P can suffer output latch-up and silicon destruction.

Therefore, the AI pipeline is structured as a **Semantic Disambiguation & Proposal Engine**:
1. The deterministic engine performs Tree-sitter AST fact extraction and handles all known libraries, pin maps, and Ohm's law calculations.
2. When the sketch contains **ambiguous identifiers**, **unregistered third-party drivers**, or **custom variable-driven state machines**, the AI Pipeline is invoked to analyze semantic context (variable names, comments, call patterns).
3. The LLM output is constrained to a strict, typed JSON schema.
4. All AI proposals are capped at a maximum confidence score of **0.60** and explicitly require user confirmation in the UI before being synthesized into Circuit IR.

### 3.2 Structured Output Schema: `PeripheralGuessSchema`

```ts
import { z } from "zod";

export const PeripheralKindSchema = z.enum([
  "led",
  "button",
  "servo",
  "piezo",
  "hc-sr04",
  "potentiometer",
  "photoresistor",
  "i2c-device",
  "relay",
  "motor",
  "generic",
]);

export const PeripheralProposalSchema = z.object({
  id: z.string().describe("Unique identifier, e.g. 'PROPOSED_OLED_DISPLAY'"),
  kind: PeripheralKindSchema.describe("Standardized peripheral category"),
  pins: z.record(z.string()).describe("Map of peripheral logical pins to MCU pins, e.g. {'sda': 'A4', 'scl': 'A5'}"),
  confidence: z.number().min(0.1).max(0.60).describe("Confidence score (strictly capped at 0.60)"),
  reasoning: z.string().describe("Clear, concise technical justification derived from code comments and identifier naming"),
  evidenceLines: z.array(z.number()).describe("Source code line numbers providing evidence"),
  suggestedProperties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const InferrerResponseSchema = z.object({
  sketchSummary: z.string().describe("1-2 sentence description of what the sketch is designed to do"),
  proposals: z.array(PeripheralProposalSchema).describe("List of inferred peripheral devices"),
  unresolvedRisks: z.array(z.string()).describe("Potential hardware hazards detected (e.g. inductive kickback, over-current)"),
});

export type InferrerResponse = z.infer<typeof InferrerResponseSchema>;
```

### 3.3 Exact System Prompt

```text
You are the Hardware Synthesis Intelligence Engine for sketch2circuit, an electronic design automation (EDA) compiler.
Your task is to analyze Arduino C/C++ firmware source code and infer connected peripheral hardware.

OPERATIONAL PRINCIPLES:
1. EVIDENCE-BASED INFERENCE: Never invent peripherals that have no grounding in the code. Look for:
   - Variable names (e.g., 'valvePin', 'ldrRaw', 'stepperEnable')
   - Library includes (e.g., '#include <TFT.h>', '#include <Adafruit_BMP280.h>')
   - Call sequences (e.g., repeated pulse generation, ADC polling intervals)
   - Inline comments (e.g., '// 10k thermistor connected to divider')
2. REPRODUCIBILITY & HARDWARE SAFETY:
   - DO NOT specify electrical passive values (e.g., resistor ohms, capacitor farads). Electrical values are strictly calculated by the deterministic compiler's physics engine.
   - All proposed confidence scores must be between 0.10 and 0.60. Never claim 1.0 confidence (1.0 is reserved exclusively for explicit AST compiler matches and '@s2c:' user annotations).
3. MCU PIN MATRIX CONSTRAINTS:
   - Arduino Uno R3: Digital pins 0-13, Analog pins A0-A5 (14-19).
   - PWM capability is limited to pins 3, 5, 6, 9, 10, 11.
   - I2C hardware bus is on A4 (SDA) and A5 (SCL).
   - SPI hardware bus is on 11 (MOSI), 12 (MISO), 13 (SCK).
   - Pins 0 and 1 are tied to hardware UART (Serial). Flag collisions if used with sensors.

You must respond ONLY with valid JSON conforming to the InferrerResponse schema. No conversational preamble, no markdown backticks outside of the JSON block.
```

### 3.4 Few-Shot Examples Injected into the Prompt

#### Few-Shot 1: Ambiguous Analog Sensor Disambiguation
**User Input (Source Code):**
```cpp
const int SENSOR_PIN = A2;
int threshold = 400;

void setup() {
  Serial.begin(9600);
}

void loop() {
  int val = analogRead(SENSOR_PIN);
  if (val > threshold) {
    Serial.println("Warning: High ambient illumination detected");
  }
  delay(100);
}
```

**Model Output (JSON):**
```json
{
  "sketchSummary": "Monitors ambient light intensity on analog pin A2 using a photoresistor voltage divider and logs warnings over serial.",
  "proposals": [
    {
      "id": "PROPOSED_LDR_A2",
      "kind": "photoresistor",
      "pins": {
        "pin": "A2"
      },
      "confidence": 0.58,
      "reasoning": "analogRead() on A2 paired with serial message 'High ambient illumination detected' indicates a cadmium-sulfide (CdS) photoresistor/LDR.",
      "evidenceLines": [1, 9, 11],
      "suggestedProperties": {
        "sensorType": "ldr",
        "dividerResistor": "10k"
      }
    }
  ],
  "unresolvedRisks": []
}
```

#### Few-Shot 2: Solenoid Valve Actuator on GPIO with Missing Driver
**User Input (Source Code):**
```cpp
#define WATER_VALVE 8

void setup() {
  pinMode(WATER_VALVE, OUTPUT);
}

void loop() {
  digitalWrite(WATER_VALVE, HIGH);
  delay(5000);
  digitalWrite(WATER_VALVE, LOW);
  delay(10000);
}
```

**Model Output (JSON):**
```json
{
  "sketchSummary": "Controls an automated 12V irrigation water solenoid valve via digital pin 8 with a 5s on / 10s off duty cycle.",
  "proposals": [
    {
      "id": "PROPOSED_SOLENOID_D8",
      "kind": "relay",
      "pins": {
        "pin": "D8"
      },
      "confidence": 0.55,
      "reasoning": "Identifier 'WATER_VALVE' indicates an inductive solenoid valve. Solenoid coils cannot be driven directly by ATmega328P pins due to 20mA limit and back-EMF spikes.",
      "evidenceLines": [1, 4, 8, 10],
      "suggestedProperties": {
        "isInductiveActuator": true,
        "requiresDriverStage": true
      }
    }
  ],
  "unresolvedRisks": [
    "DIRECT GPIO DRIVE HAZARD: A solenoid valve coil draws 200mA-1A and will destroy MCU pin D8 unless an N-channel MOSFET (IRLZ44N) and 1N4007 flyback clamp diode are wired."
  ]
}
```

---

## 4. Current State, Known Bugs & Limitations

### 4.1 Production-Ready (100% Working & Verified)
1. **Tree-sitter AST & Fact Extraction:** 100% test coverage across variables, arrays, `#define`, `pinMode`, `digitalWrite`, `analogRead`, `analogWrite`, `pulseIn`, `tone`, `#include`, and user `@s2c:` annotations.
2. **Circuit IR v0.1.0 & Bipartite Net Graph:** Strict referential integrity enforcement. Components only connect to ports; ports connect strictly through logical nets. Protocol buses (`I2C_BUS`, `SPI_BUS`) group signals with full provenance.
3. **18-Rule ERC Middle-End:** Complete detection of floating pins, shorts, over-currents, LED resistor sizing, open-drain I2C pull-ups, PWM/ADC pin capability violations, and ESP32 strapping pins (`GPIO0`, `GPIO12`) / input-only pins (`GPIO34–39`).
4. **Schematic SVG Renderer:** Clean orthogonal schematic visualizer utilizing net-label stubs for power rails (`VCC_FLAG`, `GND_ARROW`), eliminating visual clutter.
5. **Universal Exporters:**
   - **Wokwi:** Valid `diagram.json` mapping MCU boards, LEDs, buttons, buzzers, potentiometers, and colored connection wires.
   - **KiCad:** Valid KiCad Version "E" S-expression netlist `.net` compatible with KiCad PCB Editor v6/v7/v8.
   - **Atopile:** Production-grade `.ato` modules mapping standard components and wiring.
   - **Gerber & Excellon:** Standard 8-file manufacturing archive (`.gtl`, `.gbl`, `.gts`, `.gbs`, `.gto`, `.gbo`, `.gko`, `.drl`) verified via `@hpcreery/tracespace-parser`.
6. **Numerical Simulation Engine (M17):** Deterministic RK4 and adaptive RKF45 ODE integrators producing oscilloscope step responses for RC filters, voltage dividers, and servo dynamics.

### 4.2 Documented Limitations & Tracked Gaps

#### GAP-01: KiCad Netlist Exporter Golden-File Validation
- **Status:** Functional, but awaiting real KiCad headless binary export in CI.
- **Detail:** Golden KiCad netlist fixture is verified using our custom recursive-descent S-expression AST parser (`parseSExpr`) against the published KiCad format specification.

#### GAP-03: Dense PCB Grid Router Completion Rate (Documented in `docs/KNOWN_GAPS.md`)
- **Observed Behavior:**
  - Simple sketches (Blink, HC-SR04, Piezo, Dynamic Loop) achieve **100% routing completion**.
  - Dense sketches (`user_multi_peripheral.ino` with 29 connections) achieve a **55.2% routing completion rate** (16 routed, 13 unrouted, 15 DRC warnings).
- **Root Cause:**
  - The routing grid uses a coarse $0.635\text{ mm}$ (25 mil) pitch. With $0.254\text{ mm}$ traces and $0.254\text{ mm}$ clearances, tracks cannot pass between adjacent standard $2.54\text{ mm}$ header pins without consuming two grid cells.
  - The current router lacks an iterative **rip-up and reroute** pass; early nets seize corridors that block later nets.
- **Current Mitigation:** The UI honestly displays an unrouted status badge (`16/29 routed (55.2%) · 15 DRC`) and highlights unrouted nets as gold ratsnest flight-lines.

#### Board Architecture Mismatch Heuristics
- The compiler targets the **Arduino Uno R3** by default. When an ESP32 sketch is pasted (e.g., `#include <WiFi.h>` or pin numbers $\ge 20$), the compiler detects the architecture mismatch and displays an upfront warning banner advising the user to select the ESP32 target board.

---

## 5. Pending Tasks & Next Steps (Roadmap)

### 5.1 High-Priority Architectural Tasks

#### 1. Rip-Up & Reroute Engine with Multi-Tier Grid (`packages/pcb-layout`)
- Implement PathFinder-style negotiated congestion routing: allow tracks to temporarily overlap in high-density corridors, then apply exponential cost penalties to negotiate clean separation.
- Implement perpendicular escape stubs from dual-row headers before running global maze routing.
- Support a fine-pitch routing grid ($0.3175\text{ mm}$ / 12.5 mil or $0.254\text{ mm}$ / 10 mil) in congested pin escape zones while retaining $0.635\text{ mm}$ for macro traces.

#### 2. Standalone MCU Circuit Synthesis (Level B Target)
- Currently, the compiler instantiates an Arduino Uno board header (`U1`).
- The Level B synthesizer will replace the board header with a standalone ATmega328P reference circuit:
  - ATmega328P DIP-28 or TQFP-32 IC.
  - 16 MHz quartz crystal with two $22\text{ pF}$ load capacitors.
  - $10\text{ k}\Omega$ reset pull-up resistor and $100\text{ nF}$ DTR auto-reset capacitor.
  - $100\text{ nF}$ ceramic decoupling capacitors across $V_{CC}$ and $AV_{CC}$.
  - $10\,\mu\text{H}$ inductor $LC$ filter for analog $AV_{CC}$.
  - Standard 6-pin ICSP programming header.

#### 3. SPICE Netlist Export (`.cir`) & In-Browser Simulation
- Generate SPICE-compatible netlists (`ngspice` / `ltspice` syntax) for passive RC/RLC networks, diode clamps, and transistor drivers.
- Integrate WebAssembly ngspice to run transient analog simulations directly in the browser.

#### 4. Automated Mechanical 3D Enclosure / STEP Export
- Upgrade the 3D viewer to export raw STEP (`.step`) CAD models or 3D-printable snap-fit enclosure STL files based on board outline boundaries and component clearance heights.

---

## 6. Verification & Test Execution Summary

```bash
# 1. Run all unit and property tests across the workspace:
npx vitest run

# 2. Compile and verify TypeScript across the entire monorepo:
npm run build

# 3. Verify specific critical compiler modules:
npx vitest run packages/circuit-json/test/bipartite-ir.test.ts \
               packages/manifests/test/manifests.test.ts \
               packages/erc/test/erc.test.ts \
               packages/layout/test/layout.test.ts \
               packages/exporters/test/exporters.test.ts \
               packages/export-gerber/test/roundtrip.test.ts \
               apps/playground/test/github-star-button.test.ts
```

All 5 newly upgraded packages, the Gerber parser round-trip validators, and the frontend UI playground components pass with **100% green test assertions**.
