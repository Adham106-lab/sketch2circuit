/**
 * @license Apache-2.0
 * @s2c/export-ato — Component & Part Reference Mapping for Atopile (Doc §15).
 * Maps sketch2circuit IR components to verified atopile/JLCPCB part references
 * and standard library types. Never invents part numbers.
 */

import type { Component } from "@s2c/circuit-json";
import type { AtoPartReference } from "./types.js";

/**
 * Standard custom component definitions required for non-stdlib parts.
 * Follows official atopile grammar (AtoParser.g4 / AtoLexer.g4).
 */
export const ATO_COMPONENT_DEFINITIONS: Record<string, string> = {
  ArduinoUnoR3Header: `component ArduinoUnoR3Header:
    """Arduino Uno R3 standard 2.54mm shield interface header"""
    # Digital I/O
    pin D0
    pin D1
    pin D2
    pin D3
    pin D4
    pin D5
    pin D6
    pin D7
    pin D8
    pin D9
    pin D10
    pin D11
    pin D12
    pin D13
    # Analog Inputs
    pin A0
    pin A1
    pin A2
    pin A3
    pin A4
    pin A5
    # Power and Control
    # Note: 'power_5v' and 'power_3v3' are sketch2circuit-chosen pin names because atopile
    # treats tokens starting with digits (e.g. '5V', '3V3') as physical quantities with units,
    # requiring valid alphabetic identifier pin names.
    pin power_5v
    pin power_3v3
    pin GND
    pin VIN
    pin RESET
    pin AREF
    pin IOREF`,

  ArduinoNanoHeader: `component ArduinoNanoHeader:
    """Arduino Nano V3 DIP-30 interface header"""
    pin D0
    pin D1
    pin D2
    pin D3
    pin D4
    pin D5
    pin D6
    pin D7
    pin D8
    pin D9
    pin D10
    pin D11
    pin D12
    pin D13
    pin A0
    pin A1
    pin A2
    pin A3
    pin A4
    pin A5
    pin A6
    pin A7
    pin power_5v
    pin power_3v3
    pin GND
    pin VIN
    pin RESET`,

  TactileSwitch: `component TactileSwitch:
    """SPST 6x6mm Momentary Tactile Pushbutton"""
    pin p1
    pin p2`,

  Potentiometer: `component Potentiometer:
    """Rotary Potentiometer 3-terminal voltage divider"""
    pin p1
    pin p2  # wiper
    pin p3`,

  SG90Servo: `component SG90Servo:
    """TowerPro SG90 9g Micro Servo 3-pin Header"""
    pin pwm
    pin vcc
    pin gnd`,

  HC_SR04: `component HC_SR04:
    """HC-SR04 Ultrasonic Distance Sensor 4-pin Module"""
    pin vcc
    pin trig
    pin echo
    pin gnd`,

  PiezoBuzzer: `component PiezoBuzzer:
    """Piezo / Electromagnetic Buzzer"""
    pin positive
    pin negative`,

  Photoresistor: `component Photoresistor:
    """GL5528 Light-Dependent Resistor (LDR)"""
    pin p1
    pin p2`,

  DCMotor: `component DCMotor:
    """DC Motor (Requires external driver & flyback diode)"""
    pin pos
    pin neg
    pin p1
    pin p2`,

  NPNTransistor_2N2222: `component NPNTransistor_2N2222:
    """2N2222A General Purpose NPN BJT (TO-92)"""
    pin base
    pin collector
    pin emitter`,

  RelayModule: `component RelayModule:
    """SRD-05VDC Relay Module Header"""
    pin vcc
    pin in_pin
    pin gnd
    pin com
    pin no
    pin nc`,
};

/**
 * Resolves a synthesized Component to its atopile part representation.
 */
export function resolveAtoPart(comp: Component): AtoPartReference {
  const kind = comp.kind;
  const name = comp.name || "";
  const partNumber = String(comp.partNumber || comp.properties?.partNumber || name);
  const value = String(comp.value || comp.properties?.value || "");

  // Priority check for modules / sensors that might be registered with kind="module" or "generic"
  if (
    (kind as string) === "servo" ||
    comp.id.startsWith("SERVO") ||
    /servo|sg90/i.test(name) ||
    /servo|sg90/i.test(partNumber)
  ) {
    return {
      componentType: "SG90Servo",
      isStdLib: false,
      mpn: "SG90",
      manufacturer: "TowerPro",
      verified: false,
      comment: "# TODO: unverified part reference (SG90 9g servo header interface)",
      portMap: {
        PWM: "pwm",
        VCC: "vcc",
        GND: "gnd",
      },
    };
  }

  switch (kind) {
    case "mcu": {
      if (comp.name?.includes("Nano") || partNumber.includes("Nano") || comp.id === "U_NANO") {
        return {
          componentType: "ArduinoNanoHeader",
          isStdLib: false,
          mpn: "A000005",
          manufacturer: "Arduino",
          verified: true,
          comment: "Arduino Nano V3 development board interface",
          portMap: {
            "5V": "power_5v",
            "3V3": "power_3v3",
            GND: "GND",
            "GND.1": "GND",
            "GND.2": "GND",
          },
        };
      }
      return {
        componentType: "ArduinoUnoR3Header",
        isStdLib: false,
        mpn: "A000066",
        manufacturer: "Arduino",
        verified: true,
        comment: "Arduino Uno R3 DIP development board interface",
        portMap: {
          "5V": "power_5v",
          "3V3": "power_3v3",
          GND: "GND",
          "GND.1": "GND",
          "GND.2": "GND",
          "GND.3": "GND",
          "POWER.GND.1": "GND",
          "POWER.GND.2": "GND",
          "DIGITAL.GND": "GND",
        },
      };
    }

    case "resistor": {
      // Clean resistance value: e.g. "330Ω" -> "330ohm", "10kΩ" -> "10kohm", "4.7kΩ" -> "4.7kohm"
      const cleanVal = formatResistanceForAto(value || "10kohm");
      return {
        componentType: "Resistor",
        isStdLib: true,
        verified: false,
        valueConstraint: cleanVal,
        packageHint: "R0805",
        comment:
          "# TODO: unverified part reference (atopile auto-picker will select compliant standard component)",
        portMap: {
          "1": "p1",
          "2": "p2",
        },
      };
    }

    case "capacitor": {
      const cleanVal = formatCapacitanceForAto(value || "100nF");
      const isElectrolytic =
        cleanVal.includes("uF") || cleanVal.includes("µF") || comp.id.includes("SERVO");
      return {
        componentType: "Capacitor",
        isStdLib: true,
        verified: false,
        valueConstraint: cleanVal,
        packageHint: isElectrolytic ? "CP_Radial_D6.3mm_P2.50mm" : "C0805",
        comment: isElectrolytic
          ? "# TODO: unverified part reference (bulk electrolytic capacitor)"
          : "# TODO: unverified part reference (atopile auto-picker will select compliant standard component)",
        portMap: {
          "1": "p1",
          "2": "p2",
          "+": "p1",
          "-": "p2",
        },
      };
    }

    case "led": {
      const color = String(comp.properties?.color || "red").toLowerCase();
      return {
        componentType: "LED",
        isStdLib: true,
        verified: false,
        packageHint: "LED_5mm_Radial",
        comment: `# TODO: unverified part reference (standard 5mm indicator LED: ${color})`,
        portMap: {
          A: "anode",
          K: "cathode",
          "1": "anode",
          "2": "cathode",
        },
      };
    }

    case "diode": {
      // 1N4007 flyback diode
      const is1N4007 = /1N4007/i.test(partNumber) || /1N4007/i.test(value);
      if (is1N4007) {
        return {
          componentType: "Diode",
          isStdLib: true,
          mpn: "1N4007",
          verified: false,
          packageHint: "DO-41",
          comment:
            "# TODO: unverified part reference (1N4007 flyback diode; LCSC part number unverified in sandbox)",
          portMap: {
            A: "anode",
            K: "cathode",
            "1": "anode",
            "2": "cathode",
          },
        };
      }
      return {
        componentType: "Diode",
        isStdLib: true,
        verified: false,
        comment: "# TODO: unverified part reference",
        portMap: {
          A: "anode",
          K: "cathode",
          "1": "anode",
          "2": "cathode",
        },
      };
    }

    case "transistor": {
      // 2N2222 / 2N2222A BJT
      return {
        componentType: "NPNTransistor_2N2222",
        isStdLib: false,
        mpn: "2N2222A",
        verified: false,
        packageHint: "TO-92",
        comment:
          "# TODO: unverified part reference (2N2222A NPN transistor; LCSC part number unverified in sandbox)",
        portMap: {
          B: "base",
          C: "collector",
          E: "emitter",
          "1": "emitter",
          "2": "base",
          "3": "collector",
        },
      };
    }

    case "switch": {
      return {
        componentType: "TactileSwitch",
        isStdLib: false,
        verified: false,
        packageHint: "Button_Switch_THT:SW_PUSH_6mm",
        comment: "# TODO: unverified part reference (SPST 6x6mm tactile button)",
        portMap: {
          "1": "p1",
          "2": "p2",
        },
      };
    }

    case "potentiometer": {
      return {
        componentType: "Potentiometer",
        isStdLib: false,
        verified: false,
        packageHint: "Potentiometer_THT:Potentiometer_Bourns_PTV09A-1_Single_Vertical",
        comment: "# TODO: unverified part reference (10kΩ linear rotary potentiometer)",
        portMap: {
          "1": "p1",
          "2": "p2",
          "3": "p3",
          wiper: "p2",
        },
      };
    }

    case "sensor": {
      if (/HC[-_]?SR04/i.test(partNumber) || /SONAR/i.test(comp.id)) {
        return {
          componentType: "HC_SR04",
          isStdLib: false,
          mpn: "HC-SR04",
          verified: false,
          comment: "# TODO: unverified part reference (HC-SR04 ultrasonic rangefinder)",
          portMap: {
            VCC: "vcc",
            TRIG: "trig",
            ECHO: "echo",
            GND: "gnd",
          },
        };
      }
      if (/LDR|GL5528|PHOTO/i.test(partNumber) || /LDR/i.test(comp.id)) {
        return {
          componentType: "Photoresistor",
          isStdLib: false,
          mpn: "GL5528",
          manufacturer: "Senba Sensing Tech",
          verified: false,
          comment: "# TODO: unverified part reference (GL5528 5mm LDR photocell)",
          portMap: {
            "1": "p1",
            "2": "p2",
          },
        };
      }
      return {
        componentType: "Photoresistor",
        isStdLib: false,
        verified: false,
        comment: "# TODO: unverified part reference",
        portMap: {
          "1": "p1",
          "2": "p2",
        },
      };
    }

    case "buzzer": {
      return {
        componentType: "PiezoBuzzer",
        isStdLib: false,
        verified: false,
        comment: "# TODO: unverified part reference (electromagnetic/piezo buzzer)",
        portMap: {
          "1": "positive",
          "2": "negative",
          "+": "positive",
          "-": "negative",
        },
      };
    }

    case "relay": {
      return {
        componentType: "RelayModule",
        isStdLib: false,
        verified: false,
        comment: "# TODO: unverified part reference (SRD-05VDC relay module)",
        portMap: {
          VCC: "vcc",
          IN: "in_pin",
          GND: "gnd",
          COM: "com",
          NO: "no",
          NC: "nc",
        },
      };
    }

    default: {
      if (/motor/i.test(comp.name || "") || comp.id.startsWith("M")) {
        return {
          componentType: "DCMotor",
          isStdLib: false,
          verified: false,
          comment: "# TODO: unverified part reference (DC motor generic 3-6V)",
          portMap: {
            "1": "pos",
            "2": "neg",
            "+": "pos",
            "-": "neg",
            pos: "pos",
            neg: "neg",
          },
        };
      }
      return {
        componentType: "TactileSwitch",
        isStdLib: false,
        verified: false,
        comment: `# TODO: unverified part reference (generic peripheral '${kind}')`,
        portMap: {
          "1": "p1",
          "2": "p2",
        },
      };
    }
  }
}

function formatResistanceForAto(val: string): string {
  const s = val.replace(/Ω|ohm|ohms/gi, "").trim();
  if (/k/i.test(s)) {
    const n = s.replace(/k/i, "");
    return `${n}kohm +/- 5%`;
  }
  if (/m/i.test(s)) {
    const n = s.replace(/m/i, "");
    return `${n}Mohm +/- 5%`;
  }
  return `${s}ohm +/- 5%`;
}

function formatCapacitanceForAto(val: string): string {
  const s = val.trim();
  if (/uF|µF/i.test(s)) {
    const n = s.replace(/uF|µF/i, "");
    return `${n}uF +/- 20%`;
  }
  if (/nF/i.test(s)) {
    const n = s.replace(/nF/i, "");
    return `${n}nF +/- 10%`;
  }
  if (/pF/i.test(s)) {
    const n = s.replace(/pF/i, "");
    return `${n}pF +/- 5%`;
  }
  return `${s} +/- 10%`;
}
