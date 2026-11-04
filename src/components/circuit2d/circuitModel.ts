/**
 * @license Apache-2.0
 * @s2c/circuit2d — Pure 2D Schematic & Breadboard Circuit Model, E24 Color Calculator, and Breadboard Allocator.
 * Zero React or DOM dependencies; 100% deterministic and unit-testable.
 */

import type {
  Circuit,
  Component,
  ComponentKind,
  Net,
  NetKind,
  PinCapability,
  Port,
  PortKind,
} from "@s2c/circuit-json";

// ============================================================================
// WIRE COLORS (Shared across 2D Schematic, 2D Breadboard, and 3D Digital Twin)
// ============================================================================

export const WIRE_COLORS = {
  "5V": "#e0453a",
  "3V3": "#ea580c",
  "3.3V": "#ea580c",
  VIN: "#e11d48",
  VCC: "#e0453a",
  GND: "#23263a",
  GND_DARK: "#64748b",
  PALETTE: [
    "#22a559", // Green
    "#d97706", // Amber/Yellow
    "#2563eb", // Blue
    "#ea580c", // Orange
    "#9333ea", // Purple
    "#0891b2", // Cyan-Teal
    "#db2777", // Magenta
  ] as const,
  DARK_PALETTE: [
    "#34d399", // High-contrast Emerald
    "#f5b83d", // Warm Gold/Yellow
    "#60a5fa", // High-contrast Sky/Blue (replaces dark blue on #0b0f17)
    "#fb923c", // Bright Orange
    "#c084fc", // Bright Purple
    "#22d3ee", // Bright Cyan
    "#f472b6", // Bright Pink
  ] as const,
} as const;

/**
 * Deterministically resolves a wire color for a net based on its ID, kind, index, and active theme.
 */
export function resolveNetColor(
  netId: string,
  kind: NetKind,
  signalIndex: number,
  theme: "light" | "dark" = "light",
): string {
  const upper = netId.trim().toUpperCase();
  if (kind === "ground" || upper === "GND" || upper.startsWith("GND")) {
    return theme === "dark" ? WIRE_COLORS.GND_DARK : WIRE_COLORS.GND;
  }
  if (upper === "3V3" || upper === "3.3V") {
    return theme === "dark" ? "#fb923c" : WIRE_COLORS["3V3"];
  }
  if (upper === "VIN") {
    return theme === "dark" ? "#fb7185" : WIRE_COLORS.VIN;
  }
  if (kind === "power" || upper === "5V" || upper === "VCC" || upper.startsWith("5V")) {
    return theme === "dark" ? "#f87171" : WIRE_COLORS["5V"];
  }
  const palette = theme === "dark" ? WIRE_COLORS.DARK_PALETTE : WIRE_COLORS.PALETTE;
  const idx = Math.abs(signalIndex) % palette.length;
  return palette[idx] ?? (theme === "dark" ? "#34d399" : "#22a559");
}

// ============================================================================
// NORMALIZED CIRCUIT MODEL TYPES
// ============================================================================

export type SymbolKind =
  | "mcu"
  | "resistor"
  | "led"
  | "button"
  | "hc-sr04"
  | "potentiometer"
  | "ldr"
  | "servo"
  | "buzzer"
  | "oled"
  | "capacitor"
  | "relay"
  | "motor"
  | "generic";

export interface NormalizedPin {
  /** Global port ID from Circuit IR: e.g. "U1.D13", "R1.1", "D1.A" */
  id: string;
  /** Parent component ID: e.g. "U1", "R1" */
  partId: string;
  /** Pin name on the component: e.g. "D13", "1", "A", "TRIG" */
  name: string;
  /** Electrical port kind from @s2c/circuit-json */
  kind: PortKind;
  /** Connected net ID, if wired */
  netId: string | null;
  /** Pin capabilities from @s2c/circuit-json */
  capabilities: PinCapability[];
  /** Internal pull configuration */
  pull: "up" | "down" | "none";
}

export interface NormalizedPart {
  /** Component reference designator: e.g. "R1", "D1", "SENSOR1" */
  id: string;
  /** Original @s2c/circuit-json ComponentKind */
  rawKind: ComponentKind;
  /** Resolved 2D symbol category */
  symbolKind: SymbolKind;
  /** Human-readable title from comp.name || comp.partNumber || comp.id */
  label: string;
  /** Part number if present: e.g. "HC-SR04", "SG90" */
  partNumber: string;
  /** Formatted electrical value: e.g. "330 Ω", "10 kΩ", "Red", "100 µF" */
  value: string;
  /** Raw numeric resistance in Ohms if resistor/potentiometer */
  resistanceOhms?: number;
  /** Whether a button uses INPUT_PULLUP */
  inputPullup?: boolean;
  /** LED emission color hex if symbolKind === "led" */
  ledColorHex?: string;
  /** Component ports in deterministic order */
  pins: NormalizedPin[];
  /** Connected net IDs */
  netIds: string[];
  /** Connected Arduino MCU pin names (e.g. ["D13"]) for sorting/grouping */
  mcuPins: string[];
}

export interface NormalizedNet {
  /** Net ID from @s2c/circuit-json */
  id: string;
  /** Human-readable net name */
  name: string;
  /** Net classification: "signal" | "power" | "ground" */
  kind: NetKind;
  /** Nominal voltage if specified */
  voltage?: number;
  /** Assigned wire color hex from WIRE_COLORS */
  color: string;
  /** Connected port IDs in deterministic order */
  portIds: string[];
  /** Connected MCU pin names on U1 (e.g. ["D13"], ["5V"], ["GND"]) */
  mcuPins: string[];
}

export interface CircuitModel {
  /** Circuit design title */
  name: string;
  /** Target board ID from metadata or MCU component */
  boardName: string;
  /** The MCU component (U1) if present in circuit.components */
  mcu: NormalizedPart | null;
  /** Non-MCU peripheral parts in deterministic order */
  parts: NormalizedPart[];
  /** All normalized pins (both MCU and peripheral) */
  pins: NormalizedPin[];
  /** All normalized nets with stable wire colors */
  nets: NormalizedNet[];
  /** Fast lookup map: netId -> color hex */
  netColors: Record<string, string>;
}

// ============================================================================
// E24 RESISTOR COLOR BAND CALCULATOR
// ============================================================================

export interface ResistorBandSpec {
  name: string;
  hex: string;
}

export interface ResistorBandsResult {
  ohms: number;
  formatted: string;
  bands: [ResistorBandSpec, ResistorBandSpec, ResistorBandSpec, ResistorBandSpec];
}

const DIGIT_BANDS: ReadonlyArray<ResistorBandSpec> = [
  { name: "Black", hex: "#18181b" }, // 0
  { name: "Brown", hex: "#78350f" }, // 1
  { name: "Red", hex: "#dc2626" }, // 2
  { name: "Orange", hex: "#ea580c" }, // 3
  { name: "Yellow", hex: "#eab308" }, // 4
  { name: "Green", hex: "#16a34a" }, // 5
  { name: "Blue", hex: "#2563eb" }, // 6
  { name: "Violet", hex: "#7c3aed" }, // 7
  { name: "Grey", hex: "#64748b" }, // 8
  { name: "White", hex: "#f8fafc" }, // 9
];

const GOLD_BAND: ResistorBandSpec = { name: "Gold", hex: "#d4af37" };
const SILVER_BAND: ResistorBandSpec = { name: "Silver", hex: "#94a3b8" };

const E24_MANTISSAS: ReadonlyArray<number> = [
  1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6,
  6.2, 6.8, 7.5, 8.2, 9.1,
];

/**
 * Parses a resistance string (e.g. "330Ω", "4.7kΩ", "10k", "1MΩ") or number into Ohms.
 */
export function parseResistanceOhms(input: number | string | undefined): number {
  if (typeof input === "number" && Number.isFinite(input) && input > 0) {
    return input;
  }
  if (typeof input !== "string" || input.trim().length === 0) {
    return 330;
  }
  const clean = input.trim().replace(/ohms?|Ω/gi, "").trim();
  const match = clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*([kKmM]?)$/);
  if (!match) {
    const num = Number.parseFloat(clean);
    return Number.isFinite(num) && num > 0 ? num : 330;
  }
  const base = Number.parseFloat(match[1] ?? "330");
  const suffix = (match[2] ?? "").toLowerCase();
  if (suffix === "k") return base * 1_000;
  if (suffix === "m") return base * 1_000_000;
  return base > 0 ? base : 330;
}

/**
 * Formats an Ohm value into clean engineering notation (e.g. "220 Ω", "4.7 kΩ", "1 MΩ").
 */
export function formatOhmsLabel(ohms: number): string {
  if (!Number.isFinite(ohms) || ohms <= 0) return "330 Ω";
  if (ohms >= 1_000_000) {
    const m = ohms / 1_000_000;
    return `${Number(m.toFixed(2))} MΩ`;
  }
  if (ohms >= 1_000) {
    const k = ohms / 1_000;
    return `${Number(k.toFixed(2))} kΩ`;
  }
  return `${Number(ohms.toFixed(1))} Ω`;
}

/**
 * Computes E24 4-band resistor colors (Digit 1, Digit 2, Multiplier, ±5% Gold Tolerance)
 * and formatted engineering label.
 */
export function resistorBands(ohmsInput: number | string | undefined): ResistorBandsResult {
  const rawOhms = parseResistanceOhms(ohmsInput);
  const clamped = Math.max(1, Math.min(91_000_000, rawOhms));

  const decadeExp = Math.floor(Math.log10(clamped));
  const normMantissa = clamped / 10 ** decadeExp;

  // Snap to closest E24 mantissa
  let bestMantissa = E24_MANTISSAS[0] ?? 1.0;
  let minDiff = Number.POSITIVE_INFINITY;
  for (const m of E24_MANTISSAS) {
    const diff = Math.abs(m - normMantissa);
    if (diff < minDiff) {
      minDiff = diff;
      bestMantissa = m;
    }
  }

  const snappedOhms = Number((bestMantissa * 10 ** decadeExp).toPrecision(2));
  const twoDigitInt = Math.round(bestMantissa * 10); // 10..91
  const d1 = Math.max(0, Math.min(9, Math.floor(twoDigitInt / 10)));
  const d2 = Math.max(0, Math.min(9, twoDigitInt % 10));
  const multPower = decadeExp - 1; // because twoDigitInt is bestMantissa * 10

  const band1 = DIGIT_BANDS[d1] ?? DIGIT_BANDS[3]!;
  const band2 = DIGIT_BANDS[d2] ?? DIGIT_BANDS[3]!;

  let multBand: ResistorBandSpec = DIGIT_BANDS[1]!;
  if (multPower === -1) {
    multBand = GOLD_BAND;
  } else if (multPower <= -2) {
    multBand = SILVER_BAND;
  } else {
    const clampedMult = Math.max(0, Math.min(9, multPower));
    multBand = DIGIT_BANDS[clampedMult] ?? DIGIT_BANDS[1]!;
  }

  return {
    ohms: snappedOhms,
    formatted: formatOhmsLabel(rawOhms),
    bands: [band1, band2, multBand, GOLD_BAND],
  };
}

// ============================================================================
// COMPONENT CLASSIFICATION HELPERS
// ============================================================================

function classifySymbolKind(comp: Component): SymbolKind {
  if (comp.kind === "mcu" || comp.id === "U1") {
    return "mcu";
  }

  const sig = `${comp.id} ${comp.kind} ${comp.partNumber ?? ""} ${comp.name ?? ""} ${comp.footprint ?? ""}`.toLowerCase();

  if (comp.kind === "resistor" || /^r\d+/i.test(comp.id)) {
    return "resistor";
  }
  if (comp.kind === "led" || /^led\d+/i.test(comp.id) || /^d\d+/i.test(comp.id)) {
    return "led";
  }
  if (comp.kind === "button" || comp.kind === "switch" || /^sw\d+/i.test(comp.id) || sig.includes("tact")) {
    return "button";
  }
  if (sig.includes("hc-sr04") || sig.includes("sr04") || sig.includes("ultrasonic") || sig.includes("sonar")) {
    return "hc-sr04";
  }
  if (comp.kind === "potentiometer" || sig.includes("pot") || /^pot\d+/i.test(comp.id)) {
    return "potentiometer";
  }
  if (sig.includes("ldr") || sig.includes("photo") || sig.includes("gl5528")) {
    return "ldr";
  }
  if (sig.includes("sg90") || sig.includes("servo") || /^servo\d+/i.test(comp.id)) {
    return "servo";
  }
  if (comp.kind === "buzzer" || sig.includes("piezo") || sig.includes("buzzer") || /^spk\d+/i.test(comp.id)) {
    return "buzzer";
  }
  if (sig.includes("oled") || sig.includes("ssd1306") || sig.includes("i2c") || /^i2c\d+/i.test(comp.id)) {
    return "oled";
  }
  if (comp.kind === "capacitor" || /^c_?\d+/i.test(comp.id) || sig.includes("cap")) {
    return "capacitor";
  }
  if (comp.kind === "relay" || sig.includes("relay")) {
    return "relay";
  }
  if (sig.includes("motor")) {
    return "motor";
  }
  return "generic";
}

function resolveLedColorHex(comp: Component): string {
  const raw = `${comp.value ?? ""} ${comp.properties?.color ?? ""} ${comp.name ?? ""}`.toLowerCase();
  if (raw.includes("green") || raw.includes("grn")) return "#22c559";
  if (raw.includes("blue") || raw.includes("blu")) return "#3b82f6";
  if (raw.includes("yellow") || raw.includes("ylw") || raw.includes("amber")) return "#eab308";
  if (raw.includes("white")) return "#f8fafc";
  if (raw.includes("cyan")) return "#06b6d4";
  return "#ef4444"; // Default Red LED
}

function normalizeMcuPinName(portName: string): string {
  const clean = portName.trim().toUpperCase();
  if (clean.startsWith("GND") || clean.endsWith(".GND") || clean.includes("GND")) return "GND";
  if (clean === "3V3" || clean === "3.3V") return "3.3V";
  if (/^\d+$/.test(clean)) return `D${clean}`;
  return clean;
}

// ============================================================================
// BUILD NORMALIZED CIRCUIT MODEL
// ============================================================================

/**
 * Normalizes a `@s2c/circuit-json` `Circuit` into a defensive, layout-ready `CircuitModel`.
 * Unknown component kinds fall back to `"generic"` labeled blocks; empty circuits return an empty model.
 */
export function buildCircuitModel(
  circuit: Circuit | null | undefined,
  theme: "light" | "dark" = "light",
): CircuitModel {
  if (!circuit || !Array.isArray(circuit.components) || circuit.components.length === 0) {
    return {
      name: circuit?.name || "Empty Circuit",
      boardName: circuit?.metadata?.board || "ARDUINO UNO R3 · ATmega328P",
      mcu: null,
      parts: [],
      pins: [],
      nets: [],
      netColors: {},
    };
  }

  const rawComponents: Component[] = circuit.components;
  const rawNets: Net[] = Array.isArray(circuit.nets) ? circuit.nets : [];

  // 1. Identify MCU component (usually U1 / kind === "mcu")
  const mcuComp =
    rawComponents.find((c) => c.kind === "mcu" || c.id === "U1") ?? null;
  const mcuId = mcuComp?.id ?? "U1";

  // 2. Build portId -> netId map from nets + port.netId
  const portToNetId = new Map<string, string>();
  const netPortSet = new Map<string, Set<string>>();
  const netMeta = new Map<string, { name: string; kind: NetKind; voltage?: number }>();

  for (const net of rawNets) {
    if (!net || !net.id) continue;
    const set = netPortSet.get(net.id) ?? new Set<string>();
    netPortSet.set(net.id, set);
    netMeta.set(net.id, {
      name: net.name ?? net.id,
      kind: net.kind ?? "signal",
      ...(net.voltage !== undefined ? { voltage: net.voltage } : {}),
    });

    const pIds = Array.isArray(net.portIds) ? net.portIds : [];
    for (const pid of pIds) {
      if (typeof pid === "string" && pid.length > 0) {
        set.add(pid);
        portToNetId.set(pid, net.id);
      }
    }
  }

  for (const comp of rawComponents) {
    if (!comp || !Array.isArray(comp.ports)) continue;
    for (const port of comp.ports) {
      if (!port || !port.id) continue;
      if (port.netId && !portToNetId.has(port.id)) {
        portToNetId.set(port.id, port.netId);
        const set = netPortSet.get(port.netId) ?? new Set<string>();
        set.add(port.id);
        netPortSet.set(port.netId, set);
        if (!netMeta.has(port.netId)) {
          const upper = port.netId.toUpperCase();
          const inferredKind: NetKind =
            upper.includes("GND") ? "ground" : upper === "5V" || upper === "3V3" ? "power" : "signal";
          netMeta.set(port.netId, { name: port.netId, kind: inferredKind });
        }
      }
    }
  }

  // 3. Build NormalizedNet[] in deterministic order (power/ground first or alphabetical signal order)
  const sortedNetIds = Array.from(netPortSet.keys()).sort((a, b) => a.localeCompare(b));
  const nets: NormalizedNet[] = [];
  const netColors: Record<string, string> = {};
  let signalColorCounter = 0;

  for (const netId of sortedNetIds) {
    const portSet = netPortSet.get(netId);
    if (!portSet || portSet.size === 0) continue;
    const meta = netMeta.get(netId) ?? { name: netId, kind: "signal" as NetKind };
    const isSignal =
      meta.kind === "signal" &&
      !netId.toUpperCase().includes("GND") &&
      netId.toUpperCase() !== "5V" &&
      netId.toUpperCase() !== "3V3" &&
      netId.toUpperCase() !== "VIN";

    const color = resolveNetColor(netId, meta.kind, isSignal ? signalColorCounter++ : 0, theme);
    netColors[netId] = color;

    const portIds = Array.from(portSet).sort((a, b) => a.localeCompare(b));
    const mcuPins: string[] = [];
    for (const pid of portIds) {
      if (pid.startsWith(`${mcuId}.`)) {
        const pinName = normalizeMcuPinName(pid.slice(mcuId.length + 1));
        if (!mcuPins.includes(pinName)) {
          mcuPins.push(pinName);
        }
      }
    }

    nets.push({
      id: netId,
      name: meta.name,
      kind: meta.kind,
      ...(meta.voltage !== undefined ? { voltage: meta.voltage } : {}),
      color,
      portIds,
      mcuPins,
    });
  }

  // Always ensure standard power rail colors exist in netColors
  netColors["5V"] = netColors["5V"] ?? resolveNetColor("5V", "power", 0, theme);
  netColors["GND"] = netColors["GND"] ?? resolveNetColor("GND", "ground", 0, theme);
  netColors["3V3"] = netColors["3V3"] ?? resolveNetColor("3V3", "power", 0, theme);
  netColors["3.3V"] = netColors["3.3V"] ?? resolveNetColor("3.3V", "power", 0, theme);

  // 4. Normalize all components and pins
  const allPins: NormalizedPin[] = [];
  const parts: NormalizedPart[] = [];
  let normalizedMcu: NormalizedPart | null = null;

  // Map netId -> NormalizedNet for fast lookup
  const netById = new Map<string, NormalizedNet>();
  for (const n of nets) {
    netById.set(n.id, n);
  }

  for (const comp of rawComponents) {
    if (!comp || !comp.id) continue;
    const symbolKind = classifySymbolKind(comp);
    const rawPorts: Port[] = Array.isArray(comp.ports) ? comp.ports : [];

    const compPins: NormalizedPin[] = rawPorts.map((p) => {
      const pid = p.id || `${comp.id}.${p.name}`;
      const netId = portToNetId.get(pid) ?? p.netId ?? null;
      const normPin: NormalizedPin = {
        id: pid,
        partId: comp.id,
        name: p.name,
        kind: p.kind ?? "passive",
        netId,
        capabilities: Array.isArray(p.pinCapabilities) ? [...p.pinCapabilities] : [],
        pull: p.pull ?? "none",
      };
      allPins.push(normPin);
      return normPin;
    });

    // If a component has no ports defined in raw JSON, synthesize fallback ports from net references
    if (compPins.length === 0) {
      for (const n of nets) {
        for (const pid of n.portIds) {
          if (pid.startsWith(`${comp.id}.`)) {
            const pName = pid.slice(comp.id.length + 1);
            const fallbackPin: NormalizedPin = {
              id: pid,
              partId: comp.id,
              name: pName,
              kind: "passive",
              netId: n.id,
              capabilities: [],
              pull: "none",
            };
            compPins.push(fallbackPin);
            allPins.push(fallbackPin);
          }
        }
      }
    }

    const compNetIds = Array.from(
      new Set(compPins.map((p) => p.netId).filter((nid): nid is string => nid !== null)),
    );

    // Collect direct MCU pins for this component
    const directMcuPins = new Set<string>();
    for (const nid of compNetIds) {
      const netObj = netById.get(nid);
      if (!netObj) continue;
      for (const mp of netObj.mcuPins) {
        directMcuPins.add(mp);
      }
    }

    // Format value & symbol-specific properties
    const rawVal =
      comp.value ??
      (comp.properties?.resistanceOhms !== undefined
        ? `${comp.properties.resistanceOhms}Ω`
        : undefined) ??
      (comp.properties?.color !== undefined ? String(comp.properties.color) : undefined) ??
      comp.partNumber ??
      "";

    let formattedValue = String(rawVal);
    let resistanceOhms: number | undefined;

    if (symbolKind === "resistor" || symbolKind === "potentiometer") {
      resistanceOhms = parseResistanceOhms(
        comp.value ??
          (typeof comp.properties?.resistanceOhms === "number"
            ? comp.properties.resistanceOhms
            : "330Ω"),
      );
      formattedValue = formatOhmsLabel(resistanceOhms);
    } else if (!formattedValue) {
      formattedValue = comp.partNumber ?? symbolKind.toUpperCase();
    }

    // Check if button uses INPUT_PULLUP (connects directly to MCU pin + GND without 5V pull-down)
    let inputPullup: boolean | undefined;
    if (symbolKind === "button") {
      const has5V = compNetIds.some((nid) => nid.toUpperCase() === "5V");
      inputPullup = !has5V;
    }

    const normalizedPart: NormalizedPart = {
      id: comp.id,
      rawKind: comp.kind ?? "generic",
      symbolKind,
      label: comp.name ?? comp.partNumber ?? comp.id,
      partNumber: comp.partNumber ?? "",
      value: formattedValue,
      ...(resistanceOhms !== undefined ? { resistanceOhms } : {}),
      ...(inputPullup !== undefined ? { inputPullup } : {}),
      ...(symbolKind === "led" ? { ledColorHex: resolveLedColorHex(comp) } : {}),
      pins: compPins,
      netIds: compNetIds,
      mcuPins: Array.from(directMcuPins),
    };

    if (symbolKind === "mcu" && normalizedMcu === null) {
      normalizedMcu = normalizedPart;
    } else {
      parts.push(normalizedPart);
    }
  }

  // 5. Trace 1-hop series connections (e.g. MCU D13 -> R1 -> D1 LED) so D1 knows its driving MCU pin for ordering
  for (const part of parts) {
    const nonPowerMcuPins = part.mcuPins.filter(
      (p) => p !== "GND" && p !== "5V" && p !== "3.3V" && p !== "VIN",
    );
    if (nonPowerMcuPins.length === 0) {
      for (const nid of part.netIds) {
        const netObj = netById.get(nid);
        if (!netObj || netObj.kind !== "signal") continue;
        for (const peer of parts) {
          if (peer.id === part.id) continue;
          if (peer.netIds.includes(nid)) {
            for (const mp of peer.mcuPins) {
              if (mp !== "GND" && mp !== "5V" && mp !== "3.3V" && !part.mcuPins.includes(mp)) {
                part.mcuPins.push(mp);
              }
            }
          }
        }
      }
    }
  }

  // Sort parts deterministically by their primary signal MCU pin index, then series role (resistors before load), then ID
  parts.sort((a, b) => {
    const pinRank = (part: NormalizedPart): number => {
      for (const mp of part.mcuPins) {
        if (mp.startsWith("D")) {
          const n = Number.parseInt(mp.slice(1), 10);
          if (Number.isFinite(n)) return n;
        }
        if (mp.startsWith("A")) {
          const n = Number.parseInt(mp.slice(1), 10);
          if (Number.isFinite(n)) return 20 + n;
        }
        if (mp === "SDA") return 30;
        if (mp === "SCL") return 31;
      }
      return 99;
    };
    const rA = pinRank(a);
    const rB = pinRank(b);
    if (rA !== rB) return rA - rB;
    const roleA = a.symbolKind === "resistor" ? 0 : 1;
    const roleB = b.symbolKind === "resistor" ? 0 : 1;
    if (roleA !== roleB) return roleA - roleB;
    return a.id.localeCompare(b.id);
  });

  return {
    name: circuit.name || "Synthesized Circuit",
    boardName: "ARDUINO UNO R3 · ATmega328P",
    mcu: normalizedMcu,
    parts,
    pins: allPins,
    nets,
    netColors,
  };
}

// ============================================================================
// HALF-SIZE BREADBOARD ALLOCATOR (30 Columns, Rows a–e / f–j + Power Rails)
// ============================================================================

export type BreadboardRow = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "+top" | "-top" | "+bot" | "-bot";

export interface BreadboardPinCoord {
  partId: string;
  pinId: string;
  pinName: string;
  col: number; // 1..30
  row: BreadboardRow;
  netId: string | null;
}

export interface BreadboardPartPlacement {
  partId: string;
  symbolKind: SymbolKind;
  label: string;
  value: string;
  startCol: number;
  endCol: number;
  bank: "top" | "bottom" | "bridge";
  pins: BreadboardPinCoord[];
}

export interface BreadboardJumper {
  id: string;
  netId: string;
  color: string;
  from: {
    kind: "mcu" | "hole" | "rail";
    mcuPin?: string;
    col: number;
    row: BreadboardRow;
    label: string;
  };
  to: {
    kind: "hole" | "rail";
    col: number;
    row: BreadboardRow;
    label: string;
  };
}

export interface BreadboardStep {
  id: string;
  stepNumber: number;
  netId: string;
  netColor: string;
  /** Short checklist label, e.g. "D13 → R1.1 (col 4, row e)" */
  text: string;
  /** Detailed explanation of the connection */
  detail: string;
}

export interface BreadboardAllocation {
  columns: 30;
  placements: BreadboardPartPlacement[];
  pinCoords: Record<string, BreadboardPinCoord>;
  jumpers: BreadboardJumper[];
  steps: BreadboardStep[];
}

/**
 * Deterministically allocates all peripheral parts of a `CircuitModel` onto a 30-column
 * half-size breadboard (rows a–e and f–j split by the center channel, plus top/bottom power rails),
 * and produces ordered step-by-step wiring instructions for the interactive checklist.
 */
export function allocateBreadboard(model: CircuitModel): BreadboardAllocation {
  const placements: BreadboardPartPlacement[] = [];
  const pinCoords: Record<string, BreadboardPinCoord> = {};
  const jumpers: BreadboardJumper[] = [];
  const steps: BreadboardStep[] = [];

  if (model.parts.length === 0) {
    return {
      columns: 30,
      placements,
      pinCoords,
      jumpers,
      steps,
    };
  }

  // Track which vertical strip columns (1..30) are already assigned to a net on top bank (a..e) and bottom bank (f..j)
  const topColNet = new Map<number, string>();
  const botColNet = new Map<number, string>();

  // Track first component pin placed on a given signal net so series parts (e.g. R1.2 -> D1.A) can share a column strip
  const signalNetColumn = new Map<string, { col: number; bank: "top" | "bottom"; nextRowIdx: number }>();
  const topRows: ReadonlyArray<BreadboardRow> = ["e", "d", "c", "b", "a"];
  const botRows: ReadonlyArray<BreadboardRow> = ["f", "g", "h", "i", "j"];

  let cursorCol = 2;

  const isPowerOrGnd = (netId: string | null): boolean => {
    if (!netId) return false;
    const u = netId.toUpperCase();
    return u === "5V" || u === "3V3" || u === "3.3V" || u === "VIN" || u === "VCC" || u.startsWith("GND");
  };

  for (const part of model.parts) {
    const pinCount = Math.max(2, part.pins.length);
    const isBridgeButton = part.symbolKind === "button";
    const spanCols =
      part.symbolKind === "resistor"
        ? 3
        : isBridgeButton
          ? 2
          : Math.max(2, pinCount);

    if (cursorCol + spanCols > 29) {
      cursorCol = 2;
    }

    const partPinCoords: BreadboardPinCoord[] = [];
    const bank: "top" | "bottom" | "bridge" = isBridgeButton ? "bridge" : "top";

    if (isBridgeButton) {
      // Straddle center channel (rows e and f) across 2 columns
      const c1 = cursorCol;
      const c2 = Math.min(30, cursorCol + 2);
      const p0 = part.pins[0];
      const p1 = part.pins[1];

      if (p0) {
        const coord0: BreadboardPinCoord = {
          partId: part.id,
          pinId: p0.id,
          pinName: p0.name,
          col: c1,
          row: "e",
          netId: p0.netId,
        };
        partPinCoords.push(coord0);
        pinCoords[p0.id] = coord0;
        if (p0.netId) topColNet.set(c1, p0.netId);
      }
      if (p1) {
        const coord1: BreadboardPinCoord = {
          partId: part.id,
          pinId: p1.id,
          pinName: p1.name,
          col: c2,
          row: "e",
          netId: p1.netId,
        };
        partPinCoords.push(coord1);
        pinCoords[p1.id] = coord1;
        if (p1.netId) topColNet.set(c2, p1.netId);
      }
      cursorCol = Math.min(28, c2 + 2);
    } else if (part.symbolKind === "resistor" && part.pins.length === 2) {
      // Axial resistor spans 3 columns (or shares its 2nd column with a series load)
      const p0 = part.pins[0]!;
      const p1 = part.pins[1]!;

      const existing0 =
        p0.netId && !isPowerOrGnd(p0.netId) ? signalNetColumn.get(p0.netId) : undefined;
      const c1 = existing0 ? existing0.col : cursorCol;
      const r1: BreadboardRow = existing0
        ? (topRows[Math.min(topRows.length - 1, existing0.nextRowIdx++)] ?? "c")
        : "c";

      const c2 = Math.min(30, Math.max(cursorCol + 2, c1 + 2));
      const r2: BreadboardRow = "c";

      const coord0: BreadboardPinCoord = {
        partId: part.id,
        pinId: p0.id,
        pinName: p0.name,
        col: c1,
        row: r1,
        netId: p0.netId,
      };
      const coord1: BreadboardPinCoord = {
        partId: part.id,
        pinId: p1.id,
        pinName: p1.name,
        col: c2,
        row: r2,
        netId: p1.netId,
      };

      partPinCoords.push(coord0, coord1);
      pinCoords[p0.id] = coord0;
      pinCoords[p1.id] = coord1;

      if (p0.netId && !isPowerOrGnd(p0.netId) && !existing0) {
        signalNetColumn.set(p0.netId, { col: c1, bank: "top", nextRowIdx: 2 });
        topColNet.set(c1, p0.netId);
      }
      if (p1.netId && !isPowerOrGnd(p1.netId)) {
        signalNetColumn.set(p1.netId, { col: c2, bank: "top", nextRowIdx: 1 });
        topColNet.set(c2, p1.netId);
      }
      cursorCol = Math.min(28, c2 + 2);
    } else {
      // Multi-pin or 2-pin peripheral (LED, HC-SR04, Potentiometer, Servo, OLED, Buzzer, LDR)
      let baseCol = cursorCol;
      // Check if pin 0 shares a signal net with the previous series resistor
      const firstPin = part.pins[0];
      const sharedStrip =
        firstPin?.netId && !isPowerOrGnd(firstPin.netId)
          ? signalNetColumn.get(firstPin.netId)
          : undefined;

      if (sharedStrip && part.pins.length === 2) {
        baseCol = sharedStrip.col;
      }

      for (let i = 0; i < part.pins.length; i++) {
        const pin = part.pins[i]!;
        const col = Math.min(30, baseCol + i);
        const isSharedCol = i === 0 && sharedStrip && part.pins.length === 2;
        const row: BreadboardRow = isSharedCol ? "b" : "c";

        const coord: BreadboardPinCoord = {
          partId: part.id,
          pinId: pin.id,
          pinName: pin.name,
          col,
          row,
          netId: pin.netId,
        };
        partPinCoords.push(coord);
        pinCoords[pin.id] = coord;

        if (pin.netId && !isPowerOrGnd(pin.netId) && !signalNetColumn.has(pin.netId)) {
          signalNetColumn.set(pin.netId, { col, bank: "top", nextRowIdx: 1 });
          topColNet.set(col, pin.netId);
        }
      }
      cursorCol = Math.min(28, baseCol + part.pins.length + 1);
    }

    const cols = partPinCoords.map((c) => c.col);
    const startCol = cols.length > 0 ? Math.min(...cols) : cursorCol;
    const endCol = cols.length > 0 ? Math.max(...cols) : cursorCol + 1;

    placements.push({
      partId: part.id,
      symbolKind: part.symbolKind,
      label: part.label,
      value: part.value,
      startCol,
      endCol,
      bank,
      pins: partPinCoords,
    });
  }

  // Generate jumpers and step-by-step wiring checklist
  let stepCounter = 1;

  // 1. Power & Ground Rail Supply Jumpers from Arduino MCU
  const uses5V = model.nets.some((n) => n.id.toUpperCase() === "5V" || n.kind === "power");
  const usesGnd = model.nets.some((n) => n.id.toUpperCase().startsWith("GND") || n.kind === "ground");

  if (uses5V) {
    const color = model.netColors["5V"] ?? WIRE_COLORS["5V"];
    jumpers.push({
      id: "jmp-mcu-5v",
      netId: "5V",
      color,
      from: { kind: "mcu", mcuPin: "5V", col: 1, row: "+bot", label: "Arduino 5V" },
      to: { kind: "rail", col: 2, row: "+bot", label: "+5V Power Rail" },
    });
    steps.push({
      id: "step-mcu-5v",
      stepNumber: stepCounter++,
      netId: "5V",
      netColor: color,
      text: "5V → Breadboard +5V Rail (col 2, row +)",
      detail: "Connect Arduino 5V power pin to the red positive (+5V) distribution rail.",
    });
  }

  if (usesGnd) {
    const gndNet = model.nets.find((n) => n.kind === "ground" || n.id.toUpperCase().startsWith("GND"));
    const gndNetId = gndNet?.id ?? "GND";
    const color = model.netColors[gndNetId] ?? WIRE_COLORS.GND;
    jumpers.push({
      id: "jmp-mcu-gnd",
      netId: gndNetId,
      color,
      from: { kind: "mcu", mcuPin: "GND", col: 1, row: "-bot", label: "Arduino GND" },
      to: { kind: "rail", col: 2, row: "-bot", label: "GND Rail" },
    });
    steps.push({
      id: "step-mcu-gnd",
      stepNumber: stepCounter++,
      netId: gndNetId,
      netColor: color,
      text: "GND → Breadboard GND Rail (col 2, row −)",
      detail: "Connect Arduino GND pin to the dark ground (−) distribution rail.",
    });
  }

  // 2. Signal Nets & Component-to-Rail Jumpers
  const routedMcuNetCols = new Set<string>();

  for (const part of model.parts) {
    for (const pin of part.pins) {
      const coord = pinCoords[pin.id];
      if (!coord || !pin.netId) continue;

      const net = model.nets.find((n) => n.id === pin.netId);
      if (!net) continue;

      const upperNet = net.id.toUpperCase();
      if (net.kind === "power" || upperNet === "5V" || upperNet === "3V3") {
        // Jumper from component column row e to +5V rail
        jumpers.push({
          id: `jmp-pwr-${pin.id}`,
          netId: net.id,
          color: net.color,
          from: {
            kind: "hole",
            col: coord.col,
            row: "e",
            label: `${part.id}.${pin.name}`,
          },
          to: {
            kind: "rail",
            col: coord.col,
            row: "+bot",
            label: "+5V Rail",
          },
        });
        steps.push({
          id: `step-pwr-${pin.id}`,
          stepNumber: stepCounter++,
          netId: net.id,
          netColor: net.color,
          text: `${part.id}.${pin.name} (col ${coord.col}, row ${coord.row}) → +5V Rail (col ${coord.col}, row +)`,
          detail: `Wire ${part.label} (${part.id}) pin ${pin.name} in column ${coord.col} to the +5V power rail.`,
        });
      } else if (net.kind === "ground" || upperNet.startsWith("GND")) {
        // Jumper from component column row e to GND rail
        jumpers.push({
          id: `jmp-gnd-${pin.id}`,
          netId: net.id,
          color: net.color,
          from: {
            kind: "hole",
            col: coord.col,
            row: "e",
            label: `${part.id}.${pin.name}`,
          },
          to: {
            kind: "rail",
            col: coord.col,
            row: "-bot",
            label: "GND Rail",
          },
        });
        steps.push({
          id: `step-gnd-${pin.id}`,
          stepNumber: stepCounter++,
          netId: net.id,
          netColor: net.color,
          text: `${part.id}.${pin.name} (col ${coord.col}, row ${coord.row}) → GND Rail (col ${coord.col}, row −)`,
          detail: `Wire ${part.label} (${part.id}) pin ${pin.name} in column ${coord.col} to the GND rail.`,
        });
      } else {
        // Signal net: check if connected to an Arduino MCU pin
        const mcuPin = net.mcuPins[0];
        const mcuKey = `${net.id}:${coord.col}`;
        if (mcuPin && !routedMcuNetCols.has(mcuKey)) {
          routedMcuNetCols.add(mcuKey);
          jumpers.push({
            id: `jmp-sig-${pin.id}`,
            netId: net.id,
            color: net.color,
            from: {
              kind: "mcu",
              mcuPin,
              col: coord.col,
              row: "a",
              label: `Arduino ${mcuPin}`,
            },
            to: {
              kind: "hole",
              col: coord.col,
              row: "e",
              label: `${part.id}.${pin.name}`,
            },
          });
          steps.push({
            id: `step-sig-${pin.id}`,
            stepNumber: stepCounter++,
            netId: net.id,
            netColor: net.color,
            text: `${mcuPin} → ${part.id}.${pin.name} (col ${coord.col}, row e)`,
            detail: `Run a jumper wire from Arduino pin ${mcuPin} to breadboard column ${coord.col}, row e (${part.id} ${pin.name}).`,
          });
        } else if (!mcuPin) {
          // Inter-component series node (e.g. R1.2 -> D1.A sharing column strip)
          const stepId = `step-node-${pin.id}`;
          steps.push({
            id: stepId,
            stepNumber: stepCounter++,
            netId: net.id,
            netColor: net.color,
            text: `Insert ${part.id}.${pin.name} into col ${coord.col}, row ${coord.row} (${net.id})`,
            detail: `Shared breadboard strip in column ${coord.col} links ${part.id}.${pin.name} on net ${net.id}.`,
          });
        }
      }
    }
  }

  return {
    columns: 30,
    placements,
    pinCoords,
    jumpers,
    steps,
  };
}

// ============================================================================
// HUMAN-READABLE PIN & NET INSTRUCTIONS
// ============================================================================

const UNO_PIN_DESCRIPTIONS: Record<string, string> = {
  D0: "Digital Pin 0 (UART RX) — Serial receive line; avoid heavy loads during USB upload.",
  D1: "Digital Pin 1 (UART TX) — Serial transmit line.",
  D2: "Digital Pin 2 (INT0) — External hardware interrupt & digital GPIO.",
  D3: "Digital Pin ~3 (PWM / INT1) — 8-bit Timer2 PWM output & external interrupt.",
  D4: "Digital Pin 4 — Standard 5V bidirectional GPIO.",
  D5: "Digital Pin ~5 (PWM) — 8-bit Timer0 PWM output (976 Hz).",
  D6: "Digital Pin ~6 (PWM) — 8-bit Timer0 PWM output (976 Hz).",
  D7: "Digital Pin 7 — Standard 5V bidirectional GPIO.",
  D8: "Digital Pin 8 — Standard 5V bidirectional GPIO.",
  D9: "Digital Pin ~9 (PWM) — 16-bit Timer1 PWM output (ideal for Servo control).",
  D10: "Digital Pin ~10 (PWM / SPI SS) — Timer1 PWM output & SPI Chip Select.",
  D11: "Digital Pin ~11 (PWM / SPI MOSI) — Timer2 PWM output & SPI Master Out.",
  D12: "Digital Pin 12 (SPI MISO) — SPI Master In / standard GPIO.",
  D13: "Digital Pin 13 (SPI SCK / Built-in LED) — Clock line & onboard status LED.",
  A0: "Analog Input A0 (ADC0) — 10-bit 0–5V analog-to-digital converter input.",
  A1: "Analog Input A1 (ADC1) — 10-bit 0–5V analog-to-digital converter input.",
  A2: "Analog Input A2 (ADC2) — 10-bit 0–5V analog-to-digital converter input.",
  A3: "Analog Input A3 (ADC3) — 10-bit 0–5V analog-to-digital converter input.",
  A4: "Analog Input A4 (I2C SDA) — 10-bit ADC input & I2C Serial Data line.",
  A5: "Analog Input A5 (I2C SCL) — 10-bit ADC input & I2C Serial Clock line.",
  SDA: "I2C SDA (internally tied to A4 on ATmega328P) — Bidirectional open-drain data bus.",
  SCL: "I2C SCL (internally tied to A5 on ATmega328P) — Synchronous clock bus.",
  "5V": "5V Regulated Supply Rail — Provides 5.0V DC up to ~500mA over USB.",
  "3V3": "3.3V Regulated Supply — Provides 3.3V DC for low-voltage sensors (150mA max).",
  "3.3V": "3.3V Regulated Supply — Provides 3.3V DC for low-voltage sensors (150mA max).",
  VIN: "VIN Unregulated Input (7V–12V DC) — Feeds onboard linear voltage regulator.",
  GND: "0V Ground Reference — Common return path for all power and signal currents.",
};

/**
 * Returns human-readable wiring and electrical guidance for a given pin or port ID.
 */
export function pinInstruction(pinId: string, model?: CircuitModel): string {
  const clean = pinId.trim();
  if (!clean) return "Select a pin or net to inspect wiring instructions.";

  if (model) {
    const foundPin = model.pins.find(
      (p) => p.id.toLowerCase() === clean.toLowerCase() || p.name.toLowerCase() === clean.toLowerCase(),
    );
    if (foundPin) {
      const part =
        model.mcu?.id === foundPin.partId
          ? model.mcu
          : model.parts.find((pt) => pt.id === foundPin.partId);
      const net = foundPin.netId ? model.nets.find((n) => n.id === foundPin.netId) : undefined;
      const peerPorts = net ? net.portIds.filter((pid) => pid !== foundPin.id) : [];
      const peerDesc =
        peerPorts.length > 0 ? ` Connected on net ${net?.id} to ${peerPorts.join(", ")}.` : " Unconnected pin.";
      const unoDesc = UNO_PIN_DESCRIPTIONS[normalizeMcuPinName(foundPin.name)];
      if (unoDesc && foundPin.partId === (model.mcu?.id ?? "U1")) {
        return `${foundPin.partId}.${foundPin.name}: ${unoDesc}${peerDesc}`;
      }
      return `${part?.label ?? foundPin.partId} (${foundPin.partId}) pin "${foundPin.name}" [${foundPin.kind}].${peerDesc}`;
    }
  }

  // Fallback by pin name
  const dotIdx = clean.indexOf(".");
  const localName = dotIdx >= 0 ? clean.slice(dotIdx + 1) : clean;
  const norm = normalizeMcuPinName(localName);
  const unoText = UNO_PIN_DESCRIPTIONS[norm];
  if (unoText) {
    return `${clean}: ${unoText}`;
  }
  return `Pin ${clean} — Wire securely to its assigned net terminal.`;
}

/**
 * Returns human-readable wiring summary for a given net ID.
 */
export function netInstruction(netId: string, model?: CircuitModel): string {
  const clean = netId.trim();
  if (!clean) return "No net selected.";

  if (model) {
    const net = model.nets.find((n) => n.id === clean);
    if (net) {
      const endpoints = net.portIds.join(" ↔ ");
      if (net.kind === "ground" || clean.toUpperCase().startsWith("GND")) {
        return `Ground Net (${net.id}) [0V Return]: Ties ${endpoints || "GND terminals"} to the common ground rail.`;
      }
      if (net.kind === "power" || clean.toUpperCase() === "5V" || clean.toUpperCase() === "3V3") {
        return `Power Net (${net.id}) [${net.voltage ?? 5}V Supply]: Distributes regulated power across ${endpoints}.`;
      }
      return `Signal Net (${net.id}): Connects ${endpoints}. Verify continuity across all listed terminals.`;
    }
  }

  const upper = clean.toUpperCase();
  if (upper.startsWith("GND")) {
    return `Ground Net (${clean}): Connect all ground pins to the common 0V breadboard rail.`;
  }
  if (upper === "5V" || upper === "VCC") {
    return `5V Power Net (${clean}): Connect to the Arduino +5V supply rail.`;
  }
  return `Net ${clean}: Signal connection between MCU port and peripheral component lead.`;
}
