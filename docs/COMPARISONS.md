# Electronics-as-Code & EDA Toolchain Comparison

> **Doc §16 Comparison Analysis**: How `sketch2circuit` relates to and differentiates from adjacent tools across the hardware design and simulation ecosystem.

---

## 1. Quick Architectural Comparison Matrix

| Feature / Dimension | `sketch2circuit` (`s2c`) | `tscircuit` | `atopile` | `Fritzing` | `KiCad` | `Wokwi` |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Primary Input** | Arduino C++ Sketch (`.ino`) or TSX | TypeScript / React Components | Python-like (`.ato`) Code | Drag-and-Drop GUI | Schematic Capture GUI | Virtual Circuit Diagram (`diagram.json`) |
| **Inference from Code** | **Yes** (Tree-sitter C++ AST) | No | No | No | No | No |
| **Circuit IR Contract** | **Circuit IR v0.1.0** (Pure JSON) | Circuit JSON | Compiler AST / Graph | XML / FZ | S-Expressions (`.kicad_sch`) | Custom JSON |
| **Electrical Rules Check (ERC)** | **Yes** (18+ quantitative physical checks with formulas & suggestions) | Basic DRC/Connectivity | Compiler Type / Value Constraints | Very basic / None | Basic ERC (pin types) | None (Runtime simulation only) |
| **Schematic Generation** | **Deterministic SVG** (Net-label architecture) | SVG / Canvas with wire routing | KiCad export | Schematic view | Native vector rendering | 2D breadboard art |
| **KiCad Netlist Export** | **Yes** (Version "E" S-expr) | No | Yes | No | Native | No |
| **Breadboard Wiring Table** | **Step-by-step table** with physical pin allocation | No | No | Breadboard view (graphical) | No | Visual breadboard |
| **Simulation Capability** | Static analysis (no SPICE in v1) | SPICE in development | Planned | None | ngspice built-in | Full AVR / ESP32 runtime emulator |
| **Target Audience** | Arduino developers, students, educators, hardware prototypers | Web engineers building PCBs in code | Hardware engineers designing modular boards | Beginners & hobbyists | Professional EE engineers | Firmware developers testing code |
| **License** | **Apache-2.0** | MIT | Apache-2.0 | Proprietary (GPL app, paid download) | GPLv3+ | Proprietary / Web service |

---

## 2. In-Depth Comparative Breakdowns

### 2.1 sketch2circuit vs. tscircuit
- **Shared Philosophy**: Both tools embrace the concept that electronic designs can be expressed as software artifacts, compiled to a structured JSON Intermediate Representation (IR), and rendered across modern browser and CLI environments.
- **The Core Difference**:
  - `tscircuit` requires you to **write the circuit first** using TypeScript and React components (`<resistor ... />`, `<chip ... />`), focusing on automatic PCB layout, autorouting, and manufacturing exports.
  - `sketch2circuit` addresses the reverse problem: you **already wrote firmware** (`blink.ino`, `motor_control.ino`), and `s2c` extracts the evidence of the hardware from the software AST, applies electrical engineering domain recipes (like selecting E24 standard resistors for LEDs or allocating physical MCU header pins), and checks the circuit against physical laws.

### 2.2 sketch2circuit vs. atopile
- **Shared Philosophy**: Both treat electronics as code with strict compilation guarantees, modular packages, and reproducible builds.
- **The Core Difference**:
  - `atopile` is an ambitious, full-featured language and compiler for hardware engineers replacing schematics with reusable code modules (e.g. `import PowerSupply from "regulators.ato"`).
  - `s2c` is an **intent-inference bridge** specifically tuned for physical computing and microcontrollers. Rather than forcing a beginner or educator to learn a new hardware description language, it infers the circuit directly from their familiar Arduino code while emitting clean KiCad netlists that can be imported directly into traditional EDA tools.

### 2.3 sketch2circuit vs. Fritzing
- **Why People Used Fritzing**: Fritzing popularized the breadboard view—showing beginners which wire goes into which row of a physical breadboard.
- **Why Fritzing Falls Short**:
  - Purely manual: Fritzing requires drag-and-dropping every component and wire by hand.
  - Zero electrical intelligence: Fritzing happily allows you to connect an LED directly between 5V and GND with 0 Ω resistance; it will not warn you that the LED will burn out.
  - Proprietary paywall and brittle XML file format.
- **How `s2c` Improves**:
  - `s2c` automatically computes the exact breadboard rows, wire colors, and component pinout tables directly from code.
  - `s2c` includes a comprehensive Electrical Rules Checking (ERC) engine that validates operating currents ($I_F$), voltage dividers, and pull-up requirements with quantitative formulas.

### 2.4 sketch2circuit vs. KiCad
- **Complementary, Not Competitive**: `s2c` is not a replacement for KiCad; it is a **feeder** into KiCad.
- When an engineer prototypes an Arduino sketch, `s2c` compiles the sketch into Circuit IR and exports a standard KiCad Version "E" S-expression netlist (`.net`). An engineer can open KiCad Schematic or PCB Editor, load the netlist, and immediately proceed to layout traces and fabricate PCBs without manually typing net names or cross-checking pin numbers against code comments.

### 2.5 sketch2circuit vs. Wokwi
- **Dynamic Simulation vs. Static Synthesis**:
  - `Wokwi` is an in-browser microcontroller and peripheral emulator. To use Wokwi, you must manually construct a `diagram.json` describing every wire and part before the simulator can execute your C++ binary.
  - `s2c` does the opposite: it performs **static analysis** on your C++ source without running it. It infers what components you intended to connect, selects real-world component values from commercial catalogs (e.g. E24 resistors, standard breakout modules), and generates the wiring guide before you ever touch a physical breadboard.
