import { describe, expect, it } from "vitest";
import {
  ARDUINO_SYNTH_VERSION,
  buildPinUsageGraph,
  extractFacts,
  extractFactsWithTreeSitter,
  preprocessSketch,
  resolvePin,
  synthesizeSketch,
} from "../src/index.js";

describe("@s2c/arduino Sketch Synthesizer Pipeline (Doc §12)", () => {
  it("exports package version constant", () => {
    expect(ARDUINO_SYNTH_VERSION).toBe("0.1.0");
  });

  // -------------------------------------------------------------
  // Sub-step 1: Preprocessor & Annotations
  // -------------------------------------------------------------
  describe("Sub-step 1: Preprocessor", () => {
    it("extracts #include directives, #define macros, and @s2c annotations", () => {
      const code = `
        #include <Servo.h>
        #include "Wire.h"
        #define STATUS_PIN 13
        #define MAX_VAL 100
        // @s2c: led(color=blue) on D9
        // Ordinary comment about circuit
        const int sensor = A0; // @s2c: ldr on A0
      `;

      const pre = preprocessSketch(code);
      expect(pre.includes).toContain("Servo.h");
      expect(pre.includes).toContain("Wire.h");
      expect(pre.defines.get("STATUS_PIN")).toBe(13);
      expect(pre.defines.get("MAX_VAL")).toBe(100);

      expect(pre.annotations).toHaveLength(2);
      expect(pre.annotations[0].type).toBe("led");
      expect(pre.annotations[0].params.color).toBe("blue");
      expect(pre.annotations[0].pin).toBe("D9");
      expect(pre.annotations[1].type).toBe("ldr");
      expect(pre.annotations[1].pin).toBe("A0");
    });
  });

  // -------------------------------------------------------------
  // Sub-step 2: Tree-sitter C++ AST Fact Extraction
  // -------------------------------------------------------------
  describe("Sub-step 2: Tree-sitter AST Fact Extraction", () => {
    it("walks real Tree-sitter AST nodes to extract constructors, calls, and source ranges", async () => {
      const code = `
        #include <LiquidCrystal.h>
        LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
        void setup() {
          pinMode(13, OUTPUT);
          Serial.begin(9600);
        }
      `;

      const facts = await extractFactsWithTreeSitter(code);
      expect(facts.constructors).toHaveLength(1);
      expect(facts.constructors[0].className).toBe("LiquidCrystal");
      expect(facts.constructors[0].instanceName).toBe("lcd");
      expect(facts.constructors[0].args).toEqual([12, 11, 5, 4, 3, 2]);
      expect(facts.constructors[0].range.startLine).toBeGreaterThan(0);

      const pinModeCall = facts.calls.find((c) => c.name === "pinMode");
      expect(pinModeCall).toBeDefined();
      expect(pinModeCall?.args).toEqual([13, "OUTPUT"]);

      const serialCall = facts.calls.find((c) => c.name === "Serial.begin");
      expect(serialCall).toBeDefined();
      expect(serialCall?.args).toEqual([9600]);
    });
  });

  // -------------------------------------------------------------
  // Sub-steps 3, 4: Fact Extraction & Constant Resolution
  // -------------------------------------------------------------
  describe("Sub-steps 3–4: Constant Resolution & Pin Graph", () => {
    it("extracts and resolves pinMode, digitalWrite, and constant aliases", () => {
      const code = `
        const int ledPin = 13;
        #define BUTTON_PIN 2
        void setup() {
          pinMode(ledPin, OUTPUT);
          pinMode(BUTTON_PIN, INPUT_PULLUP);
        }
        void loop() {
          digitalWrite(ledPin, HIGH);
          int state = digitalRead(BUTTON_PIN);
        }
      `;

      const facts = extractFacts(code);
      expect(facts.constants.get("ledPin")).toBe(13);
      expect(facts.defines.get("BUTTON_PIN")).toBe(2);

      const resolvedLed = resolvePin("ledPin", facts);
      expect(resolvedLed?.pinId).toBe("D13");
      expect(resolvedLed?.pinNumber).toBe(13);

      const resolvedBtn = resolvePin("BUTTON_PIN", facts);
      expect(resolvedBtn?.pinId).toBe("D2");
      expect(resolvedBtn?.pinNumber).toBe(2);

      const graph = buildPinUsageGraph(facts);
      const d13Use = graph.get("D13");
      expect(d13Use).toBeDefined();
      expect(d13Use?.modes.has("OUTPUT")).toBe(true);
      expect(d13Use?.ops.has("digitalWrite")).toBe(true);

      const d2Use = graph.get("D2");
      expect(d2Use).toBeDefined();
      expect(d2Use?.modes.has("INPUT_PULLUP")).toBe(true);
      expect(d2Use?.ops.has("digitalRead")).toBe(true);
    });

    it("resolves analog pins and LED_BUILTIN", () => {
      const code = `
        void setup() {
          pinMode(LED_BUILTIN, OUTPUT);
        }
        void loop() {
          int val = analogRead(A0);
        }
      `;
      const facts = extractFacts(code);
      const graph = buildPinUsageGraph(facts);

      expect(graph.get("D13")?.modes.has("OUTPUT")).toBe(true);
      expect(graph.get("A0")?.ops.has("analogRead")).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Runtime-computed Pin & Unresolved Reporting (Doc §12.3 & §12.8)
  // -------------------------------------------------------------
  describe("Sub-step 5: Runtime-computed Pins (Doc §12.3 & §12.8)", () => {
    it("reports runtime-computed pin expression as Unresolved and refuses to guess", () => {
      const dynamicLoopSketch = `
        void setup() {
          for (int i = 0; i < 4; i++) {
            pinMode(pins[i], OUTPUT);
          }
        }
      `;

      const result = synthesizeSketch(dynamicLoopSketch);

      // Verify unresolved item is reported
      expect(result.unresolved.length).toBeGreaterThan(0);
      expect(result.unresolved[0]).toContain("pins[i]");
      expect(result.unresolved[0]).toContain("cannot be resolved statically");

      expect(result.unresolvedItems).toHaveLength(1);
      expect(result.unresolvedItems[0].expression).toBe("pins[i]");

      // Must NOT guess a phantom peripheral
      expect(result.peripherals).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Determinism Test (Doc §12.5)
  // -------------------------------------------------------------
  describe("Determinism (Doc §12.5)", () => {
    it("produces byte-identical Circuit IR across multiple synthesis runs of the same sketch", () => {
      const sketch = `
        const int redLed = 13;
        const int greenLed = 12;
        const int btn = 2;
        void setup() {
          pinMode(redLed, OUTPUT);
          pinMode(greenLed, OUTPUT);
          pinMode(btn, INPUT_PULLUP);
        }
        void loop() {
          digitalWrite(redLed, HIGH);
          digitalWrite(greenLed, LOW);
          int state = digitalRead(btn);
        }
      `;

      const run1 = synthesizeSketch(sketch, { timestamp: "2026-01-01T00:00:00.000Z" });
      const run2 = synthesizeSketch(sketch, { timestamp: "2026-01-01T00:00:00.000Z" });

      const json1 = JSON.stringify(run1.circuit);
      const json2 = JSON.stringify(run2.circuit);

      expect(json1).toBe(json2);
      expect(Buffer.from(json1).equals(Buffer.from(json2))).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Confidence Table Verification (Doc §12.4a)
  // -------------------------------------------------------------
  describe("Inference Knowledge Base Confidence Values (Doc §12.4a)", () => {
    it("emits confidence values strictly conforming to Doc §12.4a specification", () => {
      // 1. LED with name hint -> 0.90
      const ledWithName = synthesizeSketch(`
        const int statusLed = 13;
        void setup() { pinMode(statusLed, OUTPUT); }
        void loop() { digitalWrite(statusLed, HIGH); }
      `);
      expect(ledWithName.peripherals[0].confidence).toBe(0.9);

      // 2. LED without name hint -> 0.55
      const ledNoHint = synthesizeSketch(`
        void setup() { pinMode(13, OUTPUT); }
        void loop() { digitalWrite(13, HIGH); }
      `);
      expect(ledNoHint.peripherals[0].confidence).toBe(0.55);

      // 3. PWM LED -> 0.85
      const pwmVal = synthesizeSketch(`
        const int ledFade = 9;
        void loop() { analogWrite(ledFade, 128); }
      `);
      expect(pwmVal.peripherals[0].confidence).toBe(0.85);

      // 4. Button INPUT_PULLUP -> 0.90
      const btnPullup = synthesizeSketch(`
        void setup() { pinMode(2, INPUT_PULLUP); }
        void loop() { int x = digitalRead(2); }
      `);
      expect(btnPullup.peripherals[0].confidence).toBe(0.9);

      // 5. Button INPUT -> 0.70
      const btnInput = synthesizeSketch(`
        void setup() { pinMode(2, INPUT); }
        void loop() { int x = digitalRead(2); }
      `);
      expect(btnInput.peripherals[0].confidence).toBe(0.7);

      // 6. Servo -> 0.95
      const servoVal = synthesizeSketch(`
        #include <Servo.h>
        Servo s;
        void setup() { s.attach(9); }
      `);
      expect(servoVal.peripherals[0].confidence).toBe(0.95);

      // 7. Piezo tone -> 0.85
      const piezoTone = synthesizeSketch(`
        void loop() { tone(8, 440); }
      `);
      expect(piezoTone.peripherals[0].confidence).toBe(0.85);

      // 8. Piezo PWM -> 0.80
      const piezoPwm = synthesizeSketch(`
        const int buzzerPin = 9;
        void loop() { analogWrite(buzzerPin, 120); }
      `);
      expect(piezoPwm.peripherals[0].confidence).toBe(0.8);

      // 9. HC-SR04 -> 0.85
      const sonarVal = synthesizeSketch(`
        void setup() { pinMode(11, OUTPUT); pinMode(12, INPUT); }
        void loop() { digitalWrite(11, HIGH); pulseIn(12, HIGH); }
      `);
      expect(sonarVal.peripherals[0].confidence).toBe(0.85);

      // 10. Potentiometer by name -> 0.85
      const potVal = synthesizeSketch(`
        const int potPin = A0;
        void loop() { int val = analogRead(potPin); }
      `);
      expect(potVal.peripherals[0].confidence).toBe(0.85);

      // 11. LDR by name -> 0.80
      const ldrVal = synthesizeSketch(`
        const int ldrSensor = A1;
        void loop() { int val = analogRead(ldrSensor); }
      `);
      expect(ldrVal.peripherals[0].confidence).toBe(0.8);

      // 12. Thermistor / Temp by name -> 0.60
      const tempVal = synthesizeSketch(`
        const int tempSensor = A2;
        void loop() { int val = analogRead(tempSensor); }
      `);
      expect(tempVal.peripherals[0].confidence).toBe(0.6);

      // 13. Generic analog without hint -> 0.40
      const genericAnalog = synthesizeSketch(`
        void loop() { int val = analogRead(A3); }
      `);
      expect(genericAnalog.peripherals[0].confidence).toBe(0.4);

      // 14. User annotation -> 1.00
      const userAnn = synthesizeSketch(`
        const int p = 7; // @s2c: led on D7
      `);
      expect(userAnn.peripherals[0].confidence).toBe(1.0);
    });
  });

  // -------------------------------------------------------------
  // Corpus Fixture 1: Blink
  // -------------------------------------------------------------
  describe("Corpus Fixture 1: Blink", () => {
    it("synthesizes Blink sketch into LED + 330Ω E24 resistor circuit passing ERC", () => {
      const blinkSketch = `
        const int ledPin = 13;
        void setup() {
          pinMode(ledPin, OUTPUT);
        }
        void loop() {
          digitalWrite(ledPin, HIGH);
          delay(1000);
          digitalWrite(ledPin, LOW);
          delay(1000);
        }
      `;

      const result = synthesizeSketch(blinkSketch);
      expect(result.peripherals).toHaveLength(1);
      const p = result.peripherals[0];
      expect(p.kind).toBe("led");
      expect(p.pins.pin).toBe("D13");
      expect(p.confidence).toBe(0.9);

      const compIds = result.circuit.components.map((c) => c.id);
      expect(compIds).toContain("U1");
      expect(compIds).toContain("D1");
      expect(compIds).toContain("R1");
      expect(compIds).toContain("C_DECOUPLING");

      const resistor = result.circuit.components.find((c) => c.id === "R1");
      expect(["300Ω", "330Ω"]).toContain(resistor?.value);

      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Corpus Fixture 2: Button
  // -------------------------------------------------------------
  describe("Corpus Fixture 2: Button", () => {
    it("synthesizes Button sketch with INPUT_PULLUP directly to GND without external resistor", () => {
      const buttonSketch = `
        const int buttonPin = 2;
        const int ledPin = 13;
        void setup() {
          pinMode(buttonPin, INPUT_PULLUP);
          pinMode(ledPin, OUTPUT);
        }
        void loop() {
          int buttonState = digitalRead(buttonPin);
          if (buttonState == LOW) {
            digitalWrite(ledPin, HIGH);
          } else {
            digitalWrite(ledPin, LOW);
          }
        }
      `;

      const result = synthesizeSketch(buttonSketch);
      expect(result.peripherals).toHaveLength(2);

      const btn = result.peripherals.find((p) => p.kind === "button");
      expect(btn).toBeDefined();
      expect(btn?.pins.pin).toBe("D2");
      expect(btn?.confidence).toBe(0.9);

      const netBtnSignal = result.circuit.nets.find(
        (n) => n.portIds.includes("U1.D2") && n.portIds.includes("SW1.1"),
      );
      expect(netBtnSignal).toBeDefined();

      const netBtnGnd = result.circuit.nets.find(
        (n) => n.portIds.includes("SW1.2") && n.portIds.includes("U1.GND"),
      );
      expect(netBtnGnd).toBeDefined();

      const errors = result.diagnostics.filter((d) => d.severity === "error");
      expect(errors).toHaveLength(0);
    });

    it("synthesizes Button with INPUT using external 10kΩ pull-down resistor", () => {
      const buttonSketch = `
        const int buttonPin = 2;
        void setup() {
          pinMode(buttonPin, INPUT);
        }
        void loop() {
          int val = digitalRead(buttonPin);
        }
      `;

      const result = synthesizeSketch(buttonSketch);
      const btn = result.peripherals.find((p) => p.kind === "button");
      expect(btn).toBeDefined();
      expect(btn?.confidence).toBe(0.7);

      const pullDown = result.circuit.components.find((c) => c.id === "R1");
      expect(pullDown?.value).toBe("10kΩ");
    });
  });

  // -------------------------------------------------------------
  // Corpus Fixture 3: Servo Sweep
  // -------------------------------------------------------------
  describe("Corpus Fixture 3: Servo Sweep", () => {
    it("synthesizes Servo sketch with SG90 on PWM pin D9 and triggers erc.servo-power notice", () => {
      const servoSketch = `
        #include <Servo.h>
        Servo myservo;
        void setup() {
          myservo.attach(9);
        }
        void loop() {
          myservo.write(90);
        }
      `;

      const result = synthesizeSketch(servoSketch);
      const servo = result.peripherals.find((p) => p.kind === "servo");
      expect(servo).toBeDefined();
      expect(servo?.pins.pin).toBe("D9");
      expect(servo?.confidence).toBe(0.95);

      const servoComp = result.circuit.components.find((c) => c.id === "SERVO1");
      expect(servoComp).toBeDefined();
      expect(servoComp?.partNumber).toBe("SG90");

      const servoPowerDiag = result.diagnostics.find((d) => d.ruleId === "erc.servo-power");
      expect(servoPowerDiag).toBeDefined();
      expect(servoPowerDiag?.severity).toBe("warning");
    });
  });

  // -------------------------------------------------------------
  // Corpus Fixture 4: HC-SR04 Ultrasonic Distance Sensor
  // -------------------------------------------------------------
  describe("Corpus Fixture 4: HC-SR04", () => {
    it("synthesizes HC-SR04 ultrasonic distance sensor with multi-pin pulseIn/trigger pair", () => {
      const sonarSketch = `
        const int trigPin = 11;
        const int echoPin = 12;
        void setup() {
          pinMode(trigPin, OUTPUT);
          pinMode(echoPin, INPUT);
        }
        void loop() {
          digitalWrite(trigPin, LOW);
          delayMicroseconds(2);
          digitalWrite(trigPin, HIGH);
          delayMicroseconds(10);
          digitalWrite(trigPin, LOW);
          long duration = pulseIn(echoPin, HIGH);
        }
      `;

      const result = synthesizeSketch(sonarSketch);
      const sonar = result.peripherals.find((p) => p.kind === "hc-sr04");
      expect(sonar).toBeDefined();
      expect(sonar?.pins.trig).toBe("D11");
      expect(sonar?.pins.echo).toBe("D12");
      expect(sonar?.confidence).toBe(0.85);

      const sonarComp = result.circuit.components.find((c) => c.id === "SENSOR1");
      expect(sonarComp).toBeDefined();
      expect(sonarComp?.partNumber).toBe("HC-SR04");
    });
  });
});
