/**
 * @license Apache-2.0
 * @s2c/parts — Verified electronic parts library with full pinouts and electrical ratings.
 */

import type { Component, ComponentKind, PinCapability, Port, PortKind } from "@s2c/circuit-json";

export interface PartDefinition {
  id: string;
  name: string;
  kind: ComponentKind;
  partNumber: string;
  description: string;
  defaultFootprint?: string;
  verified: boolean;
  datasheetUrl?: string;
  defaultProperties?: Record<string, string | number | boolean>;
  ports: Array<{
    name: string;
    pinNumber?: string | number;
    kind: PortKind;
    pinCapabilities?: PinCapability[];
    voltageRange?: [number, number];
    currentLimit?: number;
    pull?: "up" | "down" | "none";
    description?: string;
  }>;
}

export const ARDUINO_UNO_R3: PartDefinition = {
  id: "ARDUINO_UNO_R3",
  name: "Arduino Uno R3",
  kind: "mcu",
  partNumber: "A000066",
  description: "ATmega328P based 8-bit AVR microcontroller development board (5V logic)",
  defaultFootprint: "module:arduino-uno-r3",
  verified: true,
  datasheetUrl: "https://docs.arduino.cc/resources/datasheets/A000066-datasheet.pdf",
  defaultProperties: {
    operatingVoltage: 5.0,
    clockSpeedHz: 16000000,
    flashBytes: 32768,
    ramBytes: 2048,
  },
  ports: [
    // Digital Pins
    {
      name: "D0",
      pinNumber: 0,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "UART_RX"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D1",
      pinNumber: 1,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "UART_TX"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D2",
      pinNumber: 2,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "INTERRUPT"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D3",
      pinNumber: 3,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "INTERRUPT"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D4",
      pinNumber: 4,
      kind: "bidirectional",
      pinCapabilities: ["GPIO"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D5",
      pinNumber: 5,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D6",
      pinNumber: 6,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D7",
      pinNumber: 7,
      kind: "bidirectional",
      pinCapabilities: ["GPIO"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D8",
      pinNumber: 8,
      kind: "bidirectional",
      pinCapabilities: ["GPIO"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D9",
      pinNumber: 9,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D10",
      pinNumber: 10,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "SPI_SS"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D11",
      pinNumber: 11,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "SPI_MOSI"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D12",
      pinNumber: 12,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "SPI_MISO"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D13",
      pinNumber: 13,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "SPI_SCK"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    // Analog Pins (can also be GPIO)
    {
      name: "A0",
      pinNumber: "A0",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A1",
      pinNumber: "A1",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A2",
      pinNumber: "A2",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A3",
      pinNumber: "A3",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A4",
      pinNumber: "A4",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC", "I2C_SDA"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A5",
      pinNumber: "A5",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC", "I2C_SCL"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    // Power & Ground
    { name: "5V", kind: "power", voltageRange: [5, 5], currentLimit: 0.8 },
    { name: "3V3", kind: "power", voltageRange: [3.3, 3.3], currentLimit: 0.15 },
    { name: "GND", kind: "ground", voltageRange: [0, 0] },
    { name: "GND.2", kind: "ground", voltageRange: [0, 0] },
    { name: "GND.3", kind: "ground", voltageRange: [0, 0] },
    { name: "POWER.GND.1", kind: "ground", voltageRange: [0, 0] },
    { name: "POWER.GND.2", kind: "ground", voltageRange: [0, 0] },
    { name: "DIGITAL.GND", kind: "ground", voltageRange: [0, 0] },
    { name: "VIN", kind: "power", voltageRange: [7, 12] },
    { name: "RESET", kind: "input", pinCapabilities: ["RESET"], voltageRange: [0, 5] },
    { name: "AREF", kind: "input", voltageRange: [0, 5] },
    {
      name: "SDA",
      pinNumber: "SDA",
      kind: "bidirectional",
      pinCapabilities: ["I2C_SDA"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "SCL",
      pinNumber: "SCL",
      kind: "bidirectional",
      pinCapabilities: ["I2C_SCL"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
  ],
};

export const ARDUINO_NANO: PartDefinition = {
  id: "ARDUINO_NANO",
  name: "Arduino Nano V3.0",
  kind: "mcu",
  partNumber: "A000005",
  description: "Compact breadboard-friendly ATmega328P microcontroller board (5V logic)",
  defaultFootprint: "module:arduino-nano",
  verified: true,
  datasheetUrl: "https://docs.arduino.cc/resources/datasheets/A000005-datasheet.pdf",
  defaultProperties: { operatingVoltage: 5.0, clockSpeedHz: 16000000 },
  ports: [
    {
      name: "D0",
      pinNumber: 0,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "UART_RX"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D1",
      pinNumber: 1,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "UART_TX"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D2",
      pinNumber: 2,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "INTERRUPT"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D3",
      pinNumber: 3,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "INTERRUPT"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D4",
      pinNumber: 4,
      kind: "bidirectional",
      pinCapabilities: ["GPIO"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D5",
      pinNumber: 5,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D6",
      pinNumber: 6,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D7",
      pinNumber: 7,
      kind: "bidirectional",
      pinCapabilities: ["GPIO"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D8",
      pinNumber: 8,
      kind: "bidirectional",
      pinCapabilities: ["GPIO"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D9",
      pinNumber: 9,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D10",
      pinNumber: 10,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "SPI_SS"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D11",
      pinNumber: 11,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "SPI_MOSI"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D12",
      pinNumber: 12,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "SPI_MISO"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "D13",
      pinNumber: 13,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "SPI_SCK"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A0",
      pinNumber: "A0",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A1",
      pinNumber: "A1",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A2",
      pinNumber: "A2",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A3",
      pinNumber: "A3",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A4",
      pinNumber: "A4",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC", "I2C_SDA"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    {
      name: "A5",
      pinNumber: "A5",
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "ADC", "I2C_SCL"],
      voltageRange: [0, 5],
      currentLimit: 0.04,
    },
    { name: "A6", pinNumber: "A6", kind: "input", pinCapabilities: ["ADC"], voltageRange: [0, 5] },
    { name: "A7", pinNumber: "A7", kind: "input", pinCapabilities: ["ADC"], voltageRange: [0, 5] },
    { name: "5V", kind: "power", voltageRange: [5, 5], currentLimit: 0.5 },
    { name: "3V3", kind: "power", voltageRange: [3.3, 3.3], currentLimit: 0.05 },
    { name: "GND", kind: "ground", voltageRange: [0, 0] },
    { name: "VIN", kind: "power", voltageRange: [7, 12] },
    { name: "RESET", kind: "input", pinCapabilities: ["RESET"], voltageRange: [0, 5] },
  ],
};

export const ESP32_WROOM_32: PartDefinition = {
  id: "ESP32_WROOM_32",
  name: "ESP32-WROOM-32 DevKit",
  kind: "mcu",
  partNumber: "ESP32-DEVKITV1",
  description: "32-bit dual-core Wi-Fi/Bluetooth MCU development board (3.3V logic)",
  defaultFootprint: "module:esp32-devkit",
  verified: true,
  datasheetUrl:
    "https://www.espressif.com/sites/default/files/documentation/esp32-wroom-32_datasheet_en.pdf",
  defaultProperties: { operatingVoltage: 3.3, clockSpeedHz: 240000000 },
  ports: [
    {
      name: "GPIO2",
      pinNumber: 2,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "ADC"],
      voltageRange: [0, 3.3],
      currentLimit: 0.012,
    },
    {
      name: "GPIO4",
      pinNumber: 4,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "ADC"],
      voltageRange: [0, 3.3],
      currentLimit: 0.012,
    },
    {
      name: "GPIO5",
      pinNumber: 5,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "SPI_SS"],
      voltageRange: [0, 3.3],
      currentLimit: 0.012,
    },
    {
      name: "GPIO18",
      pinNumber: 18,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "SPI_SCK"],
      voltageRange: [0, 3.3],
      currentLimit: 0.012,
    },
    {
      name: "GPIO19",
      pinNumber: 19,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "SPI_MISO"],
      voltageRange: [0, 3.3],
      currentLimit: 0.012,
    },
    {
      name: "GPIO21",
      pinNumber: 21,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "I2C_SDA"],
      voltageRange: [0, 3.3],
      currentLimit: 0.012,
    },
    {
      name: "GPIO22",
      pinNumber: 22,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "I2C_SCL"],
      voltageRange: [0, 3.3],
      currentLimit: 0.012,
    },
    {
      name: "GPIO23",
      pinNumber: 23,
      kind: "bidirectional",
      pinCapabilities: ["GPIO", "PWM", "SPI_MOSI"],
      voltageRange: [0, 3.3],
      currentLimit: 0.012,
    },
    { name: "3V3", kind: "power", voltageRange: [3.3, 3.3], currentLimit: 0.5 },
    { name: "GND", kind: "ground", voltageRange: [0, 0] },
    { name: "VIN", kind: "power", voltageRange: [4.5, 9.0] },
  ],
};

export const HC_SR04: PartDefinition = {
  id: "HC_SR04",
  name: "HC-SR04 Ultrasonic Distance Sensor",
  kind: "sensor",
  partNumber: "HC-SR04",
  description: "Ultrasonic sonar ranging sensor (2cm to 400cm)",
  defaultFootprint: "module:hc-sr04",
  verified: true,
  datasheetUrl: "https://cdn.sparkfun.com/datasheets/Sensors/Proximity/HCSR04.pdf",
  defaultProperties: { supplyVoltage: 5.0, activeCurrentA: 0.015 },
  ports: [
    { name: "VCC", kind: "power", voltageRange: [4.5, 5.5] },
    { name: "TRIG", kind: "input", voltageRange: [0, 5] },
    { name: "ECHO", kind: "output", voltageRange: [0, 5] },
    { name: "GND", kind: "ground", voltageRange: [0, 0] },
  ],
};

export const SG90_SERVO: PartDefinition = {
  id: "SG90_SERVO",
  name: "TowerPro SG90 Micro Servo 9g",
  kind: "module",
  partNumber: "SG90",
  description: "Analog 180 degree positional hobby servo motor",
  defaultFootprint: "header:3-pin-0.1in",
  verified: true,
  datasheetUrl: "https://www.towerpro.com.tw/product/sg90-7/",
  defaultProperties: { supplyVoltage: 5.0, stallCurrentA: 0.65 },
  ports: [
    { name: "PWM", kind: "input", pinCapabilities: ["PWM"], voltageRange: [0, 5] },
    { name: "VCC", kind: "power", voltageRange: [4.8, 6.0] },
    { name: "GND", kind: "ground", voltageRange: [0, 0] },
  ],
};

export const POTENTIOMETER: PartDefinition = {
  id: "POTENTIOMETER_10K",
  name: "10k Rotary Potentiometer",
  kind: "potentiometer",
  partNumber: "B10K-ROTARY",
  description: "3-terminal linear rotary potentiometer",
  defaultFootprint: "pot:3-pin-rotary",
  verified: false,
  defaultProperties: { resistanceOhms: 10000, taper: "linear" },
  ports: [
    { name: "1", kind: "passive" },
    { name: "2", kind: "passive", description: "Wiper" },
    { name: "3", kind: "passive" },
  ],
};

export const RESISTOR_GENERIC: PartDefinition = {
  id: "RESISTOR_GENERIC",
  name: "Through-Hole Resistor",
  kind: "resistor",
  partNumber: "RES-AXIAL",
  description: "Standard 2-lead passive resistor",
  defaultFootprint: "resistor:axial-0.3in",
  verified: false,
  ports: [
    { name: "1", kind: "passive" },
    { name: "2", kind: "passive" },
  ],
};

export const LED_GENERIC: PartDefinition = {
  id: "LED_GENERIC",
  name: "Through-Hole LED (5mm)",
  kind: "led",
  partNumber: "LED-5MM",
  description: "Standard 2-pin light emitting diode",
  defaultFootprint: "led:5mm",
  verified: false,
  defaultProperties: { forwardVoltage: 2.0, maxCurrentAmps: 0.02 },
  ports: [
    { name: "A", kind: "passive", description: "Anode (+)" },
    { name: "K", kind: "passive", description: "Cathode (-)" },
  ],
};

export const PUSHBUTTON: PartDefinition = {
  id: "PUSHBUTTON_SPST",
  name: "SPST Momentary Tactile Pushbutton",
  kind: "button",
  partNumber: "TACT-6MM",
  description: "4-pin SPST tactile push switch (paired contacts)",
  defaultFootprint: "button:tact-6mm",
  verified: false,
  ports: [
    { name: "1", kind: "passive" },
    { name: "2", kind: "passive" },
  ],
};

export const CAPACITOR_CERAMIC: PartDefinition = {
  id: "CAPACITOR_CERAMIC",
  name: "Ceramic Decoupling Capacitor",
  kind: "capacitor",
  partNumber: "CAP-CERAMIC",
  description: "Non-polarized 2-lead ceramic disc capacitor",
  defaultFootprint: "capacitor:radial-0.1in",
  verified: false,
  ports: [
    { name: "1", kind: "passive" },
    { name: "2", kind: "passive" },
  ],
};

export const CAPACITOR_ELECTROLYTIC: PartDefinition = {
  id: "CAPACITOR_ELECTROLYTIC",
  name: "Electrolytic Capacitor",
  kind: "capacitor",
  partNumber: "CAP-ELECTRO",
  description: "Polarized radial aluminum electrolytic capacitor",
  defaultFootprint: "capacitor:radial-can",
  verified: false,
  ports: [
    { name: "+", kind: "passive", description: "Positive" },
    { name: "-", kind: "passive", description: "Negative" },
  ],
};

export const DIODE_1N4007: PartDefinition = {
  id: "DIODE_1N4007",
  name: "1N4007 Rectifier Diode",
  kind: "diode",
  partNumber: "1N4007",
  description: "1A 1000V general purpose silicon rectifier diode",
  defaultFootprint: "diode:do-41",
  verified: true,
  datasheetUrl: "https://www.onsemi.com/pdf/datasheet/1n4001-d.pdf",
  defaultProperties: { forwardVoltage: 1.1, maxContinuousCurrent: 1.0 },
  ports: [
    { name: "A", kind: "passive", description: "Anode" },
    { name: "K", kind: "passive", description: "Cathode" },
  ],
};

export const TRANSISTOR_2N2222: PartDefinition = {
  id: "TRANSISTOR_2N2222",
  name: "2N2222 NPN Bipolar Transistor",
  kind: "transistor",
  partNumber: "2N2222",
  description: "NPN silicon switching transistor (TO-92, 40V 800mA)",
  defaultFootprint: "transistor:to-92",
  verified: true,
  datasheetUrl: "https://www.onsemi.com/pdf/datasheet/p2n2222a-d.pdf",
  defaultProperties: { vceMax: 40, icMax: 0.8, hfe: 100 },
  ports: [
    { name: "E", pinNumber: 1, kind: "passive", description: "Emitter" },
    { name: "B", pinNumber: 2, kind: "input", description: "Base" },
    { name: "C", pinNumber: 3, kind: "passive", description: "Collector" },
  ],
};

export const BUZZER_PIEZO: PartDefinition = {
  id: "BUZZER_PIEZO",
  name: "Passive Piezo Buzzer",
  kind: "buzzer",
  partNumber: "PIEZO-12MM",
  description: "Passive electromagnetic/piezo transducer",
  defaultFootprint: "buzzer:12mm",
  verified: false,
  ports: [
    { name: "+", kind: "passive" },
    { name: "-", kind: "passive" },
  ],
};

/**
 * Registry of all verified parts in the standard catalog.
 */
export const PARTS_CATALOG: Record<string, PartDefinition> = {
  [ARDUINO_UNO_R3.id]: ARDUINO_UNO_R3,
  [ARDUINO_NANO.id]: ARDUINO_NANO,
  [ESP32_WROOM_32.id]: ESP32_WROOM_32,
  [HC_SR04.id]: HC_SR04,
  [SG90_SERVO.id]: SG90_SERVO,
  [POTENTIOMETER.id]: POTENTIOMETER,
  [RESISTOR_GENERIC.id]: RESISTOR_GENERIC,
  [LED_GENERIC.id]: LED_GENERIC,
  [PUSHBUTTON.id]: PUSHBUTTON,
  [CAPACITOR_CERAMIC.id]: CAPACITOR_CERAMIC,
  [CAPACITOR_ELECTROLYTIC.id]: CAPACITOR_ELECTROLYTIC,
  [DIODE_1N4007.id]: DIODE_1N4007,
  [TRANSISTOR_2N2222.id]: TRANSISTOR_2N2222,
  [BUZZER_PIEZO.id]: BUZZER_PIEZO,
};

/**
 * Computes Levenshtein distance between two strings for typo tolerance.
 */
export function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1, // deletion
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Finds the closest matching part definition for a given query string.
 */
export function findClosestPart(query: string): PartDefinition | undefined {
  const parts = Object.values(PARTS_CATALOG);
  let bestPart: PartDefinition | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const part of parts) {
    const dId = levenshteinDistance(query, part.id);
    const dPartNum = levenshteinDistance(query, part.partNumber);
    const dName = levenshteinDistance(query, part.name);
    const minD = Math.min(dId, dPartNum, dName);

    if (minD < bestDistance) {
      bestDistance = minD;
      bestPart = part;
    }
  }

  // Suggest if distance is reasonable (<= max(4, query.length / 2))
  if (bestPart && bestDistance <= Math.max(5, Math.floor(query.length * 0.7))) {
    return bestPart;
  }
  return undefined;
}

/**
 * Look up a part by ID or partNumber, providing suggestion if not found.
 */
export function lookupPartWithSuggestion(query: string): {
  part?: PartDefinition;
  suggestion?: string;
  availablePartIds: string[];
} {
  const part = getPartDefinition(query);
  const availablePartIds = Object.keys(PARTS_CATALOG);
  if (part) {
    return { part, availablePartIds };
  }
  const closest = findClosestPart(query);
  return {
    part: undefined,
    suggestion: closest ? closest.id : undefined,
    availablePartIds,
  };
}

/**
 * Creates a Circuit IR Component instance from a verified catalog part.
 */
export function instantiatePart(
  partOrId: PartDefinition | string,
  instanceId: string,
  options?: {
    value?: string;
    name?: string;
    properties?: Record<string, string | number | boolean>;
  },
): Component {
  const def = typeof partOrId === "string" ? getPartDefinition(partOrId) : partOrId;
  if (!def) {
    const queryStr = String(partOrId);
    const closest = findClosestPart(queryStr);
    const didYouMean = closest ? ` Did you mean '${closest.id}'?` : "";
    const catalogList = Object.keys(PARTS_CATALOG).join(", ");
    throw new Error(
      `Part '${queryStr}' not found in catalog.${didYouMean} Available catalog parts: [${catalogList}].`,
    );
  }

  const ports: Port[] = def.ports.map((p) => ({
    id: `${instanceId}.${p.name}`,
    name: p.name,
    pinNumber: p.pinNumber,
    kind: p.kind,
    pinCapabilities: p.pinCapabilities ? [...p.pinCapabilities] : undefined,
    voltageRange: p.voltageRange ? [p.voltageRange[0], p.voltageRange[1]] : undefined,
    currentLimit: p.currentLimit,
    pull: p.pull,
  }));

  return {
    id: instanceId,
    kind: def.kind,
    name: options?.name ?? def.name,
    partNumber: def.partNumber,
    value: options?.value,
    footprint: def.defaultFootprint,
    properties: {
      ...(def.defaultProperties ?? {}),
      ...(options?.properties ?? {}),
    },
    ports,
    verified: def.verified,
  };
}

/**
 * Look up a part by ID or partNumber
 */
export function getPartDefinition(query: string): PartDefinition | undefined {
  if (PARTS_CATALOG[query]) {
    return PARTS_CATALOG[query];
  }
  return Object.values(PARTS_CATALOG).find(
    (p) =>
      p.partNumber.toLowerCase() === query.toLowerCase() ||
      p.name.toLowerCase() === query.toLowerCase() ||
      p.id.toLowerCase() === query.toLowerCase(),
  );
}
