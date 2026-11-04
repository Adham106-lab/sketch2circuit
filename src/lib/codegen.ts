/**
 * @license Apache-2.0
 * Deterministic Physical-Scan-to-Arduino Sketch Generator & Electrical Safety Linter.
 * Pure TypeScript logic (zero React dependencies, zero network calls).
 */

import type { ScanComponent, ScanConnection, ScanResult } from "./physicalScan.js";

export interface GenerateSketchOptions {
  board?: "uno";
}

export interface GeneratedSketchResult {
  code: string;
  notes: string[];
  warnings: string[];
}

type CanonicalPartKind =
  | "led"
  | "resistor"
  | "button"
  | "ultrasonic"
  | "servo"
  | "potentiometer"
  | "ldr"
  | "buzzer"
  | "motor"
  | "unknown";

interface TracedPart {
  id: string;
  kind: CanonicalPartKind;
  rawLabel: string;
  value?: string;
  pins: string[]; // MCU pins connected (directly or through series resistor)
  trigPin?: string;
  echoPin?: string;
  hasSeriesResistor: boolean;
  hasGnd: boolean;
  has5V: boolean;
  pullMode: "internal_pullup" | "external_pullup" | "external_pulldown";
}

class UnionFind {
  private parent = new Map<string, string>();

  find(x: string): string {
    const cur = this.parent.get(x);
    if (!cur || cur === x) {
      this.parent.set(x, x);
      return x;
    }
    const root = this.find(cur);
    this.parent.set(x, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) {
      // Prefer keeping MCU pin or power rail as canonical root if helpful
      if (isPowerOrMcuPin(ra) && !isPowerOrMcuPin(rb)) {
        this.parent.set(rb, ra);
      } else {
        this.parent.set(ra, rb);
      }
    }
  }

  connected(a: string, b: string): boolean {
    return this.find(a) === this.find(b);
  }

  allNodes(): string[] {
    return Array.from(this.parent.keys());
  }
}

/**
 * Normalizes raw endpoint strings ("pin 13", "D13", "13" -> "D13"; "A0".."A5"; "5V"; "GND").
 */
export function normalizePinEndpoint(raw: string): string {
  let s = raw.trim().toUpperCase().replace(/\s+/g, " ");
  s = s.replace(/^U1\./, "").replace(/^ARDUINO\./, "").replace(/^MCU\./, "");

  const digMatch = s.match(/^(?:DIGITAL\s*PIN|PIN|DIGITAL|GPIO|D)\s*(\d{1,2})$/);
  if (digMatch) {
    const n = Number(digMatch[1]);
    if (n >= 0 && n <= 13) return `D${n}`;
  }
  if (/^\d{1,2}$/.test(s)) {
    const n = Number(s);
    if (n >= 0 && n <= 13) return `D${n}`;
  }

  const anaMatch = s.match(/^(?:ANALOG\s*PIN|ANALOG|ADC|A)\s*([0-5])$/);
  if (anaMatch) {
    return `A${anaMatch[1]}`;
  }

  if (s === "GROUND" || s === "GND" || s.startsWith("GND ") || s.endsWith(".GND")) {
    return "GND";
  }
  if (s === "VCC" || s === "+5V" || s === "5V0" || s === "5V" || s.startsWith("5V ")) {
    return "5V";
  }
  if (s === "3V3" || s === "+3.3V" || s === "3.3V") {
    return "3.3V";
  }

  // Canonicalize component terminal names
  s = s.replace(/^D(\d+)\.(A|ANODE|\+|1)$/i, "LED$1.ANODE");
  s = s.replace(/^D(\d+)\.(K|C|CATHODE|-|2)$/i, "LED$1.CATHODE");
  s = s.replace(/^LED(\d+)\.(A|ANODE|\+|1)$/i, "LED$1.ANODE");
  s = s.replace(/^LED(\d+)\.(K|C|CATHODE|-|2)$/i, "LED$1.CATHODE");
  s = s.replace(/^R(\d+)\.(?:P1|A|LEFT|1)$/i, "R$1.1");
  s = s.replace(/^R(\d+)\.(?:P2|B|RIGHT|2)$/i, "R$1.2");

  return s;
}

function isDigitalPin(ep: string): boolean {
  return /^D(?:[0-9]|1[0-3])$/.test(ep);
}

function isAnalogPin(ep: string): boolean {
  return /^A[0-5]$/.test(ep);
}

function isMcuSignalPin(ep: string): boolean {
  return isDigitalPin(ep) || isAnalogPin(ep);
}

function isPowerOrMcuPin(ep: string): boolean {
  return isMcuSignalPin(ep) || ep === "5V" || ep === "3.3V" || ep === "GND";
}

function pinToArduinoLiteral(pin: string): string {
  if (pin.startsWith("D")) {
    return pin.slice(1);
  }
  return pin;
}

function classifyPartKind(comp: ScanComponent): CanonicalPartKind {
  const sig = `${comp.type} ${comp.label ?? ""} ${comp.value ?? ""}`.toLowerCase();
  if (sig.includes("motor") || /\bm\d+\b/.test(sig)) return "motor";
  if (sig.includes("servo") || sig.includes("sg90")) return "servo";
  if (sig.includes("ldr") || sig.includes("photo") || sig.includes("light")) return "ldr";
  if (sig.includes("pot") || sig.includes("10k") && sig.includes("vr")) return "potentiometer";
  if (sig.includes("buzz") || sig.includes("piezo") || /\bbz\d*\b/.test(sig)) return "buzzer";
  if (
    comp.type === "ultrasonic" ||
    sig.includes("ultrasonic") ||
    sig.includes("sr04") ||
    sig.includes("sonar")
  ) {
    return "ultrasonic";
  }
  if (comp.type === "button" || sig.includes("button") || sig.includes("switch") || /\bsw\d*\b/.test(sig)) {
    return "button";
  }
  if (comp.type === "resistor" || sig.includes("resistor") || /^r\d+$/i.test(comp.label ?? "")) {
    return "resistor";
  }
  if (comp.type === "led" || sig.includes("led")) {
    return "led";
  }
  return "unknown";
}

function extractComponentPrefix(endpoint: string): string | null {
  const norm = normalizePinEndpoint(endpoint);
  if (isPowerOrMcuPin(norm)) return null;
  if (/^(?:BREADBOARD\s+)?[A-J]\d{1,2}$/i.test(norm) || /^(?:COL|ROW)\s+\w+/i.test(norm)) {
    return null;
  }
  const dotIdx = norm.indexOf(".");
  const base = dotIdx >= 0 ? norm.slice(0, dotIdx) : norm;
  return base.trim() || null;
}

function inferKindFromPrefix(prefix: string): CanonicalPartKind {
  const u = prefix.toUpperCase();
  if (/^R\d+$/.test(u) || u.startsWith("RES")) return "resistor";
  if (/^(?:LED|D)\d+$/.test(u)) return "led";
  if (/^(?:SW|BTN|BUTTON|S)\d*$/.test(u)) return "button";
  if (u.includes("SONAR") || u.includes("SR04") || u.includes("ULTRA")) return "ultrasonic";
  if (u.includes("SERVO") || u.startsWith("SRV")) return "servo";
  if (u.includes("POT") || u.startsWith("VR") || u.startsWith("RV")) return "potentiometer";
  if (u.includes("LDR") || u.includes("PHOTO")) return "ldr";
  if (u.includes("BUZ") || u.startsWith("BZ") || u.startsWith("PZ")) return "buzzer";
  if (u.includes("MOTOR") || /^M\d+$/.test(u)) return "motor";
  return "unknown";
}

interface AnalyzedGraph {
  uf: UnionFind;
  resistorBridges: Map<string, Set<string>>; // netRoot -> neighbor netRoots across a resistor
  parts: TracedPart[];
  pinUsage: Map<string, string[]>; // MCU pin -> part IDs
  directShort5VToGnd: boolean;
  anyGndOnMcu: boolean;
}

function analyzeScanGraph(found: ScanResult): AnalyzedGraph {
  const uf = new UnionFind();
  const normalizedConns: Array<{ from: string; to: string }> = [];

  for (const conn of found.connections) {
    const a = normalizePinEndpoint(conn.from);
    const b = normalizePinEndpoint(conn.to);
    if (!a || !b) continue;
    normalizedConns.push({ from: a, to: b });
    uf.union(a, b);
  }

  // Group all endpoints by component prefix
  const compTerminals = new Map<string, Set<string>>();
  for (const node of uf.allNodes()) {
    const prefix = extractComponentPrefix(node);
    if (prefix) {
      const set = compTerminals.get(prefix) ?? new Set<string>();
      set.add(node);
      compTerminals.set(prefix, set);
    }
  }

  // Identify resistor prefixes from components + endpoint names
  const resistorPrefixes = new Set<string>();
  let rCounter = 1;
  for (const comp of found.components) {
    if (classifyPartKind(comp) === "resistor") {
      const id = (comp.label ?? `R${rCounter}`).trim().toUpperCase();
      resistorPrefixes.add(id);
      rCounter++;
    }
  }
  for (const prefix of compTerminals.keys()) {
    if (inferKindFromPrefix(prefix) === "resistor") {
      resistorPrefixes.add(prefix);
    }
  }

  // Build resistor bridge adjacency between net roots
  const resistorBridges = new Map<string, Set<string>>();
  const addBridge = (r1: string, r2: string) => {
    if (r1 === r2) return;
    const s1 = resistorBridges.get(r1) ?? new Set<string>();
    s1.add(r2);
    resistorBridges.set(r1, s1);
    const s2 = resistorBridges.get(r2) ?? new Set<string>();
    s2.add(r1);
    resistorBridges.set(r2, s2);
  };

  for (const rPrefix of resistorPrefixes) {
    const terms = Array.from(compTerminals.get(rPrefix) ?? [`${rPrefix}.1`, `${rPrefix}.2`]);
    if (terms.length >= 2) {
      const roots = Array.from(new Set(terms.map((t) => uf.find(t))));
      for (let i = 0; i < roots.length; i++) {
        for (let j = i + 1; j < roots.length; j++) {
          addBridge(roots[i]!, roots[j]!);
        }
      }
    }
  }

  // Helper: find all net roots reachable from a terminal (direct + across 1 resistor)
  const getNetSignals = (
    terminalNodes: string[],
  ): {
    directPins: string[];
    resistorPins: string[];
    directGnd: boolean;
    resistorGnd: boolean;
    direct5V: boolean;
    resistor5V: boolean;
  } => {
    const directRoots = new Set(terminalNodes.map((t) => uf.find(t)));
    const bridgeRoots = new Set<string>();
    for (const r of directRoots) {
      for (const b of resistorBridges.get(r) ?? []) {
        if (!directRoots.has(b)) {
          bridgeRoots.add(b);
        }
      }
    }

    const allNodes = uf.allNodes();
    const directPins: string[] = [];
    const resistorPins: string[] = [];
    let directGnd = false;
    let resistorGnd = false;
    let direct5V = false;
    let resistor5V = false;

    for (const n of allNodes) {
      const root = uf.find(n);
      const inDirect = directRoots.has(root);
      const inBridge = bridgeRoots.has(root);
      if (!inDirect && !inBridge) continue;

      if (n === "GND") {
        if (inDirect) directGnd = true;
        if (inBridge) resistorGnd = true;
      } else if (n === "5V" || n === "3.3V") {
        if (inDirect) direct5V = true;
        if (inBridge) resistor5V = true;
      } else if (isMcuSignalPin(n)) {
        if (inDirect && !directPins.includes(n)) directPins.push(n);
        if (inBridge && !resistorPins.includes(n)) resistorPins.push(n);
      }
    }

    return { directPins, resistorPins, directGnd, resistorGnd, direct5V, resistor5V };
  };

  // Build ordered list of non-resistor parts from `found.components` + any extra prefixes in connections
  const parts: TracedPart[] = [];
  const usedPrefixes = new Set<string>(resistorPrefixes);
  const kindCounters: Record<string, number> = {};

  const nextDefaultId = (kind: CanonicalPartKind): string => {
    const base =
      kind === "led"
        ? "LED"
        : kind === "button"
          ? "SW"
          : kind === "ultrasonic"
            ? "U_SONAR"
            : kind === "servo"
              ? "SERVO"
              : kind === "potentiometer"
                ? "POT"
                : kind === "ldr"
                  ? "LDR"
                  : kind === "buzzer"
                    ? "BZ"
                    : kind === "motor"
                      ? "M"
                      : "PART";
    const c = (kindCounters[base] ?? 0) + 1;
    kindCounters[base] = c;
    return base === "U_SONAR" && c === 1 ? "U_SONAR" : `${base}${c}`;
  };

  const buildTracedPart = (
    id: string,
    kind: CanonicalPartKind,
    rawLabel: string,
    value: string | undefined,
  ): TracedPart => {
    // Collect matching terminal nodes for this component
    const matchingTerms = new Set<string>(compTerminals.get(id) ?? []);
    if (matchingTerms.size === 0) {
      // Check case-insensitive prefix or type alias (e.g., LED1 vs D1, U_SONAR vs SONAR)
      for (const [pref, terms] of compTerminals.entries()) {
        if (
          pref === id ||
          (kind === "led" && /^(?:LED|D)\d+$/.test(pref) && !usedPrefixes.has(pref)) ||
          (kind === "ultrasonic" && inferKindFromPrefix(pref) === "ultrasonic" && !usedPrefixes.has(pref)) ||
          (kind === "button" && inferKindFromPrefix(pref) === "button" && !usedPrefixes.has(pref))
        ) {
          usedPrefixes.add(pref);
          for (const t of terms) matchingTerms.add(t);
          break;
        }
      }
    }

    const termList = Array.from(matchingTerms);
    const sig = getNetSignals(termList);
    const combinedPins = Array.from(new Set([...sig.directPins, ...sig.resistorPins]));

    let trigPin: string | undefined;
    let echoPin: string | undefined;
    if (kind === "ultrasonic") {
      for (const t of termList) {
        const tSig = getNetSignals([t]);
        const pin = tSig.directPins[0] ?? tSig.resistorPins[0];
        if (!pin) continue;
        if (t.includes("TRIG")) trigPin = pin;
        else if (t.includes("ECHO")) echoPin = pin;
      }
      if (!trigPin && combinedPins[0]) trigPin = combinedPins[0];
      if (!echoPin && combinedPins[1]) echoPin = combinedPins[1];
    }

    let pullMode: "internal_pullup" | "external_pullup" | "external_pulldown" = "internal_pullup";
    if (kind === "button") {
      if (sig.resistorGnd && sig.direct5V) {
        pullMode = "external_pulldown";
      } else if (sig.resistor5V && sig.directGnd) {
        pullMode = "external_pullup";
      } else {
        pullMode = "internal_pullup";
      }
    }

    return {
      id,
      kind,
      rawLabel,
      ...(value ? { value } : {}),
      pins: combinedPins,
      ...(trigPin ? { trigPin } : {}),
      ...(echoPin ? { echoPin } : {}),
      hasSeriesResistor: sig.resistorPins.length > 0 || sig.resistorGnd || sig.resistor5V,
      hasGnd: sig.directGnd || sig.resistorGnd,
      has5V: sig.direct5V || sig.resistor5V,
      pullMode,
    };
  };

  for (const comp of found.components) {
    const kind = classifyPartKind(comp);
    if (kind === "resistor") continue;
    const rawId = comp.label ? normalizePinEndpoint(comp.label) : nextDefaultId(kind);
    const cleanId = rawId.split(".")[0] ?? rawId;
    usedPrefixes.add(cleanId);
    parts.push(buildTracedPart(cleanId, kind, comp.label ?? cleanId, comp.value));
  }

  // Also include any component prefixes referenced in connections that weren't in `found.components`
  for (const prefix of compTerminals.keys()) {
    if (usedPrefixes.has(prefix)) continue;
    const kind = inferKindFromPrefix(prefix);
    if (kind === "resistor") continue;
    usedPrefixes.add(prefix);
    parts.push(buildTracedPart(prefix, kind, prefix, undefined));
  }

  // Fallback: if a direct wire goes from an MCU pin to a resistor and no component was explicitly attached,
  // don't invent pins; only report what was found.
  const pinUsage = new Map<string, string[]>();
  for (const part of parts) {
    for (const p of part.pins) {
      const list = pinUsage.get(p) ?? [];
      if (!list.includes(part.id)) list.push(part.id);
      pinUsage.set(p, list);
    }
  }

  const allNodes = uf.allNodes();
  const has5V = allNodes.includes("5V");
  const hasGnd = allNodes.includes("GND");
  const directShort5VToGnd = has5V && hasGnd && uf.connected("5V", "GND");

  return {
    uf,
    resistorBridges,
    parts,
    pinUsage,
    directShort5VToGnd,
    anyGndOnMcu: hasGnd,
  };
}

/**
 * Safety linter for scanned physical circuits.
 */
export function lintScan(found: ScanResult, usesSerial = false): string[] {
  const warnings: string[] = [];
  const graph = analyzeScanGraph(found);

  // 1. Direct 5V <-> GND short
  if (graph.directShort5VToGnd) {
    warnings.push("Direct 5V ↔ GND short detected! Remove the jumper shorting power to ground before powering on.");
  }

  // 2. LED without a series resistor
  for (const part of graph.parts) {
    if (part.kind === "led" && part.pins.length > 0 && !part.hasSeriesResistor) {
      warnings.push(
        `LED (${part.id}) on ${part.pins[0]} has no series current-limiting resistor (add 220Ω–1kΩ in series).`,
      );
    }
  }

  // 3. Component powered / connected but GND not shared with MCU
  if (graph.parts.length > 0 && found.connections.length > 0 && !graph.anyGndOnMcu) {
    warnings.push("Component powered or wired without a shared MCU GND reference (connect breadboard ground rail to Arduino GND).");
  } else {
    for (const part of graph.parts) {
      if (
        (part.kind === "led" || part.kind === "ultrasonic" || part.kind === "servo") &&
        (part.pins.length > 0 || part.has5V) &&
        !part.hasGnd
      ) {
        warnings.push(`${part.id} has no ground return path to Arduino GND.`);
      }
    }
  }

  // 4. Two parts sharing the same MCU pin
  for (const [pin, partIds] of graph.pinUsage.entries()) {
    if (partIds.length > 1) {
      warnings.push(`Multiple components (${partIds.join(", ")}) are wired to the same MCU pin ${pin}.`);
    }
  }

  // 5. Using D0/D1 while Serial is used
  const hasUltrasonic = graph.parts.some((p) => p.kind === "ultrasonic");
  const serialActive = usesSerial || hasUltrasonic;
  if (serialActive) {
    for (const pin of ["D0", "D1"]) {
      const users = graph.pinUsage.get(pin);
      if (users && users.length > 0) {
        warnings.push(
          `Pin ${pin} (UART RX/TX) is used by ${users.join(", ")} while Serial is active; move it to D2–D13.`,
        );
      }
    }
  }

  // 6. Motor / servo drawing power from a digital pin
  for (const part of graph.parts) {
    if (part.kind === "motor") {
      warnings.push(
        `DC motor (${part.id}) needs a transistor/MOSFET or H-bridge driver; do not drive it directly from an Arduino pin.`,
      );
    }
    if (part.kind === "servo" && !part.has5V && part.pins.length > 0) {
      warnings.push(
        `Servo (${part.id}) requires 5V power rail connection; do not power servo V+ from a digital I/O pin.`,
      );
    }
  }

  return warnings;
}

/**
 * Generates a deterministic, compilable Arduino UNO sketch from the scanned `found: ScanResult`.
 */
export function generateSketch(
  found: ScanResult,
  _opts?: GenerateSketchOptions,
): GeneratedSketchResult {
  const graph = analyzeScanGraph(found);
  const notes: string[] = [];

  const leds = graph.parts.filter((p) => p.kind === "led" && p.pins.length > 0);
  const buttons = graph.parts.filter((p) => p.kind === "button" && p.pins.length > 0);
  const ultrasonics = graph.parts.filter(
    (p) => p.kind === "ultrasonic" && (p.trigPin || p.pins.length >= 2),
  );
  const servos = graph.parts.filter((p) => p.kind === "servo" && p.pins.length > 0);
  const pots = graph.parts.filter((p) => p.kind === "potentiometer" && p.pins.length > 0);
  const ldrs = graph.parts.filter((p) => p.kind === "ldr" && p.pins.length > 0);
  const buzzers = graph.parts.filter((p) => p.kind === "buzzer" && p.pins.length > 0);
  const motors = graph.parts.filter((p) => p.kind === "motor");
  const unknowns = graph.parts.filter(
    (p) =>
      p.kind === "unknown" ||
      (p.kind !== "motor" &&
        p.pins.length === 0 &&
        !p.trigPin &&
        !p.echoPin),
  );

  for (const m of motors) {
    notes.push(
      `Skipped pin output for DC motor ${m.id}: requires an external transistor or driver stage.`,
    );
  }
  for (const u of unknowns) {
    notes.push(
      u.pins.length > 0
        ? `Unrecognized component ${u.rawLabel} on ${u.pins.join(", ")} noted in comments.`
        : `Component ${u.rawLabel} has no traced MCU signal pin; omitted from active pin definitions.`,
    );
  }

  // Determine behavior rule (first matching rule, documented in header)
  type RuleId =
    | "button_led"
    | "pot_servo"
    | "ultrasonic_alert"
    | "ultrasonic_serial"
    | "ldr_led"
    | "led_blink"
    | "multi_nonblocking";

  let selectedRule: RuleId = "multi_nonblocking";
  let ruleDescription = "Rule 7: Independent non-blocking millis() control blocks per detected component";

  const activePartCount =
    leds.length +
    buttons.length +
    ultrasonics.length +
    servos.length +
    pots.length +
    ldrs.length +
    buzzers.length;

  if (
    buttons.length === 1 &&
    leds.length === 1 &&
    ultrasonics.length === 0 &&
    servos.length === 0 &&
    pots.length === 0 &&
    ldrs.length === 0 &&
    buzzers.length === 0
  ) {
    selectedRule = "button_led";
    ruleDescription = "Rule 1: Button + LED -> LED follows push button state";
  } else if (
    pots.length === 1 &&
    servos.length === 1 &&
    buttons.length === 0 &&
    leds.length === 0 &&
    ultrasonics.length === 0 &&
    ldrs.length === 0 &&
    buzzers.length === 0
  ) {
    selectedRule = "pot_servo";
    ruleDescription = "Rule 2: Potentiometer + Servo -> Servo angle mapped from analog input (0..180 deg)";
  } else if (
    ultrasonics.length === 1 &&
    leds.length + buzzers.length >= 1 &&
    buttons.length === 0 &&
    servos.length === 0 &&
    pots.length === 0 &&
    ldrs.length === 0
  ) {
    selectedRule = "ultrasonic_alert";
    ruleDescription = "Rule 3: Ultrasonic + LED/Buzzer -> Activate output when distance < 20 cm";
  } else if (ultrasonics.length === 1 && activePartCount === 1) {
    selectedRule = "ultrasonic_serial";
    ruleDescription = "Rule 4: Ultrasonic sensor alone -> Print distance (cm) to Serial every 200 ms";
  } else if (
    ldrs.length === 1 &&
    leds.length === 1 &&
    buttons.length === 0 &&
    ultrasonics.length === 0 &&
    servos.length === 0 &&
    pots.length === 0 &&
    buzzers.length === 0
  ) {
    selectedRule = "ldr_led";
    ruleDescription = "Rule 5: LDR + LED -> Turn LED on when ambient light falls below DARK_THRESHOLD";
  } else if (leds.length === 1 && activePartCount === 1) {
    selectedRule = "led_blink";
    ruleDescription = "Rule 6: Single LED -> Non-blocking 500 ms blink using millis()";
  }

  notes.push(`Selected behavior: ${ruleDescription}`);

  const usesSerial =
    ultrasonics.length > 0 ||
    (selectedRule === "multi_nonblocking" && (pots.length > 0 || ldrs.length > 0));
  const warnings = lintScan(found, usesSerial);

  const lines: string[] = [];

  // Emit @s2c annotations at top so Sketch2Circuit AST synthesizer also maps parts in 3D/2D twin
  for (const led of leds) {
    lines.push(`// @s2c: led(color=red) on ${led.pins[0]}`);
  }
  for (const btn of buttons) {
    lines.push(`// @s2c: button on ${btn.pins[0]}`);
  }
  for (const u of ultrasonics) {
    const tPin = u.trigPin ?? u.pins[0] ?? "D9";
    const ePin = u.echoPin ?? u.pins[1] ?? "D10";
    lines.push(`// @s2c: hcsr04(trig=${tPin}, echo=${ePin})`);
  }
  for (const ldr of ldrs) {
    lines.push(`// @s2c: ldr on ${ldr.pins[0]}`);
  }
  for (const pot of pots) {
    lines.push(`// @s2c: potentiometer on ${pot.pins[0]}`);
  }
  for (const bz of buzzers) {
    lines.push(`// @s2c: buzzer on ${bz.pins[0]}`);
  }

  lines.push(`// Generated from physical breadboard scan (Arduino UNO)`);
  lines.push(`// ${ruleDescription}`);

  if (servos.length > 0) {
    lines.push(`#include <Servo.h>`);
  }
  lines.push("");

  // Pin constants
  leds.forEach((led, i) => {
    const varName = i === 0 ? "ledPin" : `led${i + 1}Pin`;
    lines.push(`const int ${varName} = ${pinToArduinoLiteral(led.pins[0]!)};`);
  });

  buttons.forEach((btn, i) => {
    const varName = i === 0 ? "buttonPin" : `button${i + 1}Pin`;
    lines.push(`const int ${varName} = ${pinToArduinoLiteral(btn.pins[0]!)};`);
  });

  ultrasonics.forEach((u, i) => {
    const tVar = i === 0 ? "trigPin" : `trig${i + 1}Pin`;
    const eVar = i === 0 ? "echoPin" : `echo${i + 1}Pin`;
    const tPin = u.trigPin ?? u.pins[0]!;
    const ePin = u.echoPin ?? u.pins[1] ?? u.pins[0]!;
    lines.push(`const int ${tVar} = ${pinToArduinoLiteral(tPin)};`);
    lines.push(`const int ${eVar} = ${pinToArduinoLiteral(ePin)};`);
  });

  servos.forEach((srv, i) => {
    const varName = i === 0 ? "servoPin" : `servo${i + 1}Pin`;
    lines.push(`const int ${varName} = ${pinToArduinoLiteral(srv.pins[0]!)};`);
  });

  pots.forEach((pot, i) => {
    const varName = i === 0 ? "potPin" : `pot${i + 1}Pin`;
    lines.push(`const int ${varName} = ${pinToArduinoLiteral(pot.pins[0]!)};`);
  });

  ldrs.forEach((ldr, i) => {
    const varName = i === 0 ? "ldrPin" : `ldr${i + 1}Pin`;
    lines.push(`const int ${varName} = ${pinToArduinoLiteral(ldr.pins[0]!)};`);
  });

  buzzers.forEach((bz, i) => {
    const varName = i === 0 ? "buzzerPin" : `buzzer${i + 1}Pin`;
    lines.push(`const int ${varName} = ${pinToArduinoLiteral(bz.pins[0]!)};`);
  });

  for (const m of motors) {
    lines.push(
      `// WARNING: DC motor (${m.id}) requires a transistor/driver; pin output intentionally omitted.`,
    );
  }
  for (const u of unknowns) {
    lines.push(
      `// Note: Unmapped component ${u.rawLabel}${u.pins.length > 0 ? ` on ${u.pins.join(", ")}` : " (no MCU pin traced)"}`,
    );
  }

  // Extra state/threshold constants
  if (ldrs.length > 0) {
    lines.push(`const int DARK_THRESHOLD = 400;`);
  }
  if (selectedRule === "led_blink" || (selectedRule === "multi_nonblocking" && leds.length > 0)) {
    lines.push(`const unsigned long BLINK_INTERVAL_MS = 500;`);
    lines.push(`unsigned long lastBlinkMs = 0;`);
    lines.push(`bool ledState = false;`);
  }
  if (
    selectedRule === "ultrasonic_serial" ||
    selectedRule === "ultrasonic_alert" ||
    (selectedRule === "multi_nonblocking" && ultrasonics.length > 0)
  ) {
    lines.push(`const unsigned long SONAR_INTERVAL_MS = 200;`);
    lines.push(`unsigned long lastSonarMs = 0;`);
  }

  servos.forEach((_, i) => {
    const objName = i === 0 ? "myServo" : `myServo${i + 1}`;
    lines.push(`Servo ${objName};`);
  });

  lines.push("");

  // Optional ultrasonic helper
  if (ultrasonics.length > 0) {
    lines.push(`long readDistanceCm(int trig, int echo) {`);
    lines.push(`  digitalWrite(trig, LOW);`);
    lines.push(`  delayMicroseconds(2);`);
    lines.push(`  digitalWrite(trig, HIGH);`);
    lines.push(`  delayMicroseconds(10);`);
    lines.push(`  digitalWrite(trig, LOW);`);
    lines.push(`  long durationUs = pulseIn(echo, HIGH, 30000UL);`);
    lines.push(`  if (durationUs == 0) return 999;`);
    lines.push(`  return durationUs / 58;`);
    lines.push(`}`);
    lines.push("");
  }

  // setup()
  lines.push(`void setup() {`);
  if (usesSerial) {
    lines.push(`  Serial.begin(9600);`);
  }
  leds.forEach((_, i) => {
    const varName = i === 0 ? "ledPin" : `led${i + 1}Pin`;
    lines.push(`  pinMode(${varName}, OUTPUT);`);
  });
  buttons.forEach((btn, i) => {
    const varName = i === 0 ? "buttonPin" : `button${i + 1}Pin`;
    const modeStr = btn.pullMode === "internal_pullup" ? "INPUT_PULLUP" : "INPUT";
    lines.push(`  pinMode(${varName}, ${modeStr});`);
  });
  ultrasonics.forEach((_, i) => {
    const tVar = i === 0 ? "trigPin" : `trig${i + 1}Pin`;
    const eVar = i === 0 ? "echoPin" : `echo${i + 1}Pin`;
    lines.push(`  pinMode(${tVar}, OUTPUT);`);
    lines.push(`  pinMode(${eVar}, INPUT);`);
  });
  servos.forEach((_, i) => {
    const objName = i === 0 ? "myServo" : `myServo${i + 1}`;
    const varName = i === 0 ? "servoPin" : `servo${i + 1}Pin`;
    lines.push(`  ${objName}.attach(${varName});`);
  });
  buzzers.forEach((_, i) => {
    const varName = i === 0 ? "buzzerPin" : `buzzer${i + 1}Pin`;
    lines.push(`  pinMode(${varName}, OUTPUT);`);
  });
  lines.push(`}`);
  lines.push("");

  // loop()
  lines.push(`void loop() {`);
  if (selectedRule === "button_led") {
    const btn = buttons[0]!;
    const pressedLevel = btn.pullMode === "external_pulldown" ? "HIGH" : "LOW";
    lines.push(`  // Pressed = ${pressedLevel} (${btn.pullMode.replace(/_/g, " ")})`);
    lines.push(`  bool pressed = (digitalRead(buttonPin) == ${pressedLevel});`);
    lines.push(`  digitalWrite(ledPin, pressed ? HIGH : LOW);`);
  } else if (selectedRule === "pot_servo") {
    lines.push(`  int raw = analogRead(potPin);`);
    lines.push(`  int angle = map(raw, 0, 1023, 0, 180);`);
    lines.push(`  myServo.write(angle);`);
  } else if (selectedRule === "ultrasonic_alert") {
    lines.push(`  unsigned long now = millis();`);
    lines.push(`  if (now - lastSonarMs >= SONAR_INTERVAL_MS) {`);
    lines.push(`    lastSonarMs = now;`);
    lines.push(`    long distanceCm = readDistanceCm(trigPin, echoPin);`);
    lines.push(`    Serial.print("Distance (cm): ");`);
    lines.push(`    Serial.println(distanceCm);`);
    lines.push(`    bool closeObject = (distanceCm < 20);`);
    if (leds.length > 0) {
      lines.push(`    digitalWrite(ledPin, closeObject ? HIGH : LOW);`);
    }
    if (buzzers.length > 0) {
      lines.push(`    if (closeObject) {`);
      lines.push(`      tone(buzzerPin, 1000);`);
      lines.push(`    } else {`);
      lines.push(`      noTone(buzzerPin);`);
      lines.push(`    }`);
    }
    lines.push(`  }`);
  } else if (selectedRule === "ultrasonic_serial") {
    lines.push(`  unsigned long now = millis();`);
    lines.push(`  if (now - lastSonarMs >= SONAR_INTERVAL_MS) {`);
    lines.push(`    lastSonarMs = now;`);
    lines.push(`    long distanceCm = readDistanceCm(trigPin, echoPin);`);
    lines.push(`    Serial.print("Distance (cm): ");`);
    lines.push(`    Serial.println(distanceCm);`);
    lines.push(`  }`);
  } else if (selectedRule === "ldr_led") {
    lines.push(`  int lightLevel = analogRead(ldrPin);`);
    lines.push(`  digitalWrite(ledPin, (lightLevel < DARK_THRESHOLD) ? HIGH : LOW);`);
  } else if (selectedRule === "led_blink") {
    lines.push(`  unsigned long now = millis();`);
    lines.push(`  if (now - lastBlinkMs >= BLINK_INTERVAL_MS) {`);
    lines.push(`    lastBlinkMs = now;`);
    lines.push(`    ledState = !ledState;`);
    lines.push(`    digitalWrite(ledPin, ledState ? HIGH : LOW);`);
    lines.push(`  }`);
  } else {
    // Rule 7: Multi-part non-blocking loop
    lines.push(`  unsigned long now = millis();`);
    if (buttons.length > 0 && leds.length > 0) {
      const btn = buttons[0]!;
      const pressedLevel = btn.pullMode === "external_pulldown" ? "HIGH" : "LOW";
      lines.push(`  bool pressed = (digitalRead(buttonPin) == ${pressedLevel});`);
      lines.push(`  digitalWrite(ledPin, pressed ? HIGH : LOW);`);
      for (let i = 1; i < leds.length; i++) {
        lines.push(`  digitalWrite(led${i + 1}Pin, pressed ? HIGH : LOW);`);
      }
    } else if (leds.length > 0) {
      lines.push(`  if (now - lastBlinkMs >= BLINK_INTERVAL_MS) {`);
      lines.push(`    lastBlinkMs = now;`);
      lines.push(`    ledState = !ledState;`);
      leds.forEach((_, i) => {
        const varName = i === 0 ? "ledPin" : `led${i + 1}Pin`;
        lines.push(`    digitalWrite(${varName}, ledState ? HIGH : LOW);`);
      });
      lines.push(`  }`);
    }
    if (pots.length > 0 && servos.length > 0) {
      lines.push(`  int angle = map(analogRead(potPin), 0, 1023, 0, 180);`);
      lines.push(`  myServo.write(angle);`);
    } else if (pots.length > 0 && usesSerial) {
      lines.push(`  int potVal = analogRead(potPin);`);
      lines.push(`  (void)potVal;`);
    }
    if (ldrs.length > 0) {
      lines.push(`  int lightVal = analogRead(ldrPin);`);
      if (leds.length > 0 && buttons.length === 0) {
        lines.push(`  digitalWrite(ledPin, (lightVal < DARK_THRESHOLD) ? HIGH : LOW);`);
      } else {
        lines.push(`  (void)lightVal;`);
      }
    }
    if (ultrasonics.length > 0) {
      lines.push(`  if (now - lastSonarMs >= SONAR_INTERVAL_MS) {`);
      lines.push(`    lastSonarMs = now;`);
      lines.push(`    long distanceCm = readDistanceCm(trigPin, echoPin);`);
      lines.push(`    Serial.print("Distance (cm): ");`);
      lines.push(`    Serial.println(distanceCm);`);
      if (buzzers.length > 0) {
        lines.push(`    if (distanceCm < 20) tone(buzzerPin, 1000);`);
        lines.push(`    else noTone(buzzerPin);`);
      }
      lines.push(`  }`);
    } else if (buzzers.length > 0) {
      lines.push(`  if ((now / 1000) % 2 == 0) tone(buzzerPin, 880);`);
      lines.push(`  else noTone(buzzerPin);`);
    }
  }
  lines.push(`}`);
  lines.push("");

  // Final Wiring comment block
  lines.push(`/*`);
  lines.push(` * Wiring:`);
  if (found.connections.length === 0) {
    lines.push(` * - No connections detected`);
  } else {
    for (const c of found.connections) {
      lines.push(` * - ${normalizePinEndpoint(c.from)} -> ${normalizePinEndpoint(c.to)}`);
    }
  }
  lines.push(` */`);

  return {
    code: lines.join("\n"),
    notes,
    warnings,
  };
}

/**
 * Extracts a canonical signature of all pin arguments passed to `pinMode(`, `digitalWrite(`,
 * and `analogRead(` (resolving const int identifiers) to verify an LLM comment pass never altered pins.
 */
export function extractSketchPinSignature(code: string): string {
  const constMap = new Map<string, string>();
  const constRegex = /\bconst\s+int\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z0-9_]+)\s*;/g;
  for (const m of code.matchAll(constRegex)) {
    const name = m[1];
    const val = m[2];
    if (name && val) {
      constMap.set(name, val);
    }
  }

  const calls: string[] = [];
  const callRegex = /\b(pinMode|digitalWrite|digitalRead|analogRead|analogWrite)\s*\(\s*([A-Za-z0-9_]+)/g;
  for (const m of code.matchAll(callRegex)) {
    const fn = m[1];
    const rawArg = m[2];
    if (!fn || !rawArg) continue;
    const resolved = constMap.get(rawArg) ?? rawArg;
    calls.push(`${fn}:${resolved}`);
  }

  return calls.join("|");
}
