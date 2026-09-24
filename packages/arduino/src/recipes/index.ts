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
  let sonarCounter = 1;
  let piezoCounter = 1;

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
        builder
          .addPart("SG90_SERVO", servoRef)
          .connect(`${boardRef}.${pinId}`, `${servoRef}.PWM`)
          .connectNet("5V", [`${boardRef}.5V`, `${servoRef}.VCC`])
          .connectNet("GND", [`${boardRef}.GND`, `${servoRef}.GND`]);
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
