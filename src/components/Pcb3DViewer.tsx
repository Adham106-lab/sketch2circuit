/**
 * @license Apache-2.0
 * @s2c/pcb-layout — Interactive Isometric Technical Illustration 3D Digital Twin, 2D Schematic & PCB Viewer
 * Inspired by Dilum Sanjaya's Interactive Arduino CAD Illustration Style.
 *
 * Features:
 * - Dynamic Live Circuit IR Engine: Automatically reads `circuit` & `sketchName` changes when switching
 *   projects in `App.tsx`, placing all inferred components (LEDs, Resistors, Buttons, Pots, Buzzers,
 *   HC-SR04, Servos, Relays, I2C OLED/Sensors) on the 3D breadboard with real pin-to-breadboard jumper wires
 *   and dynamic 3D-anchored callout cards.
 * - Built-in 2D Wiring Schematic View & Floating Card (toggleable from the bottom control pill or top bar)
 *   for effortless pin-by-pin wiring verification alongside the 3D Isometric Twin.
 * - True Orthographic Isometric & Perspective Camera toggle with smooth turntable rotation
 * - Crisp CAD dark ink outlines (`THREE.EdgesGeometry`) across all 3D primitives & jumper wires
 * - Dual Aesthetic Themes: Warm Drafting Blueprint (`#f5efe6`) & Obsidian Matte Gold (`#0b0f17`)
 * - Studio Lighting via `RoomEnvironment` + `PMREMGenerator` (`THREE.SRGBColorSpace`)
 */

import type { Circuit } from "@s2c/circuit-json";
import { ARDUINO_UNO_R3_SHIELD_OUTLINE } from "@s2c/footprints";
import type { PcbLayout } from "@s2c/pcb-json";
import {
  buildPcbScene3D,
  buildThreePcbGroup,
  type PcbScene3D,
  placeCircuit,
  routeCircuit,
  type ThreePcbHierarchy,
} from "@s2c/pcb-layout";
import {
  Activity,
  Box,
  ChevronRight,
  Compass,
  Cpu,
  Download,
  FileCode2,
  Info,
  Layers,
  Minus,
  Moon,
  Plus,
  RotateCcw,
  RotateCw,
  Sun,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { WIRE_COLORS } from "./circuit2d/circuitModel.js";
import { Schematic2DViewer } from "./Schematic2DViewer.js";

export type MechatronicsProjectId =
  | "tennis_shooter"
  | "omni_rover"
  | "bionic_hand"
  | "radar_turret"
  | "cnc_plotter";

export interface MechatronicsProjectPreset {
  id: MechatronicsProjectId;
  title: string;
  subtitle: string;
  badge: string;
  code: string;
}

export const MECHATRONICS_PROJECTS: MechatronicsProjectPreset[] = [
  {
    id: "tennis_shooter",
    title: "Dual-Flywheel Tennis Ball Launcher",
    subtitle: "PID PWM Motor + Servo Hopper + Ultrasonic Safety Interlock",
    badge: "MECHATRONICS",
    code: `#include <Servo.h>

const int BUTTON_1_PIN = 2;
const int BUTTON_2_PIN = 3;
const int LED_1_PIN = 4;
const int LED_2_PIN = 5;
const int MOTOR_PIN = 6;
const int BUZZER_PIN = 7;
const int SERVO_PIN = 9;
const int POT_PIN = A0;
const int LDR_PIN = A1;

Servo feederServo;

void setup() {
  Serial.begin(115200);
  pinMode(BUTTON_1_PIN, INPUT_PULLUP);
  pinMode(BUTTON_2_PIN, INPUT_PULLUP);
  pinMode(LED_1_PIN, OUTPUT);
  pinMode(LED_2_PIN, OUTPUT);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  feederServo.attach(SERVO_PIN);
}

void loop() {
  int potValue = analogRead(POT_PIN);
  int ldrValue = analogRead(LDR_PIN);
  int rpmPwm = map(potValue, 0, 1023, 0, 255);
  analogWrite(MOTOR_PIN, rpmPwm);

  if (digitalRead(BUTTON_1_PIN) == LOW) {
    digitalWrite(LED_1_PIN, HIGH);
    feederServo.write(160);
    tone(BUZZER_PIN, 1200, 80);
  } else {
    digitalWrite(LED_1_PIN, LOW);
    feederServo.write(20);
  }

  digitalWrite(LED_2_PIN, ldrValue > 500 ? HIGH : LOW);
  delay(25);
}`,
  },
  {
    id: "omni_rover",
    title: "Autonomous Ultrasonic Rover",
    subtitle: "HC-SR04 Rangefinder + Servo Pan + PWM Drive",
    badge: "ROBOTICS",
    code: `#include <Servo.h>

const int TRIG_PIN = 11;
const int ECHO_PIN = 12;
const int SERVO_PIN = 9;
const int MOTOR_PIN = 6;
const int STATUS_LED = 13;

Servo scanServo;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(MOTOR_PIN, OUTPUT);
  pinMode(STATUS_LED, OUTPUT);
  scanServo.attach(SERVO_PIN);
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);
  long distCm = duration * 0.034 / 2;

  if (distCm < 25) {
    digitalWrite(STATUS_LED, HIGH);
    analogWrite(MOTOR_PIN, 0);
    scanServo.write(150);
  } else {
    digitalWrite(STATUS_LED, LOW);
    analogWrite(MOTOR_PIN, 200);
    scanServo.write(90);
  }
  delay(60);
}`,
  },
];

export interface Pcb3DViewerProps {
  circuit: Circuit;
  layout?: PcbLayout;
  sketchName?: string;
  theme?: "dark" | "light";
  activeProject?: MechatronicsProjectId;
  onSelectProject?: (proj: MechatronicsProjectPreset) => void;
  onSelectPresetSketch?: (code: string, presetId: string) => void;
}

export type LessonPresetId =
  | "live"
  | "meet-board"
  | "blink-led"
  | "push-button"
  | "read-sensor"
  | "sense-light"
  | "sweep-servo";

export type CalloutIconKind =
  | "usb"
  | "chip"
  | "pins"
  | "power"
  | "header"
  | "analog"
  | "gnd"
  | "led"
  | "resistor"
  | "sonar"
  | "obstacle"
  | "button"
  | "sensor"
  | "servo"
  | "buzzer";

export interface CalloutDef {
  id: string;
  title: string;
  description: string;
  icon: CalloutIconKind;
  anchor3D: [number, number, number];
  cardOffset: [number, number];
  secondaryAnchors3D?: [number, number, number][];
}

interface ProjectedCallout extends CalloutDef {
  screenX: number;
  screenY: number;
  cardX: number;
  cardY: number;
  secondaryScreen?: { x: number; y: number }[];
  visible: boolean;
}

interface LessonPreset {
  id: LessonPresetId;
  numberLabel: string;
  title: string;
  badgeColor: string;
  hasBreadboard: boolean;
  code: string;
  callouts: CalloutDef[];
}

// ============================================================================
// EXTRACTED PART SUMMARY FOR LIVE CIRCUIT IR & 2D SCHEMATIC
// ============================================================================

export interface ExtractedPartInfo {
  id: string;
  kind:
    | "mcu"
    | "led"
    | "resistor"
    | "button"
    | "potentiometer"
    | "photoresistor"
    | "ultrasonic"
    | "servo"
    | "buzzer"
    | "capacitor"
    | "i2c"
    | "relay"
    | "generic";
  label: string;
  valueText: string;
  mcuPins: string[];
  nets: string[];
  wireColorHex: number;
  wireColorCss: string;
}

const WIRE_PALETTE: { hex: number; css: string }[] = WIRE_COLORS.PALETTE.map((css) => ({
  hex: Number.parseInt(css.replace("#", ""), 16),
  css,
}));

/**
 * Inspects any `@s2c/circuit-json` `Circuit` object flexibly (supporting both
 * `nets` port arrays and `connections` if present) and extracts all hardware parts
 * and their connected Arduino pins for dynamic 3D & 2D rendering.
 */
function extractCircuitParts(circuit: Circuit): ExtractedPartInfo[] {
  const rawCircuit = circuit as unknown as {
    components?: Array<{
      id: string;
      partNumber?: string;
      partId?: string;
      kind?: string;
      type?: string;
      label?: string;
      value?: string | number;
      properties?: Record<string, unknown>;
      ports?: Array<{ id: string; name?: string; netId?: string }>;
    }>;
    nets?: Array<{
      id: string;
      name?: string;
      portIds?: string[];
      ports?: Array<string | { componentId: string; portId?: string; pin?: string }>;
      connections?: Array<string | { componentId: string; portId?: string; pin?: string }>;
    }>;
  };

  const components = rawCircuit.components ?? [];
  const nets = rawCircuit.nets ?? [];

  // Map componentId -> list of connected net IDs and MCU pins
  const compNets = new Map<string, Set<string>>();
  const netMcuPins = new Map<string, Set<string>>();

  for (const c of components) {
    const netSet = new Set<string>();
    compNets.set(c.id, netSet);
    for (const port of c.ports ?? []) {
      if (port?.netId) {
        netSet.add(port.netId);
        if (!netMcuPins.has(port.netId)) netMcuPins.set(port.netId, new Set());
        const isMcu =
          c.id === "U1" ||
          c.kind === "mcu" ||
          c.id.toLowerCase().includes("uno") ||
          c.id.toLowerCase().includes("mcu") ||
          c.id.toLowerCase().includes("arduino");
        if (isMcu) {
          const rawPin = port.name || port.id.split(/[.:]/).slice(1).join(".");
          if (rawPin) netMcuPins.get(port.netId)!.add(rawPin.toUpperCase());
        }
      }
    }
  }

  for (const net of nets) {
    const netId = net.id || net.name || "NET";
    const portList = net.portIds ?? net.ports ?? net.connections ?? [];
    if (!netMcuPins.has(netId)) netMcuPins.set(netId, new Set());

    for (const p of portList) {
      let compId = "";
      let portName = "";
      if (typeof p === "string") {
        const parts = p.split(/[.:]/);
        compId = parts[0] ?? "";
        portName = parts.slice(1).join(".");
      } else if (p && typeof p === "object") {
        compId = p.componentId ?? "";
        portName = p.portId ?? p.pin ?? "";
      }

      if (!compId) continue;
      if (!compNets.has(compId)) compNets.set(compId, new Set());
      compNets.get(compId)!.add(netId);

      // Check if this component is the MCU / Arduino board
      const isMcu =
        compId === "U1" ||
        compId.toLowerCase().includes("uno") ||
        compId.toLowerCase().includes("mcu") ||
        compId.toLowerCase().includes("arduino");
      if (isMcu && portName) {
        netMcuPins.get(netId)!.add(portName.toUpperCase());
      }
    }

    // Also infer MCU pin from net name like "D13", "PIN_9", "A0", "5V", "GND"
    const cleanNet = netId.toUpperCase();
    if (/^(D?\d+|A[0-5]|5V|3V3|GND|SDA|SCL)$/.test(cleanNet)) {
      netMcuPins.get(netId)!.add(cleanNet);
    }
  }

  const results: ExtractedPartInfo[] = [];
  let colorIdx = 0;

  for (const c of components) {
    const sig = `${c.id} ${c.partId ?? ""} ${c.kind ?? ""} ${c.type ?? ""} ${c.label ?? ""}`.toLowerCase();
    const isMcu =
      c.id === "U1" ||
      sig.includes("atmega") ||
      sig.includes("arduino") ||
      sig.includes("uno") ||
      sig.includes("esp32");

    if (isMcu) continue;

    let kind: ExtractedPartInfo["kind"] = "generic";
    if (sig.includes("sr04") || sig.includes("ultrasonic") || sig.includes("sonar")) {
      kind = "ultrasonic";
    } else if (sig.includes("servo") || sig.includes("sg90")) {
      kind = "servo";
    } else if (sig.includes("led")) {
      kind = "led";
    } else if (sig.includes("res") || /^r\d+/i.test(c.id)) {
      kind = "resistor";
    } else if (sig.includes("btn") || sig.includes("button") || sig.includes("switch") || /^sw\d+/i.test(c.id)) {
      kind = "button";
    } else if (sig.includes("pot") || sig.includes("rv")) {
      kind = "potentiometer";
    } else if (sig.includes("ldr") || sig.includes("photo") || sig.includes("light")) {
      kind = "photoresistor";
    } else if (sig.includes("piezo") || sig.includes("First") || sig.includes("buzz") || sig.includes("speaker") || /^bz/i.test(c.id)) {
      kind = "buzzer";
    } else if (sig.includes("cap") || /^c\d+/i.test(c.id)) {
      kind = "capacitor";
    } else if (sig.includes("oled") || sig.includes("ssd1306") || sig.includes("i2c") || sig.includes("lcd")) {
      kind = "i2c";
    } else if (sig.includes("relay") || sig.includes("motor") || sig.includes("solenoid")) {
      kind = "relay";
    }

    const cNets = Array.from(compNets.get(c.id) ?? []);
    const mcuPinSet = new Set<string>();
    for (const n of cNets) {
      const pins = netMcuPins.get(n);
      if (pins) {
        for (const p of pins) mcuPinSet.add(p);
      }
    }

    // If a component connects through a series resistor to an MCU pin (e.g. Pin13 -> R1 -> LED1),
    // also trace 1 hop across shared non-power nets so LED knows its driving pin
    if (mcuPinSet.size === 0 || (mcuPinSet.size === 1 && mcuPinSet.has("GND"))) {
      for (const n of cNets) {
        if (n.toUpperCase().includes("GND") || n.toUpperCase().includes("5V")) continue;
        for (const otherComp of components) {
          if (otherComp.id === c.id) continue;
          const otherNets = compNets.get(otherComp.id);
          if (otherNets?.has(n)) {
            for (const on of otherNets) {
              for (const p of netMcuPins.get(on) ?? []) {
                if (!p.includes("GND")) mcuPinSet.add(p);
              }
            }
          }
        }
      }
    }

    const propVal =
      c.value ??
      c.properties?.resistance ??
      c.properties?.capacitance ??
      c.properties?.color ??
      c.properties?.pin ??
      "";
    const valueText = propVal ? String(propVal) : kind.toUpperCase();

    const palette = WIRE_PALETTE[colorIdx % WIRE_PALETTE.length]!;
    colorIdx++;

    results.push({
      id: c.id,
      kind,
      label: c.label || c.partId || c.id,
      valueText,
      mcuPins: Array.from(mcuPinSet),
      nets: cNets,
      wireColorHex: palette.hex,
      wireColorCss: palette.css,
    });
  }

  return results;
}

/**
 * Maps an Arduino pin name (e.g. "13", "D9", "A0", "5V", "GND") to its 3D coordinate on the Uno headers.
 */
function getArduinoPin3DPosition(pinRaw: string, unoOffsetX: number): [number, number, number] {
  const p = pinRaw.toUpperCase().replace(/^PIN_?/, "").replace(/^DIGITAL\.?/, "").replace(/^POWER\.?/, "");

  if (p.includes("GND")) return [unoOffsetX - 9.0, 10.2, -23.5];
  if (p === "5V" || p === "VCC") return [unoOffsetX - 6.0, 10.2, 23.5];
  if (p === "3V3" || p === "3.3V") return [unoOffsetX - 8.5, 10.2, 23.5];
  if (p === "SDA" || p === "A4") return [unoOffsetX + 21.0, 10.2, 23.5];
  if (p === "SCL" || p === "A5") return [unoOffsetX + 23.5, 10.2, 23.5];

  const analogMatch = p.match(/A([0-5])/);
  if (analogMatch) {
    const idx = Number.parseInt(analogMatch[1]!, 10);
    return [unoOffsetX + 10.5 + idx * 2.54, 10.2, 23.5];
  }

  const digMatch = p.match(/D?(\d+)/);
  if (digMatch) {
    const d = Number.parseInt(digMatch[1]!, 10);
    if (d >= 8 && d <= 13) {
      // Digital 8..13 header bank
      return [unoOffsetX + 6.0 - (d - 8) * 2.54, 10.2, -23.5];
    }
    if (d >= 0 && d <= 7) {
      // Digital 0..7 header bank
      return [unoOffsetX + 28.5 - d * 2.54, 10.2, -23.5];
    }
  }

  return [unoOffsetX - 3.5, 10.2, -23.5];
}

// ============================================================================
// LESSON & CIRCUIT PRESET DEFINITIONS
// ============================================================================

const LESSON_PRESETS: LessonPreset[] = [
  {
    id: "live",
    numberLabel: "0. LIVE PROJECT",
    title: "LIVE CIRCUIT (SYNCED)",
    badgeColor: "#0d9488",
    hasBreadboard: true,
    code: "",
    callouts: [],
  },
  {
    id: "meet-board",
    numberLabel: "1. MEET THE BOARD",
    title: "1. MEET THE BOARD",
    badgeColor: "#2b4c7e",
    hasBreadboard: false,
    code: `// Lesson 1: Meet the Arduino Uno R3 Board
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(1000);
  digitalWrite(LED_BUILTIN, LOW);
  delay(1000);
}`,
    callouts: [
      {
        id: "usb-port",
        title: "USB PORT",
        description: "Connects to your computer for programming and power.",
        icon: "usb",
        anchor3D: [-31, 6.5, -11],
        cardOffset: [-210, -95],
      },
      {
        id: "microcontroller",
        title: "MICROCONTROLLER",
        description: "ATmega328P runs your code.",
        icon: "chip",
        anchor3D: [8, 6.5, 9],
        cardOffset: [-45, -175],
      },
      {
        id: "digital-pins",
        title: "DIGITAL PINS",
        description: "Pins 0–13 for digital input/output. (~ PWM on some pins)",
        icon: "pins",
        anchor3D: [6, 9.5, -23.5],
        cardOffset: [105, -120],
      },
      {
        id: "power-jack",
        title: "POWER JACK",
        description: "External DC power (7–12V recommended).",
        icon: "power",
        anchor3D: [-30, 6.5, 16],
        cardOffset: [-195, 110],
      },
      {
        id: "power-pins",
        title: "POWER PINS",
        description: "5V, 3.3V, GND and VIN for power.",
        icon: "header",
        anchor3D: [-6, 9.5, 23.5],
        cardOffset: [-75, 115],
      },
      {
        id: "analog-pins",
        title: "ANALOG PINS",
        description: "A0–A5 for reading analog signals.",
        icon: "analog",
        anchor3D: [17, 9.5, 23.5],
        cardOffset: [120, 95],
      },
    ],
  },
  {
    id: "blink-led",
    numberLabel: "2. BLINK AN LED",
    title: "2. BLINK AN LED",
    badgeColor: "#ef4444",
    hasBreadboard: true,
    code: `// Lesson 2: Blink an External LED on Pin 13
const int LED_PIN = 13;

void setup() {
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_PIN, HIGH);
  delay(800);
  digitalWrite(LED_PIN, LOW);
  delay(800);
}`,
    callouts: [
      {
        id: "gnd-wire",
        title: "GND",
        description: "The short leg (–) returns current here.",
        icon: "gnd",
        anchor3D: [-25, 10.2, -23.5],
        cardOffset: [-215, -125],
      },
      {
        id: "pin-13",
        title: "PIN 13",
        description: "Your sketch switches it HIGH and LOW.",
        icon: "pins",
        anchor3D: [-22.5, 10.2, -23.5],
        cardOffset: [-15, -145],
      },
      {
        id: "external-led",
        title: "LED",
        description: "Lights up whenever pin 13 goes HIGH.",
        icon: "led",
        anchor3D: [46, 15.5, 3],
        cardOffset: [70, -145],
      },
      {
        id: "builtin-led",
        title: "BUILT-IN LED",
        description: 'The "L" LED mirrors pin 13 on the board.',
        icon: "led",
        anchor3D: [-20, 3.2, -14],
        cardOffset: [-185, 125],
      },
      {
        id: "resistor",
        title: "RESISTOR",
        description: "Stops the LED drawing too much current.",
        icon: "resistor",
        anchor3D: [39, 9.2, 6],
        cardOffset: [80, 115],
      },
    ],
  },
  {
    id: "push-button",
    numberLabel: "3. PUSH A BUTTON",
    title: "3. PUSH A BUTTON",
    badgeColor: "#f97316",
    hasBreadboard: true,
    code: `// Lesson 3: Read a Tactile Push Button on Pin 2
const int BUTTON_PIN = 2;
const int LED_PIN = 13;

void setup() {
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
}

void loop() {
  int pressed = digitalRead(BUTTON_PIN) == LOW;
  digitalWrite(LED_PIN, pressed ? HIGH : LOW);
}`,
    callouts: [
      {
        id: "pin-2",
        title: "PIN 2 (INPUT_PULLUP)",
        description: "Reads LOW when the tactile button is pressed down.",
        icon: "pins",
        anchor3D: [8, 10.2, -23.5],
        cardOffset: [-80, -145],
      },
      {
        id: "tactile-btn",
        title: "PUSH BUTTON",
        description: "Bridges the two breadboard rows when pressed.",
        icon: "button",
        anchor3D: [43, 12.0, 2],
        cardOffset: [85, -130],
      },
      {
        id: "gnd-return",
        title: "GND",
        description: "Pulls Pin 2 to 0V when the switch closes.",
        icon: "gnd",
        anchor3D: [-25, 10.2, -23.5],
        cardOffset: [-210, -110],
      },
    ],
  },
  {
    id: "read-sensor",
    numberLabel: "4. READ A SENSOR",
    title: "4. READ A SENSOR",
    badgeColor: "#06b6d4",
    hasBreadboard: true,
    code: `// Lesson 4: HC-SR04 Ultrasonic Distance Sensor
const int TRIG_PIN = 9;
const int ECHO_PIN = 10;

void setup() {
  Serial.begin(9600);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
}

void loop() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH);
  float distanceCm = duration * 0.034 / 2;
  Serial.println(distanceCm);
  delay(100);
}`,
    callouts: [
      {
        id: "trig-echo",
        title: "TRIG · ECHO",
        description: "Pin 9 fires the ping, pin 10 hears the echo.",
        icon: "pins",
        anchor3D: [-13.5, 10.2, -23.5],
        secondaryAnchors3D: [[-16.0, 10.2, -23.5]],
        cardOffset: [-55, -145],
      },
      {
        id: "hcsr04",
        title: "HC-SR04",
        description: "Pings at 40 kHz and times the echo.",
        icon: "sonar",
        anchor3D: [39, 16.5, 8],
        cardOffset: [95, -140],
      },
      {
        id: "power-5v-gnd",
        title: "5V · GND",
        description: "Power for the sensor, straight from the board.",
        icon: "header",
        anchor3D: [-22, 10.2, 23.5],
        secondaryAnchors3D: [[-19.5, 10.2, 23.5]],
        cardOffset: [-200, 105],
      },
      {
        id: "obstacle-car",
        title: "OBSTACLE",
        description: "Click to swap distance, reflects the ultrasonic ping.",
        icon: "obstacle",
        anchor3D: [21, 5.5, 22],
        cardOffset: [110, 85],
      },
    ],
  },
  {
    id: "sense-light",
    numberLabel: "5. SENSE LIGHT",
    title: "5. SENSE LIGHT",
    badgeColor: "#eab308",
    hasBreadboard: true,
    code: `// Lesson 5: LDR Photoresistor Automatic Night Light
const int SENSOR = A0;
const int LED = 9;

void setup() {
  Serial.begin(9600);
  pinMode(LED, OUTPUT);
}

void loop() {
  int light = analogRead(SENSOR);
  digitalWrite(LED, light < 450 ? HIGH : LOW);
  delay(100);
}`,
    callouts: [
      {
        id: "night-light",
        title: "NIGHT LIGHT",
        description: 'Comes on when the reading says "dark".',
        icon: "led",
        anchor3D: [40, 13.5, 1],
        cardOffset: [-75, -145],
      },
      {
        id: "light-sensor",
        title: "LIGHT SENSOR",
        description: "Less resistance the more light it gets.",
        icon: "sensor",
        anchor3D: [49, 11.5, 11],
        cardOffset: [75, -145],
      },
      {
        id: "pin-a0",
        title: "PIN A0",
        description: "Reads the divider as 0–1023.",
        icon: "analog",
        anchor3D: [-5.5, 10.2, 23.5],
        cardOffset: [-195, 105],
      },
    ],
  },
  {
    id: "sweep-servo",
    numberLabel: "6. SWEEP A SERVO",
    title: "6. SWEEP A SERVO",
    badgeColor: "#3b82f6",
    hasBreadboard: true,
    code: `// Lesson 6: Sweep an SG90 Micro Servo on PWM Pin 9
#include <Servo.h>
Servo myServo;

void setup() {
  myServo.attach(9);
}

void loop() {
  myServo.write(15);
  delay(1000);
  myServo.write(165);
  delay(1000);
}`,
    callouts: [
      {
        id: "pwm-pin-9",
        title: "PWM PIN 9",
        description: "Sends 50 Hz pulse-width modulation angle pulses.",
        icon: "pins",
        anchor3D: [-13.5, 10.2, -23.5],
        cardOffset: [-70, -145],
      },
      {
        id: "sg90-servo",
        title: "SG90 MICRO SERVO",
        description: "Rotates its horn between 0° and 180°.",
        icon: "servo",
        anchor3D: [46, 15.0, 4],
        cardOffset: [85, -135],
      },
      {
        id: "servo-power",
        title: "5V · GND RAIL",
        description: "Supplies current to the DC gearmotor inside.",
        icon: "header",
        anchor3D: [-22, 10.2, 23.5],
        cardOffset: [-190, 105],
      },
    ],
  },
];

// ============================================================================
// PROCEDURAL GEOMETRY & INK OUTLINE HELPERS (Three.js r186 compliant)
// ============================================================================

const INK_COLOR_LIGHT = 0x1b2432;
const INK_COLOR_DARK = 0x090d14;

function roundedBox(
  w: number,
  h: number,
  d: number,
  radius = 0.4,
  segments = 3,
): RoundedBoxGeometry {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, Math.min(w, h, d) * 0.45));
}

function addInkOutlines(
  root: THREE.Object3D,
  inkHex = INK_COLOR_LIGHT,
  thresholdAngle = 22,
): void {
  const lineMat = new THREE.LineBasicMaterial({
    color: inkHex,
    transparent: true,
    opacity: 0.88,
  });

  const meshes: THREE.Mesh[] = [];
  root.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh && !obj.userData?.noInkOutline) {
      meshes.push(obj as THREE.Mesh);
    }
  });

  for (const mesh of meshes) {
    const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
    const lines = new THREE.LineSegments(edgesGeo, lineMat);
    lines.userData.isInkOutline = true;
    lines.raycast = () => {};
    mesh.add(lines);
  }
}

function createArduinoSilkscreenTexture(isDarkTheme: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = isDarkTheme ? "#162944" : "#2d5086";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = isDarkTheme ? "rgba(56, 189, 248, 0.08)" : "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 4;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.moveTo(180 + i * 48, 90);
    ctx.lineTo(180 + i * 48, 220);
    ctx.lineTo(220 + i * 42, 310);
    ctx.stroke();
  }

  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#f8fafc";

  ctx.font = "bold 20px monospace";
  const topPins = [
    "SCL",
    "SDA",
    "AREF",
    "GND",
    "13",
    "12",
    "~11",
    "~10",
    "~9",
    "8",
    "",
    "7",
    "~6",
    "~5",
    "4",
    "~3",
    "2",
    "TX1",
    "RX0",
  ];
  topPins.forEach((lbl, idx) => {
    if (!lbl) return;
    const x = 230 + idx * 38;
    ctx.fillText(lbl, x, 118);
  });

  ctx.font = "bold 24px sans-serif";
  ctx.fillText("DIGITAL (PWM~)", 610, 165);

  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(520, 315, 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(588, 315, 34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = "bold 36px sans-serif";
  ctx.fillText("−", 508, 327);
  ctx.fillText("+", 576, 327);

  ctx.font = "900 42px sans-serif";
  ctx.fillText("ARDUINO", 435, 385);

  ctx.fillStyle = "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(645, 345, 130, 52, 24);
  ctx.fill();
  ctx.fillStyle = isDarkTheme ? "#162944" : "#2d5086";
  ctx.font = "900 36px sans-serif";
  ctx.fillText("UNO", 668, 384);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("POWER", 385, 650);
  ctx.fillText("ANALOG IN", 665, 650);

  ctx.font = "bold 18px monospace";
  const pwrPins = ["IOREF", "RST", "3.3V", "5V", "GND", "GND", "VIN"];
  pwrPins.forEach((lbl, idx) => {
    ctx.fillText(lbl, 310 + idx * 42, 685);
  });
  const analogPins = ["A0", "A1", "A2", "A3", "A4", "A5"];
  analogPins.forEach((lbl, idx) => {
    ctx.fillText(lbl, 650 + idx * 42, 685);
  });

  const holes = [
    [140, 110],
    [920, 220],
    [920, 660],
    [220, 680],
  ];
  for (const [hx, hy] of holes) {
    ctx.fillStyle = "#e2c07d";
    ctx.beginPath();
    ctx.arc(hx!, hy!, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1e293b";
    ctx.beginPath();
    ctx.arc(hx!, hy!, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createBreadboardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 680;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f7f4eb";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#e5dec9";
  ctx.fillRect(0, 315, canvas.width, 50);
  ctx.strokeStyle = "#94a3b8";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 315, canvas.width, 50);

  ctx.strokeStyle = "#dc2626";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(55, 32);
  ctx.lineTo(canvas.width - 55, 32);
  ctx.moveTo(55, canvas.height - 72);
  ctx.lineTo(canvas.width - 55, canvas.height - 72);
  ctx.stroke();

  ctx.strokeStyle = "#2563eb";
  ctx.beginPath();
  ctx.moveTo(55, 86);
  ctx.lineTo(canvas.width - 55, 86);
  ctx.moveTo(55, canvas.height - 22);
  ctx.lineTo(canvas.width - 55, canvas.height - 22);
  ctx.stroke();

  const cols = 30;
  const startX = 68;
  const stepX = 30.2;

  const drawHole = (cx: number, cy: number) => {
    ctx.fillStyle = "#262930";
    ctx.fillRect(cx - 5.5, cy - 5.5, 11, 11);
  };

  for (let c = 0; c < cols; c++) {
    const x = startX + c * stepX;
    if (c % 6 !== 5) {
      drawHole(x, 50);
      drawHole(x, 72);
      drawHole(x, canvas.height - 56);
      drawHole(x, canvas.height - 34);
    }
    for (let r = 0; r < 5; r++) {
      drawHole(x, 140 + r * 32);
    }
    for (let r = 0; r < 5; r++) {
      drawHole(x, 400 + r * 32);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createJumperWire(
  start: [number, number, number],
  end: [number, number, number],
  colorHex: number,
  arcHeight = 16,
): THREE.Group {
  const wireGroup = new THREE.Group();

  const p0 = new THREE.Vector3(...start);
  const p3 = new THREE.Vector3(...end);
  const mid = p0.clone().lerp(p3, 0.5);
  const p1 = new THREE.Vector3(
    THREE.MathUtils.lerp(p0.x, mid.x, 0.55),
    Math.max(p0.y, p3.y) + arcHeight,
    THREE.MathUtils.lerp(p0.z, mid.z, 0.55),
  );
  const p2 = new THREE.Vector3(
    THREE.MathUtils.lerp(p3.x, mid.x, 0.55),
    Math.max(p0.y, p3.y) + arcHeight,
    THREE.MathUtils.lerp(p3.z, mid.z, 0.55),
  );

  const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);

  const outlineGeo = new THREE.TubeGeometry(curve, 36, 0.92, 10, false);
  const outlineMat = new THREE.MeshBasicMaterial({
    color: INK_COLOR_LIGHT,
    side: THREE.BackSide,
  });
  const outlineMesh = new THREE.Mesh(outlineGeo, outlineMat);
  outlineMesh.userData.noInkOutline = true;
  wireGroup.add(outlineMesh);

  const tubeGeo = new THREE.TubeGeometry(curve, 36, 0.64, 10, false);
  const tubeMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.42,
    metalness: 0.05,
  });
  const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
  tubeMesh.userData.noInkOutline = true;
  wireGroup.add(tubeMesh);

  const dupontMat = new THREE.MeshStandardMaterial({
    color: 0x1e242b,
    roughness: 0.6,
  });
  for (const pt of [p0, p3]) {
    const housing = new THREE.Mesh(roundedBox(2.1, 4.6, 2.1, 0.25, 2), dupontMat);
    housing.position.set(pt.x, pt.y - 1.2, pt.z);
    wireGroup.add(housing);
  }

  return wireGroup;
}

/**
 * Builds the Isometric 3D Twin Scene:
 * - If `presetId === "live"`, dynamically synthesizes 3D models, jumper wires, and callout cards
 *   for EVERY component present in `circuit`!
 * - Otherwise renders the selected curated lesson preset.
 */
function buildIllustrativeTwinScene(
  presetId: LessonPresetId,
  extractedParts: ExtractedPartInfo[],
  isDarkTheme: boolean,
  obstacleOffsetCm: number,
): {
  root: THREE.Group;
  animatedLedMeshes: THREE.Mesh[];
  servoHornGroup: THREE.Group | null;
  dynamicCallouts: CalloutDef[];
} {
  const root = new THREE.Group();
  const animatedLedMeshes: THREE.Mesh[] = [];
  let servoHornGroup: THREE.Group | null = null;
  const dynamicCallouts: CalloutDef[] = [];

  const hasBreadboard =
    presetId === "live" ? extractedParts.length > 0 : presetId !== "meet-board";
  const unoOffsetX = hasBreadboard ? -16 : 0;

  // -------------------------------------------------------------------------
  // 1. ARDUINO UNO R3 3D MODEL
  // -------------------------------------------------------------------------
  const unoGroup = new THREE.Group();
  unoGroup.position.set(unoOffsetX, 0, 0);
  root.add(unoGroup);

  const silkscreenTex = createArduinoSilkscreenTexture(isDarkTheme);
  const pcbSideMat = new THREE.MeshStandardMaterial({
    color: isDarkTheme ? 0x162944 : 0x284778,
    roughness: 0.55,
  });
  const pcbTopMat = new THREE.MeshStandardMaterial({
    map: silkscreenTex,
    roughness: 0.48,
    metalness: 0.05,
  });
  const pcbEdgeMat = new THREE.MeshStandardMaterial({
    color: 0xd6b87c,
    roughness: 0.65,
  });

  const pcbMesh = new THREE.Mesh(roundedBox(68, 2.2, 53, 0.6, 3), [
    pcbSideMat,
    pcbSideMat,
    pcbTopMat,
    pcbSideMat,
    pcbSideMat,
    pcbSideMat,
  ]);
  pcbMesh.position.set(0, 1.1, 0);
  unoGroup.add(pcbMesh);

  const trimMesh = new THREE.Mesh(roundedBox(68.4, 0.7, 53.4, 0.5, 2), pcbEdgeMat);
  trimMesh.position.set(0, 0.35, 0);
  unoGroup.add(trimMesh);

  const usbMat = new THREE.MeshStandardMaterial({
    color: 0xd6d3c9,
    roughness: 0.32,
    metalness: 0.45,
  });
  const usbMesh = new THREE.Mesh(roundedBox(16, 11, 12, 0.5, 2), usbMat);
  usbMesh.position.set(-29, 7.2, -11);
  unoGroup.add(usbMesh);

  const darkPlasticMat = new THREE.MeshStandardMaterial({
    color: 0x262930,
    roughness: 0.55,
  });
  const dcJack = new THREE.Mesh(roundedBox(14, 10, 9.5, 0.6, 2), darkPlasticMat);
  dcJack.position.set(-29, 6.8, 16);
  unoGroup.add(dcJack);

  const resetBase = new THREE.Mesh(roundedBox(6, 2.2, 6, 0.3, 2), usbMat);
  resetBase.position.set(-28, 3.2, -21);
  unoGroup.add(resetBase);
  const resetCap = new THREE.Mesh(
    new THREE.CylinderGeometry(1.9, 1.9, 2.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 }),
  );
  resetCap.position.set(-28, 4.8, -21);
  unoGroup.add(resetCap);

  const capGeom = new THREE.CylinderGeometry(3.2, 3.2, 6.5, 20);
  for (const cz of [14, 21.5]) {
    const cap = new THREE.Mesh(capGeom, usbMat);
    cap.position.set(-16, 5.2, cz);
    unoGroup.add(cap);
  }

  const xtal = new THREE.Mesh(roundedBox(10.5, 3.2, 4.8, 1.4, 3), usbMat);
  xtal.position.set(-11, 3.6, -2);
  unoGroup.add(xtal);

  const u2Chip = new THREE.Mesh(roundedBox(5.5, 1.6, 5.5, 0.3, 2), darkPlasticMat);
  u2Chip.position.set(-14, 2.8, -11);
  u2Chip.rotation.y = Math.PI / 4;
  unoGroup.add(u2Chip);

  const dipSocket = new THREE.Mesh(roundedBox(35, 3.2, 10, 0.4, 2), darkPlasticMat);
  dipSocket.position.set(8, 3.6, 9);
  unoGroup.add(dipSocket);

  const dipChip = new THREE.Mesh(
    roundedBox(33.5, 2.8, 7.6, 0.4, 2),
    new THREE.MeshStandardMaterial({ color: 0x1e2229, roughness: 0.45 }),
  );
  dipChip.position.set(8, 6.2, 9);
  unoGroup.add(dipChip);

  const pinLegMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.6,
    roughness: 0.3,
  });
  for (let i = 0; i < 14; i++) {
    const lx = -7.6 + i * 2.4;
    for (const lz of [4.8, 13.2]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.9), pinLegMat);
      leg.position.set(lx, 4.5, lz);
      unoGroup.add(leg);
    }
  }

  const buildHeaderBank = (pinCount: number, hx: number, hz: number) => {
    const bankW = pinCount * 2.54;
    const bank = new THREE.Mesh(roundedBox(bankW, 8.2, 3.2, 0.3, 2), darkPlasticMat);
    bank.position.set(hx, 6.1, hz);
    unoGroup.add(bank);

    const holeMat = new THREE.MeshBasicMaterial({ color: 0x090d14 });
    for (let p = 0; p < pinCount; p++) {
      const hole = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), holeMat);
      hole.position.set(hx - bankW / 2 + 1.27 + p * 2.54, 10.1, hz);
      hole.userData.noInkOutline = true;
      unoGroup.add(hole);
    }
  };

  buildHeaderBank(10, -5, -23.5);
  buildHeaderBank(8, 20, -23.5);
  buildHeaderBank(8, -6, 23.5);
  buildHeaderBank(6, 17, 23.5);

  const builtinLedMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.85,
  });
  const builtinLed = new THREE.Mesh(roundedBox(2.4, 1.4, 1.6, 0.2, 2), builtinLedMat);
  builtinLed.position.set(-4, 2.7, -14);
  unoGroup.add(builtinLed);
  animatedLedMeshes.push(builtinLed);

  const onLed = new THREE.Mesh(
    roundedBox(2.4, 1.4, 1.6, 0.2, 2),
    new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.9,
    }),
  );
  onLed.position.set(24, 2.7, -8);
  unoGroup.add(onLed);

  // -------------------------------------------------------------------------
  // 2. HALF-SIZE BREADBOARD & PERIPHERALS
  // -------------------------------------------------------------------------
  if (hasBreadboard) {
    const bbX = 44;
    const bbZ = 2;
    const bbGroup = new THREE.Group();
    bbGroup.position.set(bbX, 0, bbZ);
    root.add(bbGroup);

    const bbTex = createBreadboardTexture();
    const bbSideMat = new THREE.MeshStandardMaterial({
      color: 0xebe5d5,
      roughness: 0.6,
    });
    const bbTopMat = new THREE.MeshStandardMaterial({
      map: bbTex,
      roughness: 0.55,
    });

    const bbSlab = new THREE.Mesh(roundedBox(46, 7.5, 34, 0.6, 3), [
      bbSideMat,
      bbSideMat,
      bbTopMat,
      bbSideMat,
      bbSideMat,
      bbSideMat,
    ]);
    bbSlab.position.set(0, 3.75, 0);
    bbGroup.add(bbSlab);

    // =========================================================================
    // MODE A: DYNAMIC LIVE CIRCUIT IR SYNTHESIS (Updates on ANY Project Change!)
    // =========================================================================
    if (presetId === "live") {
      // Always connect GND rail wire from Arduino to Breadboard
      root.add(
        createJumperWire([unoOffsetX - 9, 10.2, -23.5], [bbX - 18, 9.5, -13], 0x1e293b, 16),
      );

      // Filter primary interactive parts vs passives so we lay them out cleanly along the breadboard
      const totalParts = extractedParts.length;
      const spacingX = Math.min(9.5, 36 / Math.max(1, totalParts));

      const cardOffsets: [number, number][] = [
        [75, -145],
        [-75, -145],
        [85, 105],
        [-195, 105],
        [-210, -120],
        [105, -35],
      ];

      extractedParts.forEach((part, idx) => {
        const localX = -15 + idx * spacingX;
        const localZ = (idx % 2 === 0 ? -3 : 4);
        const worldX = bbX + localX;
        const worldZ = bbZ + localZ;

        if (part.kind === "led") {
          const ledGroup = new THREE.Group();
          ledGroup.position.set(localX, 7.5, localZ);
          bbGroup.add(ledGroup);

          const ledColors = [0xef4444, 0x22c55e, 0x3b82f6, 0xfacc15];
          const ledHex = ledColors[idx % ledColors.length]!;
          const ledMat = new THREE.MeshStandardMaterial({
            color: ledHex,
            emissive: ledHex,
            emissiveIntensity: 0.85,
            roughness: 0.2,
          });
          const ledBody = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 4.2, 18), ledMat);
          ledBody.position.set(0, 5.8, 0);
          ledGroup.add(ledBody);
          const ledDome = new THREE.Mesh(
            new THREE.SphereGeometry(2.4, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2),
            ledMat,
          );
          ledDome.position.set(0, 7.9, 0);
          ledGroup.add(ledDome);
          animatedLedMeshes.push(ledBody, ledDome);
        } else if (part.kind === "resistor" || part.kind === "capacitor") {
          const resGroup = new THREE.Group();
          resGroup.position.set(localX, 9.0, localZ + 3);
          bbGroup.add(resGroup);

          const resBody = new THREE.Mesh(
            new THREE.CylinderGeometry(1.15, 1.15, 6.2, 14),
            new THREE.MeshStandardMaterial({
              color: part.kind === "capacitor" ? 0xd97706 : 0xe6d3a7,
              roughness: 0.5,
            }),
          );
          resBody.rotation.z = Math.PI / 2;
          resGroup.add(resBody);
        } else if (part.kind === "button") {
          const btnGroup = new THREE.Group();
          btnGroup.position.set(localX, 7.5, localZ);
          bbGroup.add(btnGroup);
          const btnHousing = new THREE.Mesh(roundedBox(6.8, 3.4, 6.8, 0.4, 2), darkPlasticMat);
          btnHousing.position.set(0, 1.7, 0);
          btnGroup.add(btnHousing);
          const btnCap = new THREE.Mesh(
            new THREE.CylinderGeometry(2.2, 2.3, 2.2, 18),
            new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35 }),
          );
          btnCap.position.set(0, 4.4, 0);
          btnGroup.add(btnCap);
        } else if (part.kind === "ultrasonic") {
          const sonarGroup = new THREE.Group();
          sonarGroup.position.set(localX, 7.5, localZ + 3);
          bbGroup.add(sonarGroup);
          const sonarPcb = new THREE.Mesh(
            roundedBox(24, 11.5, 1.6, 0.3, 2),
            new THREE.MeshStandardMaterial({ color: 0x2b4c7e, roughness: 0.45 }),
          );
          sonarPcb.position.set(0, 7.8, 0);
          sonarGroup.add(sonarPcb);
          for (const cx of [-6.5, 6.5]) {
            const cyl = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 7.0, 22), usbMat);
            cyl.rotation.x = Math.PI / 2;
            cyl.position.set(cx, 7.8, 3.8);
            sonarGroup.add(cyl);
          }
        } else if (part.kind === "servo") {
          const servoGroup = new THREE.Group();
          servoGroup.position.set(localX, 7.5, localZ);
          bbGroup.add(servoGroup);
          const servoBody = new THREE.Mesh(
            roundedBox(13, 11.5, 7, 0.5, 2),
            new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 }),
          );
          servoBody.position.set(0, 5.8, 0);
          servoGroup.add(servoBody);
          const hornPivot = new THREE.Group();
          hornPivot.position.set(3, 12.2, 0);
          servoGroup.add(hornPivot);
          servoHornGroup = hornPivot;
          const hornArm = new THREE.Mesh(
            roundedBox(10, 1.3, 2.6, 0.4, 2),
            new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
          );
          hornArm.position.set(3, 0, 0);
          hornPivot.add(hornArm);
        } else if (part.kind === "buzzer") {
          const bzCyl = new THREE.Mesh(
            new THREE.CylinderGeometry(5.2, 5.2, 6.8, 24),
            darkPlasticMat,
          );
          bzCyl.position.set(localX, 10.9, localZ);
          bbGroup.add(bzCyl);
        } else if (part.kind === "potentiometer") {
          const potBase = new THREE.Mesh(
            roundedBox(7.5, 4.5, 7.5, 0.4, 2),
            new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }),
          );
          potBase.position.set(localX, 9.8, localZ);
          bbGroup.add(potBase);
          const potKnob = new THREE.Mesh(
            new THREE.CylinderGeometry(3.2, 3.5, 6.5, 20),
            darkPlasticMat,
          );
          potKnob.position.set(localX, 15.0, localZ);
          bbGroup.add(potKnob);
        } else {
          // Photoresistor, I2C OLED, Relay, or Generic IC module
          const modMesh = new THREE.Mesh(
            roundedBox(8.5, 4.2, 6.5, 0.4, 2),
            new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.4 }),
          );
          modMesh.position.set(localX, 9.6, localZ);
          bbGroup.add(modMesh);
        }

        // Route 3D Jumper Wire from each connected Arduino Pin to this component on the Breadboard
        const activePins = part.mcuPins.filter((p) => !p.includes("GND"));
        activePins.forEach((pinName, pIdx) => {
          const startPos = getArduinoPin3DPosition(pinName, unoOffsetX);
          const endPos: [number, number, number] = [
            worldX + pIdx * 2.2,
            9.5,
            worldZ + 1.5,
          ];
          root.add(createJumperWire(startPos, endPos, part.wireColorHex, 15 + (idx % 4) * 2.5));
        });

        // Add Dynamic 3D-Anchored Callout Card (up to 6 clear callouts to prevent overlap)
        if (dynamicCallouts.length < 6) {
          const nonEmptyNets = part.nets.filter((n) => n.trim().length > 0);
          const nonEmptyPins = part.mcuPins.filter((p) => p.trim().length > 0);
          const netAndPinSuffix =
            nonEmptyPins.length > 0 && nonEmptyNets.length > 0
              ? ` — Pins: ${nonEmptyPins.join(" · ")} · Nets: ${nonEmptyNets.slice(0, 3).join(", ")}`
              : nonEmptyPins.length > 0
                ? ` — Pins: ${nonEmptyPins.join(" · ")}`
                : nonEmptyNets.length > 0
                  ? ` — Nets: ${nonEmptyNets.slice(0, 3).join(", ")}`
                  : "";
          const iconMap: Record<ExtractedPartInfo["kind"], CalloutIconKind> = {
            mcu: "chip",
            led: "led",
            resistor: "resistor",
            button: "button",
            potentiometer: "analog",
            photoresistor: "sensor",
            ultrasonic: "sonar",
            servo: "servo",
            buzzer: "buzzer",
            capacitor: "header",
            i2c: "chip",
            relay: "power",
            generic: "pins",
          };
          dynamicCallouts.push({
            id: `dyn-${part.id}`,
            title: `${part.id} · ${part.kind.charAt(0).toUpperCase() + part.kind.slice(1)}`,
            description: `${part.label} (${part.valueText})${netAndPinSuffix}`,
            icon: iconMap[part.kind] ?? "pins",
            anchor3D: [worldX, 13.0, worldZ],
            cardOffset: cardOffsets[dynamicCallouts.length % cardOffsets.length]!,
          });
        }
      });

      // Also add a callout on the Arduino side showing active MCU pins
      const allMcuPins = Array.from(new Set(extractedParts.flatMap((p) => p.mcuPins)));
      if (allMcuPins.length > 0 && dynamicCallouts.length < 6) {
        const firstPinPos = getArduinoPin3DPosition(allMcuPins[0]!, unoOffsetX);
        dynamicCallouts.push({
          id: "dyn-mcu-pins",
          title: `Active Pins (${allMcuPins.slice(0, 4).join(", ")})`,
          description: `Synthesized from sketch AST (${extractedParts.length} parts).`,
          icon: "chip",
          anchor3D: firstPinPos,
          cardOffset: [-195, -135],
        });
      }
    } else if (presetId === "blink-led") {
      // Curated Lesson 2: Blink an LED
      const ledGroup = new THREE.Group();
      ledGroup.position.set(2, 7.5, 1);
      bbGroup.add(ledGroup);

      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 5, 8), pinLegMat);
      leg1.position.set(-1.3, 2.2, 0);
      ledGroup.add(leg1);
      const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 5, 8), pinLegMat);
      leg2.position.set(1.3, 2.2, 0);
      ledGroup.add(leg2);

      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.85,
        roughness: 0.2,
      });
      const ledBody = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.8, 4.5, 20), ledMat);
      ledBody.position.set(0, 6.2, 0);
      ledGroup.add(ledBody);

      const ledDome = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        ledMat,
      );
      ledDome.position.set(0, 8.4, 0);
      ledGroup.add(ledDome);
      animatedLedMeshes.push(ledBody, ledDome);

      const resGroup = new THREE.Group();
      resGroup.position.set(-5, 9.2, 4);
      bbGroup.add(resGroup);

      const resBody = new THREE.Mesh(
        new THREE.CylinderGeometry(1.25, 1.25, 6.8, 16),
        new THREE.MeshStandardMaterial({ color: 0xe6d3a7, roughness: 0.5 }),
      );
      resBody.rotation.z = Math.PI / 2;
      resGroup.add(resBody);

      const bandColors = [0xdc2626, 0xdc2626, 0x78350f, 0xd97706];
      bandColors.forEach((bHex, idx) => {
        const band = new THREE.Mesh(
          new THREE.CylinderGeometry(1.32, 1.32, 0.7, 16),
          new THREE.MeshBasicMaterial({ color: bHex }),
        );
        band.rotation.z = Math.PI / 2;
        band.position.x = -2.1 + idx * 1.35;
        band.userData.noInkOutline = true;
        resGroup.add(band);
      });

      root.add(createJumperWire([unoOffsetX - 9, 10.2, -23.5], [44 + 0.5, 9.5, 3], 0x1e293b, 19));
      root.add(createJumperWire([unoOffsetX - 6.5, 10.2, -23.5], [44 - 8.5, 9.5, 6], 0xf59e0b, 17));
    } else if (presetId === "push-button") {
      const btnGroup = new THREE.Group();
      btnGroup.position.set(-1, 7.5, 0);
      bbGroup.add(btnGroup);

      const btnHousing = new THREE.Mesh(roundedBox(7.5, 3.6, 7.5, 0.4, 2), darkPlasticMat);
      btnHousing.position.set(0, 1.8, 0);
      btnGroup.add(btnHousing);

      const btnTopPlate = new THREE.Mesh(roundedBox(6.8, 0.5, 6.8, 0.2, 2), usbMat);
      btnTopPlate.position.set(0, 3.7, 0);
      btnGroup.add(btnTopPlate);

      const btnCap = new THREE.Mesh(
        new THREE.CylinderGeometry(2.4, 2.5, 2.4, 20),
        new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35 }),
      );
      btnCap.position.set(0, 4.8, 0);
      btnGroup.add(btnCap);

      root.add(createJumperWire([unoOffsetX + 24, 10.2, -23.5], [44 - 4, 9.5, -3], 0x22c55e, 18));
      root.add(createJumperWire([unoOffsetX - 9, 10.2, -23.5], [44 + 2.5, 9.5, 3], 0x1e293b, 17));
    } else if (presetId === "read-sensor") {
      const sonarGroup = new THREE.Group();
      sonarGroup.position.set(-5, 7.5, 6);
      sonarGroup.rotation.y = -0.15;
      bbGroup.add(sonarGroup);

      const sonarPcb = new THREE.Mesh(
        roundedBox(26, 12.5, 1.6, 0.3, 2),
        new THREE.MeshStandardMaterial({ color: 0x2b4c7e, roughness: 0.45 }),
      );
      sonarPcb.position.set(0, 8.2, 0);
      sonarGroup.add(sonarPcb);

      const canMat = new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        metalness: 0.55,
        roughness: 0.3,
      });
      const meshDarkMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.7,
      });

      for (const cx of [-7.2, 7.2]) {
        const cyl = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 7.5, 24), canMat);
        cyl.rotation.x = Math.PI / 2;
        cyl.position.set(cx, 8.2, 4.2);
        sonarGroup.add(cyl);

        const innerMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 3.8, 7.7, 20), meshDarkMat);
        innerMesh.rotation.x = Math.PI / 2;
        innerMesh.position.set(cx, 8.2, 4.2);
        sonarGroup.add(innerMesh);
      }

      root.add(createJumperWire([unoOffsetX - 6, 10.2, 23.5], [44 - 9, 9.5, 3], 0xef4444, 18));
      root.add(createJumperWire([unoOffsetX - 3.5, 10.2, 23.5], [44 - 2, 9.5, 3], 0x1e293b, 16));
      root.add(createJumperWire([unoOffsetX + 2.5, 10.2, -23.5], [44 - 6.5, 9.5, 3], 0xf59e0b, 20));
      root.add(createJumperWire([unoOffsetX + 0, 10.2, -23.5], [44 - 4, 9.5, 3], 0x22c55e, 22));

      const carGroup = new THREE.Group();
      carGroup.position.set(21, 0, 22 + obstacleOffsetCm);
      carGroup.rotation.y = -0.35;
      root.add(carGroup);

      const carMat = new THREE.MeshStandardMaterial({
        color: 0xe05a47,
        roughness: 0.45,
      });
      const carChassis = new THREE.Mesh(roundedBox(14, 4.5, 22, 1.0, 3), carMat);
      carChassis.position.set(0, 3.2, 0);
      carGroup.add(carChassis);

      const carCabin = new THREE.Mesh(roundedBox(11.5, 4.2, 12, 1.0, 3), carMat);
      carCabin.position.set(0, 6.8, -1.5);
      carGroup.add(carCabin);

      const wheelGeom = new THREE.CylinderGeometry(2.6, 2.6, 2.2, 18);
      for (const [wx, wz] of [
        [-7.2, -6],
        [7.2, -6],
        [-7.2, 6.5],
        [7.2, 6.5],
      ]) {
        const wheel = new THREE.Mesh(wheelGeom, darkPlasticMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(wx!, 2.6, wz!);
        carGroup.add(wheel);
      }
    } else if (presetId === "sense-light") {
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xeab308,
        emissiveIntensity: 0.9,
      });
      const ledCyl = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.7, 5, 20), ledMat);
      ledCyl.position.set(-4, 11.5, -1);
      bbGroup.add(ledCyl);
      animatedLedMeshes.push(ledCyl);

      const ldrWafer = new THREE.Mesh(
        new THREE.CylinderGeometry(2.6, 2.6, 1.4, 20),
        new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.35 }),
      );
      ldrWafer.position.set(5, 11, 9);
      bbGroup.add(ldrWafer);

      root.add(createJumperWire([unoOffsetX + 2.5, 10.2, -23.5], [44 - 4, 9.5, 1], 0xf59e0b, 18));
      root.add(createJumperWire([unoOffsetX + 11, 10.2, 23.5], [44 + 5, 9.5, 11], 0x22c55e, 16));
      root.add(createJumperWire([unoOffsetX - 6, 10.2, 23.5], [44 + 2, 9.5, 11], 0xef4444, 15));
    } else if (presetId === "sweep-servo") {
      const servoGroup = new THREE.Group();
      servoGroup.position.set(2, 7.5, 2);
      bbGroup.add(servoGroup);

      const servoBody = new THREE.Mesh(
        roundedBox(14, 12, 7.5, 0.6, 2),
        new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.4 }),
      );
      servoBody.position.set(0, 6, 0);
      servoGroup.add(servoBody);

      const hornPivot = new THREE.Group();
      hornPivot.position.set(3.5, 12.8, 0);
      servoGroup.add(hornPivot);
      servoHornGroup = hornPivot;

      const hornArm = new THREE.Mesh(
        roundedBox(11, 1.4, 2.8, 0.5, 2),
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 }),
      );
      hornArm.position.set(3.5, 0, 0);
      hornPivot.add(hornArm);

      root.add(createJumperWire([unoOffsetX + 2.5, 10.2, -23.5], [44 - 2, 9.5, 2], 0xf59e0b, 19));
      root.add(createJumperWire([unoOffsetX - 6, 10.2, 23.5], [44, 9.5, 4], 0xef4444, 17));
      root.add(createJumperWire([unoOffsetX - 3.5, 10.2, 23.5], [44 + 2, 9.5, 4], 0x1e293b, 16));
    }
  }

  addInkOutlines(root, isDarkTheme ? INK_COLOR_DARK : INK_COLOR_LIGHT, 22);

  return { root, animatedLedMeshes, servoHornGroup, dynamicCallouts };
}

// ============================================================================
// INTERACTIVE 2D SCHEMATIC & PIN WIRING OVERLAY (Dilum Sanjaya 00:41 Style)
// ============================================================================

const Schematic2DCard: React.FC<{
  sketchName: string;
  parts: ExtractedPartInfo[];
  isBlueprint: boolean;
  fullMode?: boolean;
  onClose?: () => void;
}> = ({ sketchName, parts, isBlueprint, fullMode = false, onClose }) => {
  const displayParts =
    parts.length > 0
      ? parts
      : [
          {
            id: "R1",
            kind: "resistor" as const,
            label: "Current-Limiting Resistor",
            valueText: "220Ω",
            mcuPins: ["D13"],
            nets: ["PIN13_NET"],
            wireColorHex: 0xf59e0b,
            wireColorCss: "#f59e0b",
          },
          {
            id: "LED1",
            kind: "led" as const,
            label: "Red 5mm LED",
            valueText: "2.0V Vf",
            mcuPins: ["D13", "GND"],
            nets: ["PIN13_NET", "GND"],
            wireColorHex: 0xef4444,
            wireColorCss: "#ef4444",
          },
        ];

  const rowHeight = 68;
  const svgHeight = Math.max(290, 110 + displayParts.length * rowHeight);
  const ink = isBlueprint ? "#1e293b" : "#e2e8f0";
  const subInk = isBlueprint ? "#64748b" : "#94a3b8";

  return (
    <div
      className={`${
        fullMode
          ? "w-full h-full flex flex-col p-6 overflow-auto"
          : "absolute top-3 left-3 z-30 w-[410px] max-w-[92vw] rounded-[8px] border shadow-xl p-3.5"
      }`}
      style={{
        backgroundColor: isBlueprint ? "rgba(250, 246, 238, 0.98)" : "rgba(15, 23, 42, 0.96)",
        borderColor: isBlueprint ? "#d4c7b0" : "#334155",
        color: ink,
      }}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b pb-2 mb-2.5" style={{ borderColor: isBlueprint ? "#e2d8c5" : "#1e293b" }}>
        <div className="flex items-center gap-2">
          <FileCode2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="font-black text-[11px] tracking-wider uppercase">
            2D WIRING SCHEMATIC
          </span>
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: isBlueprint ? "#e8dfd1" : "#1e293b",
              color: subInk,
            }}
          >
            {sketchName}
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
            title="Close 2D Schematic Panel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Interactive 2D Vector Schematic SVG */}
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 540 ${svgHeight}`}
          className="w-full h-auto select-none"
          style={{ minHeight: fullMode ? "340px" : "220px" }}
        >
          {/* Left MCU Block: ARDUINO UNO */}
          <rect
            x={24}
            y={36}
            width={135}
            height={svgHeight - 72}
            rx={6}
            fill={isBlueprint ? "#f2ece1" : "#0f172a"}
            stroke={ink}
            strokeWidth={2.2}
          />
          <text
            x={91}
            y={62}
            textAnchor="middle"
            fill={ink}
            fontSize="12"
            fontWeight="900"
            letterSpacing="1"
          >
            ARDUINO UNO
          </text>
          <text
            x={91}
            y={78}
            textAnchor="middle"
            fill={subInk}
            fontSize="9"
            fontFamily="monospace"
          >
            ATmega328P
          </text>

          {/* Right Common Ground Return Rail */}
          <line
            x1={485}
            y1={56}
            x2={485}
            y2={svgHeight - 50}
            stroke={ink}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          {/* GND Symbol at bottom of return rail */}
          <line x1={471} y1={svgHeight - 50} x2={499} y2={svgHeight - 50} stroke={ink} strokeWidth={2.2} />
          <line x1={476} y1={svgHeight - 44} x2={494} y2={svgHeight - 44} stroke={ink} strokeWidth={2} />
          <line x1={481} y1={svgHeight - 38} x2={489} y2={svgHeight - 38} stroke={ink} strokeWidth={1.8} />
          <text x={485} y={svgHeight - 24} textAnchor="middle" fill={subInk} fontSize="10" fontWeight="bold" fontFamily="monospace">
            GND (0V)
          </text>

          {/* Render Each Component Branch Row */}
          {displayParts.map((part, idx) => {
            const y = 104 + idx * rowHeight;
            const pinLabel = part.mcuPins.find((p) => !p.includes("GND")) ?? part.mcuPins[0] ?? `D${13 - idx}`;

            return (
              <g key={part.id}>
                {/* Pin Badge inside Arduino Block */}
                <rect
                  x={108}
                  y={y - 11}
                  width={44}
                  height={22}
                  rx={3}
                  fill={part.wireColorCss}
                  stroke={ink}
                  strokeWidth={1.5}
                />
                <text
                  x={130}
                  y={y + 4}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="900"
                  fontFamily="monospace"
                >
                  {pinLabel}
                </text>

                {/* Left Wire from Arduino Pin to Component Symbol */}
                <line
                  x1={159}
                  y1={y}
                  x2={275}
                  y2={y}
                  stroke={part.wireColorCss}
                  strokeWidth={2.8}
                />
                <circle cx={159} cy={y} r={3.5} fill={part.wireColorCss} stroke={ink} strokeWidth={1.2} />

                {/* IEEE/IEC 2D Symbol Box in Center */}
                <rect
                  x={275}
                  y={y - 22}
                  width={125}
                  height={44}
                  rx={5}
                  fill={isBlueprint ? "#ffffff" : "#1e293b"}
                  stroke={ink}
                  strokeWidth={2}
                />

                {/* Component ID & Value */}
                <text
                  x={337}
                  y={y - 4}
                  textAnchor="middle"
                  fill={ink}
                  fontSize="11"
                  fontWeight="900"
                >
                  {part.id} · {part.kind.toUpperCase()}
                </text>
                <text
                  x={337}
                  y={y + 12}
                  textAnchor="middle"
                  fill={subInk}
                  fontSize="9.5"
                  fontFamily="monospace"
                >
                  {part.valueText}
                </text>

                {/* Right Return Wire to GND Rail */}
                <line
                  x1={400}
                  y1={y}
                  x2={485}
                  y2={y}
                  stroke={ink}
                  strokeWidth={2}
                />
                <circle cx={485} cy={y} r={4} fill="#06b6d4" stroke={ink} strokeWidth={1.5} />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Quick Breadboard Wiring Guide Table */}
      <div
        className="mt-2 pt-2 border-t text-[11px] flex flex-wrap items-center justify-between gap-2"
        style={{ borderColor: isBlueprint ? "#e2d8c5" : "#1e293b", color: subInk }}
      >
        <span>
          <strong style={{ color: ink }}>{displayParts.length}</strong> components wired to Arduino Uno
        </span>
        <span className="font-mono text-[10px]">
          5V / Signal → Component → GND Rail
        </span>
      </div>
    </div>
  );
};

// ============================================================================
// CALLOUT SVG ICON HELPER
// ============================================================================

const CalloutSvgIcon: React.FC<{ kind: CalloutIconKind }> = ({ kind }) => {
  switch (kind) {
    case "usb":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <rect x="7" y="4" width="10" height="6" rx="1" />
          <path d="M5 10h14v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4v-6z" />
          <path d="M12 20v3M10 7h1M13 7h1" />
        </svg>
      );
    case "chip":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <rect x="9" y="9" width="6" height="6" />
          <path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </svg>
      );
    case "pins":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <path d="M7 4v11M11 4v11M5 15h8v4H5zM15 19h4" />
        </svg>
      );
    case "power":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case "header":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <path d="M8 3v5M16 3v5M6 8h12v5a6 6 0 0 1-12 0V8zM12 19v3" />
        </svg>
      );
    case "analog":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <path d="M2 12h4l3-7 4 14 3-7h6" />
        </svg>
      );
    case "gnd":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <path d="M12 3v9M5 12h14M8 16h8M10 20h4" />
        </svg>
      );
    case "led":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <path d="M8 14V9a4 4 0 1 1 8 0v5M6 14h12M10 14v7M14 14v5M12 2v1M4 9H2M22 9h-2M5.5 4.5L4 3M18.5 4.5L20 3" />
        </svg>
      );
    case "resistor":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <rect x="6" y="8" width="12" height="8" rx="2" />
          <path d="M2 12h4M18 12h4M9 8v8M12 8v8M15 8v8" />
        </svg>
      );
    case "sonar":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="8" cy="12" r="3" />
          <circle cx="16" cy="12" r="3" />
        </svg>
      );
    case "obstacle":
      return (
        <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth={1.8}>
          <path d="M5 15l2-5h10l2 5H5z" />
          <rect x="3" y="15" width="18" height="4" rx="1" />
          <circle cx="7" cy="19" r="2" />
          <circle cx="17" cy="19" r="2" />
        </svg>
      );
    default:
      return <Info className="w-4 h-4" />;
  }
};

// ============================================================================
// MAIN PCB 3D VIEWER COMPONENT
// ============================================================================

export const Pcb3DViewer: React.FC<Pcb3DViewerProps> = ({
  circuit,
  layout: providedLayout,
  sketchName = "arduino_circuit",
  theme = "light",
  onSelectPresetSketch,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Viewer Mode: "twin" (3D Isometric Twin) | "schematic2d" (Full 2D Wiring Schematic) | "pcb" (2-Layer FR4 Shield)
  const [viewMode, setViewMode] = useState<"twin" | "schematic2d" | "pcb">("twin");
  // Floating 2D Schematic Card Overlay inside 3D Twin mode (like 00:41 in Dilum's video)
  const [showSchematicOverlay, setShowSchematicOverlay] = useState<boolean>(false);

  // Default to "live" so any project selected in `App.tsx` renders its exact components immediately!
  const [activePresetId, setActivePresetId] = useState<LessonPresetId>("live");
  const [isOrthographic, setIsOrthographic] = useState<boolean>(true);
  const [showCallouts, setShowCallouts] = useState<boolean>(true);
  const [pulseActive, setPulseActive] = useState<boolean>(true);
  const [canvasTheme, setCanvasTheme] = useState<"blueprint" | "obsidian">(
    theme === "dark" ? "obsidian" : "blueprint",
  );
  const [obstacleOffsetCm, setObstacleOffsetCm] = useState<number>(0);

  const [projectedCallouts, setProjectedCallouts] = useState<ProjectedCallout[]>([]);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 960, h: 600 });

  // Classic PCB Layer Toggles
  const [showBoard, setShowBoard] = useState<boolean>(true);
  const [showTopCopper, setShowTopCopper] = useState<boolean>(true);
  const [showBottomCopper, setShowBottomCopper] = useState<boolean>(true);
  const [showVias, setShowVias] = useState<boolean>(true);
  const [showPads, setShowPads] = useState<boolean>(true);
  const [showComponents, setShowComponents] = useState<boolean>(true);

  const [webglSupported, setWebglSupported] = useState<boolean>(true);

  const sceneRootRef = useRef<THREE.Group | null>(null);
  const hierarchyRef = useRef<ThreePcbHierarchy | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const activeCameraRef = useRef<THREE.Camera | null>(null);
  const zoomLevelRef = useRef<number>(1.0);

  // Extract parts dynamically whenever `circuit` changes
  const extractedParts = useMemo(() => {
    return extractCircuitParts(circuit);
  }, [circuit]);

  // Whenever the user switches projects in `App.tsx` (`circuit` or `sketchName` changes),
  // automatically switch to `"live"` mode so the 3D scene & callouts update immediately!
  useEffect(() => {
    setActivePresetId("live");
  }, [circuit, sketchName]);

  const activePreset = useMemo(() => {
    return LESSON_PRESETS.find((p) => p.id === activePresetId) ?? LESSON_PRESETS[0]!;
  }, [activePresetId]);

  const routedLayout = useMemo(() => {
    if (providedLayout) return providedLayout;
    try {
      const placementRes = placeCircuit(circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      const routingRes = routeCircuit(placementRes.layout, circuit, { gridPitchMm: 0.635 });
      return routingRes.layout;
    } catch {
      const placementRes = placeCircuit(circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      return placementRes.layout;
    }
  }, [circuit, providedLayout]);

  const scene3d: PcbScene3D = useMemo(() => {
    return buildPcbScene3D(routedLayout, circuit);
  }, [routedLayout, circuit]);

  const handleRotateStep = useCallback((dir: -1 | 1) => {
    const root = sceneRootRef.current;
    if (!root) return;
    root.rotation.y += dir * (Math.PI / 8);
  }, []);

  const handleZoomStep = useCallback((factor: number) => {
    const cam = activeCameraRef.current;
    if (!cam) return;
    if ((cam as THREE.OrthographicCamera).isOrthographicCamera) {
      const ortho = cam as THREE.OrthographicCamera;
      ortho.zoom = THREE.MathUtils.clamp(ortho.zoom * factor, 0.45, 2.8);
      ortho.updateProjectionMatrix();
    } else if ((cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const persp = cam as THREE.PerspectiveCamera;
      persp.position.multiplyScalar(1 / factor);
      persp.updateProjectionMatrix();
    }
    zoomLevelRef.current = THREE.MathUtils.clamp(zoomLevelRef.current * factor, 0.45, 2.8);
  }, []);

  const handleSelectLesson = (preset: LessonPreset) => {
    setActivePresetId(preset.id);
    if (preset.code && onSelectPresetSketch) {
      onSelectPresetSketch(preset.code, preset.id);
    }
    if (preset.code) {
      window.dispatchEvent(
        new CustomEvent("s2c:select-preset-sketch", {
          detail: { presetId: preset.id, code: preset.code, title: preset.title },
        }),
      );
    }
  };

  // Three.js r186 Mount & Render Loop
  useEffect(() => {
    if (viewMode === "schematic2d") return;
    const container = mountRef.current;
    if (!container) return;

    try {
      const testCanvas = document.createElement("canvas");
      const gl = testCanvas.getContext("webgl2") || testCanvas.getContext("webgl");
      if (!gl) {
        setWebglSupported(false);
        return;
      }
    } catch {
      setWebglSupported(false);
      return;
    }

    const width = container.clientWidth || 960;
    const height = container.clientHeight || 600;
    setViewportSize({ w: width, h: height });

    const isDark = canvasTheme === "obsidian";
    const scene = new THREE.Scene();

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.05 : 1.15;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const aspect = width / height;
    const frustumSize = 112;
    let camera: THREE.OrthographicCamera | THREE.PerspectiveCamera;

    if (isOrthographic) {
      camera = new THREE.OrthographicCamera(
        (-frustumSize * aspect) / 2,
        (frustumSize * aspect) / 2,
        frustumSize / 2,
        -frustumSize / 2,
        -500,
        1000,
      );
      camera.position.set(-85, 95, 95);
      camera.zoom = zoomLevelRef.current;
      camera.updateProjectionMatrix();
    } else {
      camera = new THREE.PerspectiveCamera(36, aspect, 1, 1200);
      camera.position.set(-95, 105, 110);
    }
    activeCameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(8, 2, 2);
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.update();
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.65 : 0.9);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, isDark ? 1.25 : 1.45);
    keyLight.position.set(-70, 140, 90);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.75);
    fillLight.position.set(90, 80, -70);
    scene.add(fillLight);

    const masterGroup = new THREE.Group();
    sceneRootRef.current = masterGroup;
    scene.add(masterGroup);

    let animatedLeds: THREE.Mesh[] = [];
    let servoHorn: THREE.Group | null = null;
    let calloutsToProject: CalloutDef[] = activePreset.callouts;

    if (viewMode === "twin") {
      const twin = buildIllustrativeTwinScene(
        activePresetId,
        extractedParts,
        isDark,
        obstacleOffsetCm,
      );
      masterGroup.add(twin.root);
      animatedLeds = twin.animatedLedMeshes;
      servoHorn = twin.servoHornGroup;
      if (activePresetId === "live") {
        calloutsToProject =
          twin.dynamicCallouts.length > 0
            ? twin.dynamicCallouts
            : LESSON_PRESETS[1]!.callouts;
      }
    } else {
      const h = buildThreePcbGroup(scene3d);
      h.root.rotation.x = -Math.PI / 2;
      h.root.position.set(-34, 2, 27);
      addInkOutlines(h.root, isDark ? INK_COLOR_DARK : INK_COLOR_LIGHT, 20);
      hierarchyRef.current = h;
      masterGroup.add(h.root);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 600;
      setViewportSize({ w, h });

      const newAspect = w / h;
      if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
        const ortho = camera as THREE.OrthographicCamera;
        ortho.left = (-frustumSize * newAspect) / 2;
        ortho.right = (frustumSize * newAspect) / 2;
        ortho.top = frustumSize / 2;
        ortho.bottom = -frustumSize / 2;
        ortho.updateProjectionMatrix();
      } else {
        const persp = camera as THREE.PerspectiveCamera;
        persp.aspect = newAspect;
        persp.updateProjectionMatrix();
      }
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    let animId: number;
    const tempVec = new THREE.Vector3();
    const clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      if (pulseActive) {
        const blinkOn = Math.sin(elapsed * 4.2) > 0;
        for (const ledMesh of animatedLeds) {
          const mat = ledMesh.material as THREE.MeshStandardMaterial;
          if (mat && "emissiveIntensity" in mat) {
            mat.emissiveIntensity = blinkOn ? 1.1 : 0.12;
          }
        }
        if (servoHorn) {
          servoHorn.rotation.y = Math.sin(elapsed * 2.4) * 0.65;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (viewMode === "twin" && showCallouts) {
        const w = renderer.domElement.clientWidth || width;
        const h = renderer.domElement.clientHeight || height;

        const cardWidth = 225;
        const cardHeight = 76;
        const padX = 12;
        const padY = 12;
        const maxCardX = Math.max(padX, w - cardWidth - padX);
        const maxCardY = Math.max(padY, h - cardHeight - 48);

        const rawProjected: ProjectedCallout[] = calloutsToProject.map((c, idx) => {
          tempVec.set(...c.anchor3D);
          tempVec.applyMatrix4(masterGroup.matrixWorld);
          tempVec.project(camera);

          const sx = (tempVec.x * 0.5 + 0.5) * w;
          const sy = (-(tempVec.y * 0.5) + 0.5) * h;

          // Place in non-overlapping left/right edge columns so cards never overflow or stack on top of each other
          const preferLeft = c.cardOffset[0] < 0 || (c.cardOffset[0] === 0 && idx % 2 === 0);
          const rawX = preferLeft ? Math.min(sx + c.cardOffset[0], w * 0.5 - cardWidth - 8) : Math.max(sx + c.cardOffset[0], w * 0.5 + 8);
          const cardX = THREE.MathUtils.clamp(rawX, padX, maxCardX);
          const cardY = THREE.MathUtils.clamp(sy + c.cardOffset[1], padY, maxCardY);

          const secondaryScreen = c.secondaryAnchors3D?.map((pt) => {
            tempVec.set(...pt);
            tempVec.applyMatrix4(masterGroup.matrixWorld);
            tempVec.project(camera);
            return {
              x: (tempVec.x * 0.5 + 0.5) * w,
              y: (-(tempVec.y * 0.5) + 0.5) * h,
            };
          });

          return {
            ...c,
            screenX: sx,
            screenY: sy,
            cardX,
            cardY,
            secondaryScreen,
            visible: tempVec.z < 1,
          };
        });

        // Deterministic vertical collision avoidance per column so cards never overlap each other
        const resolveColumnCollisions = (cards: ProjectedCallout[]) => {
          cards.sort((a, b) => a.cardY - b.cardY || a.id.localeCompare(b.id));
          const minGapY = cardHeight + 8;
          // Forward pass (push down)
          for (let i = 1; i < cards.length; i++) {
            const prev = cards[i - 1]!;
            const curr = cards[i]!;
            if (Math.abs(curr.cardX - prev.cardX) < cardWidth + 8 && curr.cardY < prev.cardY + minGapY) {
              curr.cardY = prev.cardY + minGapY;
            }
          }
          // Clamp bottom & backward pass (push up if bottom overflowed)
          for (let i = cards.length - 1; i >= 0; i--) {
            const curr = cards[i]!;
            if (curr.cardY > maxCardY) {
              curr.cardY = maxCardY;
            }
            if (i > 0) {
              const prev = cards[i - 1]!;
              if (
                Math.abs(curr.cardX - prev.cardX) < cardWidth + 8 &&
                prev.cardY > curr.cardY - minGapY
              ) {
                prev.cardY = Math.max(padY, curr.cardY - minGapY);
              }
            }
          }
        };

        const leftCards = rawProjected.filter((c) => c.visible && c.cardX < w * 0.45);
        const rightCards = rawProjected.filter((c) => c.visible && c.cardX >= w * 0.45);
        resolveColumnCollisions(leftCards);
        resolveColumnCollisions(rightCards);

        setProjectedCallouts(rawProjected);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      pmremGenerator.dispose();
      envTex.dispose();
      renderer.dispose();
      controls.dispose();
    };
  }, [
    viewMode,
    activePresetId,
    activePreset,
    extractedParts,
    scene3d,
    isOrthographic,
    canvasTheme,
    showCallouts,
    pulseActive,
    obstacleOffsetCm,
  ]);

  useEffect(() => {
    const h = hierarchyRef.current;
    if (!h) return;
    h.boardGroup.visible = showBoard;
    h.tracesTopGroup.visible = showTopCopper;
    h.tracesBottomGroup.visible = showBottomCopper;
    h.viasGroup.visible = showVias;
    h.padsGroup.visible = showPads;
    h.componentsGroup.visible = showComponents;
  }, [showBoard, showTopCopper, showBottomCopper, showVias, showPads, showComponents]);

  const handleDownloadSceneJson = () => {
    const jsonStr = JSON.stringify(scene3d, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sketchName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_scene3d.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportGlb = () => {
    const root = sceneRootRef.current;
    if (!root) return;

    const exporter = new GLTFExporter();
    exporter.parse(
      root,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${sketchName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_3d_twin.glb`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      (err) => {
        console.error("GLB Export error:", err);
      },
      { binary: true },
    );
  };

  const isBlueprint = canvasTheme === "blueprint";

  return (
    <div
      className="flex flex-col h-full border rounded-[2px] overflow-hidden relative select-none"
      style={{
        backgroundColor: isBlueprint ? "#f5efe6" : "#0b0f17",
        borderColor: isBlueprint ? "#d6cbb9" : "var(--border-app)",
        color: isBlueprint ? "#1e293b" : "#f8fafc",
      }}
    >
      {/* Top Mode & Export Bar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b text-xs z-30"
        style={{
          backgroundColor: isBlueprint ? "rgba(245, 239, 230, 0.92)" : "rgba(15, 23, 42, 0.9)",
          borderColor: isBlueprint ? "#dfd5c3" : "rgba(255,255,255,0.1)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="font-semibold text-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
            <span>{sketchName}</span>
            <span className="font-mono text-[11px] opacity-75">({extractedParts.length} parts)</span>
          </span>

          {/* 3-Way Mode Switcher: 3D Digital Twin | 2D Schematic | PCB Shield */}
          <div
            className="flex items-center rounded-lg p-0.5 border text-[11px] font-medium"
            style={{
              borderColor: isBlueprint ? "#cbbba0" : "#334155",
              backgroundColor: isBlueprint ? "#ebe2d3" : "#0f172a",
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode("twin")}
              className={`px-2.5 py-0.5 rounded-md transition cursor-pointer ${
                viewMode === "twin"
                  ? "bg-cyan-600 text-white"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              3D Digital Twin
            </button>
            <button
              type="button"
              onClick={() => setViewMode("schematic2d")}
              className={`px-2.5 py-0.5 rounded-md transition cursor-pointer ${
                viewMode === "schematic2d"
                  ? "bg-cyan-600 text-white"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              2D Schematic
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pcb")}
              className={`px-2.5 py-0.5 rounded-md transition cursor-pointer ${
                viewMode === "pcb"
                  ? "bg-cyan-600 text-white"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              PCB Shield <span className="font-mono">({scene3d.metadata.traceCount})</span>
            </button>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {viewMode === "twin" && (
            <button
              type="button"
              onClick={() => setShowSchematicOverlay((v) => !v)}
              className="px-2.5 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
              style={{
                borderColor: showSchematicOverlay ? "#06b6d4" : isBlueprint ? "#c5b8a1" : "#334155",
                backgroundColor: showSchematicOverlay
                  ? "rgba(6, 182, 212, 0.16)"
                  : isBlueprint
                    ? "#fcf9f4"
                    : "#1e293b",
              }}
              title="Toggle floating 2D wiring schematic card over 3D view"
            >
              <FileCode2 className="w-3 h-3" />
              <span>2D Wiring Card</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadSceneJson}
            className="px-2.5 py-1 rounded-md border text-[11px] font-mono font-medium flex items-center gap-1 hover:opacity-80 cursor-pointer"
            style={{
              borderColor: isBlueprint ? "#c5b8a1" : "#334155",
              backgroundColor: isBlueprint ? "#fcf9f4" : "#1e293b",
            }}
          >
            <Download className="w-3 h-3" />
            <span>JSON</span>
          </button>

          <button
            type="button"
            onClick={handleExportGlb}
            className="px-2.5 py-1 rounded-md border text-[11px] font-mono font-medium flex items-center gap-1 hover:opacity-80 cursor-pointer"
            style={{
              borderColor: isBlueprint ? "#c5b8a1" : "#334155",
              backgroundColor: isBlueprint ? "#fcf9f4" : "#1e293b",
            }}
          >
            <Download className="w-3 h-3" />
            <span>GLB</span>
          </button>
        </div>
      </div>

      {/* Main Viewport Area */}
      <div
        className="flex-1 relative w-full h-full min-h-[480px] overflow-hidden"
        style={{
          backgroundImage: isBlueprint
            ? `
              linear-gradient(30deg, rgba(185, 168, 142, 0.24) 1px, transparent 1px),
              linear-gradient(150deg, rgba(185, 168, 142, 0.24) 1px, transparent 1px)
            `
            : `
              linear-gradient(30deg, rgba(212, 175, 55, 0.10) 1px, transparent 1px),
              linear-gradient(150deg, rgba(212, 175, 55, 0.10) 1px, transparent 1px)
            `,
          backgroundSize: "48px 28px",
        }}
      >
        {viewMode === "schematic2d" ? (
          <Schematic2DViewer
            circuit={circuit}
            sketchName={sketchName}
            theme={isBlueprint ? "light" : "dark"}
            onSwitchTo3D={() => setViewMode("twin")}
          />
        ) : webglSupported ? (
          <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <Box className="w-12 h-12 text-amber-500 animate-pulse" />
            <h3 className="text-base font-bold">WebGL Hardware Acceleration Unavailable</h3>
          </div>
        )}

        {/* Floating 2D Schematic Card Overlay (When toggled inside 3D Twin mode) */}
        {viewMode === "twin" && showSchematicOverlay && (
          <Schematic2DCard
            sketchName={sketchName}
            parts={extractedParts}
            isBlueprint={isBlueprint}
            onClose={() => setShowSchematicOverlay(false)}
          />
        )}

        {/* 3D-Anchored Dashed SVG Leader Lines + Glowing Cyan Dots (`#06b6d4`) */}
        {viewMode === "twin" && showCallouts && (
          <svg
            className="absolute inset-0 pointer-events-none z-10"
            width={viewportSize.w}
            height={viewportSize.h}
          >
            {projectedCallouts.map((c) => {
              if (!c.visible) return null;

              const cardW = 225;
              const cardH = 82;
              const cardCenterX = c.cardX + cardW / 2;
              const cardCenterY = c.cardY + cardH / 2;

              const attachBottom = c.cardY + cardH < c.screenY - 10;
              const attachTop = c.cardY > c.screenY + 10;
              const attachX =
                attachBottom || attachTop
                  ? cardCenterX
                  : c.cardX < c.screenX
                    ? c.cardX + cardW
                    : c.cardX;
              const attachY = attachBottom
                ? c.cardY + cardH + 6
                : attachTop
                  ? c.cardY - 6
                  : cardCenterY;

              const elbowX = attachBottom || attachTop ? attachX : (attachX + c.screenX) / 2;
              const elbowY = attachBottom || attachTop ? (attachY + c.screenY) / 2 : attachY;

              const strokeColor = isBlueprint ? "#334155" : "#94a3b8";

              return (
                <g key={c.id}>
                  <path
                    d={`M ${attachX} ${attachY} L ${elbowX} ${elbowY} L ${c.screenX} ${c.screenY}`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={1.6}
                    strokeDasharray="4 4"
                  />

                  {c.secondaryScreen?.map((sec, idx) => (
                    <g key={`${c.id}-sec-${idx}`}>
                      <path
                        d={`M ${elbowX} ${elbowY} L ${sec.x} ${sec.y}`}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={1.4}
                        strokeDasharray="4 4"
                      />
                      <circle cx={sec.x} cy={sec.y} r={6.5} fill="rgba(6, 182, 212, 0.28)" />
                      <circle
                        cx={sec.x}
                        cy={sec.y}
                        r={3.8}
                        fill="#22d3ee"
                        stroke="#0e7490"
                        strokeWidth={1.5}
                      />
                    </g>
                  ))}

                  <circle
                    cx={attachX}
                    cy={attachY}
                    r={3.5}
                    fill={isBlueprint ? "#f5efe6" : "#0f172a"}
                    stroke="#0891b2"
                    strokeWidth={1.8}
                  />

                  <circle cx={c.screenX} cy={c.screenY} r={7.5} fill="rgba(6, 182, 212, 0.30)" />
                  <circle
                    cx={c.screenX}
                    cy={c.screenY}
                    r={4.2}
                    fill="#22d3ee"
                    stroke="#0e7490"
                    strokeWidth={1.5}
                  />
                </g>
              );
            })}
          </svg>
        )}

        {/* Floating HTML/CSS Callout Cards */}
        {viewMode === "twin" &&
          showCallouts &&
          projectedCallouts.map((c) =>
            c.visible ? (
              <div
                key={c.id}
                onClick={
                  c.id === "obstacle-car"
                    ? () => setObstacleOffsetCm((p) => (p === 0 ? 10 : p === 10 ? -6 : 0))
                    : undefined
                }
                className={`absolute z-20 w-[225px] rounded-[6px] border px-3 py-2.5 shadow-sm transition-transform duration-75 ${
                  c.id === "obstacle-car" ? "cursor-pointer hover:scale-[1.02]" : "pointer-events-none"
                }`}
                style={{
                  left: `${c.cardX}px`,
                  top: `${c.cardY}px`,
                  backgroundColor: isBlueprint
                    ? "rgba(250, 246, 238, 0.95)"
                    : "rgba(15, 23, 42, 0.92)",
                  borderColor: isBlueprint ? "#d5c9b4" : "rgba(56, 189, 248, 0.35)",
                  color: isBlueprint ? "#1e293b" : "#f1f5f9",
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className="mt-0.5 shrink-0"
                    style={{ color: isBlueprint ? "#1e293b" : "#38bdf8" }}
                  >
                    <CalloutSvgIcon kind={c.icon} />
                  </div>
                  <div className="min-w-0">
                    <div
                      className="font-black text-[11px] tracking-wide uppercase leading-tight"
                      style={{ color: isBlueprint ? "#0f172a" : "#f8fafc" }}
                    >
                      {c.title}
                    </div>
                    <div
                      className="text-[11px] leading-snug mt-0.5"
                      style={{ color: isBlueprint ? "#57534e" : "#94a3b8" }}
                    >
                      {c.description}
                    </div>
                  </div>
                </div>
              </div>
            ) : null,
          )}

        {/* PCB Layer Visibility Dock (In Routed PCB Shield Mode) */}
        {viewMode === "pcb" && (
          <div
            className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 p-2 rounded border text-[10px] backdrop-blur-md z-20"
            style={{
              backgroundColor: "rgba(15, 23, 42, 0.88)",
              borderColor: "#334155",
              color: "#f8fafc",
            }}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400 mr-1" />
            <button
              type="button"
              onClick={() => setShowBoard(!showBoard)}
              className={`px-1.5 py-0.5 border rounded ${showBoard ? "border-emerald-500 text-emerald-300" : "border-slate-700 text-slate-500"}`}
            >
              FR4
            </button>
            <button
              type="button"
              onClick={() => setShowTopCopper(!showTopCopper)}
              className={`px-1.5 py-0.5 border rounded ${showTopCopper ? "border-amber-500 text-amber-300" : "border-slate-700 text-slate-500"}`}
            >
              TOP CU
            </button>
            <button
              type="button"
              onClick={() => setShowBottomCopper(!showBottomCopper)}
              className={`px-1.5 py-0.5 border rounded ${showBottomCopper ? "border-blue-500 text-blue-300" : "border-slate-700 text-slate-500"}`}
            >
              BOT CU
            </button>
            <button
              type="button"
              onClick={() => setShowVias(!showVias)}
              className={`px-1.5 py-0.5 border rounded ${showVias ? "border-yellow-500 text-yellow-300" : "border-slate-700 text-slate-500"}`}
            >
              VIAS
            </button>
            <button
              type="button"
              onClick={() => setShowPads(!showPads)}
              className={`px-1.5 py-0.5 border rounded ${showPads ? "border-amber-400 text-amber-200" : "border-slate-700 text-slate-500"}`}
            >
              PADS
            </button>
            <button
              type="button"
              onClick={() => setShowComponents(!showComponents)}
              className={`px-1.5 py-0.5 border rounded ${showComponents ? "border-cyan-400 text-cyan-200" : "border-slate-700 text-slate-500"}`}
            >
              PARTS
            </button>
          </div>
        )}

        {/* Floating Viewport Control Pill (With 3D / 2D Schematic Toggle Icon like 00:41 in video) */}
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2.5 py-1 rounded-[8px] border shadow-md z-30"
          style={{
            backgroundColor: isBlueprint
              ? "rgba(250, 246, 238, 0.96)"
              : "rgba(15, 23, 42, 0.94)",
            borderColor: isBlueprint ? "#d4c7b0" : "#334155",
            color: isBlueprint ? "#1e293b" : "#e2e8f0",
          }}
        >
          <button
            type="button"
            onClick={() => handleRotateStep(-1)}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition"
            title="Rotate Counter-Clockwise"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleRotateStep(1)}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition"
            title="Rotate Clockwise"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <div
            className="h-4 w-[1px] mx-1"
            style={{ backgroundColor: isBlueprint ? "#d4c7b0" : "#334155" }}
          />

          <button
            type="button"
            onClick={() => handleZoomStep(0.85)}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition"
            title="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => handleZoomStep(1.18)}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition"
            title="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div
            className="h-4 w-[1px] mx-1"
            style={{ backgroundColor: isBlueprint ? "#d4c7b0" : "#334155" }}
          />

          <button
            type="button"
            onClick={() => setShowCallouts((v) => !v)}
            className={`p-1.5 rounded transition ${
              showCallouts
                ? "bg-teal-500/20 text-teal-700 dark:text-teal-300"
                : "opacity-60 hover:opacity-100"
            }`}
            title="Toggle 3D Callout Annotations (ⓘ)"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsOrthographic((v) => !v)}
            className={`px-2 py-1 rounded text-[10px] font-black tracking-wider transition ${
              isOrthographic
                ? "bg-teal-600/20 text-teal-800 dark:text-teal-300"
                : "opacity-60 hover:opacity-100"
            }`}
            title="Toggle Orthographic Isometric vs Perspective"
          >
            ISO
          </button>

          {/* 2D Schematic Toggle Button inside Control Pill */}
          <button
            type="button"
            onClick={() => setShowSchematicOverlay((v) => !v)}
            className={`px-2 py-1 rounded text-[10px] font-black tracking-wider transition flex items-center gap-1 ${
              showSchematicOverlay || viewMode === "schematic2d"
                ? "bg-cyan-600 text-white"
                : "opacity-70 hover:opacity-100"
            }`}
            title="Toggle 2D Wiring Schematic Card"
          >
            <Cpu className="w-3 h-3" />
            <span>2D</span>
          </button>

          <button
            type="button"
            onClick={() => setPulseActive((v) => !v)}
            className={`p-1.5 rounded transition ${
              pulseActive
                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                : "opacity-60 hover:opacity-100"
            }`}
            title="Toggle Live Signal & LED Animation"
          >
            <Activity className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setCanvasTheme((prev) => (prev === "blueprint" ? "obsidian" : "blueprint"))
            }
            className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition"
            title="Switch between Warm Blueprint (#f5efe6) and Obsidian Matte Gold"
          >
            {isBlueprint ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Bottom Interactive Lesson / Circuit Preset Carousel Deck (Unclipped) */}
      <div
        className="px-3 py-2 border-t shrink-0 z-30"
        style={{
          backgroundColor: isBlueprint ? "#f2ece1" : "#0f172a",
          borderColor: isBlueprint ? "#dfd5c3" : "#1e293b",
        }}
      >
        <div
          className="text-[10px] font-semibold tracking-wider uppercase mb-1.5"
          style={{ color: isBlueprint ? "#475569" : "#94a3b8" }}
        >
          Lessons &amp; Live Project Sync
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          {LESSON_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id && viewMode === "twin";
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setViewMode("twin");
                  handleSelectLesson(preset);
                }}
                className="group flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg border shrink-0 transition-all text-left cursor-pointer"
                style={{
                  backgroundColor: isBlueprint ? "#faf6ee" : "#1e293b",
                  borderColor: isSelected
                    ? "#06b6d4"
                    : isBlueprint
                      ? "#d8ccb8"
                      : "#334155",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-white text-[9px] shrink-0"
                    style={{
                      backgroundColor: preset.badgeColor,
                    }}
                  >
                    {preset.id === "live" && "LIVE"}
                    {preset.id === "meet-board" && "UNO"}
                    {preset.id === "blink-led" && "LED"}
                    {preset.id === "push-button" && "BTN"}
                    {preset.id === "read-sensor" && "PING"}
                    {preset.id === "sense-light" && "LDR"}
                    {preset.id === "sweep-servo" && "PWM"}
                  </span>

                  <span
                    className="font-medium text-xs whitespace-nowrap"
                    style={{ color: isBlueprint ? "#0f172a" : "#f8fafc" }}
                  >
                    {preset.id === "live" ? `Live (${sketchName})` : preset.title}
                  </span>
                </div>

                <ChevronRight
                  className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:translate-x-0.5 transition-transform"
                  style={{ color: isBlueprint ? "#334155" : "#94a3b8" }}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};