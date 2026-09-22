/**
 * @license Apache-2.0
 * @s2c/circuit-json — Circuit IR v0.1.0 canonical TypeScript type definitions.
 */

export type ComponentKind =
  | "resistor"
  | "capacitor"
  | "led"
  | "button"
  | "switch"
  | "diode"
  | "potentiometer"
  | "mcu"
  | "sensor"
  | "ic"
  | "module"
  | "connector"
  | "buzzer"
  | "transistor"
  | "relay"
  | "generic";

export type PortKind =
  | "passive"
  | "power"
  | "ground"
  | "input"
  | "output"
  | "bidirectional"
  | "no_connect";

export type NetKind = "signal" | "power" | "ground";

export type PinCapability =
  | "GPIO"
  | "PWM"
  | "ADC"
  | "DAC"
  | "I2C_SDA"
  | "I2C_SCL"
  | "SPI_MOSI"
  | "SPI_MISO"
  | "SPI_SCK"
  | "SPI_SS"
  | "UART_TX"
  | "UART_RX"
  | "INTERRUPT"
  | "RESET";

export interface Position {
  x: number;
  y: number;
  rotation?: number; // degrees: 0, 90, 180, 270
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Port {
  /** Identifier: e.g. "R1.1", "U1.D9" */
  id: string;
  /** Port / pin name: e.g. "1", "2", "A", "K", "D9", "VCC", "GND" */
  name: string;
  /** Physical pin number if applicable */
  pinNumber?: string | number | undefined;
  /** Electrical kind of port */
  kind: PortKind;
  /** Connected net ID */
  netId?: string | undefined;
  /** Electrical capabilities */
  pinCapabilities?: PinCapability[] | undefined;
  /** Allowed voltage range [min, max] in Volts */
  voltageRange?: [number, number] | undefined;
  /** Maximum source or sink current in Amperes */
  currentLimit?: number | undefined;
  /** Internal pull resistor state */
  pull?: "up" | "down" | "none" | undefined;
}

export interface Component {
  /** Unique reference designator: e.g. "R1", "LED1", "U1" */
  id: string;
  /** Component category */
  kind: ComponentKind;
  /** Descriptive name: e.g. "Status LED", "Current Limiting Resistor" */
  name?: string | undefined;
  /** Manufacturer part number / breakout id: e.g. "HC-SR04", "SG90" */
  partNumber?: string | undefined;
  /** Nominal electrical value: e.g. "330Ω", "10µF", "10kΩ", "Red" */
  value?: string | undefined;
  /** Package / footprint: e.g. "axial-0.3", "0805", "DIP-8", "module" */
  footprint?: string | undefined;
  /** Arbitrary domain properties (e.g. forwardVoltage: 2.0, maxCurrent: 0.02) */
  properties?: Record<string, string | number | boolean> | undefined;
  /** Ports / pins of this component */
  ports: Port[];
  /** Optional schematic layout position */
  position?: Position | undefined;
  /** Whether part specs derive from a verified datasheet entry */
  verified?: boolean | undefined;
}

export interface Net {
  /** Unique net ID: e.g. "GND", "5V", "N$1", "net_d9_led" */
  id: string;
  /** Optional human-readable net name */
  name?: string | undefined;
  /** Net domain classification */
  kind: NetKind;
  /** Nominal DC voltage on this net if known (e.g. 5.0, 3.3, 0.0) */
  voltage?: number | undefined;
  /** List of port IDs connected together by this net */
  portIds: string[];
}

export interface DiagnosticTarget {
  type: "component" | "port" | "net" | "circuit" | "code";
  id: string;
}

export interface SourceRange {
  file: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

export interface Diagnostic {
  /** Rule identifier: e.g. "erc.floating-input", "erc.led-no-resistor" */
  ruleId: string;
  severity: "error" | "warning" | "info";
  message: string;
  /** Quantitative explanation of why rule triggered (including measured vs limit numbers) */
  explanation: string;
  target: DiagnosticTarget;
  /** Computable fix suggestion */
  suggestion?: string | undefined;
  /** Source code location in sketch if synthesized */
  sourceRange?: SourceRange | undefined;
}

export interface Assumption {
  /** Unique assumption ID */
  id: string;
  /** Category: e.g. "peripheral-type", "pin-assignment", "voltage-level" */
  category: string;
  /** Clear human explanation */
  description: string;
  /** Confidence score: 0.0 to 1.0 */
  confidence: number;
  /** Evidence statements supporting this assumption */
  evidence: string[];
  /** Possible alternatives user can select */
  alternativeOptions?: string[] | undefined;
  /** Current selected option */
  selectedOption?: string | undefined;
}

export interface CircuitMetadata {
  /** Target board identifier: e.g. "arduino-uno", "nano", "esp32-devkit" */
  board?: string | undefined;
  /** Source sketch filename */
  sketchName?: string | undefined;
  /** Author or system generator tag */
  author?: string | undefined;
  /** ISO-8601 generation timestamp */
  generatedAt?: string | undefined;
  /** Circuit description / notes */
  description?: string | undefined;
}

export interface Circuit {
  /** Semantic version of Circuit IR */
  schemaVersion: "0.1.0";
  /** Design title */
  name: string;
  /** Circuit components */
  components: Component[];
  /** Electrical nets connecting ports */
  nets: Net[];
  /** Electrical rule check results */
  diagnostics?: Diagnostic[] | undefined;
  /** Inferred assumptions with confidence metrics */
  assumptions?: Assumption[] | undefined;
  /** Design metadata */
  metadata?: CircuitMetadata | undefined;
}
