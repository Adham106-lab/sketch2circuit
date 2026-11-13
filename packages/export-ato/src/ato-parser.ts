/**
 * @license Apache-2.0
 * @s2c/export-ato — Deterministic Atopile (.ato) DSL Parser & Circuit Synthesizer.
 *
 * Implements first-class atopile language input for sketch2circuit:
 * 1. Parses standard atopile statements (import, module, component instantiations, property assignments, ~ connections)
 * 2. Compiles directly into canonical Circuit IR with line-level evidence and confidence: 1.0
 * 3. Evaluates the full 18 Electrical Rules Check (ERC) catalog on .ato designs
 * 4. Provides bi-directional translation between atopile and Arduino C++ firmware
 */

import type {
  InferredPeripheral,
  PinModeType,
  PinOpType,
  PinUse,
  SynthesisResult,
} from "@s2c/arduino";
import type {
  Circuit,
  Component,
  ComponentKind,
  Diagnostic,
  LineSpan,
  NetKind,
  Provenance,
} from "@s2c/circuit-json";
import { createCircuit } from "@s2c/core";
import { runErc } from "@s2c/rules";
import type { AtoParseOptions, AtoParseResult } from "./types.js";

/**
 * Standard default atopile starter template for testing and initial IDE load.
 */
export const DEFAULT_ATO_SKETCH = `# =============================================================================
# Arduino Uno System with LED, Current-Limiting Resistor & Pushbutton
# Declarative hardware description compiled with atopile (.ato)
# =============================================================================
import ArduinoUno
import Resistor
import LED
import TactileSwitch

module MainCircuit:
    """
    Arduino Uno R3 with Indicator LED (D13) and User Pushbutton (D2)
    Demonstrating full ERC validation, 2D Schematic & 3D PCB Layout
    """
    # Global Power & Ground Rails
    signal GND
    signal VCC_5V

    # Hardware Components
    mcu = new ArduinoUno
    r1 = new Resistor
    led = new LED
    btn = new TactileSwitch

    # Component Electrical Properties
    r1.value = 330ohm +/- 5%
    r1.package = "0805"
    led.color = "red"
    led.package = "0805"

    # Microcontroller Power
    mcu.gnd ~ GND
    mcu.power_5v ~ VCC_5V

    # Output Channel: Pin D13 -> Resistor R1 -> Status LED -> GND
    mcu.d13 ~ r1.p1
    r1.p2 ~ led.anode
    led.cathode ~ GND

    # Input Channel: Pushbutton on Pin D2 with internal pullup
    mcu.d2 ~ btn.p1
    btn.p2 ~ GND
`;

/**
 * Normalizes electrical unit strings (e.g. 330ohm, 10k, 100nF, +/- 5%).
 */
export function normalizeElectricalValue(raw: string): {
  display: string;
  numeric?: number;
  tolerance?: number;
} {
  let str = raw.trim().replace(/^["']|["']$/g, "");
  let tolerance: number | undefined;

  const tolMatch = str.match(/(?:\+\/-|±)\s*([0-9.]+)\s*%/);
  if (tolMatch) {
    tolerance = Number.parseFloat(tolMatch[1]!) / 100;
    str = str.replace(/(?:\+\/-|±)\s*[0-9.]+\s*%/, "").trim();
  }

  // Resistance: e.g. 330, 330ohm, 330Ω, 330R, 10k, 10kohm, 4.7k, 1M
  const resMatch = str.match(/^([0-9.]+)\s*([kKMm]?)(?:ohm|ohms|Ω|R)?$/i);
  if (resMatch) {
    const base = Number.parseFloat(resMatch[1]!);
    const prefix = resMatch[2]!.toUpperCase();
    let mult = 1;
    if (prefix === "K") mult = 1e3;
    else if (prefix === "M") mult = 1e6;
    const num = Number((base * mult).toPrecision(12));
    const display = `${base}${prefix === "K" ? "k" : prefix === "M" ? "M" : ""}Ω`;
    return { display, numeric: num, tolerance };
  }

  // Capacitance: e.g. 100nF, 10uF, 10µF, 22pF, 0.1uF
  const capMatch = str.match(/^([0-9.]+)\s*([pnµuUmM]?)(?:F|farad|farads)?$/i);
  if (capMatch) {
    const base = Number.parseFloat(capMatch[1]!);
    const prefix = capMatch[2]!;
    let mult = 1;
    if (prefix.toLowerCase() === "p") mult = 1e-12;
    else if (prefix.toLowerCase() === "n") mult = 1e-9;
    else if (prefix.toLowerCase() === "u" || prefix === "µ") mult = 1e-6;
    else if (prefix.toLowerCase() === "m") mult = 1e-3;
    const num = Number((base * mult).toPrecision(12));
    const display = `${base}${prefix || "u"}F`;
    return { display, numeric: num, tolerance };
  }

  return { display: str, tolerance };
}

/**
 * Normalizes pin names on components to standard schema pin IDs.
 */
function normalizePortName(compKind: string, rawPort: string): string {
  const p = rawPort.trim();
  const lower = p.toLowerCase();

  if (compKind === "led" || compKind === "diode") {
    if (["anode", "a", "pos", "+", "p1", "1"].includes(lower)) return "A";
    if (["cathode", "k", "neg", "-", "p2", "2"].includes(lower)) return "K";
  }

  if (compKind === "resistor" || compKind === "capacitor") {
    if (["p1", "1", "a", "pos", "+"].includes(lower)) return "1";
    if (["p2", "2", "b", "neg", "-"].includes(lower)) return "2";
  }

  if (compKind === "button") {
    if (["p1", "1", "a", "in"].includes(lower)) return "1";
    if (["p2", "2", "b", "out"].includes(lower)) return "2";
  }

  if (compKind === "potentiometer") {
    if (["p1", "1", "vcc"].includes(lower)) return "1";
    if (["p2", "2", "wiper", "out"].includes(lower)) return "2";
    if (["p3", "3", "gnd"].includes(lower)) return "3";
  }

  if (compKind === "mcu") {
    if (["power_5v", "5v", "vcc_5v", "vcc"].includes(lower)) return "5V";
    if (["power_3v3", "3v3", "vcc_3v3"].includes(lower)) return "3V3";
    if (["gnd", "ground"].includes(lower)) return "GND";
    if (["gnd2", "gnd_2", "gnd.2"].includes(lower)) return "GND.2";
    if (["vin"].includes(lower)) return "VIN";
    if (["reset"].includes(lower)) return "RESET";
    if (["aref"].includes(lower)) return "AREF";
    if (["sda"].includes(lower)) return "SDA";
    if (["scl"].includes(lower)) return "SCL";
    if (/^[da][0-9]+$/i.test(p)) {
      return p.toUpperCase();
    }
  }

  return p;
}

/**
 * Normalizes global net names (e.g. GND, 5V, 3V3).
 */
function normalizeNetName(rawName: string): { netName: string; kind: NetKind; voltage?: number } {
  const trimmed = rawName.trim();
  const upper = trimmed.toUpperCase();

  if (upper === "GND" || upper === "GROUND" || upper === "VSS" || upper === "0V") {
    return { netName: "GND", kind: "ground", voltage: 0.0 };
  }
  if (upper === "5V" || upper === "VCC_5V" || upper === "VCC") {
    return { netName: "5V", kind: "power", voltage: 5.0 };
  }
  if (upper === "3V3" || upper === "VCC_3V3" || upper === "3.3V") {
    return { netName: "3V3", kind: "power", voltage: 3.3 };
  }

  return { netName: trimmed, kind: "signal" };
}

/**
 * Deterministically parses atopile (.ato) code into a valid Circuit IR.
 */
export function parseAto(source: string, options: AtoParseOptions = {}): AtoParseResult {
  const sourceFile = options.sourceFile || "circuit.ato";
  const diagnostics: Diagnostic[] = [];

  let moduleName = "MainCircuit";
  const rawLines = source.split(/\r?\n/);

  const builder = createCircuit({
    title: moduleName,
    description: "Compiled from atopile (.ato) declarative hardware description",
  });

  // Track components by atopile variable name (e.g. 'mcu', 'r1', 'led')
  interface RegisteredInst {
    instanceName: string;
    compId: string;
    type: string;
    kind: ComponentKind;
    comp: Component;
  }
  const instanceMap = new Map<string, RegisteredInst>();
  const declaredSignals = new Set<string>();

  let inDocstring = false;
  let docstringDelimiter = "";

  for (let idx = 0; idx < rawLines.length; idx++) {
    const lineNum = idx + 1;
    let line = rawLines[idx]!;

    // 1. Docstring parsing (""" or ''')
    if (!inDocstring) {
      if (line.includes('"""')) {
        inDocstring = true;
        docstringDelimiter = '"""';
        const start = line.indexOf('"""');
        const end = line.indexOf('"""', start + 3);
        if (end !== -1) {
          inDocstring = false;
          line = line.slice(0, start) + line.slice(end + 3);
        } else {
          line = line.slice(0, start);
        }
      } else if (line.includes("'''")) {
        inDocstring = true;
        docstringDelimiter = "'''";
        const start = line.indexOf("'''");
        const end = line.indexOf("'''", start + 3);
        if (end !== -1) {
          inDocstring = false;
          line = line.slice(0, start) + line.slice(end + 3);
        } else {
          line = line.slice(0, start);
        }
      }
    } else {
      if (line.includes(docstringDelimiter)) {
        inDocstring = false;
        const end = line.indexOf(docstringDelimiter);
        line = line.slice(end + 3);
      } else {
        continue; // Still inside docstring
      }
    }

    // 2. Strip single-line comments (# or //)
    const hashIdx = line.indexOf("#");
    if (hashIdx !== -1) line = line.slice(0, hashIdx);
    const slashIdx = line.indexOf("//");
    if (slashIdx !== -1) line = line.slice(0, slashIdx);

    const trimmed = line.trim();
    if (!trimmed) continue;

    const lineSpan: LineSpan = {
      startLine: lineNum,
      startCol: 1,
      endLine: lineNum,
      endCol: line.length,
    };

    // 3. Module, Component, or Interface definition block
    const blockMatch = trimmed.match(/^(?:module|component|interface)\s+([A-Za-z0-9_]+)\s*:/);
    if (blockMatch) {
      if (trimmed.startsWith("module ")) {
        moduleName = blockMatch[1]!;
      }
      continue;
    }

    // 4. Pin declarations inside component/interface definitions (pin <name>)
    if (/^pin\s+[A-Za-z0-9_]+/i.test(trimmed)) {
      continue;
    }

    // 5. Assertions (assert ...)
    if (trimmed.startsWith("assert ")) {
      continue;
    }

    // 6. Imports (import X [from "..."] or from "..." import X)
    if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
      // Ignored for deterministic local synthesis since standard library parts are built-in
      continue;
    }

    // 5. Signal declarations (signal <name>)
    const signalMatch = trimmed.match(/^signal\s+([A-Za-z0-9_]+)$/);
    if (signalMatch) {
      const sig = signalMatch[1]!;
      declaredSignals.add(sig.toLowerCase());
      const { netName, kind, voltage } = normalizeNetName(sig);
      builder.connectNet(netName, [], { kind, voltage });
      continue;
    }

    // 6. Component Instantiation (<var> = new <Type>)
    const newMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*new\s+([A-Za-z0-9_]+)$/);
    if (newMatch) {
      const instName = newMatch[1]!;
      const typeName = newMatch[2]!;
      const lowerType = typeName.toLowerCase();

      // Deterministically derive component refdes
      let compId = instName.toUpperCase();
      let kind: ComponentKind = "generic";

      if (
        lowerType === "arduinouno" ||
        lowerType === "arduinounor3" ||
        lowerType === "arduinounor3header" ||
        lowerType === "uno"
      ) {
        compId = "U1";
        kind = "mcu";
        builder.addPart("ARDUINO_UNO_R3", compId, {
          name: "Arduino Uno R3",
        });
      } else if (
        lowerType === "arduinonano" ||
        lowerType === "arduinonanoheader" ||
        lowerType === "nano"
      ) {
        compId = "U1";
        kind = "mcu";
        builder.addPart("ARDUINO_NANO", compId, {
          name: "Arduino Nano",
        });
      } else if (lowerType === "resistor") {
        if (!/^[R][0-9]+/i.test(compId)) compId = `R_${instName.toUpperCase()}`;
        kind = "resistor";
        builder.addResistor(compId, "1kΩ", {
          name: `${instName} (Resistor)`,
        });
      } else if (lowerType === "capacitor") {
        if (!/^[C][0-9]+/i.test(compId)) compId = `C_${instName.toUpperCase()}`;
        kind = "capacitor";
        builder.addCapacitor(compId, "100nF", {
          name: `${instName} (Capacitor)`,
        });
      } else if (lowerType === "led") {
        if (!/^(LED|D)[0-9]+/i.test(compId)) compId = `LED_${instName.toUpperCase()}`;
        kind = "led";
        builder.addLed(compId, "Red", {
          name: `${instName} (LED)`,
        });
      } else if (lowerType === "diode") {
        if (!/^[D][0-9]+/i.test(compId)) compId = `D_${instName.toUpperCase()}`;
        kind = "diode";
        builder.addComponent(compId, "diode", {
          name: `${instName} (Diode)`,
          ports: [
            { name: "A", kind: "passive" },
            { name: "K", kind: "passive" },
          ],
        });
      } else if (
        lowerType === "tactileswitch" ||
        lowerType === "button" ||
        lowerType === "pushbutton"
      ) {
        if (!/^(SW|BTN)[0-9]+/i.test(compId)) compId = `SW_${instName.toUpperCase()}`;
        kind = "button";
        builder.addButton(compId, {
          name: `${instName} (Button)`,
        });
      } else if (lowerType === "potentiometer" || lowerType === "rotarypotentiometer") {
        if (!/^(RV|POT)[0-9]+/i.test(compId)) compId = `POT_${instName.toUpperCase()}`;
        kind = "potentiometer";
        builder.addComponent(compId, "potentiometer", {
          name: `${instName} (Potentiometer)`,
          ports: [
            { name: "1", kind: "passive" },
            { name: "2", kind: "passive" },
            { name: "3", kind: "passive" },
          ],
        });
      } else if (lowerType === "sg90servo" || lowerType === "servo") {
        compId = `SERVO_${instName.toUpperCase()}`;
        kind = "module";
        builder.addComponent(compId, "module", {
          name: `${instName} (SG90 Servo)`,
          partNumber: "SG90",
          ports: [
            { name: "pwm", kind: "input" },
            { name: "vcc", kind: "power" },
            { name: "gnd", kind: "ground" },
          ],
        });
      } else if (lowerType === "hc_sr04" || lowerType === "ultrasonic") {
        compId = `SONAR_${instName.toUpperCase()}`;
        kind = "sensor";
        builder.addComponent(compId, "sensor", {
          name: `${instName} (HC-SR04)`,
          partNumber: "HC-SR04",
          ports: [
            { name: "VCC", kind: "power" },
            { name: "TRIG", kind: "input" },
            { name: "ECHO", kind: "output" },
            { name: "GND", kind: "ground" },
          ],
        });
      } else if (lowerType === "buzzer" || lowerType === "piezo") {
        compId = `BZ_${instName.toUpperCase()}`;
        kind = "buzzer";
        builder.addComponent(compId, "buzzer", {
          name: `${instName} (Buzzer)`,
          ports: [
            { name: "1", kind: "passive" },
            { name: "2", kind: "passive" },
          ],
        });
      } else {
        // Generic fallback component
        builder.addComponent(compId, "generic", {
          name: `${instName} (${typeName})`,
          ports: [
            { name: "1", kind: "passive" },
            { name: "2", kind: "passive" },
          ],
        });
      }

      // Attach Line-Level Evidence and Provenance with confidence: 1.0
      const comp = builder.getComponent(compId);
      if (comp) {
        const provenance: Provenance = {
          sourceFile,
          lineSpan,
          evidenceType: "EXPLICIT_AST_CALL",
          confidence: 1.0,
          notes: `Explicit atopile instantiation: '${instName} = new ${typeName}'`,
        };
        builder.attachProvenance(compId, provenance);

        instanceMap.set(instName.toLowerCase(), {
          instanceName: instName,
          compId,
          type: typeName,
          kind,
          comp,
        });
      }
      continue;
    }

    // 7. Property Assignment (<var>.<prop> = <val>)
    const propMatch = trimmed.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (propMatch && !trimmed.includes("~")) {
      const instName = propMatch[1]!;
      const propKey = propMatch[2]!.toLowerCase();
      const rawValue = propMatch[3]!;

      const target = instanceMap.get(instName.toLowerCase());
      if (!target) {
        diagnostics.push({
          ruleId: "ato.syntax-error",
          severity: "error",
          message: `Unknown component '${instName}' in property assignment on line ${lineNum}`,
          explanation: `Component '${instName}' must be instantiated with '= new <ComponentType>' before setting properties.`,
          target: { type: "code", id: `line-${lineNum}` },
          sourceRange: {
            file: sourceFile,
            startLine: lineNum,
            startCol: 1,
            endLine: lineNum,
            endCol: line.length,
          },
        });
        continue;
      }

      const comp = target.comp;
      comp.properties = comp.properties || {};

      if (propKey === "value" || propKey === "resistance" || propKey === "capacitance") {
        const norm = normalizeElectricalValue(rawValue);
        comp.value = norm.display;
        if (norm.numeric !== undefined) {
          if (target.kind === "resistor") comp.properties.resistance = norm.numeric;
          if (target.kind === "capacitor") comp.properties.capacitance = norm.numeric;
        }
        if (norm.tolerance !== undefined) {
          comp.properties.tolerance = norm.tolerance;
        }
      } else if (propKey === "color") {
        const cleanColor = rawValue.replace(/["']/g, "").trim();
        comp.value = cleanColor.charAt(0).toUpperCase() + cleanColor.slice(1).toLowerCase();
        comp.properties.color = cleanColor.toLowerCase();
      } else if (propKey === "package" || propKey === "footprint") {
        comp.footprint = rawValue.replace(/["']/g, "").trim();
      } else if (propKey === "lcsc_id") {
        comp.properties.lcscId = rawValue.replace(/["']/g, "").trim();
      } else if (propKey === "mpn") {
        comp.partNumber = rawValue.replace(/["']/g, "").trim();
      } else if (propKey === "manufacturer") {
        comp.properties.manufacturer = rawValue.replace(/["']/g, "").trim();
      } else if (propKey === "forward_voltage") {
        const num = Number.parseFloat(rawValue);
        if (!Number.isNaN(num)) comp.properties.forwardVoltage = num;
      } else if (propKey === "max_current") {
        const num = Number.parseFloat(rawValue);
        if (!Number.isNaN(num)) comp.properties.maxCurrent = num;
      } else {
        comp.properties[propKey] = rawValue.replace(/["']/g, "").trim();
      }
      continue;
    }

    // 8. Interconnection using '~' (<endpoint1> ~ <endpoint2> [~ <endpoint3> ...])
    if (trimmed.includes("~")) {
      const rawEndpoints = trimmed
        .split("~")
        .map((e) => e.trim())
        .filter(Boolean);

      if (rawEndpoints.length < 2) {
        diagnostics.push({
          ruleId: "ato.syntax-error",
          severity: "error",
          message: `Malformed connection on line ${lineNum}: '~' operator requires at least two endpoints.`,
          explanation: `Invalid wire connection syntax on line ${lineNum}.`,
          target: { type: "code", id: `line-${lineNum}` },
          sourceRange: {
            file: sourceFile,
            startLine: lineNum,
            startCol: 1,
            endLine: lineNum,
            endCol: line.length,
          },
        });
        continue;
      }

      interface ResolvedEndpoint {
        isNet: boolean;
        netInfo?: { netName: string; kind: NetKind; voltage?: number };
        portId?: string;
      }

      const endpoints: ResolvedEndpoint[] = [];
      let hasError = false;

      for (const ep of rawEndpoints) {
        if (ep.includes(".")) {
          // Component port endpoint (e.g. mcu.d13, r1.p1, led.anode)
          const dot = ep.indexOf(".");
          const inst = ep.slice(0, dot).trim();
          const rawPort = ep.slice(dot + 1).trim();

          const target = instanceMap.get(inst.toLowerCase());
          if (!target) {
            diagnostics.push({
              ruleId: "ato.syntax-error",
              severity: "error",
              message: `Unknown component '${inst}' in connection on line ${lineNum}`,
              explanation: `Component '${inst}' must be instantiated before connecting ports.`,
              target: { type: "code", id: `line-${lineNum}` },
              sourceRange: {
                file: sourceFile,
                startLine: lineNum,
                startCol: 1,
                endLine: lineNum,
                endCol: line.length,
              },
            });
            hasError = true;
            break;
          }

          const normPort = normalizePortName(target.kind, rawPort);
          const port = target.comp.ports.find((p) => p.name === normPort || p.id === ep);
          if (!port) {
            const avail = target.comp.ports.map((p) => p.name).join(", ");
            diagnostics.push({
              ruleId: "ato.syntax-error",
              severity: "error",
              message: `Port '${rawPort}' not found on component '${inst}' (${target.comp.name ?? target.comp.kind}) on line ${lineNum}`,
              explanation: `Available ports on '${inst}': [${avail}].`,
              target: { type: "code", id: `line-${lineNum}` },
              sourceRange: {
                file: sourceFile,
                startLine: lineNum,
                startCol: 1,
                endLine: lineNum,
                endCol: line.length,
              },
            });
            hasError = true;
            break;
          }

          endpoints.push({ isNet: false, portId: port.id });
        } else {
          // Global net / signal endpoint (e.g. gnd, vcc_5v, sig_name)
          const netInfo = normalizeNetName(ep);
          endpoints.push({ isNet: true, netInfo });
        }
      }

      if (hasError) continue;

      // Apply connection in builder
      const netEndpoints = endpoints.filter((e) => e.isNet && e.netInfo);
      const portEndpoints = endpoints.filter((e) => !e.isNet && e.portId);

      const netProvenance: Provenance = {
        sourceFile,
        lineSpan,
        evidenceType: "EXPLICIT_AST_CALL",
        confidence: 1.0,
        notes: `Wired in atopile via '${trimmed}'`,
      };

      if (netEndpoints.length > 0) {
        // Connect all port endpoints to the named net(s)
        for (const netEp of netEndpoints) {
          const { netName, kind, voltage } = netEp.netInfo!;
          const portIds = portEndpoints.map((p) => p.portId!);
          builder.connectNet(netName, portIds, { kind, voltage });
          builder.attachProvenance(netName, netProvenance);
        }

        // If multiple different nets are wired together (e.g. VCC_5V ~ GND), detect power-short
        if (netEndpoints.length > 1) {
          const hasPwr = netEndpoints.some((n) => n.netInfo!.kind === "power");
          const hasGnd = netEndpoints.some((n) => n.netInfo!.kind === "ground");
          if (hasPwr && hasGnd) {
            const pwrNet = netEndpoints.find((n) => n.netInfo!.kind === "power")!.netInfo!.netName;
            const gndNet = netEndpoints.find((n) => n.netInfo!.kind === "ground")!.netInfo!.netName;
            diagnostics.push({
              ruleId: "erc.power-short",
              severity: "error",
              message: `Catastrophic short circuit detected between power net '${pwrNet}' and ground net '${gndNet}'.`,
              explanation: `Power rail and ground return paths are directly bridged together in atopile code ('${trimmed}'). Under Ohm's Law (I = V / R), current approaches infinity, triggering power supply overcurrent protection or permanent destruction.`,
              target: { type: "code", id: `line-${lineNum}` },
              suggestion: "Separate the power rail and ground return paths into independent isolated nets.",
              sourceRange: {
                file: sourceFile,
                startLine: lineNum,
                startCol: 1,
                endLine: lineNum,
                endCol: line.length,
              },
            });
          }
        }
      } else if (portEndpoints.length >= 2) {
        // Direct port-to-port wire (e.g. mcu.d13 ~ r1.p1)
        const ports = portEndpoints.map((p) => p.portId!);
        builder.connect(ports[0]!, ports[1]!, ...ports.slice(2));
      }
      continue;
    }

    // 9. Unrecognized atopile syntax
    diagnostics.push({
      ruleId: "ato.syntax-error",
      severity: "error",
      message: `Unrecognized atopile syntax on line ${lineNum}: '${trimmed}'`,
      explanation: `Line ${lineNum} could not be parsed as a module, import, component instantiation, property assignment, or ~ connection.`,
      target: { type: "code", id: `line-${lineNum}` },
      sourceRange: {
        file: sourceFile,
        startLine: lineNum,
        startCol: 1,
        endLine: lineNum,
        endCol: line.length,
      },
    });
  }

  const rawCircuit = builder.build();

  // Deterministically sort components, nets, and portIds
  const components = [...rawCircuit.components].sort((a, b) => a.id.localeCompare(b.id));
  const nets = [...rawCircuit.nets]
    .map((net) => ({
      ...net,
      portIds: [...net.portIds].sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const circuit: Circuit = {
    ...rawCircuit,
    name: moduleName,
    metadata: {
      ...rawCircuit.metadata,
      description: `Synthesized from atopile module '${moduleName}'`,
      ...(options.timestamp ? { generatedAt: options.timestamp } : {}),
    },
    components,
    nets,
  };

  const valid = diagnostics.filter((d) => d.severity === "error").length === 0;

  return {
    valid,
    circuit,
    diagnostics,
    moduleName,
  };
}

/**
 * Full Pipeline Synthesizer for atopile (.ato) input:
 * 1. Runs parseAto()
 * 2. Runs the 18 ERC rules via runErc()
 * 3. Populates InferredPeripheral and PinUse graphs for downstream 3D/Schematic/PCB engines
 */
export function synthesizeAto(source: string, options: AtoParseOptions = {}): SynthesisResult {
  const parseResult = parseAto(source, options);
  const circuit = parseResult.circuit;

  // Run the full 18-rule Electrical Rules Check (ERC)
  const ercDiagnostics = runErc(circuit);
  const allDiagnostics = [...parseResult.diagnostics, ...ercDiagnostics];

  // Infer peripherals from circuit components for 3D digital twin and pin inspectors
  const peripherals: InferredPeripheral[] = [];
  const pinGraph = new Map<string, PinUse>();

  // Find MCU component
  const mcu = circuit.components.find((c) => c.kind === "mcu");
  const mcuId = mcu?.id;

  for (const comp of circuit.components) {
    if (comp.kind === "led") {
      let pin = "";
      const anodePort = comp.ports.find((p) => p.name === "A" || p.name.includes("anode"));
      if (anodePort && anodePort.netId) {
        const net = circuit.nets.find((n) => n.id === anodePort.netId);
        if (net) {
          for (const pid of net.portIds) {
            if (mcuId && pid.startsWith(`${mcuId}.`)) {
              pin = pid.replace(`${mcuId}.`, "");
              break;
            }
          }
        }
      }
      peripherals.push({
        id: `LED_${comp.id}`,
        kind: "led",
        pins: { pin: pin || "D13" },
        confidence: 1.0,
        evidence: [
          `Explicit atopile declaration: ${comp.name ?? comp.id} (${comp.value ?? "Red"})`,
        ],
        assumptions: [],
        properties: comp.properties,
      });
    } else if (comp.kind === "button") {
      let pin = "";
      for (const p of comp.ports) {
        if (p.netId) {
          const net = circuit.nets.find((n) => n.id === p.netId);
          if (net) {
            for (const pid of net.portIds) {
              if (mcuId && pid.startsWith(`${mcuId}.`)) {
                const candidate = pid.replace(`${mcuId}.`, "");
                if (
                  !["GND", "5V", "3V3", "VIN", "RESET", "AREF"].includes(candidate.toUpperCase())
                ) {
                  pin = candidate;
                  break;
                }
              }
            }
          }
        }
        if (pin) break;
      }
      peripherals.push({
        id: `BTN_${comp.id}`,
        kind: "button",
        pins: { pin: pin || "D2" },
        confidence: 1.0,
        evidence: [`Explicit atopile declaration: ${comp.name ?? comp.id}`],
        assumptions: [],
        properties: comp.properties,
      });
    } else if (comp.kind === "potentiometer") {
      let pin = "";
      const wiper = comp.ports.find((p) => p.name === "2" || p.name.includes("wiper"));
      if (wiper && wiper.netId) {
        const net = circuit.nets.find((n) => n.id === wiper.netId);
        if (net) {
          for (const pid of net.portIds) {
            if (mcuId && pid.startsWith(`${mcuId}.`)) {
              pin = pid.replace(`${mcuId}.`, "");
              break;
            }
          }
        }
      }
      peripherals.push({
        id: `POT_${comp.id}`,
        kind: "potentiometer",
        pins: { pin: pin || "A0" },
        confidence: 1.0,
        evidence: [`Explicit atopile declaration: ${comp.name ?? comp.id}`],
        assumptions: [],
        properties: comp.properties,
      });
    } else if (comp.kind === "module" && comp.partNumber === "SG90") {
      let pin = "";
      const pwmPort = comp.ports.find((p) => p.name === "pwm");
      if (pwmPort && pwmPort.netId) {
        const net = circuit.nets.find((n) => n.id === pwmPort.netId);
        if (net) {
          for (const pid of net.portIds) {
            if (mcuId && pid.startsWith(`${mcuId}.`)) {
              pin = pid.replace(`${mcuId}.`, "");
              break;
            }
          }
        }
      }
      peripherals.push({
        id: `SERVO_${comp.id}`,
        kind: "servo",
        pins: { pin: pin || "D9" },
        confidence: 1.0,
        evidence: [`Explicit atopile declaration: ${comp.name ?? comp.id}`],
        assumptions: [],
        properties: comp.properties,
      });
    }
  }

  // Populate PinUsage graph
  for (const peri of peripherals) {
    const pinName = peri.pins.pin;
    if (pinName) {
      const pinNum = Number.parseInt(pinName.replace(/^[DA]/, "")) || 0;
      const modes = new Set<PinModeType>();
      const ops = new Set<PinOpType>();

      if (peri.kind === "led" || peri.kind === "servo") {
        modes.add("OUTPUT");
        ops.add(peri.kind === "servo" ? "analogWrite" : "digitalWrite");
      } else if (peri.kind === "button") {
        modes.add("INPUT_PULLUP");
        ops.add("digitalRead");
      } else if (peri.kind === "potentiometer") {
        ops.add("analogRead");
      }

      pinGraph.set(pinName, {
        pin: pinName,
        pinNumber: pinNum,
        modes,
        ops,
        nameHints: [peri.id],
        ranges: [],
      });
    }
  }

  return {
    circuit,
    peripherals,
    pinGraph,
    diagnostics: allDiagnostics,
    assumptions: [],
    unresolved: [],
    unresolvedItems: [],
  };
}

/**
 * Translates Circuit IR synthesized from .ato into compiling Arduino C++ firmware.
 */
export function circuitToArduino(circuit: Circuit): string {
  const mcu = circuit.components.find((c) => c.kind === "mcu");
  const mcuId = mcu?.id || "U1";

  const setupLines: string[] = [];
  const loopLines: string[] = [];
  const includes: string[] = [`// Auto-generated Arduino C++ firmware from atopile (.ato) circuit`];

  for (const comp of circuit.components) {
    if (comp.kind === "led") {
      let pin = "13";
      for (const p of comp.ports) {
        if (p.netId) {
          const net = circuit.nets.find((n) => n.id === p.netId);
          if (net) {
            for (const pid of net.portIds) {
              if (pid.startsWith(`${mcuId}.D`)) {
                pin = pid.replace(`${mcuId}.D`, "");
                break;
              }
            }
          }
        }
      }
      setupLines.push(`  pinMode(${pin}, OUTPUT); // ${comp.name || comp.id}`);
      loopLines.push(`  digitalWrite(${pin}, HIGH);`);
      loopLines.push(`  delay(500);`);
      loopLines.push(`  digitalWrite(${pin}, LOW);`);
      loopLines.push(`  delay(500);`);
    } else if (comp.kind === "button") {
      let pin = "2";
      for (const p of comp.ports) {
        if (p.netId) {
          const net = circuit.nets.find((n) => n.id === p.netId);
          if (net) {
            for (const pid of net.portIds) {
              if (pid.startsWith(`${mcuId}.D`)) {
                pin = pid.replace(`${mcuId}.D`, "");
                break;
              }
            }
          }
        }
      }
      setupLines.push(`  pinMode(${pin}, INPUT_PULLUP); // ${comp.name || comp.id}`);
      loopLines.push(`  int btnState = digitalRead(${pin});`);
    } else if (comp.kind === "potentiometer") {
      let pin = "A0";
      for (const p of comp.ports) {
        if (p.netId) {
          const net = circuit.nets.find((n) => n.id === p.netId);
          if (net) {
            for (const pid of net.portIds) {
              if (pid.startsWith(`${mcuId}.A`)) {
                pin = pid.replace(`${mcuId}.`, "");
                break;
              }
            }
          }
        }
      }
      loopLines.push(`  int potVal = analogRead(${pin}); // ${comp.name || comp.id}`);
    }
  }

  if (setupLines.length === 0) {
    setupLines.push(`  pinMode(13, OUTPUT);`);
  }
  if (loopLines.length === 0) {
    loopLines.push(`  digitalWrite(13, HIGH);`);
    loopLines.push(`  delay(500);`);
    loopLines.push(`  digitalWrite(13, LOW);`);
    loopLines.push(`  delay(500);`);
  }

  const lines: string[] = [
    `/*`,
    ` * Circuit: ${circuit.name || "MainCircuit"}`,
    ` * Auto-converted from atopile (.ato) hardware definition to Arduino C++`,
    ` */`,
    ...includes,
    ``,
    `void setup() {`,
    ...setupLines,
    `}`,
    ``,
    `void loop() {`,
    ...loopLines,
    `}`,
    ``,
  ];

  return lines.join("\n");
}
