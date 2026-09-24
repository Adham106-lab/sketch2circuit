# sketch2circuit — Video Walkthrough & Interactive Demo Script

> **Doc §16 Deliverable**: Complete script, screen-action guide, and timeline walkthrough for a 3-minute video presentation and interactive product tour of `sketch2circuit`.

---

## Video Metadata & Overview
- **Title**: *sketch2circuit: Compiling Code into Working Circuits with Electrical Rules Checking*
- **Target Duration**: 3 minutes, 15 seconds (195 seconds)
- **Target Audience**: Embedded Software Engineers, Hardware Designers, STEM Educators, Engineering Leaders

---

## Timeline & Scene Breakdown

### Scene 1: The Problem — The Hardware/Firmware Disconnect (0:00 – 0:30)
- **Visual**: Split screen. On the left, an Arduino sketch in an IDE; on the right, a desk with a tangle of loose jumper wires, an Arduino Uno, resistors, and breadboards.
- **Voiceover**: 
  > *"Every hardware project starts with firmware, but code alone doesn't wire a breadboard. When you write `pinMode(9, OUTPUT)` or `analogWrite(6, 128)`, how does a developer know what resistor to pick? How do they avoid frying an MCU pin or leaving an I2C bus floating? Traditional tools force you to redraw everything by hand in a schematic capture program. Today, we're introducing `sketch2circuit`—an electronics-as-code toolchain that turns your Arduino sketch into a verified, buildable circuit."*
- **On-Screen Graphic**: An arrow transforming `.ino` $\to$ `Circuit IR` $\to$ `SVG Schematic + Breadboard Wiring Table + KiCad Netlist`.

---

### Scene 2: Interactive Playground & Instant Synthesis (0:30 – 1:15)
- **Visual**: Screen recording of the `sketch2circuit` browser playground.
- **Action**:
  1. User selects the **"Distance Alarm (HC-SR04 + Buzzer)"** preset from the sample dropdown.
  2. The code editor instantly highlights Tree-sitter C++ AST tokens: `trigPin = 7`, `echoPin = 8`, `buzzerPin = 6`, `pulseIn(echoPin, HIGH)`.
  3. The right-hand panel renders a crisp, vector SVG schematic in real time.
- **Voiceover**:
  > *"Here's our browser synthesis studio. As soon as you paste your code, `sketch2circuit` uses an in-browser WebAssembly Tree-sitter C++ parser to extract raw electrical facts. Notice the Evidence & Inference panel: it didn't just guess an LED. It identified `pulseIn` with microsecond timing and recognized the HC-SR04 ultrasonic distance sensor with 85% confidence, and tone modulation on pin 6 for a piezo buzzer."*
- **Highlight**: Hovering over the `HC-SR04` component highlights the evidence card: `pinMode(7, OUTPUT)` and `pulseIn(8, HIGH)`.

---

### Scene 3: Electrical Rules Checking (ERC) in Action (1:15 – 2:00)
- **Visual**: Switch code to a deliberate error: an LED connected directly to pin 13 without a series resistor (`pinMode(13, OUTPUT); digitalWrite(13, HIGH);`).
- **Action**:
  1. The **ERC Rules Engine** immediately flags a high-severity red diagnostic: `erc.led-no-resistor` and `erc.led-current`.
  2. The diagnostic badge opens, showing:
     - Math: *"Calculated current $I = (5.0\text{V} - 2.0\text{V}) / 0\text{ }\Omega \to \infty$. Exceeds LED max 20 mA and Uno pin limit 40 mA."*
     - Suggestion: *"Add series resistor $R_1 = 330\text{ }\Omega$ (E24 standard) for $I_F = 9.1\text{ mA}$."*
- **Voiceover**:
  > *"Most circuit tools are passive drawings. `sketch2circuit` includes a formal Electrical Rules Checking engine. When an LED is driven without current limiting, it doesn't give a generic error—it provides quantitative physics. It calculates the exact forward voltage drop, warns that the pin will draw excessive current, and computes the exact standard E24 resistor value you should purchase."*

---

### Scene 4: Physical Header Ground Resolution & Breadboard Wiring Table (2:00 – 2:40)
- **Visual**: Switch to the **Export & Artifacts** tab.
- **Action**:
  1. Click **Breadboard Wiring Table**. Show the color-coded steps:
     - `Arduino.5V` $\to$ Breadboard Red Rail
     - `Arduino.POWER.GND.1` $\to$ Sensor Ground
     - `Arduino.POWER.GND.2` $\to$ Piezo Ground
     - Graceful overflow to `Breadboard.GND_RAIL` when >3 grounds exist.
  2. Click **Download KiCad Netlist (`.net`)** and open KiCad PCB Editor showing the netlist importing seamlessly.
- **Voiceover**:
  > *"When you're ready to assemble your hardware, `sketch2circuit` generates an unambiguous step-by-step breadboard guide. It even knows the physical realities of the Arduino Uno header—allocating `POWER.GND.1`, `POWER.GND.2`, and `DIGITAL.GND` without collisions, falling back to a dedicated breadboard ground rail when your circuit grows. And for professional fabrication, one click gives you a standard KiCad Version E netlist ready for routing."*

---

### Scene 5: CLI Toolchain & Summary (2:40 – 3:15)
- **Visual**: Terminal terminal demonstration running `s2c compile blink.ino -o circuit.json` and `s2c wiring blink.ino`. Show the clean table output in terminal and how it matches the browser playground.
- **Voiceover**:
  > *"Whether you're working directly in the terminal with the `s2c` CLI or exploring in the web playground, `sketch2circuit` gives you deterministic Circuit IR, BOM, and wiring instructions straight from your code. With zero setup, 100% client-side privacy, and an extensible TypeScript monorepo, `sketch2circuit` bridges the gap between software and hardware. Try it online today or install the `s2c` CLI."*
- **Closing Screen**: GitHub repo link, `pnpm install -g @s2c/cli`, and "Ready for development".
