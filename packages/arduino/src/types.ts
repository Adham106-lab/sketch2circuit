/**
 * @license Apache-2.0
 * @s2c/arduino — Arduino Sketch Static Analysis & Synthesis Types (Doc §12).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";

export interface SourceRange {
  file?: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface Annotation {
  type: string; // e.g. "led", "button", "servo", "ignore"
  pin?: string; // e.g. "D9", "A0"
  params: Record<string, string>; // e.g. { color: "green", addr: "0x68" }
  raw: string;
  line: number;
}

export type PinModeType = "INPUT" | "OUTPUT" | "INPUT_PULLUP";

export type PinOpType =
  | "digitalWrite"
  | "digitalRead"
  | "analogWrite"
  | "analogRead"
  | "tone"
  | "pulseIn"
  | "interrupt"
  | "library";

export interface PinUse {
  pin: string; // e.g. "D13", "D2", "A0"
  pinNumber: number; // e.g. 13, 2, 14
  modes: Set<PinModeType>;
  ops: Set<PinOpType>;
  nameHints: string[];
  ranges: SourceRange[];
}

export interface CallFact {
  name: string; // e.g. "pinMode", "digitalWrite", "analogWrite", "pulseIn", "attach"
  target?: string; // e.g. "myservo" for myservo.attach(9)
  args: (string | number)[];
  range: SourceRange;
}

export interface VarFact {
  name: string;
  type: string;
  value: string | number;
  isArray?: boolean;
  arrayValues?: (string | number)[];
  range: SourceRange;
}

export interface ConstructorFact {
  className: string; // e.g. "Servo", "LiquidCrystal", "DHT"
  instanceName: string; // e.g. "myservo", "lcd"
  args: (string | number)[];
  range: SourceRange;
}

export interface SketchFacts {
  includes: string[];
  defines: Map<string, string | number>;
  constants: Map<string, string | number>;
  arrays: Map<string, (string | number)[]>;
  calls: CallFact[];
  constructors: ConstructorFact[];
  annotations: Annotation[];
  serialEnabled: boolean;
  wireEnabled: boolean;
  spiEnabled: boolean;
  commentHints: Map<number, string>;
}

export type PeripheralKind =
  | "led"
  | "button"
  | "servo"
  | "piezo"
  | "hc-sr04"
  | "potentiometer"
  | "photoresistor"
  | "i2c-device"
  | "relay"
  | "motor"
  | "generic";

export interface InferredPeripheral {
  id: string; // e.g. "LED_D13", "BTN_D2", "SERVO_D9"
  kind: PeripheralKind;
  pins: Record<string, string>; // e.g. { pin: "D13" }, or { trig: "D11", echo: "D12" }
  confidence: number; // 0.0 to 1.0
  evidence: string[];
  assumptions: string[];
  properties?: Record<string, string | number | boolean>;
}

export interface SynthesizerOptions {
  boardId?: string; // Default "ARDUINO_UNO_R3"
  boardRef?: string; // Default "U1"
  ledDefaultColor?: string; // Default "Red"
  includeDecoupling?: boolean; // Default true
  includeI2cPullups?: boolean; // Default true
  timestamp?: string; // Fixed ISO timestamp for deterministic IR builds
}

export interface UnresolvedItem {
  expression: string;
  reason: string;
  range?: SourceRange;
}

export interface SynthesisResult {
  circuit: Circuit;
  peripherals: InferredPeripheral[];
  pinGraph: Map<string, PinUse>;
  diagnostics: Diagnostic[];
  assumptions: string[];
  unresolved: string[];
  unresolvedItems: UnresolvedItem[];
}
