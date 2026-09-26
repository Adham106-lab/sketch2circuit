/**
 * @license Apache-2.0
 * @s2c/arduino — Sub-steps 6 & 7: Peripheral Inference Engine (Doc §12.4a & §12.6).
 */

import { resolvePin } from "./resolve.js";
import type { InferredPeripheral, PinUse, SketchFacts } from "./types.js";

/**
 * Infers connected peripheral devices from pin usage graph, sketch facts, and annotations.
 */
export function inferPeripherals(
  pinGraph: Map<string, PinUse>,
  facts: SketchFacts,
): {
  peripherals: InferredPeripheral[];
  assumptions: string[];
  unresolved: string[];
} {
  const assumptions: string[] = [];
  const unresolved: string[] = [];
  const claimedPins = new Set<string>();

  const list: InferredPeripheral[] = [];

  // -------------------------------------------------------------
  // Priority 1: User Annotations (@s2c: ...) -> Confidence 1.0
  // -------------------------------------------------------------
  for (const ann of facts.annotations) {
    if (ann.type === "ignore" && ann.pin) {
      claimedPins.add(ann.pin);
      continue;
    }

    if (ann.pin) {
      claimedPins.add(ann.pin);
      list.push({
        id: `${ann.type.toUpperCase()}_${ann.pin}`,
        kind: mapPeripheralKind(ann.type),
        pins: { pin: ann.pin },
        confidence: 1.0,
        evidence: [`User annotation: @s2c: ${ann.raw}`],
        assumptions: [],
        properties: ann.params,
      });
    } else if (ann.type === "i2c") {
      list.push({
        id: `I2C_${(ann.params.device || "DEVICE").toUpperCase()}`,
        kind: "i2c-device",
        pins: { sda: "SDA", scl: "SCL" },
        confidence: 1.0,
        evidence: [`User annotation: @s2c: ${ann.raw}`],
        assumptions: [],
        properties: ann.params,
      });
    }
  }

  // -------------------------------------------------------------
  // Priority 2: Multi-Pin Peripherals (e.g. HC-SR04 Sonar Ranging)
  // pulseIn(echo) paired with digitalWrite(trig)
  // -------------------------------------------------------------
  let trigPinUse: PinUse | null = null;
  let echoPinUse: PinUse | null = null;

  for (const pinUse of pinGraph.values()) {
    if (claimedPins.has(pinUse.pin)) continue;
    const hints = pinUse.nameHints.join(" ").toLowerCase();

    if (pinUse.ops.has("pulseIn") || hints.includes("echo")) {
      echoPinUse = pinUse;
    } else if (pinUse.ops.has("digitalWrite") || pinUse.modes.has("OUTPUT")) {
      if (hints.includes("trig") || !trigPinUse) {
        trigPinUse = pinUse;
      }
    }
  }

  if (trigPinUse && echoPinUse && trigPinUse.pin !== echoPinUse.pin) {
    claimedPins.add(trigPinUse.pin);
    claimedPins.add(echoPinUse.pin);
    list.push({
      id: `HC_SR04_${trigPinUse.pin}_${echoPinUse.pin}`,
      kind: "hc-sr04",
      pins: { trig: trigPinUse.pin, echo: echoPinUse.pin },
      confidence: 0.85,
      evidence: [
        `Matched pulseIn() on ${echoPinUse.pin} paired with ultrasonic trigger pulse on ${trigPinUse.pin}`,
      ],
      assumptions: ["Assumed HC-SR04 standard 4-pin 5V ultrasonic rangefinder module"],
    });
  }

  // -------------------------------------------------------------
  // Priority 3: Library Bindings (Servo, etc.)
  // -------------------------------------------------------------
  // Check for Servo attach(p)
  for (const call of facts.calls) {
    if (call.name === "attach" && call.target) {
      const pinArg = call.args[0];
      const resolved = resolvePin(pinArg, facts);
      const pinId = resolved
        ? resolved.pinId
        : typeof pinArg === "number"
          ? `D${pinArg}`
          : String(pinArg).toUpperCase();
      const canonicalPinId = pinId.startsWith("D") || pinId.startsWith("A") ? pinId : `D${pinId}`;

      if (!claimedPins.has(canonicalPinId)) {
        claimedPins.add(canonicalPinId);
        list.push({
          id: `SERVO_${call.target.toUpperCase()}_${canonicalPinId}`,
          kind: "servo",
          pins: { pin: canonicalPinId },
          confidence: 0.95,
          evidence: [
            `#include <Servo.h> and ${call.target}.attach(${pinArg}) invocation on pin ${canonicalPinId}`,
          ],
          assumptions: ["Assumed standard TowerPro SG90 9g positional servo motor"],
          properties: { stallCurrentA: 0.65 },
        });
      }
    }
  }

  // Check for I2C bus usage (Wire.begin() or #include <Wire.h>)
  if (facts.wireEnabled || facts.includes.some((inc) => /Wire\.h/i.test(inc))) {
    list.push({
      id: "I2C_BUS_DEVICE",
      kind: "i2c-device",
      pins: { sda: "SDA", scl: "SCL" },
      confidence: 0.85,
      evidence: [
        facts.wireEnabled
          ? "Wire.begin() invocation enabling hardware I2C bus"
          : "#include <Wire.h> included for I2C communication",
      ],
      assumptions: ["Assumed 5V I2C peripheral breakout module with 4.7kΩ bus pull-up resistors"],
    });
  }

  // -------------------------------------------------------------
  // Priority 4: Single-Pin Peripherals
  // -------------------------------------------------------------
  for (const pinUse of pinGraph.values()) {
    if (claimedPins.has(pinUse.pin)) continue;

    const hints = pinUse.nameHints.join(" ").toLowerCase();

    // 1. Piezo Buzzer / Speaker: tone(), noTone(), or buzzer/piezo name hint with PWM/digital output
    if (
      pinUse.ops.has("tone") ||
      (/buzzer|piezo|sound|beep|speaker/i.test(hints) &&
        (pinUse.ops.has("analogWrite") ||
          pinUse.modes.has("OUTPUT") ||
          pinUse.ops.has("digitalWrite")))
    ) {
      claimedPins.add(pinUse.pin);
      list.push({
        id: `BUZZER_${pinUse.pin}`,
        kind: "piezo",
        pins: { pin: pinUse.pin },
        confidence: pinUse.ops.has("tone") ? 0.85 : 0.8,
        evidence: [
          pinUse.ops.has("tone")
            ? `tone()/noTone() frequency generator on pin ${pinUse.pin}`
            : `Buzzer/piezo output with identifier '${hints}' on pin ${pinUse.pin}`,
        ],
        assumptions: ["Assumed passive piezo transducer with 100Ω current limiting resistor"],
      });
      continue;
    }

    // 2. Relay Module: name hint /relay/i with digital output
    if (/relay/i.test(hints) && (pinUse.modes.has("OUTPUT") || pinUse.ops.has("digitalWrite"))) {
      claimedPins.add(pinUse.pin);
      list.push({
        id: `RELAY_${pinUse.pin}`,
        kind: "relay",
        pins: { pin: pinUse.pin },
        confidence: 0.8,
        evidence: [`Digital output on pin ${pinUse.pin} with identifier '${hints}'`],
        assumptions: ["Assumed 5V isolated relay module with onboard optocoupler & flyback diode"],
      });
      continue;
    }

    // 2b. Bare DC Motor / Inductive Actuator: analogWrite or digital output with motor/pump/fan hint
    if (
      (pinUse.ops.has("analogWrite") ||
        pinUse.modes.has("OUTPUT") ||
        pinUse.ops.has("digitalWrite")) &&
      /motor|pump|fan/i.test(hints)
    ) {
      claimedPins.add(pinUse.pin);
      list.push({
        id: `MOTOR_${pinUse.pin}`,
        kind: "generic",
        pins: { pin: pinUse.pin },
        confidence: 0.85,
        evidence: [
          `PWM analogWrite() or digital output driving motor on pin ${pinUse.pin} with identifier '${hints}'`,
        ],
        assumptions: [
          `WARNING: Direct GPIO drive for DC motor detected on ${pinUse.pin}. DC motors draw 100mA–1A+ (exceeding ATmega328P 40mA absolute max) and produce inductive back-EMF spikes (V = -L * di/dt) that destroy microcontroller I/O pins. A switching transistor/MOSFET driver (e.g. 2N2222/TIP120) and antiparallel flyback clamp diode (1N4007) are required.`,
        ],
        properties: { isBareMotor: true },
      });
      continue;
    }

    // 3. Potentiometer / Analog Sensor: analogRead
    if (pinUse.ops.has("analogRead")) {
      claimedPins.add(pinUse.pin);
      const isLdr = /ldr|light|photo|cds/i.test(hints);
      const isTemp = /temp|therm|ntc|lm35|tmp36/i.test(hints);
      const isPotHint = /pot|knob|dial|volume|wiper|slider/i.test(hints);

      if (isLdr) {
        list.push({
          id: `LDR_${pinUse.pin}`,
          kind: "photoresistor",
          pins: { pin: pinUse.pin },
          confidence: 0.8,
          evidence: [`analogRead() ADC with LDR light sensor identifier hint '${hints}'`],
          assumptions: ["Assumed photoresistor with 10kΩ pull-up/down voltage divider"],
          properties: { sensorType: "ldr", subtype: "photoresistor" },
        });
      } else if (isTemp) {
        list.push({
          id: `TEMP_${pinUse.pin}`,
          kind: "generic",
          pins: { pin: pinUse.pin },
          confidence: 0.6,
          evidence: [`analogRead() ADC with temperature sensor identifier hint '${hints}'`],
          assumptions: [
            "Assumed 10kΩ NTC thermistor divider or analog temperature sensor (LM35/TMP36)",
          ],
        });
      } else {
        list.push({
          id: `POT_${pinUse.pin}`,
          kind: "potentiometer",
          pins: { wiper: pinUse.pin },
          confidence: isPotHint ? 0.85 : 0.4,
          evidence: [`analogRead() ADC voltage sampling on analog pin ${pinUse.pin}`],
          assumptions: [
            isPotHint
              ? "Assumed 10kΩ linear rotary potentiometer voltage divider"
              : "Defaulted to 10kΩ potentiometer / generic 0-5V analog sensor",
          ],
          properties: { resistanceOhms: 10000 },
        });
      }
      continue;
    }

    // 4. Pushbutton: INPUT_PULLUP (no external resistor needed)
    if (pinUse.modes.has("INPUT_PULLUP")) {
      claimedPins.add(pinUse.pin);
      list.push({
        id: `BTN_${pinUse.pin}`,
        kind: "button",
        pins: { pin: pinUse.pin },
        confidence: 0.9,
        evidence: [
          `pinMode(${pinUse.pin}, INPUT_PULLUP) internal pull-up enabled for active-low button`,
        ],
        assumptions: [
          "Assumed momentary tactile pushbutton directly to GND using internal microcontroller pull-up resistor",
        ],
        properties: { internalPullup: true },
      });
      continue;
    }

    // 5. Pushbutton: INPUT + digitalRead
    if (
      pinUse.modes.has("INPUT") &&
      (pinUse.ops.has("digitalRead") || /button|btn|switch|sw/i.test(hints))
    ) {
      claimedPins.add(pinUse.pin);
      list.push({
        id: `BTN_${pinUse.pin}`,
        kind: "button",
        pins: { pin: pinUse.pin },
        confidence: 0.7,
        evidence: [
          `pinMode(${pinUse.pin}, INPUT) with digitalRead() sampling on pin ${pinUse.pin}`,
        ],
        assumptions: [
          "Assumed momentary tactile pushbutton with external 10kΩ pull-down resistor to GND",
        ],
        properties: { internalPullup: false, pullDownOhms: 10000 },
      });
      continue;
    }

    // 6. LED (PWM dimmed): analogWrite on LED pin
    if (pinUse.ops.has("analogWrite")) {
      claimedPins.add(pinUse.pin);
      const isLedHint = /led|light|fade|bright/i.test(hints);
      list.push({
        id: `LED_${pinUse.pin}`,
        kind: "led",
        pins: { pin: pinUse.pin },
        confidence: isLedHint ? 0.85 : 0.6,
        evidence: [`PWM analogWrite() pulse output on pin ${pinUse.pin}`],
        assumptions: ["Assumed PWM dimmed LED with series current-limiting resistor"],
        properties: { isPwm: true, color: "Red" },
      });
      continue;
    }

    // 7. LED: OUTPUT + digitalWrite
    if (pinUse.modes.has("OUTPUT") || pinUse.ops.has("digitalWrite")) {
      claimedPins.add(pinUse.pin);
      const isLedHint = /led|lamp|light/i.test(hints);
      list.push({
        id: `LED_${pinUse.pin}`,
        kind: "led",
        pins: { pin: pinUse.pin },
        confidence: isLedHint ? 0.9 : 0.55,
        evidence: [
          `Digital output with digitalWrite() toggling on pin ${pinUse.pin}${
            isLedHint ? ` (identifier hint '${hints}')` : ""
          }`,
        ],
        assumptions: isLedHint
          ? ["Assumed standard 5mm indicator LED with series resistor calculated for 5V"]
          : ["Defaulted digital output to LED with series current-limiting resistor"],
        properties: { color: "Red" },
      });
      continue;
    }

    unresolved.push(`Pin ${pinUse.pin} was referenced in sketch but usage could not be inferred`);
  }

  return {
    peripherals: list,
    assumptions,
    unresolved,
  };
}

function mapPeripheralKind(type: string): InferredPeripheral["kind"] {
  const lower = type.toLowerCase();
  if (lower === "led") return "led";
  if (lower === "button" || lower === "btn" || lower === "switch") return "button";
  if (lower === "servo") return "servo";
  if (lower === "piezo" || lower === "buzzer") return "piezo";
  if (lower.includes("sonar") || lower.includes("sr04")) return "hc-sr04";
  if (lower === "pot" || lower === "potentiometer") return "potentiometer";
  if (lower === "relay") return "relay";
  if (lower === "ldr" || lower === "photoresistor") return "photoresistor";
  if (lower === "motor" || lower.includes("motor")) return "motor";
  if (lower.includes("i2c")) return "i2c-device";
  return "generic";
}
