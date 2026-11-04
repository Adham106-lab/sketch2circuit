/**
 * @license Apache-2.0
 * Physical Breadboard Vision Scanner & Digital-Twin Comparator.
 * Pure TypeScript logic (zero React dependencies).
 */

export type ScanComponentType =
  | "led"
  | "resistor"
  | "button"
  | "ultrasonic"
  | "servo"
  | "potentiometer"
  | "ldr"
  | "buzzer"
  | "motor"
  | "other";

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
  modelUsed?: string;
  modelShortName?: string;
  elapsedSec?: number;
}

export interface ScanProgressUpdate {
  model: string;
  shortName: string;
  label: string;
  isFallback: boolean;
}

export interface GroupedScanErrors {
  components: string[];
  wiring: string[];
  power: string[];
}

export interface ScanVerificationReport {
  passed: boolean;
  errors: string[];
  groupedErrors: GroupedScanErrors;
  matched: number;
  total: number;
}

export type ScanErrorKind =
  | "network"
  | "http"
  | "parse"
  | "empty"
  | "unconfigured"
  | "timeout"
  | "image_too_large";

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

export const VISION_MODEL_CHAIN = [
  "accounts/fireworks/models/muse-spark-open",         // primary (Meta)
  "accounts/fireworks/models/qwen3p8-flash-next-fp8",  // fallback 1 (fast Qwen)
  "accounts/fireworks/models/qwen3p8-max",             // fallback 2 (known serverless, most accurate)
  "accounts/fireworks/models/glm-5p3-flash",           // fallback 3 (cheap)
] as const;

const FIREWORKS_MODELS_URL = "https://api.fireworks.ai/inference/v1/models";
const FIREWORKS_CHAT_URL = "https://api.fireworks.ai/inference/v1/chat/completions";
const MAX_BASE64_BYTES = 2 * 1024 * 1024; // ~2 MB limit
const MUSE_TIMEOUT_MS = 60_000; // 60s for Muse Spark
const DEFAULT_TIMEOUT_MS = 30_000; // 30s for other models

const SYSTEM_PROMPT =
  "Analyze this breadboard image. Identify all electronic components (LEDs, resistors, ultrasonic sensors) and wire connections (e.g., Wire from Pin 13 to Breadboard J15). Return ONLY a valid JSON object with keys `components` and `connections`. No markdown, no explanations.\n\n" +
  'Required JSON schema:\n{\n  "components": [\n    { "type": "led" | "resistor" | "button" | "ultrasonic" | "other", "label"?: string, "value"?: string }\n  ],\n  "connections": [\n    { "from": string, "to": string }\n  ]\n}\n' +
  'Use canonical endpoint names where possible such as "D13", "5V", "GND", "R1.1", "R1.2", "LED1.anode", "LED1.cathode", "SW1.1", "U_SONAR.TRIG", "U_SONAR.ECHO".';

export function shortModelName(modelId: string): string {
  const idx = modelId.lastIndexOf("/");
  return idx >= 0 ? modelId.slice(idx + 1) : modelId;
}

export function friendlyModelDisplay(modelId: string): string {
  const short = shortModelName(modelId);
  if (short.includes("muse-spark")) return "Muse Spark";
  if (short.startsWith("qwen")) return `Qwen (${short})`;
  if (short.startsWith("glm")) return `GLM (${short})`;
  return short;
}

function cleanEnvString(val: string | undefined): string {
  if (!val) return "";
  const stripped = val.trim().replace(/^["']+|["']+$/g, "").trim();
  if (stripped === "undefined" || stripped === "null") return "";
  return stripped;
}

export function getVisionEnv(): { apiKey: string; model: string; proxyUrl: string } {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  const rawProxy = cleanEnvString(env.VITE_VISION_PROXY_URL);
  const proxyUrl = /^https?:\/\/|^\/api\//i.test(rawProxy) ? rawProxy : "";
  const apiKey = cleanEnvString(env.VITE_FIREWORKS_API_KEY);
  const rawModel = cleanEnvString(env.VITE_VISION_MODEL);
  // Ignore removed legacy llama-v3p2 env values that may linger in container process.env
  const validRawModel = /llama-v3p2/i.test(rawModel) ? "" : rawModel;
  const model =
    validRawModel &&
    !validRawModel.startsWith("accounts/") &&
    validRawModel !== "auto" &&
    !validRawModel.startsWith("firerouter/")
      ? `accounts/fireworks/models/${validRawModel}`
      : validRawModel;
  return { apiKey, model, proxyUrl };
}

/**
 * Checks whether a Vision API endpoint or Fireworks API key is configured.
 */
export function isVisionConfigured(): boolean {
  const { apiKey, proxyUrl } = getVisionEnv();
  return proxyUrl.length > 0 || apiKey.length > 0;
}

let cachedAllModelIds: Set<string> | null = null;
let sessionWinnerModel: string | null = null;

/**
 * Queries `GET https://api.fireworks.ai/inference/v1/models` once per session,
 * caches the returned model IDs in memory, and returns the available IDs.
 */
export async function listVisionModels(signal?: AbortSignal): Promise<string[]> {
  if (cachedAllModelIds && cachedAllModelIds.size > 0) {
    return Array.from(cachedAllModelIds);
  }
  const { apiKey } = getVisionEnv();
  if (!apiKey) {
    return [];
  }

  try {
    const res = await fetch(`${FIREWORKS_MODELS_URL}?limit=200`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal,
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[scan] GET /inference/v1/models HTTP ${res.status}:`, errText.slice(0, 200));
      return [];
    }

    const data = (await res.json()) as {
      data?: Array<{ id?: string; name?: string }>;
      models?: Array<{ id?: string; name?: string }>;
    };
    const rawList = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.models)
        ? data.models
        : [];

    const allIds = new Set<string>();
    for (const item of rawList) {
      const rawId = (item.id ?? item.name ?? "").trim();
      if (!rawId) continue;
      const fullId =
        rawId.startsWith("accounts/") || rawId === "auto" || rawId.startsWith("firerouter/")
          ? rawId
          : `accounts/fireworks/models/${rawId}`;
      allIds.add(fullId);
    }

    if (allIds.size > 0) {
      cachedAllModelIds = allIds;
    }
    return Array.from(allIds);
  } catch (err: unknown) {
    console.warn(
      "[scan] GET /inference/v1/models failed (keeping full chain):",
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

/**
 * Builds the ordered, deduplicated vision model chain for the current scan:
 * 1. Session winner (if one already succeeded this session)
 * 2. VITE_VISION_MODEL (if set)
 * 3. VISION_MODEL_CHAIN
 * Filtered against GET /inference/v1/models (unless the list call failed).
 */
export async function resolveVisionModelChain(signal?: AbortSignal): Promise<string[]> {
  const { model: envModel } = getVisionEnv();
  const ordered: string[] = [];
  const pushUnique = (id: string | null | undefined) => {
    const clean = (id ?? "").trim();
    if (clean && !ordered.includes(clean)) {
      ordered.push(clean);
    }
  };

  if (sessionWinnerModel) {
    pushUnique(sessionWinnerModel);
  }
  if (envModel) {
    pushUnique(envModel);
  }
  for (const m of VISION_MODEL_CHAIN) {
    pushUnique(m);
  }

  const catalogIds = await listVisionModels(signal);
  if (catalogIds.length > 0) {
    const catalogSet = new Set(catalogIds);
    const filtered = ordered.filter((id) => catalogSet.has(id));
    if (filtered.length > 0) {
      console.log("[scan] Chain after filtering:", filtered);
      return filtered;
    }
  }

  console.log("[scan] Chain (unfiltered fallback):", ordered);
  return ordered;
}

/**
 * Client-side image downscaler: resizes an uploaded image File to <= maxSide px on its longest side
 * and encodes as JPEG (quality 0.85). Automatically steps down further if base64 exceeds ~2 MB.
 */
export async function downscaleImageFile(
  file: File,
  maxSide = 1280,
  quality = 0.85,
): Promise<{ base64: string; mime: string; previewUrl: string; sizeKb: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new ScanError("parse", `Could not decode image file "${file.name}".`));
      el.src = objectUrl;
    });

    const srcW = img.naturalWidth || img.width || 1;
    const srcH = img.naturalHeight || img.height || 1;
    const mime = "image/jpeg";

    const attempts: Array<{ side: number; q: number }> = [
      { side: maxSide, q: quality },
      { side: 960, q: 0.75 },
      { side: 640, q: 0.65 },
    ];

    let lastBase64 = "";
    let lastDataUrl = "";

    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.side / Math.max(srcW, srcH));
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

      const dataUrl = canvas.toDataURL(mime, attempt.q);
      const commaIdx = dataUrl.indexOf(",");
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      if (!base64) {
        throw new ScanError("empty", "Encoded image payload was empty.");
      }

      lastBase64 = base64;
      lastDataUrl = dataUrl;
      if (base64.length <= MAX_BASE64_BYTES) {
        break;
      }
    }

    const sizeKb = Math.round((lastBase64.length * 0.75) / 1024);
    if (lastBase64.length > MAX_BASE64_BYTES) {
      throw new ScanError(
        "image_too_large",
        `image too large (${sizeKb} KB after downscaling; max ~2048 KB).`,
      );
    }

    return { base64: lastBase64, mime, previewUrl: lastDataUrl, sizeKb };
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
  if (lower === "servo" || lower.includes("servo") || lower.includes("sg90")) return "servo";
  if (lower === "potentiometer" || lower.includes("pot") || lower.includes("variable resistor")) {
    return "potentiometer";
  }
  if (lower === "ldr" || lower.includes("ldr") || lower.includes("photoresistor") || lower.includes("photocell")) {
    return "ldr";
  }
  if (lower === "buzzer" || lower.includes("buzzer") || lower.includes("piezo")) return "buzzer";
  if (lower === "motor" || lower.includes("dc motor") || lower.includes("motor")) return "motor";
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
    throw new ScanError(
      "parse",
      `invalid JSON from model: response did not contain a JSON object (${withoutFences.slice(0, 120)})`,
    );
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

  throw new ScanError("parse", "invalid JSON from model: unterminated JSON object.");
}

/**
 * Hand-written defensive validator and normalizer for `ScanResult`.
 */
export function parseAndValidateScanResult(rawText: string): ScanResult {
  if (!rawText || rawText.trim().length === 0) {
    throw new ScanError("empty", "invalid JSON from model: empty content");
  }

  const jsonSlice = extractJsonObjectString(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonSlice);
  } catch (err: unknown) {
    throw new ScanError(
      "parse",
      `invalid JSON from model: ${err instanceof Error ? err.message : "JSON.parse failed"}`,
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ScanError("parse", "invalid JSON from model: root must be a JSON object.");
  }

  const record = parsed as Record<string, unknown>;
  if (!Array.isArray(record.components) || !Array.isArray(record.connections)) {
    throw new ScanError(
      "parse",
      "invalid JSON from model: missing required `components` or `connections` arrays.",
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

  return { components, connections };
}

interface ModelAttemptParams {
  model: string;
  maxTokens: number;
  includeResponseFormat: boolean;
  includeReasoningEffort: boolean;
  timeoutMs: number;
}

/**
 * Calls Fireworks AI Vision across `VISION_MODEL_CHAIN` (or configured proxy URL)
 * to inspect a physical breadboard photo, automatically falling back on model errors.
 */
export async function analyzePhysicalCircuit(
  base64Image: string,
  mime: string,
  signal?: AbortSignal,
  onProgress?: (update: ScanProgressUpdate) => void,
): Promise<ScanResult> {
  const { apiKey, proxyUrl } = getVisionEnv();

  if (!proxyUrl && !apiKey) {
    throw new ScanError(
      "unconfigured",
      "Vision API not configured: missing VITE_FIREWORKS_API_KEY and VITE_VISION_PROXY_URL.",
    );
  }

  const rawBase64 = base64Image.startsWith("data:")
    ? base64Image.slice(base64Image.indexOf(",") + 1)
    : base64Image;
  const approxKb = Math.round((rawBase64.length * 0.75) / 1024);
  if (rawBase64.length > MAX_BASE64_BYTES) {
    throw new ScanError(
      "image_too_large",
      `image too large (${approxKb} KB exceeds ~2048 KB limit).`,
    );
  }

  const cleanDataUrl = base64Image.startsWith("data:")
    ? base64Image
    : `data:${mime || "image/jpeg"};base64,${base64Image}`;

  const chain = await resolveVisionModelChain(signal);
  const primaryEndpoint = proxyUrl || FIREWORKS_CHAT_URL;
  const failures: Array<{ model: string; reason: string }> = [];

  const executePost = async (
    params: ModelAttemptParams,
  ): Promise<{ response: Response; bodyText: string }> => {
    const attemptController = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      attemptController.abort();
    }, params.timeoutMs);

    const onCallerAbort = () => attemptController.abort();
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        throw new DOMException("Scan aborted", "AbortError");
      }
      signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    const buildBody = () =>
      JSON.stringify({
        model: params.model,
        temperature: 0,
        max_tokens: params.maxTokens,
        ...(params.includeReasoningEffort ? { reasoning_effort: "low" } : {}),
        ...(params.includeResponseFormat ? { response_format: { type: "json_object" } } : {}),
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
                image_url: { url: cleanDataUrl },
              },
            ],
          },
        ],
      });

    const doFetch = async (url: string) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }
      console.log("[scan] Request start:", {
        model: params.model,
        maxTokens: params.maxTokens,
        reasoningEffort: params.includeReasoningEffort ? "low" : undefined,
        responseFormat: params.includeResponseFormat,
        timeoutMs: params.timeoutMs,
      });
      const response = await fetch(url, {
        method: "POST",
        headers,
        signal: attemptController.signal,
        body: buildBody(),
      });
      const bodyText = await response.text();
      console.log("[scan] Response status:", { model: params.model, status: response.status });
      return { response, bodyText };
    };

    try {
      return await doFetch(primaryEndpoint);
    } catch (err: unknown) {
      if (signal?.aborted) {
        throw new DOMException("Scan aborted", "AbortError");
      }
      if (timedOut) {
        throw new ScanError("timeout", "timeout");
      }
      if (primaryEndpoint !== proxyUrl && proxyUrl) {
        console.warn("[scan] Direct request failed (network/CORS), retrying via proxy:", proxyUrl);
        try {
          return await doFetch(proxyUrl);
        } catch {
          throw new ScanError("network", "network/CORS");
        }
      }
      throw new ScanError("network", "network/CORS");
    } finally {
      clearTimeout(timer);
      if (signal) {
        signal.removeEventListener("abort", onCallerAbort);
      }
    }
  };

  for (let idx = 0; idx < chain.length; idx++) {
    const model = chain[idx]!;
    const shortName = shortModelName(model);
    const isMuse = model.includes("muse-spark");
    const timeoutMs = isMuse ? MUSE_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
    const prevModel = idx > 0 ? chain[idx - 1]! : null;

    const progressLabel =
      idx === 0
        ? isMuse
          ? "Analyzing with Muse Spark…"
          : `Analyzing with ${shortName}…`
        : `${friendlyModelDisplay(prevModel!)} unavailable, trying ${
            shortName.startsWith("qwen") ? "Qwen" : friendlyModelDisplay(model)
          }…`;

    onProgress?.({
      model,
      shortName,
      label: progressLabel,
      isFallback: idx > 0,
    });

    const modelStartMs = performance.now();
    let params: ModelAttemptParams = {
      model,
      maxTokens: isMuse ? 4096 : 2048,
      includeResponseFormat: true,
      includeReasoningEffort: isMuse,
      timeoutMs,
    };

    try {
      let { response, bodyText } = await executePost(params);

      // Stop immediately on 401 (bad API key) — do NOT move on to other models
      if (response.status === 401) {
        throw new ScanError("http", "Invalid API key", 401);
      }

      // On 400 mentioning reasoning_effort or response_format, retry the same model once without that param
      if (
        response.status === 400 &&
        /reasoning_effort|response_format|json_object|response format|unrecognized|extra_forbidden/i.test(
          bodyText,
        )
      ) {
        const dropReasoning = /reasoning_effort/i.test(bodyText);
        const dropFormat = /response_format|json_object|response format/i.test(bodyText);
        params = {
          ...params,
          includeReasoningEffort: dropReasoning ? false : params.includeReasoningEffort && !dropFormat ? false : params.includeReasoningEffort,
          includeResponseFormat: dropFormat ? false : params.includeResponseFormat && !dropReasoning ? false : params.includeResponseFormat,
        };
        console.warn("[scan] Retrying 400 without unsupported param:", params);
        const retry400 = await executePost(params);
        response = retry400.response;
        bodyText = retry400.bodyText;
        if (response.status === 401) {
          throw new ScanError("http", "Invalid API key", 401);
        }
      }

      // On 429 or 5xx, retry the same model once before moving on
      if (response.status === 429 || response.status >= 500) {
        console.warn(`[scan] HTTP ${response.status} on ${shortName}; retrying once...`);
        const retry5xx = await executePost(params);
        response = retry5xx.response;
        bodyText = retry5xx.bodyText;
        if (response.status === 401) {
          throw new ScanError("http", "Invalid API key", 401);
        }
      }

      if (!response.ok) {
        failures.push({
          model: shortName,
          reason: `${response.status}`,
        });
        console.warn(
          `[scan] Model ${shortName} failed with HTTP ${response.status}:`,
          bodyText.slice(0, 200),
        );
        continue;
      }

      const parseCompletionPayload = (rawBody: string): {
        content: string;
        finishReason: string;
        usage: unknown;
        isDirectSchema: boolean;
      } => {
        let payload: unknown;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          throw new ScanError("parse", "invalid JSON");
        }
        const record = payload as Record<string, unknown>;
        if (Array.isArray(record.components) && Array.isArray(record.connections)) {
          return {
            content: rawBody,
            finishReason: "stop",
            usage: record.usage ?? null,
            isDirectSchema: true,
          };
        }
        const choices = Array.isArray(record.choices) ? record.choices : [];
        const firstChoice = (choices[0] as Record<string, unknown> | undefined) ?? {};
        const finishReason =
          typeof firstChoice.finish_reason === "string" ? firstChoice.finish_reason : "";
        const message = (firstChoice.message as Record<string, unknown> | undefined) ?? {};
        const content = typeof message.content === "string" ? message.content : "";
        return {
          content,
          finishReason,
          usage: record.usage ?? null,
          isDirectSchema: false,
        };
      };

      let extracted = parseCompletionPayload(bodyText);
      console.log("[scan] Model output:", {
        model: shortName,
        finishReason: extracted.finishReason,
        usage: extracted.usage,
        rawPreview: extracted.content.slice(0, 500),
      });

      // Muse Spark retry once with max_tokens: 8192 if finish_reason === "length" or content is empty
      if (isMuse && (extracted.finishReason === "length" || !extracted.content.trim())) {
        console.warn(
          `[scan] Muse Spark finish_reason="${extracted.finishReason}" or empty content; retrying once with max_tokens: 8192`,
        );
        const retry8k = await executePost({
          ...params,
          maxTokens: 8192,
        });
        if (retry8k.response.status === 401) {
          throw new ScanError("http", "Invalid API key", 401);
        }
        if (retry8k.response.ok) {
          extracted = parseCompletionPayload(retry8k.bodyText);
          console.log("[scan] Muse Spark 8192-token retry output:", {
            finishReason: extracted.finishReason,
            usage: extracted.usage,
            rawPreview: extracted.content.slice(0, 500),
          });
        }
      }

      if (!extracted.content.trim()) {
        failures.push({ model: shortName, reason: "empty content" });
        console.warn(`[scan] Model ${shortName} returned empty content; moving to next model.`);
        continue;
      }

      const scanResult = parseAndValidateScanResult(extracted.content);
      const elapsedSec = Number(((performance.now() - modelStartMs) / 1000).toFixed(1));
      sessionWinnerModel = model;
      console.log(`[scan] Winner model: ${shortName} (${elapsedSec}s)`, scanResult);

      return {
        ...scanResult,
        modelUsed: model,
        modelShortName: shortName,
        elapsedSec,
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      if (err instanceof ScanError && err.status === 401) {
        throw err;
      }
      const reason =
        err instanceof ScanError
          ? err.kind === "timeout"
            ? "timeout"
            : err.kind === "parse"
              ? "invalid JSON"
              : err.kind === "empty"
                ? "empty content"
                : err.message
          : "error";
      failures.push({ model: shortName, reason });
      console.warn(`[scan] Model ${shortName} failed (${reason}); trying next in chain...`);
    }
  }

  const summary =
    failures.length > 0
      ? failures.map((f) => `${f.model}: ${f.reason}`).join(" · ")
      : "All vision models in chain failed.";
  throw new ScanError("http", summary);
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

function formatReadableEndpoint(ep: string): string {
  return ep
    .replace(/\.ANODE$/i, " anode")
    .replace(/\.CATHODE$/i, " cathode");
}

/**
 * Compares the scanned physical breadboard graph against the expected digital twin,
 * returning actionable fix instructions grouped into Components, Wiring, and Power.
 */
export function verifyScan(expected: ScanResult, found: ScanResult): ScanVerificationReport {
  const groupedErrors: GroupedScanErrors = {
    components: [],
    wiring: [],
    power: [],
  };

  const componentTypes: ScanComponentType[] = [
    "led",
    "resistor",
    "button",
    "ultrasonic",
    "servo",
    "potentiometer",
    "ldr",
    "buzzer",
    "motor",
    "other",
  ];
  const typeLabels: Record<ScanComponentType, string> = {
    led: "LED",
    resistor: "resistor",
    button: "push button",
    ultrasonic: "ultrasonic sensor",
    servo: "servo",
    potentiometer: "potentiometer",
    ldr: "LDR photoresistor",
    buzzer: "piezo buzzer",
    motor: "DC motor",
    other: "component",
  };

  let totalComponents = 0;
  let matchedComponents = 0;

  const expResistorCount = expected.components.filter((c) => c.type === "resistor").length;
  const fndResistorCount = found.components.filter((c) => c.type === "resistor").length;

  for (const t of componentTypes) {
    const expItems = expected.components.filter((c) => c.type === t);
    const fndItems = found.components.filter((c) => c.type === t);
    const expCount = expItems.length;
    const fndCount = fndItems.length;
    totalComponents += expCount;
    matchedComponents += Math.min(expCount, fndCount);

    if (fndCount < expCount) {
      const diff = expCount - fndCount;
      // Special actionable guidance if a series resistor between MCU pin and LED is missing
      if (t === "resistor") {
        const expLed = expected.components.find((c) => c.type === "led");
        const expMcuConn = expected.connections.find(
          (c) => /^D\d+$/i.test(normalizeEndpoint(c.from)) || /^D\d+$/i.test(normalizeEndpoint(c.to)),
        );
        const mcuPin = expMcuConn
          ? /^D\d+$/i.test(normalizeEndpoint(expMcuConn.from))
            ? normalizeEndpoint(expMcuConn.from)
            : normalizeEndpoint(expMcuConn.to)
          : null;
        if (expLed && mcuPin) {
          groupedErrors.components.push(
            `Add a resistor between ${mcuPin} and ${expLed.label ?? "LED1"}`,
          );
          continue;
        }
      }
      const missingLabel = expItems[fndCount]?.label;
      groupedErrors.components.push(
        diff === 1 && expCount === 1
          ? `Add missing ${typeLabels[t]}${missingLabel ? ` (${missingLabel})` : ""}`
          : `Add ${diff} missing ${typeLabels[t]}${diff > 1 ? "s" : ""} (expected ${expCount}, found ${fndCount})`,
      );
    } else if (fndCount > expCount) {
      const diff = fndCount - expCount;
      groupedErrors.components.push(
        `Remove ${diff} extra ${typeLabels[t]}${diff > 1 ? "s" : ""} (expected ${expCount}, found ${fndCount})`,
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

    const isPowerOrGnd =
      exp.a === "GND" ||
      exp.b === "GND" ||
      exp.a === "5V" ||
      exp.b === "5V" ||
      exp.a === "3.3V" ||
      exp.b === "3.3V";

    if (isPowerOrGnd) {
      const rail =
        exp.a === "GND" || exp.a === "5V" || exp.a === "3.3V" ? exp.a : exp.b;
      const target = rail === exp.a ? exp.b : exp.a;
      groupedErrors.power.push(`Connect ${rail} to ${formatReadableEndpoint(target)}`);
      continue;
    }

    // Check if one side is an MCU pin and the other side was wired to the wrong MCU pin
    const expMcu = isMcuPin(exp.a) ? exp.a : isMcuPin(exp.b) ? exp.b : null;
    const expCompEnd = expMcu ? (exp.a === expMcu ? exp.b : exp.a) : null;

    if (expMcu && expCompEnd) {
      const expPrefix = expCompEnd.split(".")[0] ?? expCompEnd;
      const wrongPinIdx = unmatchedFound.findIndex((f) => {
        const fMcu = isMcuPin(f.a) ? f.a : isMcuPin(f.b) ? f.b : null;
        if (!fMcu || fMcu === "GND" || fMcu === "5V" || fMcu === "3.3V") return false;
        const other = f.a === fMcu ? f.b : f.a;
        const otherPrefix = other.split(".")[0] ?? other;
        return other === expCompEnd || otherPrefix === expPrefix;
      });

      if (wrongPinIdx !== -1) {
        const wrong = unmatchedFound[wrongPinIdx]!;
        const foundPin = isMcuPin(wrong.a) ? wrong.a : wrong.b;
        unmatchedFound.splice(wrongPinIdx, 1);
        groupedErrors.wiring.push(
          `Move the wire from ${foundPin} to ${expMcu} (${formatReadableEndpoint(expCompEnd)})`,
        );
        continue;
      }
    }

    // If a series resistor was omitted and the user wired MCU directly to LED
    if (fndResistorCount < expResistorCount && (/^R\d+\./.test(exp.a) || /^R\d+\./.test(exp.b))) {
      const nonRes = /^R\d+\./.test(exp.a) ? exp.b : exp.a;
      groupedErrors.wiring.push(`Connect resistor lead to ${formatReadableEndpoint(nonRes)}`);
      continue;
    }

    groupedErrors.wiring.push(
      `Connect ${formatReadableEndpoint(exp.a)} to ${formatReadableEndpoint(exp.b)}`,
    );
  }

  const errors = [
    ...groupedErrors.components,
    ...groupedErrors.wiring,
    ...groupedErrors.power,
  ];
  const total = totalComponents + expPairs.length;
  const matched = matchedComponents + matchedConnections;

  return {
    passed: errors.length === 0,
    errors,
    groupedErrors,
    matched,
    total,
  };
}

/**
 * Uses the existing `VISION_MODEL_CHAIN` fallback sequence with a text-only prompt
 * to enrich a generated Arduino sketch with concise line-by-line comments without
 * changing any pin numbers or structure.
 */
export async function explainSketchWithMuseSpark(
  deterministicCode: string,
  externalSignal?: AbortSignal,
): Promise<{ code: string; modelShortName: string }> {
  const { apiKey, proxyUrl } = getVisionEnv();
  if (!apiKey && !proxyUrl) {
    throw new ScanError("unconfigured", "Vision API not configured");
  }

  const { extractSketchPinSignature } = await import("./codegen.js");
  const expectedPinSig = extractSketchPinSignature(deterministicCode);

  const chain = await resolveVisionModelChain(externalSignal);
  const endpoint = proxyUrl || FIREWORKS_CHAT_URL;

  for (const model of chain) {
    const shortName = shortModelName(model);
    const isMuse = model.includes("muse-spark");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), isMuse ? 45_000 : 25_000);
    const onAbort = () => controller.abort();
    externalSignal?.addEventListener("abort", onAbort, { once: true });

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: isMuse ? 4096 : 2048,
          ...(isMuse ? { reasoning_effort: "low" } : {}),
          messages: [
            {
              role: "system",
              content:
                "Add concise comments explaining each line of this Arduino sketch. Return ONLY the full sketch, no markdown fences.",
            },
            {
              role: "user",
              content: deterministicCode,
            },
          ],
        }),
      });

      if (res.status === 401) {
        throw new ScanError("http", "Invalid API key", 401);
      }
      if (!res.ok) continue;

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const rawContent = data.choices?.[0]?.message?.content ?? "";
      const cleaned = rawContent
        .replace(/^```(?:cpp|c|arduino)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      if (!cleaned.includes("void setup") || !cleaned.includes("void loop")) {
        console.warn(`[scan] Explain output from ${shortName} missing setup/loop; rejecting.`);
        continue;
      }

      const candidatePinSig = extractSketchPinSignature(cleaned);
      if (candidatePinSig !== expectedPinSig) {
        console.warn(
          `[scan] Explain output from ${shortName} altered pin signature (${candidatePinSig} !== ${expectedPinSig}); rejecting.`,
        );
        continue;
      }

      sessionWinnerModel = model;
      return { code: cleaned, modelShortName: shortName };
    } catch (err: unknown) {
      if (externalSignal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (err instanceof ScanError && err.status === 401) {
        throw err;
      }
    } finally {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onAbort);
    }
  }

  throw new ScanError("parse", "Couldn't improve comments");
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
