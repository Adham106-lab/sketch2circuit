/**
 * @license Apache-2.0
 * @s2c/arduino — Sub-step 8: Circuit Synthesis Recipes (Doc §12.5).
 */

import type { CircuitBuilder } from "@s2c/core";
import { calculateLedResistor } from "@s2c/units";
import type { InferredPeripheral, SynthesizerOptions } from "../types.js";

/**
 * Applies synthesis recipes to instantiate components and wire nets on the circuit builder.
 */
export function applyRecipes(
  builder: CircuitBuilder,
  peripherals: InferredPeripheral[],
  options: SynthesizerOptions,
): void {
  const boardRef = options.boardRef || "U1";
  let ledCounter = 1;
  let btnCounter = 1;
  let rCounter = 1;
  let potCounter = 1;
  let servoCounter = 1;
  let cServoCounter = 1;
  let sonarCounter = 1;
  let piezoCounter = 1;
  let ldrCounter = 1;
  let sensorCounter = 1;
  let motorCounter = 1;
  let relayCounter = 1;
  let i2cCounter = 1;
  let devCounter = 1;
  let hasAddedI2cPullups = false;

  for (const p of peripherals) {
    switch (p.kind) {
      case "led": {
        const pinId = p.pins.pin;
        const color = (p.properties?.color as string) || options.ledDefaultColor || "Red";
        const ledRef = `D${ledCounter++}`;
        const resRef = `R${rCounter++}`;

        // Calculate series resistor for 5V supply and 2.0V drop at 10mA: 300Ω -> E24 330Ω
        const rec = calculateLedResistor(5.0, 2.0, 0.01);
        const resValue = `${rec.recommendedResistance}Ω`;

        builder
          .addLed(ledRef, color)
          .addResistor(resRef, resValue)
          // Wire: MCU Pin -> Resistor -> LED Anode, LED Cathode -> GND
          .connect(`${boardRef}.${pinId}`, `${resRef}.1`)
          .connect(`${resRef}.2`, `${ledRef}.A`)
          .connectNet("GND", [`${ledRef}.K`, `${boardRef}.GND`]);
        break;
      }

      case "button": {
        const pinId = p.pins.pin;
        const btnRef = `SW${btnCounter++}`;
        builder.addButton(btnRef);

        const isInternalPullup = p.properties?.internalPullup !== false;
        if (isInternalPullup) {
          // INPUT_PULLUP: Pin -> Button terminal 1, Button terminal 2 -> GND
          builder
            .connect(`${boardRef}.${pinId}`, `${btnRef}.1`)
            .connectNet("GND", [`${btnRef}.2`, `${boardRef}.GND`]);
        } else {
          // INPUT with external 10kΩ pull-down:
          // 5V -> Button terminal 1, Button terminal 2 -> Pin & 10k Resistor terminal 1, Resistor terminal 2 -> GND
          const resRef = `R${rCounter++}`;
          builder
            .addResistor(resRef, "10kΩ")
            .connectNet("5V", [`${boardRef}.5V`, `${btnRef}.1`])
            .connect(`${boardRef}.${pinId}`, `${btnRef}.2`, `${resRef}.1`)
            .connectNet("GND", [`${resRef}.2`, `${boardRef}.GND`]);
        }
        break;
      }

      case "servo": {
        const pinId = p.pins.pin;
        const servoRef = `SERVO${servoCounter++}`;
        const bulkCapRef = `C_SERVO${cServoCounter++}`;
        builder
          .addPart("SG90_SERVO", servoRef)
          .connect(`${boardRef}.${pinId}`, `${servoRef}.PWM`)
          .connectNet("5V", [`${boardRef}.5V`, `${servoRef}.VCC`])
          .connectNet("GND", [`${boardRef}.GND`, `${servoRef}.GND`])
          // Doc §12.5: 100–470 µF bulk capacitor across servo power supply terminals
          .addPart("CAPACITOR_ELECTROLYTIC", bulkCapRef, { value: "100µF" })
          .connectNet("5V", [`${boardRef}.5V`, `${bulkCapRef}.+`])
          .connectNet("GND", [`${boardRef}.GND`, `${bulkCapRef}.-`]);
        break;
      }

      case "hc-sr04": {
        const trigPin = p.pins.trig;
        const echoPin = p.pins.echo;
        const sonarRef = `SENSOR${sonarCounter++}`;
        builder
          .addPart("HC_SR04", sonarRef)
          .connect(`${boardRef}.${trigPin}`, `${sonarRef}.TRIG`)
          .connect(`${boardRef}.${echoPin}`, `${sonarRef}.ECHO`)
          .connectNet("5V", [`${boardRef}.5V`, `${sonarRef}.VCC`])
          .connectNet("GND", [`${boardRef}.GND`, `${sonarRef}.GND`]);
        break;
      }

      case "potentiometer": {
        const wiperPin = p.pins.wiper;
        const potRef = `POT${potCounter++}`;
        builder
          .addPart("POTENTIOMETER_10K", potRef)
          .connectNet("5V", [`${boardRef}.5V`, `${potRef}.1`])
          .connect(`${boardRef}.${wiperPin}`, `${potRef}.2`)
          .connectNet("GND", [`${boardRef}.GND`, `${potRef}.3`]);
        break;
      }

      case "piezo": {
        const pinId = p.pins.pin;
        const piezoRef = `SPK${piezoCounter++}`;
        const resRef = `R${rCounter++}`;
        builder
          .addPart("BUZZER_PIEZO", piezoRef)
          .addResistor(resRef, "100Ω")
          .connect(`${boardRef}.${pinId}`, `${resRef}.1`)
          .connect(`${resRef}.2`, `${piezoRef}.+`)
          .connectNet("GND", [`${piezoRef}.-`, `${boardRef}.GND`]);
        break;
      }

      case "photoresistor": {
        const pinId = p.pins.pin;
        const ldrRef = `LDR${ldrCounter++}`;
        const resRef = `R${rCounter++}`;

        // Voltage divider per Doc §12.5: 5V -> LDR.1, LDR.2 -> Pin & 10kΩ Resistor.1, Resistor.2 -> GND
        builder
          .addPart("PHOTORESISTOR_LDR", ldrRef)
          .addResistor(resRef, "10kΩ")
          .connectNet("5V", [`${boardRef}.5V`, `${ldrRef}.1`])
          .connect(`${boardRef}.${pinId}`, `${ldrRef}.2`, `${resRef}.1`)
          .connectNet("GND", [`${resRef}.2`, `${boardRef}.GND`]);
        break;
      }

      case "motor": {
        const pinId = p.pins.pin;
        const motorRef = `M${motorCounter++}`;
        builder
          .addPart("MOTOR_DC_GENERIC", motorRef)
          .connect(`${boardRef}.${pinId}`, `${motorRef}.+`)
          .connectNet("GND", [`${motorRef}.-`, `${boardRef}.GND`]);
        break;
      }

      case "relay": {
        const pinId = p.pins.pin;
        const relayRef = `RELAY${relayCounter++}`;
        builder
          .addPart("RELAY_MODULE_5V", relayRef)
          .connect(`${boardRef}.${pinId}`, `${relayRef}.IN`)
          .connectNet("5V", [`${boardRef}.5V`, `${relayRef}.VCC`])
          .connectNet("GND", [`${boardRef}.GND`, `${relayRef}.GND`]);
        break;
      }

      case "i2c-device": {
        const i2cRef = `I2C${i2cCounter++}`;
        builder
          .addPart("I2C_GENERIC_DEVICE", i2cRef)
          .connectNet("5V", [`${boardRef}.5V`, `${i2cRef}.VCC`])
          .connectNet("GND", [`${boardRef}.GND`, `${i2cRef}.GND`])
          .connect(`${boardRef}.SDA`, `${i2cRef}.SDA`)
          .connect(`${boardRef}.SCL`, `${i2cRef}.SCL`);

        // Doc §12.5: Add 4.7kΩ pull-up resistors on SDA/SCL to VCC once per bus
        if (options.includeI2cPullups !== false && !hasAddedI2cPullups) {
          hasAddedI2cPullups = true;
          const rSda = `R${rCounter++}`;
          const rScl = `R${rCounter++}`;
          builder
            .addResistor(rSda, "4.7kΩ")
            .addResistor(rScl, "4.7kΩ")
            .connectNet("5V", [`${boardRef}.5V`, `${rSda}.1`, `${rScl}.1`])
            .connect(`${boardRef}.SDA`, `${rSda}.2`)
            .connect(`${boardRef}.SCL`, `${rScl}.2`);
        }
        break;
      }

      case "generic": {
        const pinId = p.pins.pin;

        // 1. Bare DC motor / inductive actuator
        const isMotor =
          p.properties?.isBareMotor || p.id.startsWith("MOTOR") || /motor|pump|fan/i.test(p.id);

        if (isMotor && pinId) {
          const motorRef = `M${motorCounter++}`;
          builder
            .addPart("MOTOR_DC_GENERIC", motorRef)
            .connect(`${boardRef}.${pinId}`, `${motorRef}.+`)
            .connectNet("GND", [`${motorRef}.-`, `${boardRef}.GND`]);
          break;
        }

        // 2. LDR / Photoresistor
        const isLdr =
          p.id.startsWith("LDR") ||
          p.properties?.subtype === "photoresistor" ||
          p.properties?.sensorType === "ldr" ||
          /ldr|photo|light/i.test(p.id);

        if (isLdr && pinId) {
          const ldrRef = `LDR${ldrCounter++}`;
          const resRef = `R${rCounter++}`;

          // Voltage divider per Doc §12.5: 5V -> LDR.1, LDR.2 -> Pin & 10kΩ Resistor.1, Resistor.2 -> GND
          builder
            .addPart("PHOTORESISTOR_LDR", ldrRef)
            .addResistor(resRef, "10kΩ")
            .connectNet("5V", [`${boardRef}.5V`, `${ldrRef}.1`])
            .connect(`${boardRef}.${pinId}`, `${ldrRef}.2`, `${resRef}.1`)
            .connectNet("GND", [`${resRef}.2`, `${boardRef}.GND`]);
          break;
        }

        // 3. Generic analog sensor / thermistor on analog pin (e.g. A0-A5, ADC)
        const isAnalogPin = pinId && (pinId.startsWith("A") || pinId.startsWith("ADC"));
        if (isAnalogPin) {
          const sensorRef = `SENSOR${sensorCounter++}`;
          const resRef = `R${rCounter++}`;

          builder
            .addComponent(sensorRef, "sensor", {
              name: p.id.startsWith("TEMP")
                ? "Analog Temperature Sensor / NTC"
                : "Generic Analog Sensor",
              partNumber: p.id.startsWith("TEMP") ? "NTC-10K" : "GENERIC-ANALOG-SENSOR",
              ports: [
                { name: "1", kind: "passive" },
                { name: "2", kind: "passive" },
              ],
            })
            .addResistor(resRef, "10kΩ")
            .connectNet("5V", [`${boardRef}.5V`, `${sensorRef}.1`])
            .connect(`${boardRef}.${pinId}`, `${sensorRef}.2`, `${resRef}.1`)
            .connectNet("GND", [`${resRef}.2`, `${boardRef}.GND`]);
          break;
        }

        // 4. Any other generic peripheral with a pin: ensure component + wiring are added
        if (pinId) {
          const genRef = `DEV${devCounter++}`;
          builder
            .addComponent(genRef, "generic", {
              name: p.id,
              partNumber: "GENERIC-PERIPHERAL",
              ports: [
                { name: "1", kind: "passive" },
                { name: "2", kind: "passive" },
              ],
            })
            .connect(`${boardRef}.${pinId}`, `${genRef}.1`)
            .connectNet("GND", [`${genRef}.2`, `${boardRef}.GND`]);
          break;
        }
        break;
      }
    }
  }

  // Decoupling Recipe: Add 100nF decoupling capacitor across 5V and GND for the MCU
  if (options.includeDecoupling !== false) {
    const cBypassRef = "C_DECOUPLING";
    builder
      .addCapacitor(cBypassRef, "100nF")
      .connectNet("5V", [`${boardRef}.5V`, `${cBypassRef}.1`])
      .connectNet("GND", [`${boardRef}.GND`, `${cBypassRef}.2`]);
  }
}
