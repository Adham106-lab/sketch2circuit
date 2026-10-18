/**
 * @license Apache-2.0
 * @s2c/manifests — Declarative Board & Component Sub-Circuit Manifests Types.
 */

import type {
  Bus,
  Component,
  ComponentKind,
  Net,
  PinCapability,
  PortKind,
  Provenance,
} from "@s2c/circuit-json";

export interface StrappingRule {
  /** Expected boot voltage level: HIGH (pullup), LOW (pulldown), or FLOATING */
  safeBootState: "HIGH" | "LOW" | "FLOATING";
  /** Explanation of failure mode if violated */
  riskDescription: string;
}

export interface BoardPinDefinition {
  id: string;
  name: string;
  pinNumber?: string | number;
  capabilities: PinCapability[];
  voltageRange: [number, number];
  maxCurrentMa: number;
  internalPull?: "up" | "down" | "both" | "none";
  inputOnly?: boolean;
  strappingRule?: StrappingRule;
  description?: string;
}

export interface BoardManifest {
  id: string;
  name: string;
  mcuFamily: "AVR" | "ESP32" | "ARM" | "RP2040" | string;
  operatingVoltage: number;
  maxGpioCurrentMa: number;
  totalPackageCurrentMa: number;
  pins: Record<string, BoardPinDefinition>;
  defaultI2C?: { sda: string; scl: string };
  defaultSPI?: { mosi: string; miso: string; sck: string; ss: string };
  defaultUART?: { tx: string; rx: string };
}

export interface SupportingPassiveConnection {
  /** Local port on the passive component (e.g. "1", "2", "A", "K") */
  passivePort: string;
  /**
   * Target endpoint:
   * - "PRIMARY.<portName>": pin on primary peripheral (e.g. "PRIMARY.VCC")
   * - "RAIL_VCC": VCC rail
   * - "RAIL_GND": GND rail
   * - "EXTERNAL_NET.<bindingKey>": target net name from caller bindings
   */
  target: string;
}

export interface SupportingPassive {
  refSuffix: string; // e.g. "C_DEC", "R_PULLUP_SDA", "D_FLYBACK"
  name: string;
  kind: ComponentKind;
  value: string;
  footprint?: string;
  role: "decoupling" | "current_limiting" | "flyback" | "pull_up" | "pull_down" | "gate_damping";
  ports: Array<{ name: string; kind: PortKind }>;
  connections: SupportingPassiveConnection[];
}

export interface DriverStageRecommendation {
  type: "NFET" | "NPN";
  part: string;
  gateResistor?: string;
  baseResistor?: string;
  pullDownResistor?: string;
  flybackDiode?: string;
}

export interface ComponentTemplateManifest {
  id: string;
  name: string;
  category: "sensor" | "display" | "actuator" | "led" | "rtc" | "generic";
  operatingVoltage: [number, number];
  peakCurrentMa: number;
  isHighCurrentActuator?: boolean;
  requiresDriverStage?: boolean;
  primaryKind: ComponentKind;
  primaryPartNumber?: string;
  primaryValue?: string;
  primaryFootprint?: string;
  primaryPorts: Array<{
    name: string;
    kind: PortKind;
    required?: boolean;
    role?: string;
  }>;
  supportingPassives: SupportingPassive[];
  driverStageRecommendation?: DriverStageRecommendation;
}

export interface TemplateExpansionResult {
  primaryComponent: Component;
  supportingComponents: Component[];
  allComponents: Component[];
  generatedNets: Net[];
  buses?: Bus[];
}
