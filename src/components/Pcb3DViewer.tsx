/**
 * @license Apache-2.0
 * sketch2circuit — Obsidian Matte Gold & Bioluminescent 3D Digital Twin.
 * Features:
 * - High-Craft PBR Materials (Matte Obsidian Soldermask, ENIG 24k Gold Pads, Brushed Aluminum, Clearcoat Epoxy)
 * - Live Bioluminescent Signal Pulse Animation streaming along 3D Bezier Wire Harnesses
 * - Frosted Obsidian Glassmorphic Floating HUDs (View Presets, Transport Rig Controls, Project Selector #1-#5)
 * - Dual Mode: 3D Arduino + Breadboard + Mechatronics Rigs vs. Manufacturable FR4/Obsidian PCB Shield
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
  Cpu,
  Download,
  FastForward,
  Flame,
  Layers,
  Pause,
  Play,
  Rewind,
  SkipBack,
  SkipForward,
  Sparkles,
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export type MechatronicsProjectId =
  | "tennis_shooter"
  | "rc_car"
  | "quad_drone"
  | "radar_turret"
  | "sense_light";

export interface MechatronicsProjectPreset {
  id: MechatronicsProjectId;
  stepNumber: number;
  title: string;
  subtitle: string;
  badge: string;
  description: string;
  specs: string[];
  code: string;
}

export const MECHATRONICS_PROJECTS: MechatronicsProjectPreset[] = [
  {
    id: "tennis_shooter",
    stepNumber: 1,
    title: "TENNIS BALL SHOOTER",
    subtitle: "Dual Flywheel Launch Motors + SG90 Servo Hopper",
    badge: "MECHATRONICS 1/5",
    description:
      "Dual high-inertia PWM flywheel motors spin up to launch velocity while an SG90 micro-servo gate feeds optic-yellow tennis balls whenever the HC-SR04 ultrasonic sensor detects a player ready.",
    specs: [
      "PWM Flywheel Drive: Pin D5 (3450 RPM via MOSFET stage)",
      "Hopper Feeder Gate: SG90 Servo on Timer1 Pin D9",
      "Player Rangefinder: HC-SR04 Ultrasonic on D11 / D12",
    ],
    code: `// @s2c: led(color=green) on D3
// Sketch2Circuit - Obsidian Hardware Test: Tennis Ball Shooter
#include <Servo.h>

#define PIN_FLYWHEEL_PWM 5
#define PIN_STATUS_LED   3
#define PIN_SERVO_FEEDER 9
#define PIN_SONAR_TRIG   11
#define PIN_SONAR_ECHO   12
#define PIN_SPEED_POT    A0

Servo hopperServo;

void setup() {
  pinMode(PIN_FLYWHEEL_PWM, OUTPUT);
  pinMode(PIN_STATUS_LED, OUTPUT);
  pinMode(PIN_SONAR_TRIG, OUTPUT);
  pinMode(PIN_SONAR_ECHO, INPUT);
  hopperServo.attach(PIN_SERVO_FEEDER);
}

void loop() {
  int throttle = analogRead(PIN_SPEED_POT) >> 2;
  analogWrite(PIN_FLYWHEEL_PWM, throttle);
  digitalWrite(PIN_STATUS_LED, HIGH);

  // Actuate servo feeder stroke
  hopperServo.write(135);
  delay(350);
  hopperServo.write(45);
  delay(650);
}`,
  },
  {
    id: "rc_car",
    stepNumber: 2,
    title: "AUTONOMOUS 4WD RC CAR",
    subtitle: "L298N Dual H-Bridge + Ultrasonic Steering",
    badge: "MECHATRONICS 2/5",
    description:
      "Four-wheel drive robotic chassis powered by an L298N dual H-bridge driver, Ackermann steering servo, and front-mounted HC-SR04 ultrasonic collision avoidance.",
    specs: [
      "Traction Drive: L298N ENA PWM on Pin D5",
      "Steering Actuator: SG90 Servo on Pin D9",
      "Collision Sonar: HC-SR04 on Pins D7 / D8",
    ],
    code: `// @s2c: led(color=blue) on D6
// Autonomous 4WD RC Car: L298N PWM Drive + Steering Servo + HC-SR04 Sonar
#include <Servo.h>

const int DRIVE_PWM_ENA = 5;
const int HEADLIGHT_LED = 6;
const int STEER_SERVO_PIN = 9;
const int SONAR_TRIG = 7;
const int SONAR_ECHO = 8;
const int THROTTLE_ADC = A0;

Servo steeringServo;

void setup() {
  pinMode(DRIVE_PWM_ENA, OUTPUT);
  pinMode(HEADLIGHT_LED, OUTPUT);
  pinMode(SONAR_TRIG, OUTPUT);
  pinMode(SONAR_ECHO, INPUT);
  steeringServo.attach(STEER_SERVO_PIN);
}

void loop() {
  int throttle = analogRead(THROTTLE_ADC) >> 2;
  analogWrite(DRIVE_PWM_ENA, throttle);
  analogWrite(HEADLIGHT_LED, 220);
  steeringServo.write(90);
  delay(40);
}`,
  },
  {
    id: "quad_drone",
    stepNumber: 3,
    title: "QUADCOPTER FLIGHT CONTROLLER",
    subtitle: "4-Channel ESC Hardware PWM Mixer",
    badge: "MECHATRONICS 3/5",
    description:
      "X-configuration quadcopter flight controller driving 4 brushless outrunner motors via hardware PWM timers (D3, D5, D6, D9) with counter-rotating CW/CCW propellers.",
    specs: [
      "Front-Left / Front-Right ESC: Pins D3 & D5 (490Hz/980Hz)",
      "Rear-Left / Rear-Right ESC: Pins D6 & D9",
      "Collective Throttle Input: Analog Stick A0",
    ],
    code: `// @s2c: led(color=green) on D3
// @s2c: led(color=red) on D5
// Quadcopter Flight Controller: 4-Channel Hardware PWM ESC Mixer
const int MOTOR_FL_PWM = 3;
const int MOTOR_FR_PWM = 5;
const int MOTOR_RL_PWM = 6;
const int MOTOR_RR_PWM = 9;
const int THROTTLE_STICK = A0;

void setup() {
  pinMode(MOTOR_FL_PWM, OUTPUT);
  pinMode(MOTOR_FR_PWM, OUTPUT);
  pinMode(MOTOR_RL_PWM, OUTPUT);
  pinMode(MOTOR_RR_PWM, OUTPUT);
}

void loop() {
  int stick = analogRead(THROTTLE_STICK);
  int escCommand = map(stick, 0, 1023, 45, 250);
  analogWrite(MOTOR_FL_PWM, escCommand);
  analogWrite(MOTOR_FR_PWM, escCommand);
  analogWrite(MOTOR_RL_PWM, escCommand);
  analogWrite(MOTOR_RR_PWM, escCommand);
  delay(15);
}`,
  },
  {
    id: "radar_turret",
    stepNumber: 4,
    title: "ULTRASONIC RADAR TURRET",
    subtitle: "Sweeping SG90 Gimbal + HC-SR04 Array",
    badge: "MECHATRONICS 4/5",
    description:
      "Continuous 180-degree ultrasonic radar scanner mounted on an SG90 micro-servo pan stage with target-lock LED indicator and piezo acoustic alarm.",
    specs: [
      "Gimbal Pan Servo: Timer1 PWM Pin D9",
      "Acoustic Transceiver: HC-SR04 on D10 / D11",
      "Target Lock Indicator: High-brightness LED on D3",
    ],
    code: `// @s2c: led(color=red) on D3
#include <Servo.h>

const int SERVO_PAN = 9;
const int TRIG_PIN = 10;
const int ECHO_PIN = 11;
const int ALARM_PIEZO = 6;
const int LOCK_LED = 3;
const int RANGE_POT = A0;

Servo radarPan;

void setup() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(ALARM_PIEZO, OUTPUT);
  pinMode(LOCK_LED, OUTPUT);
  radarPan.attach(SERVO_PAN);
}

void loop() {
  int pot = analogRead(RANGE_POT);
  int panDeg = map(pot, 0, 1023, 15, 165);
  radarPan.write(panDeg);
  digitalWrite(LOCK_LED, HIGH);
  delay(35);
}`,
  },
  {
    id: "sense_light",
    stepNumber: 5,
    title: "PRECISION LUX PHOTOMETER",
    subtitle: "CdS Photoresistor Divider & PWM Dimmer",
    badge: "MECHATRONICS 5/5",
    description:
      "Analog photoresistor voltage divider on ADC channel A0 driving a closed-loop PWM solid-state lamp dimmer with automatic dark-threshold hysteresis.",
    specs: [
      "Optical Divider Input: Analog Pin A0 (10-bit ADC)",
      "PWM Lamp Output: Pin D9 (Timer1)",
      "Tactile Override Input: Pin D2 (INPUT_PULLUP)",
    ],
    code: `// @s2c: button on D2
// @s2c: led(color=green) on D9
const int LDR_SENSOR = A0;
const int OVERRIDE_BTN = 2;
const int PWM_LAMP = 9;

void setup() {
  pinMode(OVERRIDE_BTN, INPUT_PULLUP);
  pinMode(PWM_LAMP, OUTPUT);
}

void loop() {
  int light = analogRead(LDR_SENSOR);
  bool forced = (digitalRead(OVERRIDE_BTN) == LOW);
  int duty = forced ? 255 : map(1023 - light, 0, 1023, 0, 255);
  analogWrite(PWM_LAMP, duty);
  delay(25);
}`,
  },
];

interface WirePulseStream {
  curve: THREE.QuadraticBezierCurve3;
  beads: THREE.Mesh[];
  speedMultiplier: number;
  baseColor: THREE.Color;
}

/**
 * Animation handles plus GPU resources that must be released when the
 * renderer effect tears down (textures, decal geometries, rounded geometries).
 */
interface WorkbenchAnimRefs {
  rotors: THREE.Object3D[];
  servoHorns: THREE.Object3D[];
  leds: THREE.Mesh[];
  buttonCap: THREE.Object3D | null;
  tennisBall: THREE.Object3D | null;
  pulseStreams: WirePulseStream[];
  textures: THREE.Texture[];
  geometries: THREE.BufferGeometry[];
  materials: THREE.Material[];
}

interface Pcb3DViewerProps {
  circuit: Circuit;
  layout?: PcbLayout;
  sketchName?: string;
  theme?: "dark" | "light";
  activeProject?: MechatronicsProjectId;
  onSelectProject?: (proj: MechatronicsProjectPreset) => void;
  onSelectProjectCode?: (code: string, title: string) => void;
}

type ViewPreset = "iso" | "top" | "front" | "left" | "right";
type StudioMode = "workbench" | "pcb_shield";

/**
 * Offscreen Arduino Uno R3 silkscreen artwork: title block, digital / power /
 * analog pin legends, LED legends and faint trace hints.
 */
function createArduinoSilkscreenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#d7e3f4";
  ctx.strokeStyle = "#d7e3f4";

  // Title block
  ctx.font = "bold 40px monospace";
  ctx.fillText("ARDUINO", 44, 52);
  ctx.font = "bold 26px monospace";
  ctx.fillText("UNO  R3", 44, 96);

  // Digital pin header legend
  ctx.font = "bold 18px monospace";
  ctx.fillText("DIGITAL (PWM~)", 430, 40);
  const digitalPins = [
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "11",
    "12",
    "13",
  ];
  digitalPins.forEach((pin, i) => {
    const x = 430 + i * 40;
    ctx.font = "bold 18px monospace";
    ctx.fillText(pin, x, 74);
    ctx.fillRect(x - 6, 92, 22, 4);
  });

  // Power header legend
  ctx.font = "bold 18px monospace";
  ctx.fillText("POWER", 44, 640);
  const powerPins = ["IOREF", "RESET", "3V3", "5V", "GND", "GND", "VIN"];
  powerPins.forEach((pin, i) => {
    const x = 44 + i * 62;
    ctx.font = "bold 13px monospace";
    ctx.fillText(pin, x, 676);
    ctx.fillRect(x - 4, 694, 30, 4);
  });

  // Analog header legend
  ctx.font = "bold 18px monospace";
  ctx.fillText("ANALOG IN", 560, 640);
  const analogPins = ["A0", "A1", "A2", "A3", "A4", "A5"];
  analogPins.forEach((pin, i) => {
    const x = 560 + i * 62;
    ctx.font = "bold 13px monospace";
    ctx.fillText(pin, x, 676);
    ctx.fillRect(x - 4, 694, 30, 4);
  });

  // TX / RX / LED legends
  ctx.font = "bold 16px monospace";
  ctx.fillText("TX", 44, 150);
  ctx.fillText("RX", 44, 180);
  ctx.fillText("L", 44, 210);
  ctx.fillText("ON", 44, 240);

  // Faint trace hints
  ctx.strokeStyle = "rgba(215, 227, 244, 0.32)";
  ctx.lineWidth = 2;
  const traces: Array<[number, number, number, number]> = [
    [300, 120, 300, 420],
    [340, 120, 340, 520],
    [380, 120, 380, 300],
    [420, 120, 420, 560],
    [460, 120, 460, 380],
  ];
  for (const [x1, y1, x2, y2] of traces) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Board outline
  ctx.strokeStyle = "rgba(215, 227, 244, 0.22)";
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Offscreen solderless breadboard artwork: tie-point pitch grid, row/column
 * coordinates and the red/blue power rails.
 */
function createBreadboardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    const fallback = new THREE.CanvasTexture(canvas);
    fallback.colorSpace = THREE.SRGBColorSpace;
    return fallback;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "middle";

  // Board spans x: -27..27 mm, y: -42..42 mm
  const toU = (x: number) => ((x + 27) / 54) * canvas.width;
  const toV = (y: number) => ((42 - y) / 84) * canvas.height;
  const mmToPxX = (mm: number) => (mm / 54) * canvas.width;
  const mmToPxY = (mm: number) => (mm / 84) * canvas.height;

  // Center channel groove
  ctx.strokeStyle = "rgba(30, 41, 59, 0.55)";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(toU(0), 0);
  ctx.lineTo(toU(0), canvas.height);
  ctx.stroke();

  // Tie-point sockets (matches the 3D instanced hole grid)
  ctx.fillStyle = "rgba(51, 65, 85, 0.85)";
  for (let r = 0; r < 24; r++) {
    const y = -34.5 + r * 3.0;
    for (let c = 0; c < 5; c++) {
      const xs = [-14.2 + c * 2.54, 3.8 + c * 2.54];
      for (const x of xs) {
        ctx.fillRect(
          toU(x) - mmToPxX(0.55),
          toV(y) - mmToPxY(0.55),
          mmToPxX(1.1),
          mmToPxY(1.1),
        );
      }
    }
  }

  // Row coordinate letters
  ctx.fillStyle = "rgba(71, 85, 105, 0.95)";
  ctx.font = "bold 22px monospace";
  for (let r = 0; r < 24; r++) {
    const y = -34.5 + r * 3.0;
    const letter = String.fromCharCode(65 + r);
    ctx.fillText(letter, toU(-26.4), toV(y));
    ctx.fillText(letter, toU(24.8), toV(y));
  }

  // Column coordinate numbers
  ctx.font = "bold 20px monospace";
  for (let c = 0; c < 5; c++) {
    ctx.fillText(String(c + 1), toU(-14.2 + c * 2.54), toV(-38.6));
    ctx.fillText(String(c + 6), toU(3.8 + c * 2.54), toV(-38.6));
  }

  // Power rails
  const drawRail = (x: number, color: string, label: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(toU(x), toV(38));
    ctx.lineTo(toU(x), toV(-38));
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = "bold 26px monospace";
    ctx.fillText(label, toU(x) - 8, toV(40.4));
  };
  drawRail(-24.7, "#ef4444", "+");
  drawRail(-22.3, "#0891b2", "-");
  drawRail(22.3, "#ef4444", "+");
  drawRail(24.7, "#0891b2", "-");

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Builds the Obsidian & Gold 3D Digital Twin Workbench:
 * - Matte Black & 24k Gold Arduino Uno R3 on dark anodized aluminum baseplate
 * - Translucent Smoked Frost Solderless Breadboard with glowing LEDs, resistors, and tactile switches
 * - Bioluminescent fiber-optic jumper wires with animated energy pulse beads
 * - Detailed SG90 Micro-Servo, HC-SR04 Ultrasonic Sensor, and Mechatronics Rig
 */
function buildObsidianWorkbenchGroup(
  activeProject: MechatronicsProjectId,
  animRefs: WorkbenchAnimRefs,
): THREE.Group {
  const root = new THREE.Group();
  root.name = "OBSIDIAN_TWIN_ROOT";

  // Rounded-box factory: every instance is tracked so it can be disposed.
  const roundedBox = (
    width: number,
    height: number,
    depth: number,
    radius: number,
    segments = 2,
  ): RoundedBoxGeometry => {
    const geometry = new RoundedBoxGeometry(width, height, depth, segments, radius);
    animRefs.geometries.push(geometry);
    return geometry;
  };

  // Subtle gold/metallic edge accent helper
  const addMetallicEdges = (
    mesh: THREE.Mesh,
    colorHex = 0x334155,
    opacity = 0.45,
    thresholdAngle = 24,
  ) => {
    const edges = new THREE.EdgesGeometry(mesh.geometry, thresholdAngle);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: colorHex, transparent: true, opacity }),
    );
    mesh.add(line);
  };

  // =========================================================================
  // 0. ANODIZED CARBON ALUMINUM BASEPLATE TRAY (Unifies Arduino + Breadboard)
  // =========================================================================
  const traySlab = new THREE.Mesh(
    new THREE.BoxGeometry(148, 102, 2.4),
    new THREE.MeshPhysicalMaterial({
      color: "#0b0f17",
      metalness: 0.75,
      roughness: 0.28,
      clearcoat: 0.4,
    }),
  );
  traySlab.position.set(-4, 16, -1.2);
  addMetallicEdges(traySlab, 0x38bdf8, 0.28);
  root.add(traySlab);

  // Subtle Gold Chamfer Frame on Baseplate
  const trayRim = new THREE.Mesh(
    new THREE.BoxGeometry(145, 99, 0.4),
    new THREE.MeshStandardMaterial({ color: "#eab308", metalness: 0.9, roughness: 0.2 }),
  );
  trayRim.position.set(-4, 16, 0.05);
  root.add(trayRim);

  // =========================================================================
  // 1. OBSIDIAN MATTE BLACK & 24K GOLD ARDUINO UNO R3 (LEFT: X = -40, Y = 10)
  // =========================================================================
  const unoGroup = new THREE.Group();
  unoGroup.position.set(-40, 10, 0.2);

  // Matte Black Soldermask PCB Slab
  const unoPcb = new THREE.Mesh(
    roundedBox(68.6, 53.3, 2.0, 0.6),
    new THREE.MeshPhysicalMaterial({
      color: "#090d14",
      roughness: 0.25,
      metalness: 0.15,
      clearcoat: 0.65,
      clearcoatRoughness: 0.15,
    }),
  );
  unoPcb.position.set(0, 0, 1.0);
  addMetallicEdges(unoPcb, 0xd97706, 0.65, 50);
  unoGroup.add(unoPcb);

  // Silkscreen Decal: pin labels, title block and trace hints on the PCB top
  const silkscreenTexture = createArduinoSilkscreenTexture();
  animRefs.textures.push(silkscreenTexture);
  const silkscreenGeometry = new THREE.PlaneGeometry(68.6, 53.3);
  animRefs.geometries.push(silkscreenGeometry);
  const silkscreenMaterial = new THREE.MeshBasicMaterial({
    map: silkscreenTexture,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    toneMapped: false,
  });
  animRefs.materials.push(silkscreenMaterial);
  const silkscreenDecal = new THREE.Mesh(silkscreenGeometry, silkscreenMaterial);
  silkscreenDecal.position.set(0, 0, 2.02);
  silkscreenDecal.renderOrder = 1;
  unoGroup.add(silkscreenDecal);

  // Decorative 24k Gold ENIG Copper Trace Lines on Uno Top Surface
  for (let i = 0; i < 9; i++) {
    const traceLine = new THREE.Mesh(
      new THREE.BoxGeometry(26 - i * 1.5, 0.45, 0.12),
      new THREE.MeshStandardMaterial({
        color: "#f59e0b",
        emissive: "#d97706",
        emissiveIntensity: 0.25,
        metalness: 0.92,
        roughness: 0.15,
      }),
    );
    traceLine.position.set(-6, -2 + i * 2.2, 2.06);
    unoGroup.add(traceLine);
  }

  // Brushed Stainless USB Type-B Port
  const usbBox = new THREE.Mesh(
    roundedBox(16.0, 12.2, 10.8, 0.9),
    new THREE.MeshPhysicalMaterial({
      color: "#e2e8f0",
      metalness: 0.92,
      roughness: 0.16,
      clearcoat: 0.3,
    }),
  );
  usbBox.position.set(-28.5, 13.0, 7.2);
  addMetallicEdges(usbBox, 0x94a3b8, 0.5, 50);
  unoGroup.add(usbBox);

  // Matte Black DC Power Barrel Jack
  const dcJack = new THREE.Mesh(
    roundedBox(14.2, 9.2, 10.4, 0.9),
    new THREE.MeshPhysicalMaterial({ color: "#111827", roughness: 0.3, clearcoat: 0.4 }),
  );
  dcJack.position.set(-29.0, -17.5, 7.0);
  addMetallicEdges(dcJack, 0x475569, 0.5, 50);
  unoGroup.add(dcJack);

  // ATmega328P DIP-28 Microcontroller Package + Gold Pin Socket
  const dipBody = new THREE.Mesh(
    roundedBox(35.0, 7.6, 4.2, 0.5),
    new THREE.MeshPhysicalMaterial({ color: "#111827", roughness: 0.3, metalness: 0.2 }),
  );
  dipBody.position.set(6.5, -9.0, 4.1);
  addMetallicEdges(dipBody, 0x64748b, 0.55, 50);
  unoGroup.add(dipBody);

  for (let i = 0; i < 14; i++) {
    const px = -9.5 + i * 2.45;
    for (const py of [-4.3, 4.3]) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 1.3, 3.2),
        new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 0.95, roughness: 0.15 }),
      );
      leg.position.set(6.5 + px, -9.0 + py, 2.6);
      unoGroup.add(leg);
    }
  }

  // Dual SMD Aluminum Electrolytic Capacitor Cans + 16MHz Crystal
  for (const cy of [-10, -17]) {
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 2.8, 5.8, 24),
      new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.92, roughness: 0.15 }),
    );
    can.rotation.x = Math.PI / 2;
    can.position.set(-16.5, cy, 4.9);
    unoGroup.add(can);
  }

  const crystal = new THREE.Mesh(
    new THREE.BoxGeometry(10.5, 4.6, 3.6),
    new THREE.MeshStandardMaterial({ color: "#f8fafc", metalness: 0.95, roughness: 0.1 }),
  );
  crystal.position.set(-10.0, -1.5, 3.8);
  unoGroup.add(crystal);

  // Top & Bottom Female Pin Header Strips with Gold Bezel Rings
  for (const hy of [23.8, -23.8]) {
    const hdr = new THREE.Mesh(
      new THREE.BoxGeometry(46.5, 2.8, 8.6),
      new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4 }),
    );
    hdr.position.set(5.0, hy, 6.2);
    addMetallicEdges(hdr, 0xf59e0b, 0.45);
    unoGroup.add(hdr);

    // Gold pin sockets along top of header
    for (let p = 0; p < 14; p++) {
      const holeRing = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 0.3),
        new THREE.MeshStandardMaterial({ color: "#fbbf24", metalness: 0.9, roughness: 0.2 }),
      );
      holeRing.position.set(-14.5 + p * 2.54, hy, 10.6);
      unoGroup.add(holeRing);
    }
  }

  // Glowing Bioluminescent Emerald ON LED on Arduino
  const onLed = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 16, 16),
    new THREE.MeshBasicMaterial({ color: "#4ade80" }),
  );
  onLed.position.set(22.0, 6.0, 2.6);
  unoGroup.add(onLed);

  root.add(unoGroup);

  // =========================================================================
  // 2. TRANSLUCENT FROSTED ACRYLIC BREADBOARD (RIGHT OF UNO: X = 32, Y = 16)
  // =========================================================================
  const bbGroup = new THREE.Group();
  bbGroup.position.set(32, 16, 0.2);

  const bbSlab = new THREE.Mesh(
    roundedBox(54.0, 84.0, 9.2, 1.2),
    new THREE.MeshPhysicalMaterial({
      color: "#e2e8f0",
      roughness: 0.22,
      metalness: 0.05,
      transmission: 0.25,
      transparent: true,
      opacity: 0.94,
      clearcoat: 0.5,
    }),
  );
  bbSlab.position.set(0, 0, 4.6);
  addMetallicEdges(bbSlab, 0x64748b, 0.45, 50);
  bbGroup.add(bbSlab);

  // Breadboard Decal: tie-point pitch, coordinates and power rails
  const breadboardTexture = createBreadboardTexture();
  animRefs.textures.push(breadboardTexture);
  const breadboardGeometry = new THREE.PlaneGeometry(54.0, 84.0);
  animRefs.geometries.push(breadboardGeometry);
  const breadboardMaterial = new THREE.MeshBasicMaterial({
    map: breadboardTexture,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    toneMapped: false,
  });
  animRefs.materials.push(breadboardMaterial);
  const breadboardDecal = new THREE.Mesh(breadboardGeometry, breadboardMaterial);
  breadboardDecal.position.set(0, 0, 9.21);
  breadboardDecal.renderOrder = 1;
  bbGroup.add(breadboardDecal);

  // Center Channel Groove
  const groove = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 84.1, 1.4),
    new THREE.MeshStandardMaterial({ color: "#94a3b8", roughness: 0.4 }),
  );
  groove.position.set(0, 0, 8.7);
  bbGroup.add(groove);

  // Power Rail Lines (Red +5V & Cyan GND)
  for (const sx of [-23.5, 23.5]) {
    const pLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 78.0, 0.2),
      new THREE.MeshBasicMaterial({ color: "#ef4444" }),
    );
    pLine.position.set(sx - 1.2, 0, 9.25);
    bbGroup.add(pLine);

    const gLine = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 78.0, 0.2),
      new THREE.MeshBasicMaterial({ color: "#06b6d4" }),
    );
    gLine.position.set(sx + 1.2, 0, 9.25);
    bbGroup.add(gLine);
  }

  // Tie-Point Metallic Sockets (InstancedMesh)
  const holeGeom = new THREE.BoxGeometry(1.15, 1.15, 0.35);
  const holeMat = new THREE.MeshStandardMaterial({
    color: "#334155",
    metalness: 0.8,
    roughness: 0.3,
  });
  const rows = 24;
  const cols = 10;
  const holesInst = new THREE.InstancedMesh(holeGeom, holeMat, rows * cols);
  const dummy = new THREE.Object3D();
  let hIdx = 0;
  for (let r = 0; r < rows; r++) {
    const y = -34.5 + r * 3.0;
    for (let c = 0; c < cols; c++) {
      const x = c < 5 ? -14.2 + c * 2.54 : 3.8 + (c - 5) * 2.54;
      dummy.position.set(x, y, 9.22);
      dummy.updateMatrix();
      holesInst.setMatrixAt(hIdx++, dummy.matrix);
    }
  }
  bbGroup.add(holesInst);

  // Dual Glowing 5mm LEDs on Breadboard (Emerald Green & Amber Gold)
  const ledSpecs = [
    { x: 6.5, y: -6.0, color: "#22c55e" },
    { x: -6.5, y: -14.0, color: "#f59e0b" },
  ];
  for (const ls of ledSpecs) {
    const dome = new THREE.Mesh(
      new THREE.CylinderGeometry(2.7, 2.7, 6.8, 24),
      new THREE.MeshPhysicalMaterial({
        color: ls.color,
        emissive: ls.color,
        emissiveIntensity: 1.35,
        roughness: 0.1,
        transmission: 0.4,
        transparent: true,
        opacity: 0.92,
      }),
    );
    dome.rotation.x = Math.PI / 2;
    dome.position.set(ls.x, ls.y, 13.5);
    bbGroup.add(dome);
    animRefs.leds.push(dome);
  }

  // Interactive Tactile Pushbutton on Breadboard
  const swBase = new THREE.Mesh(
    new THREE.BoxGeometry(11.0, 11.0, 4.6),
    new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4 }),
  );
  swBase.position.set(0, -24.0, 11.5);
  bbGroup.add(swBase);

  const swCap = new THREE.Mesh(
    new THREE.CylinderGeometry(3.8, 3.8, 3.5, 24),
    new THREE.MeshStandardMaterial({
      color: "#ef4444",
      emissive: "#ef4444",
      emissiveIntensity: 0.35,
      roughness: 0.25,
    }),
  );
  swCap.rotation.x = Math.PI / 2;
  swCap.position.set(0, -24.0, 14.8);
  bbGroup.add(swCap);
  animRefs.buttonCap = swCap;

  // HC-SR04 Ultrasonic Transducer Module Mounted at Top of Breadboard (Matches Image 2!)
  const sonarGroup = new THREE.Group();
  sonarGroup.position.set(0, 26.0, 19.0);

  const sonarPcb = new THREE.Mesh(
    new THREE.BoxGeometry(44.0, 2.0, 19.0),
    new THREE.MeshPhysicalMaterial({
      color: "#0284c7",
      roughness: 0.3,
      metalness: 0.2,
      clearcoat: 0.5,
    }),
  );
  addMetallicEdges(sonarPcb, 0x38bdf8, 0.5);
  sonarGroup.add(sonarPcb);

  for (const sx of [-11.5, 11.5]) {
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(7.6, 7.6, 11.5, 28),
      new THREE.MeshPhysicalMaterial({
        color: "#e2e8f0",
        metalness: 0.92,
        roughness: 0.14,
        clearcoat: 0.4,
      }),
    );
    can.position.set(sx, -6.0, 0);
    sonarGroup.add(can);

    const meshFace = new THREE.Mesh(
      new THREE.CylinderGeometry(6.2, 6.2, 0.5, 24),
      new THREE.MeshStandardMaterial({ color: "#090d16", metalness: 0.5, roughness: 0.8 }),
    );
    meshFace.position.set(sx, -11.8, 0);
    sonarGroup.add(meshFace);
  }
  bbGroup.add(sonarGroup);

  root.add(bbGroup);

  // =========================================================================
  // 3. SG90 TRANSLUCENT SAPPHIRE SERVO & MECHATRONICS ACTUATOR BAY (TOP-LEFT: X = -42, Y = 56)
  // =========================================================================
  const srvGroup = new THREE.Group();
  srvGroup.position.set(-42, 54, 0.2);

  const srvBody = new THREE.Mesh(
    roundedBox(23.0, 12.2, 16.5, 1.0),
    new THREE.MeshPhysicalMaterial({
      color: "#0284c7",
      transmission: 0.45,
      transparent: true,
      opacity: 0.88,
      roughness: 0.15,
      clearcoat: 0.6,
    }),
  );
  srvBody.position.set(0, 0, 8.25);
  addMetallicEdges(srvBody, 0x38bdf8, 0.5, 50);
  srvGroup.add(srvBody);

  const srvBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(5.6, 5.6, 4.2, 24),
    new THREE.MeshPhysicalMaterial({ color: "#0369a1", roughness: 0.2 }),
  );
  srvBoss.rotation.x = Math.PI / 2;
  srvBoss.position.set(5.5, 0, 18.5);
  srvGroup.add(srvBoss);

  // Cross-Shaped White Servo Horn (Matches Top-Left Servo in Image 2!)
  const hornGroup = new THREE.Group();
  hornGroup.position.set(5.5, 0, 21.5);

  const arm1 = new THREE.Mesh(
    new THREE.BoxGeometry(24.0, 3.6, 1.8),
    new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.25 }),
  );
  const arm2 = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 20.0, 1.8),
    new THREE.MeshStandardMaterial({ color: "#f8fafc", roughness: 0.25 }),
  );
  hornGroup.add(arm1);
  hornGroup.add(arm2);
  srvGroup.add(hornGroup);
  animRefs.servoHorns.push(hornGroup);

  root.add(srvGroup);

  // =========================================================================
  // 4. BIOLUMINESCENT JUMPER WIRES WITH STREAMING ENERGY PULSE PACKETS!
  // =========================================================================
  const biolumWires = [
    {
      start: new THREE.Vector3(-42, 34, 11),
      end: new THREE.Vector3(18, 22, 11),
      color: "#f97316", // Warm Amber/Orange Power Pulse
      speed: 1.25,
    },
    {
      start: new THREE.Vector3(-34, 34, 11),
      end: new THREE.Vector3(24, 18, 11),
      color: "#fbbf24", // Pure Gold PWM Signal
      speed: 1.6,
    },
    {
      start: new THREE.Vector3(-25, 34, 11),
      end: new THREE.Vector3(32, 12, 11),
      color: "#38bdf8", // Electric Cyan Digital Bus
      speed: 1.4,
    },
    {
      start: new THREE.Vector3(-16, 34, 11),
      end: new THREE.Vector3(38, 4, 11),
      color: "#4ade80", // Bioluminescent Emerald Sensor Return
      speed: 1.15,
    },
    {
      start: new THREE.Vector3(-46, 34, 11),
      end: new THREE.Vector3(-36, 52, 14),
      color: "#a855f7", // Violet Servo Control Line
      speed: 1.5,
    },
  ];

  for (const bw of biolumWires) {
    const mid = bw.start.clone().lerp(bw.end, 0.5);
    mid.z += 24;
    const curve = new THREE.QuadraticBezierCurve3(bw.start, mid, bw.end);

    // Translucent outer fiber jacket
    const outerTube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 32, 0.72, 12, false),
      new THREE.MeshPhysicalMaterial({
        color: bw.color,
        emissive: bw.color,
        emissiveIntensity: 0.35,
        roughness: 0.15,
        transparent: true,
        opacity: 0.65,
      }),
    );
    root.add(outerTube);

    // Black Dupont Connector Housings at both wire ends
    for (const endPt of [bw.start, bw.end]) {
      const pinShroud = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.4, 6.0),
        new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.4 }),
      );
      pinShroud.position.set(endPt.x, endPt.y, endPt.z - 2.0);
      root.add(pinShroud);
    }

    // Create 6 glowing energy pulse beads per wire that travel along the Bezier curve!
    const beads: THREE.Mesh[] = [];
    const beadGeom = new THREE.SphereGeometry(1.15, 12, 12);
    for (let b = 0; b < 6; b++) {
      const beadMat = new THREE.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.95,
      });
      const bead = new THREE.Mesh(beadGeom, beadMat);

      // Halo glow around each pulse bead
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(2.1, 12, 12),
        new THREE.MeshBasicMaterial({
          color: bw.color,
          transparent: true,
          opacity: 0.42,
        }),
      );
      bead.add(halo);

      root.add(bead);
      beads.push(bead);
    }

    animRefs.pulseStreams.push({
      curve,
      beads,
      speedMultiplier: bw.speed,
      baseColor: new THREE.Color(bw.color),
    });
  }

  return root;
}

export const Pcb3DViewer: React.FC<Pcb3DViewerProps> = ({
  circuit,
  layout: providedLayout,
  sketchName = "arduino_circuit",
  theme = "dark",
  activeProject: externalProject,
  onSelectProject,
  onSelectProjectCode,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  const [studioMode, setStudioMode] = useState<StudioMode>("workbench");
  const [internalProject, setInternalProject] = useState<MechatronicsProjectId>("tennis_shooter");
  const activeProject = externalProject ?? internalProject;

  const [liveSimActive, setLiveSimActive] = useState<boolean>(true);
  const [pwmThrottle, setPwmThrottle] = useState<number>(72);
  const [simSpeedMultiplier, setSimSpeedMultiplier] = useState<number>(1.0);
  const [thermalFaultMode, setThermalFaultMode] = useState<boolean>(false);

  const simParamsRef = useRef({
    active: true,
    pwmThrottle: 72,
    speedMult: 1.0,
    thermalFault: false,
  });

  useEffect(() => {
    simParamsRef.current = {
      active: liveSimActive,
      pwmThrottle,
      speedMult: simSpeedMultiplier,
      thermalFault: thermalFaultMode,
    };
  }, [liveSimActive, pwmThrottle, simSpeedMultiplier, thermalFaultMode]);

  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const hierarchyRef = useRef<ThreePcbHierarchy | null>(null);
  const boardCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(-4, 18, 4));

  const routedLayout = useMemo(() => {
    if (providedLayout) return providedLayout;
    try {
      const placementRes = placeCircuit(circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      const routingRes = routeCircuit(placementRes.layout, circuit, { gridPitchMm: 0.508 });
      return routingRes.layout;
    } catch {
      const placementRes = placeCircuit(circuit, ARDUINO_UNO_R3_SHIELD_OUTLINE);
      return placementRes.layout;
    }
  }, [circuit, providedLayout]);

  const scene3d: PcbScene3D = useMemo(() => {
    return buildPcbScene3D(routedLayout, circuit, {
      solderMaskColor: "#0b1320",
      copperColor: "#f59e0b",
      padColor: "#fbbf24",
    });
  }, [routedLayout, circuit]);

  const currentPreset =
    MECHATRONICS_PROJECTS.find((p) => p.id === activeProject) ?? MECHATRONICS_PROJECTS[0]!;

  const handleChooseProject = (proj: MechatronicsProjectPreset) => {
    setInternalProject(proj.id);
    setStudioMode("workbench");
    onSelectProject?.(proj);
    onSelectProjectCode?.(proj.code, proj.title);
  };

  const setCameraPreset = (preset: ViewPreset) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    const center = boardCenterRef.current;
    const dist = studioMode === "workbench" ? 135 : 90;

    switch (preset) {
      case "iso":
        camera.position.set(center.x - 45, center.y - 98, 86);
        camera.up.set(0, 0, 1);
        break;
      case "top":
        camera.position.set(center.x, center.y, dist);
        camera.up.set(0, 1, 0);
        break;
      case "front":
        camera.position.set(center.x, center.y - dist, 25);
        camera.up.set(0, 0, 1);
        break;
      case "left":
        camera.position.set(center.x - dist, center.y, 25);
        camera.up.set(0, 0, 1);
        break;
      case "right":
        camera.position.set(center.x + dist, center.y, 25);
        camera.up.set(0, 0, 1);
        break;
    }

    controls.target.copy(center);
    controls.update();
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 580;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#070a10");

    const center =
      studioMode === "workbench"
        ? new THREE.Vector3(-4, 18, 4)
        : new THREE.Vector3(
            scene3d.metadata.boardWidthMm / 2,
            scene3d.metadata.boardHeightMm / 2,
            0,
          );
    boardCenterRef.current = center;

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.5, 1200);
    if (studioMode === "workbench") {
      camera.position.set(center.x - 42, center.y - 96, 84);
    } else {
      camera.position.set(center.x + 40, center.y - 60, 68);
    }
    camera.up.set(0, 0, 1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.copy(center);
    controlsRef.current = controls;

    // Studio Environment: PMREM-filtered RoomEnvironment for PBR reflections
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentTarget = pmremGenerator.fromScene(roomEnvironment, 0.04);
    scene.environment = environmentTarget.texture;

    // Dramatic Obsidian Studio Lighting
    scene.add(new THREE.AmbientLight(0xdbeafe, 0.8));

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.75);
    keyLight.position.set(60, -80, 110);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.15);
    rimLight.position.set(-85, 75, 70);
    scene.add(rimLight);

    const goldFill = new THREE.PointLight(0xf59e0b, 1.2, 160);
    goldFill.position.set(-10, 20, 42);
    scene.add(goldFill);

    // Subtle Carbon Dot-Matrix Technical Grid Floor
    const grid = new THREE.GridHelper(280, 44, 0x1e293b, 0x0f172a);
    grid.position.set(center.x, center.y, -2.5);
    grid.rotation.x = Math.PI / 2;
    scene.add(grid);

    const animRefs: WorkbenchAnimRefs = {
      rotors: [],
      servoHorns: [],
      leds: [],
      buttonCap: null,
      tennisBall: null,
      pulseStreams: [],
      textures: [],
      geometries: [],
      materials: [],
    };

    if (studioMode === "workbench") {
      const wb = buildObsidianWorkbenchGroup(activeProject, animRefs);
      scene.add(wb);
      hierarchyRef.current = null;
    } else {
      const h = buildThreePcbGroup(scene3d);
      hierarchyRef.current = h;
      scene.add(h.root);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    let servoDeg = 90;
    let servoVel = 0;
    let pulsePhase = 0;
    let lastTime = performance.now();
    let animId: number;

    const animate = (now: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const p = simParamsRef.current;

      if (p.active) {
        const throttleNorm = (p.pwmThrottle / 100) * p.speedMult;
        pulsePhase += dt * (0.55 + throttleNorm * 1.35);

        // 1. Animate Bioluminescent Signal Packets along 3D Wire Harnesses!
        for (const stream of animRefs.pulseStreams) {
          const count = stream.beads.length;
          for (let i = 0; i < count; i++) {
            const t = (pulsePhase * stream.speedMultiplier + i / count) % 1.0;
            const pt = stream.curve.getPointAt(t);
            const bead = stream.beads[i]!;
            bead.position.copy(pt);
            const scale = 0.75 + 0.45 * Math.sin(t * Math.PI);
            bead.scale.setScalar(scale);
          }
        }

        // 2. 2nd-Order ODE Servo Horn Rotation
        const wn = 14.0;
        const zeta = 0.62;
        const target = 90 + Math.sin(now * 0.003 * p.speedMult) * (55 * (p.pwmThrottle / 100));
        const acc = wn * wn * (target - servoDeg) - 2 * zeta * wn * servoVel;
        servoVel += acc * dt;
        servoDeg += servoVel * dt;

        const hornRad = ((servoDeg - 90) * Math.PI) / 180;
        for (const horn of animRefs.servoHorns) {
          horn.rotation.z = hornRad;
        }

        // 3. LED Emissive Glow
        for (const led of animRefs.leds) {
          const mat = led.material as THREE.MeshPhysicalMaterial;
          if (p.thermalFault) {
            mat.emissive.setHex(0xff1100);
            mat.emissiveIntensity = 2.2 + Math.sin(now * 0.03) * 1.0;
          } else {
            mat.emissiveIntensity = 0.5 + throttleNorm * (1.1 + 0.4 * Math.sin(now * 0.008));
          }
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);

      // Release the studio environment
      scene.environment = null;
      environmentTarget.dispose();
      pmremGenerator.dispose();
      roomEnvironment.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry?.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat?.dispose();
        }
      });

      // Release decal textures, decal geometries and rounded geometries
      for (const texture of animRefs.textures) texture.dispose();
      for (const geometry of animRefs.geometries) geometry.dispose();
      for (const material of animRefs.materials) material.dispose();

      renderer.dispose();
      controls.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [scene3d, studioMode, activeProject]);

  const handleExportGlb = () => {
    const h = hierarchyRef.current;
    if (!h) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      h.root,
      (gltf) => {
        const blob = new Blob([gltf as ArrayBuffer], { type: "model/gltf-binary" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${sketchName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}_obsidian.glb`;
        link.click();
        URL.revokeObjectURL(url);
      },
      (err) => console.error(err),
      { binary: true },
    );
  };

  return (
    <div className="flex flex-col h-full w-full relative select-none overflow-hidden bg-[#070a10] text-slate-100">
      {/* Full-Bleed 3D WebGL Canvas */}
      <div className="flex-1 relative w-full h-full min-h-[540px]">
        <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Top-Left Mode Switcher Pill (3D Obsidian Twin vs PCB Shield) */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 p-1 rounded-[4px] border border-white/10 bg-[#0d131f]/85 backdrop-blur-xl z-20 shadow-2xl">
          <button
            type="button"
            onClick={() => setStudioMode("workbench")}
            className={`px-2.5 py-1 rounded-[3px] text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5 ${
              studioMode === "workbench"
                ? "bg-cyan-500/20 border border-cyan-400/60 text-cyan-200 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>3D Obsidian Twin</span>
          </button>

          <button
            type="button"
            onClick={() => setStudioMode("pcb_shield")}
            className={`px-2.5 py-1 rounded-[3px] text-[10px] font-bold tracking-wider uppercase transition cursor-pointer flex items-center gap-1.5 ${
              studioMode === "pcb_shield"
                ? "bg-amber-500/20 border border-amber-400/60 text-amber-200 shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-3 h-3 text-amber-400" />
            <span>ENIG Gold PCB ({scene3d.metadata.traceCount} Traces)</span>
          </button>

          {studioMode === "pcb_shield" && (
            <button
              type="button"
              onClick={handleExportGlb}
              className="px-2 py-1 rounded-[3px] text-[10px] font-bold text-amber-300 hover:bg-white/10 flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3" />
              <span>GLB</span>
            </button>
          )}
        </div>

        {/* FLOATING GLASS CARD 1: 3D DIGITAL TWIN (LIVE RKF45) + VIEW PRESETS + LIVE RIG CONTROLS (Matches Image 2!) */}
        <div className="absolute top-3 right-[248px] hidden xl:flex flex-col gap-2.5 w-[215px] z-20">
          {/* View Presets Sub-Card */}
          <div className="p-3 rounded-[4px] border border-white/10 bg-[#0d131f]/85 backdrop-blur-xl shadow-2xl space-y-2">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-300 border-b border-white/10 pb-1.5">
              3D DIGITAL TWIN (LIVE RKF45)
            </div>

            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              VIEW PRESETS
            </div>

            <div className="flex flex-wrap gap-1">
              {(["iso", "top", "front", "left", "right"] as ViewPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCameraPreset(p)}
                  className={`px-2 py-1 rounded-[2px] border text-[9px] font-mono font-bold uppercase transition cursor-pointer ${
                    p === "iso"
                      ? "border-cyan-400/60 bg-cyan-950/60 text-cyan-200"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/30"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Live Rig Controls Sub-Card */}
          <div className="p-3 rounded-[4px] border border-white/10 bg-[#0d131f]/85 backdrop-blur-xl shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                LIVE RIG CONTROLS
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center">
              3D ANIMATION
            </div>

            {/* Media Transport Button Strip (|◁ ◁◁ || ▷▷ ▷|) */}
            <div className="grid grid-cols-5 gap-1">
              <button
                type="button"
                onClick={() => setPwmThrottle(25)}
                className="p-1.5 rounded-[2px] border border-white/10 bg-white/5 hover:bg-white/15 flex items-center justify-center cursor-pointer"
                title="Min Throttle"
              >
                <SkipBack className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setSimSpeedMultiplier((s) => Math.max(0.4, Number((s - 0.3).toFixed(1))))}
                className="p-1.5 rounded-[2px] border border-white/10 bg-white/5 hover:bg-white/15 flex items-center justify-center cursor-pointer"
                title="Slow Down Pulses"
              >
                <Rewind className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setLiveSimActive(!liveSimActive)}
                className={`p-1.5 rounded-[2px] border flex items-center justify-center cursor-pointer ${
                  liveSimActive
                    ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-300"
                    : "border-amber-400/60 bg-amber-500/20 text-amber-300"
                }`}
                title={liveSimActive ? "Pause" : "Play"}
              >
                {liveSimActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={() => setSimSpeedMultiplier((s) => Math.min(2.5, Number((s + 0.3).toFixed(1))))}
                className="p-1.5 rounded-[2px] border border-white/10 bg-white/5 hover:bg-white/15 flex items-center justify-center cursor-pointer"
                title="Speed Up Pulses"
              >
                <FastForward className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setPwmThrottle(100)}
                className="p-1.5 rounded-[2px] border border-white/10 bg-white/5 hover:bg-white/15 flex items-center justify-center cursor-pointer"
                title="Max Throttle"
              >
                <SkipForward className="w-3 h-3" />
              </button>
            </div>

            {/* PWM Throttle Slider */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-slate-400">PWM THROTTLE</span>
                <span className="text-cyan-300 font-bold">{pwmThrottle}%</span>
              </div>
              <input
                type="range"
                min={10}
                max={100}
                value={pwmThrottle}
                onChange={(e) => setPwmThrottle(Number(e.target.value))}
                className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            {/* Thermal Fault Simulation Toggle */}
            <button
              type="button"
              onClick={() => setThermalFaultMode(!thermalFaultMode)}
              className={`w-full py-1 px-2 rounded-[2px] border text-[9px] font-bold uppercase flex items-center justify-center gap-1 transition cursor-pointer ${
                thermalFaultMode
                  ? "border-red-500 bg-red-950/70 text-red-200 animate-pulse"
                  : "border-white/10 bg-white/5 text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3 h-3 text-amber-400" />
              <span>{thermalFaultMode ? "OVERCURRENT HAZARD ON" : "TEST ERC OVERCURRENT"}</span>
            </button>
          </div>
        </div>

        {/* FLOATING GLASS CARD 2: MECHATRONICS PROJECT INSPECTOR (#1 - #5) (Matches Far-Right Card in Image 2!) */}
        <div className="absolute top-3 right-3 w-[232px] p-3.5 rounded-[4px] border border-white/10 bg-[#0d131f]/88 backdrop-blur-xl shadow-2xl z-20 space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>{currentPreset.badge}</span>
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>

          <div>
            <h3 className="text-xs font-bold tracking-wide uppercase text-white">
              {currentPreset.title}
            </h3>
            <p className="text-[10px] text-cyan-400 mt-0.5 font-mono leading-snug">
              {currentPreset.subtitle}
            </p>
          </div>

          <p className="text-[10px] text-slate-300 leading-relaxed font-sans">
            {currentPreset.description}
          </p>

          <div className="space-y-1 border-t border-white/10 pt-2">
            {currentPreset.specs.map((sp, i) => (
              <div key={i} className="text-[9px] text-slate-400 flex items-start gap-1">
                <span className="text-amber-400">•</span>
                <span>{sp}</span>
              </div>
            ))}
          </div>

          <div className="pt-1 space-y-1.5">
            <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              SELECT MECHATRONICS RIG
            </div>
            <div className="grid grid-cols-5 gap-1">
              {MECHATRONICS_PROJECTS.map((proj) => {
                const active = proj.id === activeProject;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => handleChooseProject(proj)}
                    title={proj.title}
                    className={`py-1.5 rounded-[2px] border text-[10px] font-mono font-bold transition cursor-pointer ${
                      active
                        ? "border-cyan-400 bg-cyan-500/25 text-cyan-200 shadow-sm"
                        : "border-white/10 bg-white/5 text-slate-400 hover:border-white/30 hover:text-white"
                    }`}
                  >
                    #{proj.stepNumber}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
