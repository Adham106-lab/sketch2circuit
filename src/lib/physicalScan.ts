/**
 * @license Apache-2.0
 * Physical Breadboard Vision Scanner & Digital-Twin Comparator.
 * Pure TypeScript logic (zero React dependencies).
 */

export type ScanComponentType = "led" | "resistor" | "button" | "ultrasonic" | "other";

export interface ScanComponent {
  type: ScanComponentType;
  label?: string;
  value?: string;
}

export interface ScanConnection {
  from: string;
  to: string;
}

export interface ScanResult {
  components: ScanComponent[];
  connections: ScanConnection[];
}

export interface ScanVerificationReport {
  passed: boolean;
  errors: string[];
  matched: number;
  total: number;
}

export type ScanErrorKind = "network" | "http" | "parse" | "empty" | "unconfigured";

export class ScanError extends Error {
  public readonly kind: ScanErrorKind;
  public readonly status?: number;

  constructor(kind: ScanErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ScanError";
    this.kind = kind;
    if (status !== undefined) {
      this.status = status;
    }
  }
}

const DEFAULT_VISION_MODEL = "accounts/fireworks/models/llama-v3p2-90b-vision-instruct";
const FIREWORKS_CHAT_URL = "https://api.fireworks.ai/inference/v1/chat/completions";

const SYSTEM_PROMPT =
  "Analyze this breadboard image. Identify all electronic components (LEDs, resistors, ultrasonic sensors) and wire connections (e.g., Wire from Pin 13 to Breadboard J15). Return ONLY a valid JSON object with keys `components` and `connections`. No markdown, no explanations.\n\n" +
  'Required JSON schema:\n{\n  "components": [\n    { "type": "led" | "resistor" | "button" | "ultrasonic" | "other", "label"?: string, "value"?: string }\n  ],\n  "connections": [\n    { "from": string, "to": string }\n  ]\n}\n' +
  'Use canonical endpoint names where possible such as "D13", "5V", "GND", "R1.1", "R1.2", "LED1.anode", "LED1.cathode", "SW1.1", "U_SONAR.TRIG", "U_SONAR.ECHO".';

/**
 * Checks whether a Vision API endpoint or Fireworks API key is configured.
 */
export function isVisionConfigured(): boolean {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const proxyUrl = (env.VITE_VISION_PROXY_URL ?? "").trim();
  const apiKey = (env.VITE_FIREWORKS_API_KEY ?? "").trim();
  return proxyUrl.length > 0 || apiKey.length > 0;
}

/**
 * Client-side image downscaler: resizes an uploaded image File to <= maxSide px on its longest side
 * and encodes as JPEG (quality 0.85) before base64 serialization.
 */
export async function downscaleImageFile(
  file: File,
  maxSide = 1280,
  quality = 0.85,
): Promise<{ base64: string; mime: string; previewUrl: string }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ScanError("parse", "Could not decode the selected image file."));
      el.src = objectUrl;
    });

    const srcW = img.naturalWidth || img.width || 1;
    const srcH = img.naturalHeight || img.height || 1;
    const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
    const dstW = Math.max(1, Math.round(srcW * scale));
    const dstH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dstW;
    canvas.height = dstH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new ScanError("parse", "Canvas 2D context unavailable for image preparation.");
    }
    ctx.drawImage(img, 0, 0, dstW, dstH);

    const mime = "image/jpeg";
    const dataUrl = canvas.toDataURL(mime, quality);
    const commaIdx = dataUrl.indexOf(",");
    const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
    if (!base64) {
      throw new ScanError("empty", "Encoded image payload was empty.");
    }
    return { base64, mime, previewUrl: dataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizeComponentType(raw: unknown): ScanComponentType {
  if (typeof raw !== "string") return "other";
  const lower = raw.trim().toLowerCase();
  if (lower === "led" || lower.includes("led") || lower.includes("diode")) return "led";
  if (lower === "resistor" || lower.includes("resistor") || lower.includes("ohm")) return "resistor";
  if (lower === "button" || lower.includes("button") || lower.includes("switch") || lower.includes("tact")) {
    return "button";
  }
  if (
    lower === "ultrasonic" ||
    lower.includes("ultrasonic") ||
    lower.includes("hc-sr04") ||
    lower.includes("sr04") ||
    lower.includes("sonar")
  ) {
    return "ultrasonic";
  }
  return "other";
}

/**
 * Extracts the first top-level `{ ... }` JSON block from a string after stripping markdown code fences.
 */
function extractJsonObjectString(rawText: string): string {
  const withoutFences = rawText
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();

  const start = withoutFences.indexOf("{");
  if (start === -1) {
    throw new ScanError("parse", "Vision response did not contain a JSON object.");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < withoutFences.length; i++) {
    const ch = withoutFences[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          return withoutFences.slice(start, i + 1);
        }
      }
    }
  }

  throw new ScanError("parse", "Vision response contained an unterminated JSON object.");
}

/**
 * Hand-written defensive validator and normalizer for `ScanResult`.
 */
export function parseAndValidateScanResult(rawText: string): ScanResult {
  if (!rawText || rawText.trim().length === 0) {
    throw new ScanError("empty", "Vision API returned an empty response.");
  }

  const jsonSlice = extractJsonObjectString(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch {
    throw new ScanError("parse", "Vision response could not be parsed as valid JSON.");
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ScanError("parse", "Vision JSON root must be an object.");
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.components) || !Array.isArray(record.connections)) {
    throw new ScanError(
      "parse",
      "Vision JSON is missing required `components` or `connections` arrays.",
    );
  }

  const components: ScanComponent[] = [];
  for (const item of record.components) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const type = normalizeComponentType(obj.type ?? obj.kind ?? obj.name);
    const label = typeof obj.label === "string" && obj.label.trim() ? obj.label.trim() : undefined;
    const value = typeof obj.value === "string" && obj.value.trim() ? obj.value.trim() : undefined;
    components.push({
      type,
      ...(label ? { label } : {}),
      ...(value ? { value } : {}),
    });
  }

  const connections: ScanConnection[] = [];
  for (const item of record.connections) {
    if (typeof item !== "object" || item === null) continue;
    const obj = item as Record<string, unknown>;
    const from = typeof obj.from === "string" ? obj.from.trim() : "";
    const to = typeof obj.to === "string" ? obj.to.trim() : "";
    if (from && to) {
      connections.push({ from, to });
    }
  }

  if (components.length === 0 && connections.length === 0) {
    throw new ScanError("empty", "No breadboard components or wire connections were detected.");
  }

  return { components, connections };
}

/**
 * Calls Fireworks AI Llama Vision (or configured proxy URL) to inspect a physical breadboard photo.
 */
export async function analyzePhysicalCircuit(
  base64Image: string,
  mime: string,
  signal?: AbortSignal,
): Promise<ScanResult> {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const proxyUrl = (env.VITE_VISION_PROXY_URL ?? "").trim();
  const apiKey = (env.VITE_FIREWORKS_API_KEY ?? "").trim();
  const model = (env.VITE_VISION_MODEL ?? "").trim() || DEFAULT_VISION_MODEL;

  if (!proxyUrl && !apiKey) {
    throw new ScanError(
      "unconfigured",
      "Vision API not configured. Set VITE_FIREWORKS_API_KEY or VITE_VISION_PROXY_URL, or use Demo mode.",
    );
  }

  const endpoint = proxyUrl || FIREWORKS_CHAT_URL;
  const cleanBase64 = base64Image.startsWith("data:")
    ? base64Image
    : `data:${mime || "image/jpeg"};base64,${base64Image}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1024,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: SYSTEM_PROMPT,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Inspect this breadboard circuit and return ONLY the JSON object with `components` and `connections`.",
              },
              {
                type: "image_url",
                image_url: { url: cleanBase64 },
              },
            ],
          },
        ],
      }),
    });
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new ScanError(
      "network",
      err instanceof Error ? `Network failure: ${err.message}` : "Network request to Vision API failed.",
    );
  }

  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.text();
      detail = errBody.slice(0, 160);
    } catch {
      // ignore body read error
    }
    throw new ScanError(
      "http",
      `Vision API HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ScanError("parse", "Vision API response was not valid JSON.");
  }

  const record = payload as Record<string, unknown>;
  // Support direct { components, connections } from custom proxy OR OpenAI/Fireworks choices[0].message.content
  if (Array.isArray(record.components) && Array.isArray(record.connections)) {
    return parseAndValidateScanResult(JSON.stringify(record));
  }

  const choices = Array.isArray(record.choices) ? record.choices : [];
  const firstChoice = (choices[0] as Record<string, unknown> | undefined) ?? {};
  const message = (firstChoice.message as Record<string, unknown> | undefined) ?? {};
  const content = typeof message.content === "string" ? message.content : "";

  return parseAndValidateScanResult(content);
}

/**
 * Deterministic 1500 ms mock scan for live demos and `?demo=1` fallback.
 */
export function mockScan(expected: ScanResult, signal?: AbortSignal): Promise<ScanResult> {
  return new Promise<ScanResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      resolve({
        components: expected.components.map((c) => ({ ...c })),
        connections: expected.connections.map((c) => ({ ...c })),
      });
    }, 1500);

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          reject(new DOMException("Scan aborted", "AbortError"));
        },
        { once: true },
      );
    }
  });
}

// ============================================================================
// ENDPOINT NORMALIZATION & GRAPH COMPARISON
// ============================================================================

function normalizeEndpoint(raw: string): string {
  let s = raw.trim().toUpperCase().replace(/\s+/g, " ");
  // Strip MCU prefix e.g. "U1.D13" -> "D13"
  s = s.replace(/^U1\./, "").replace(/^ARDUINO\./, "").replace(/^MCU\./, "");

  // Normalize "PIN 13", "DIGITAL 13", "GPIO 13", or bare number "13" -> "D13"
  const pinMatch = s.match(/^(?:DIGITAL\s*PIN|PIN|DIGITAL|GPIO|D)\s*(\d{1,2})$/);
  if (pinMatch) {
    return `D${pinMatch[1]}`;
  }
  if (/^\d{1,2}$/.test(s)) {
    return `D${s}`;
  }

  // Normalize Ground / Power rails
  if (s === "GROUND" || s.startsWith("GND") || s.endsWith(".GND")) return "GND";
  if (s === "VCC" || s === "+5V" || s === "5V0" || s.startsWith("5V")) return "5V";
  if (s === "3V3" || s === "+3.3V" || s === "3.3V") return "3.3V";

  // Normalize LED1 / D1 anode & cathode aliases
  s = s.replace(/^D(\d+)\.(A|ANODE|\+|1)$/i, "LED$1.ANODE");
  s = s.replace(/^D(\d+)\.(K|C|CATHODE|-|2)$/i, "LED$1.CATHODE");
  s = s.replace(/^LED(\d+)\.(A|ANODE|\+|1)$/i, "LED$1.ANODE");
  s = s.replace(/^LED(\d+)\.(K|C|CATHODE|-|2)$/i, "LED$1.CATHODE");

  // Normalize Resistor terminals: R1.P1 / R1.A -> R1.1, R1.P2 / R1.B -> R1.2
  s = s.replace(/^R(\d+)\.(?:P1|A|LEFT|1)$/i, "R$1.1");
  s = s.replace(/^R(\d+)\.(?:P2|B|RIGHT|2)$/i, "R$1.2");

  return s;
}

function isBreadboardTiePoint(endpoint: string): boolean {
  // Matches e.g. "J15", "E12", "BREADBOARD J15", "COL 12 ROW E", "ROW 15"
  return (
    /^(?:BREADBOARD\s+)?[A-J]\d{1,2}$/i.test(endpoint) ||
    /^(?:COL|ROW)\s+\w+/i.test(endpoint)
  );
}

/**
 * Collapses intermediate breadboard tie-point hops (e.g., D13 -> J15 and J15 -> R1.1 becomes D13 -> R1.1).
 */
function collapseBreadboardHops(connections: ScanConnection[]): Array<{ a: string; b: string }> {
  const normalized = connections
    .map((c) => ({ a: normalizeEndpoint(c.from), b: normalizeEndpoint(c.to) }))
    .filter((c) => c.a && c.b && c.a !== c.b);

  const tiePointNeighbors = new Map<string, Set<string>>();
  const directPairs: Array<{ a: string; b: string }> = [];

  for (const conn of normalized) {
    const aTie = isBreadboardTiePoint(conn.a);
    const bTie = isBreadboardTiePoint(conn.b);
    if (!aTie && !bTie) {
      directPairs.push(conn);
    } else if (aTie && !bTie) {
      const set = tiePointNeighbors.get(conn.a) ?? new Set<string>();
      set.add(conn.b);
      tiePointNeighbors.set(conn.a, set);
    } else if (!aTie && bTie) {
      const set = tiePointNeighbors.get(conn.b) ?? new Set<string>();
      set.add(conn.a);
      tiePointNeighbors.set(conn.b, set);
    }
  }

  for (const [, endpoints] of tiePointNeighbors) {
    const list = Array.from(endpoints);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        directPairs.push({ a: list[i]!, b: list[j]! });
      }
    }
  }

  return directPairs;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:::${b}` : `${b}:::${a}`;
}

function isMcuPin(ep: string): boolean {
  return /^D\d{1,2}$/.test(ep) || /^A\d$/.test(ep) || ep === "5V" || ep === "3.3V" || ep === "GND";
}

/**
 * Compares the scanned physical breadboard graph against the expected digital twin.
 */
export function verifyScan(expected: ScanResult, found: ScanResult): ScanVerificationReport {
  const errors: string[] = [];
  const componentTypes: ScanComponentType[] = ["led", "resistor", "button", "ultrasonic", "other"];
  const typeLabels: Record<ScanComponentType, string> = {
    led: "LED",
    resistor: "resistor",
    button: "push button",
    ultrasonic: "ultrasonic sensor",
    other: "auxiliary component",
  };

  let totalComponents = 0;
  let matchedComponents = 0;

  for (const t of componentTypes) {
    const expCount = expected.components.filter((c) => c.type === t).length;
    const fndCount = found.components.filter((c) => c.type === t).length;
    totalComponents += expCount;
    matchedComponents += Math.min(expCount, fndCount);

    if (fndCount < expCount) {
      const diff = expCount - fndCount;
      errors.push(
        diff === 1 && expCount === 1
          ? `Missing ${typeLabels[t]}`
          : `Missing ${diff} ${typeLabels[t]}${diff > 1 ? "s" : ""} (expected ${expCount}, found ${fndCount})`,
      );
    } else if (fndCount > expCount) {
      const diff = fndCount - expCount;
      errors.push(
        `Unexpected extra ${typeLabels[t]} (+${diff}: expected ${expCount}, found ${fndCount})`,
      );
    }
  }

  const expPairs = collapseBreadboardHops(expected.connections);
  const fndPairs = collapseBreadboardHops(found.connections);

  const unmatchedFound = [...fndPairs];
  let matchedConnections = 0;

  for (const exp of expPairs) {
    const key = pairKey(exp.a, exp.b);
    const idx = unmatchedFound.findIndex((f) => pairKey(f.a, f.b) === key);
    if (idx !== -1) {
      matchedConnections++;
      unmatchedFound.splice(idx, 1);
      continue;
    }

    // Check if one side is an MCU pin and the other side was wired to the wrong MCU pin
    const expMcu = isMcuPin(exp.a) ? exp.a : isMcuPin(exp.b) ? exp.b : null;
    const expCompEnd = expMcu ? (exp.a === expMcu ? exp.b : exp.a) : null;

    if (expMcu && expCompEnd) {
      const wrongPinIdx = unmatchedFound.findIndex((f) => {
        const other = f.a === expCompEnd ? f.b : f.b === expCompEnd ? f.a : null;
        return other !== null && isMcuPin(other);
      });

      if (wrongPinIdx !== -1) {
        const wrong = unmatchedFound[wrongPinIdx]!;
        const foundPin = wrong.a === expCompEnd ? wrong.b : wrong.a;
        unmatchedFound.splice(wrongPinIdx, 1);
        errors.push(`Expected wire on ${expMcu}, found on ${foundPin} (${expCompEnd})`);
        continue;
      }
    }

    errors.push(`Missing connection: ${exp.a} ↔ ${exp.b}`);
  }

  const total = totalComponents + expPairs.length;
  const matched = matchedComponents + matchedConnections;

  return {
    passed: errors.length === 0,
    errors,
    matched,
    total,
  };
}

// ============================================================================
// DERIVE EXPECTED SCAN RESULT FROM @s2c/circuit-json CIRCUIT
// ============================================================================

const BLINK_FALLBACK: ScanResult = {
  components: [
    { type: "resistor", label: "R1", value: "220Ω" },
    { type: "led", label: "LED1", value: "Red" },
  ],
  connections: [
    { from: "D13", to: "R1.1" },
    { from: "R1.2", to: "LED1.anode" },
    { from: "LED1.cathode", to: "GND" },
  ],
};

function formatPortEndpoint(portId: string): string {
  const trimmed = portId.trim();
  if (trimmed.startsWith("U1.")) {
    return normalizeEndpoint(trimmed.slice(3));
  }
  const [compId, pinName] = trimmed.split(".");
  if (!compId || !pinName) return normalizeEndpoint(trimmed);
  const upperComp = compId.toUpperCase();
  const upperPin = pinName.toUpperCase();
  if (/^(D|LED)\d+$/.test(upperComp)) {
    const num = upperComp.replace(/^(D|LED)/, "");
    if (upperPin === "A" || upperPin === "ANODE" || upperPin === "1") return `LED${num}.anode`;
    if (upperPin === "K" || upperPin === "C" || upperPin === "CATHODE" || upperPin === "2") {
      return `LED${num}.cathode`;
    }
  }
  return `${upperComp}.${pinName}`;
}

/**
 * Builds the expected `ScanResult` directly from the synthesized `@s2c/circuit-json` `Circuit` object.
 * Falls back to the canonical Blink circuit (`D13 -> R1 -> LED1 -> GND`) if the circuit has no external parts.
 */
export function expectedFromCircuit(circuit: unknown): ScanResult {
  if (typeof circuit !== "object" || circuit === null) {
    return BLINK_FALLBACK;
  }

  const record = circuit as {
    components?: Array<{
      id?: string;
      kind?: string;
      name?: string;
      partNumber?: string;
      value?: string;
    }>;
    nets?: Array<{
      id?: string;
      kind?: string;
      portIds?: string[];
    }>;
  };

  const rawComponents = Array.isArray(record.components) ? record.components : [];
  const rawNets = Array.isArray(record.nets) ? record.nets : [];

  const components: ScanComponent[] = [];
  for (const comp of rawComponents) {
    if (!comp || !comp.id) continue;
    if (comp.kind === "mcu" || comp.id.toUpperCase() === "U1") continue;
    const sig = `${comp.id} ${comp.kind ?? ""} ${comp.name ?? ""} ${comp.partNumber ?? ""}`;
    const type = normalizeComponentType(sig);
    components.push({
      type,
      label: comp.id,
      ...(comp.value ? { value: comp.value } : {}),
    });
  }

  const connections: ScanConnection[] = [];
  for (const net of rawNets) {
    if (!net || !Array.isArray(net.portIds) || net.portIds.length === 0) continue;
    const netIdUpper = (net.id ?? "").toUpperCase();
    const isGnd = net.kind === "ground" || netIdUpper === "GND" || netIdUpper.startsWith("GND");
    const isPower = net.kind === "power" || netIdUpper === "5V" || netIdUpper === "VCC";

    const nonMcuPorts = net.portIds.filter((p) => !p.toUpperCase().startsWith("U1."));
    const mcuPorts = net.portIds.filter((p) => p.toUpperCase().startsWith("U1."));

    if (isGnd && nonMcuPorts.length > 0) {
      for (const p of nonMcuPorts) {
        connections.push({ from: formatPortEndpoint(p), to: "GND" });
      }
      continue;
    }

    if (isPower && nonMcuPorts.length > 0) {
      const rail = netIdUpper === "3V3" || netIdUpper === "3.3V" ? "3.3V" : "5V";
      for (const p of nonMcuPorts) {
        connections.push({ from: rail, to: formatPortEndpoint(p) });
      }
      continue;
    }

    if (mcuPorts.length > 0 && nonMcuPorts.length > 0) {
      const mcuEp = formatPortEndpoint(mcuPorts[0]!);
      for (const p of nonMcuPorts) {
        connections.push({ from: mcuEp, to: formatPortEndpoint(p) });
      }
    } else if ( net.portIds.length >= 2) {
      for (let i = 0; i < net.portIds.length - 1; i++) {
        connections.push({
          from: formatPortEndpoint(net.portIds[i]!),
          to: formatPortEndpoint(net.portIds[i + 1]!),
        });
      }
    }
  }

  if (components.length === 0 && connections.length === 0) {
    return BLINK_FALLBACK;
  }

  return { components, connections };
}
