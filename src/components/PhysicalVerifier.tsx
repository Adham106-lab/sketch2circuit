/**
 * @license Apache-2.0
 * PhysicalVerifier — Physical breadboard camera/file scanner + non-blocking 3D HUD verification card.
 */

import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { type GeneratedSketchResult, generateSketch } from "../lib/codegen.js";
import {
  analyzePhysicalCircuit,
  clearUserSessionKey,
  downscaleImageFile,
  explainSketchWithMuseSpark,
  getUserSessionKey,
  getVisionEnv,
  mockScan,
  ScanError,
  type ScanPhase,
  type ScanResult,
  type ScanVerificationReport,
  setUserSessionKey,
  VISION_MODEL_CHAIN,
  verifyScan,
} from "../lib/physicalScan.js";

export interface PhysicalVerifierProps {
  expected: ScanResult;
  theme?: "dark" | "light";
  /**
   * "full" (default): renders both the Scan Breadboard button and the HUD overlay.
   * "trigger": renders only the toolbar Scan Breadboard button.
   * "hud": renders only the absolute HUD overlay over the 3D viewer.
   */
  mode?: "full" | "trigger" | "hud";
  sketchName?: string;
  onSendToEditor?: (code: string) => void;
}

type VerifierStatus = "idle" | "scanning" | "done" | "error";

interface SharedScanState {
  status: VerifierStatus;
  mockMode: boolean;
  previewUrl: string | null;
  fileName: string | null;
  scanPhase: ScanPhase;
  longWait: boolean;
  modelShortName: string | null;
  elapsedSec: number | null;
  report: ScanVerificationReport | null;
  found: ScanResult | null;
  errorMsg: string | null;
  errorDetails: string | null;
  errorKind: string | null;
  errorStatus: number | null;
  collapsed: boolean;
  detailsExpanded: boolean;
  keyDisclosureOpen: boolean;
  hasSavedUserKey: boolean;
  showAllErrors: boolean;
  detectedExpanded: boolean;
  excludedComponents: number[];
  excludedConnections: number[];
  generatedSketch: GeneratedSketchResult | null;
  deterministicCode: string | null;
  explaining: boolean;
  explainStatusMsg: string | null;
  copied: boolean;
  sentToEditor: boolean;
}

function getInitialDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("demo") === "1";
  } catch {
    return false;
  }
}

let sharedState: SharedScanState = {
  status: "idle",
  mockMode: getInitialDemoMode(),
  previewUrl: null,
  fileName: null,
  scanPhase: "reading",
  longWait: false,
  modelShortName: null,
  elapsedSec: null,
  report: null,
  found: null,
  errorMsg: null,
  errorDetails: null,
  errorKind: null,
  errorStatus: null,
  collapsed: false,
  detailsExpanded: false,
  keyDisclosureOpen: false,
  hasSavedUserKey: Boolean(getUserSessionKey()),
  showAllErrors: false,
  detectedExpanded: false,
  excludedComponents: [],
  excludedConnections: [],
  generatedSketch: null,
  deterministicCode: null,
  explaining: false,
  explainStatusMsg: null,
  copied: false,
  sentToEditor: false,
};

const listeners = new Set<() => void>();

function updateSharedState(patch: Partial<SharedScanState>) {
  sharedState = { ...sharedState, ...patch };
  for (const listener of listeners) {
    listener();
  }
}

function useSharedScanState(): [SharedScanState, (patch: Partial<SharedScanState>) => void] {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return [sharedState, updateSharedState];
}

let activeAbortController: AbortController | null = null;
let longWaitTimerId: ReturnType<typeof setTimeout> | null = null;

function clearLongWaitTimer() {
  if (longWaitTimerId !== null) {
    clearTimeout(longWaitTimerId);
    longWaitTimerId = null;
  }
}

export function PhysicalVerifier({
  expected,
  theme = "dark",
  mode = "full",
  sketchName = "ScannedBreadboard",
  onSendToEditor,
}: PhysicalVerifierProps) {
  const [state, setState] = useSharedScanState();
  const [userKeyDraft, setUserKeyDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expectedRef = useRef<ScanResult>(expected);
  expectedRef.current = expected;

  const isDark = theme === "dark";

  // Re-verify automatically if the user edits the sketch while a scan result is open
  useEffect(() => {
    if (state.status === "done" && state.found) {
      const updatedReport = verifyScan(expected, state.found);
      setState({ report: updatedReport });
    }
  }, [expected, state.status, state.found, setState]);

  const handleCancelOrDismiss = useCallback(() => {
    clearLongWaitTimer();
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    setState({
      status: "idle",
      longWait: false,
      report: null,
      found: null,
      errorMsg: null,
      errorDetails: null,
      errorKind: null,
      errorStatus: null,
      detailsExpanded: false,
      generatedSketch: null,
      deterministicCode: null,
      explaining: false,
      explainStatusMsg: null,
    });
  }, [setState]);

  // Escape key cancels in-flight scan or dismisses the HUD overlay
  useEffect(() => {
    if (mode === "trigger") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sharedState.status !== "idle") {
        handleCancelOrDismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, handleCancelOrDismiss]);

  // Abort in-flight scan only when the last mounted instance unmounts
  useEffect(() => {
    return () => {
      if (listeners.size === 0) {
        clearLongWaitTimer();
        if (activeAbortController) {
          activeAbortController.abort();
          activeAbortController = null;
        }
      }
    };
  }, []);

  const runVerification = useCallback(
    async (file: File | null, forceMock?: boolean) => {
      clearLongWaitTimer();
      if (activeAbortController) {
        activeAbortController.abort();
      }
      const controller = new AbortController();
      activeAbortController = controller;

      const useMock = forceMock ?? sharedState.mockMode;
      const { endpoint, usesProxy, apiKey, model: cleanModel } = getVisionEnv();
      const hasApiKey = Boolean(apiKey);
      const hasUserKey = Boolean(getUserSessionKey());
      const modelEnv = cleanModel || VISION_MODEL_CHAIN[0];

      console.group("[scan]");
      console.log("[scan] Env check:", {
        endpoint,
        usesProxy,
        hasDevApiKey: hasApiKey,
        hasUserSessionKey: hasUserKey,
        model: modelEnv,
        mockMode: useMock,
      });

      setState({
        status: "scanning",
        fileName: file ? file.name : "demo-breadboard.jpg",
        scanPhase: file ? "preparing" : "reading",
        longWait: false,
        modelShortName: null,
        elapsedSec: null,
        report: null,
        found: null,
        errorMsg: null,
        errorDetails: null,
        errorKind: null,
        errorStatus: null,
        collapsed: false,
        detailsExpanded: false,
        showAllErrors: false,
        detectedExpanded: false,
        excludedComponents: [],
        excludedConnections: [],
        generatedSketch: null,
        deterministicCode: null,
        explaining: false,
        explainStatusMsg: null,
        copied: false,
        sentToEditor: false,
      });

      longWaitTimerId = setTimeout(() => {
        if (sharedState.status === "scanning") {
          setState({ longWait: true });
        }
      }, 8000);

      try {
        let base64 = "";
        let mime = "image/jpeg";

        if (file) {
          setState({ scanPhase: "preparing" });
          const prepared = await downscaleImageFile(file, 1280, 0.85);
          if (controller.signal.aborted) return;
          base64 = prepared.base64;
          mime = prepared.mime;
          console.log(`[scan] Image downscaled: ${prepared.sizeKb} KB (${file.name})`);
          setState({ previewUrl: prepared.previewUrl });
        } else {
          setState({ previewUrl: null });
        }

        let scanResult: ScanResult;
        if (useMock) {
          setState({ scanPhase: "reading" });
          console.log("[scan] Running deterministic mockScan (1.5s)...");
          const t0 = performance.now();
          scanResult = await mockScan(expectedRef.current, controller.signal);
          scanResult.modelShortName = "demo-twin";
          scanResult.elapsedSec = Number(((performance.now() - t0) / 1000).toFixed(1));
          console.log("[scan] Mock scan result:", scanResult);
        } else {
          scanResult = await analyzePhysicalCircuit(
            base64,
            mime,
            controller.signal,
            (phase) => {
              setState({ scanPhase: phase });
            },
          );
        }

        if (controller.signal.aborted) return;

        setState({ scanPhase: "checking" });
        const verification = verifyScan(expectedRef.current, scanResult);
        console.log("[scan] Verification report:", verification);
        clearLongWaitTimer();
        setState({
          status: "done",
          longWait: false,
          found: scanResult,
          report: verification,
          modelShortName: scanResult.modelShortName ?? "muse-spark-open",
          elapsedSec: scanResult.elapsedSec ?? null,
          errorMsg: null,
          errorDetails: null,
          errorKind: null,
          errorStatus: null,
        });
      } catch (err: unknown) {
        clearLongWaitTimer();
        if (err instanceof DOMException && err.name === "AbortError") {
          console.warn("[scan] Scan cancelled by user.");
          if (activeAbortController === controller) {
            setState({ status: "idle", longWait: false });
          }
          return;
        }
        const kind = err instanceof ScanError ? err.kind : "network";
        const status = err instanceof ScanError ? (err.status ?? null) : null;
        const details = err instanceof ScanError ? (err.details ?? null) : null;
        const message =
          status === 429 || kind === "rate_limit"
            ? "Demo limit reached. Add your own Fireworks key to keep scanning."
            : status === 413 || kind === "image_too_large"
              ? "Image too large, try a smaller photo"
              : status === 503 || kind === "unconfigured"
                ? "Scanning is temporarily unavailable. Try Demo Twin."
                : status === 401
                  ? "Invalid API key"
                  : "Couldn't read the circuit. Try a clearer photo or Demo Twin.";

        console.error("[scan] Scan failed:", {
          kind,
          status,
          message,
          details: details ?? (err instanceof Error ? err.message : String(err)),
        });
        setState({
          status: "error",
          longWait: false,
          errorKind: kind,
          errorStatus: status,
          errorMsg: message,
          errorDetails:
            details ?? (err instanceof Error && err.message !== message ? err.message : null),
          keyDisclosureOpen:
            status === 429 || kind === "rate_limit" ? true : sharedState.keyDisclosureOpen,
          report: null,
          collapsed: false,
          detailsExpanded: false,
        });
      } finally {
        console.groupEnd();
        if (activeAbortController === controller) {
          activeAbortController = null;
        }
      }
    },
    [setState],
  );

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const { endpoint, usesProxy } = getVisionEnv();
    console.log("[scan] Scan Breadboard button clicked:", {
      shiftKey: e.shiftKey,
      mockMode: state.mockMode,
      endpoint,
      usesProxy,
      fileInputReady: Boolean(fileInputRef.current),
    });

    // Shift+click toggles deterministic Demo / Mock mode and runs immediately if no file needed
    if (e.shiftKey) {
      e.preventDefault();
      const nextMock = !state.mockMode;
      setState({ mockMode: nextMock });
      if (nextMock) {
        void runVerification(null, true);
      }
      return;
    }

    if (state.status === "scanning") return;

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    } else {
      setState({
        status: "error",
        errorKind: "parse",
        errorMsg: "Couldn't read the circuit. Try a clearer photo or Demo Twin.",
        errorDetails: "File input element ref was not mounted.",
        collapsed: false,
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = "";
    console.log(
      "[scan] File input onChange fired:",
      file ? { name: file.name, sizeBytes: file.size, type: file.type } : "no file selected",
    );
    if (!file) return;
    void runVerification(file);
  };

  const handleDismiss = () => {
    handleCancelOrDismiss();
  };

  const handleSaveUserKey = () => {
    const clean = userKeyDraft.trim();
    if (!clean) return;
    setUserSessionKey(clean);
    setUserKeyDraft("");
    setState({ hasSavedUserKey: true, keyDisclosureOpen: false });
  };

  const handleRemoveUserKey = () => {
    clearUserSessionKey();
    setUserKeyDraft("");
    setState({ hasSavedUserKey: false });
  };

  const getFilteredFound = (): ScanResult | null => {
    if (!state.found) return null;
    const compExcl = new Set(state.excludedComponents);
    const connExcl = new Set(state.excludedConnections);

    const removedPrefixes = new Set<string>();
    const components = state.found.components.filter((c, i) => {
      if (compExcl.has(i)) {
        if (c.label) removedPrefixes.add(c.label.trim().toUpperCase());
        return false;
      }
      return true;
    });

    const connections = state.found.connections.filter((conn, i) => {
      if (connExcl.has(i)) return false;
      const fromPrefix = (conn.from.split(".")[0] ?? conn.from).trim().toUpperCase();
      const toPrefix = (conn.to.split(".")[0] ?? conn.to).trim().toUpperCase();
      if (removedPrefixes.has(fromPrefix) || removedPrefixes.has(toPrefix)) {
        return false;
      }
      return true;
    });

    return {
      ...state.found,
      components,
      connections,
    };
  };

  const handleToggleComponent = (idx: number) => {
    if (state.generatedSketch !== null) return; // Editable only before generating
    const exists = state.excludedComponents.includes(idx);
    const next = exists
      ? state.excludedComponents.filter((i) => i !== idx)
      : [...state.excludedComponents, idx];
    setState({ excludedComponents: next });
  };

  const handleToggleConnection = (idx: number) => {
    if (state.generatedSketch !== null) return; // Editable only before generating
    const exists = state.excludedConnections.includes(idx);
    const next = exists
      ? state.excludedConnections.filter((i) => i !== idx)
      : [...state.excludedConnections, idx];
    setState({ excludedConnections: next });
  };

  const handleGenerateCode = () => {
    const filtered = getFilteredFound();
    if (!filtered) return;
    const generated = generateSketch(filtered, { board: "uno" });
    setState({
      generatedSketch: generated,
      deterministicCode: generated.code,
      explainStatusMsg: null,
      copied: false,
      sentToEditor: false,
    });
  };

  const handleCopyCode = async () => {
    if (!state.generatedSketch) return;
    try {
      await navigator.clipboard.writeText(state.generatedSketch.code);
      setState({ copied: true });
      setTimeout(() => setState({ copied: false }), 2000);
    } catch {
      // Clipboard API unavailable in some restricted frames
    }
  };

  const handleDownloadIno = () => {
    if (!state.generatedSketch) return;
    const safeName =
      sketchName.replace(/[^A-Za-z0-9_-]/g, "_").replace(/^_+/, "") || "ScannedSketch";
    const blob = new Blob([state.generatedSketch.code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safeName}.ino`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 250);
    }
  };

  const handleSendToEditor = () => {
    if (!state.generatedSketch || !onSendToEditor) return;
    onSendToEditor(state.generatedSketch.code);
    setState({ sentToEditor: true });
    setTimeout(() => setState({ sentToEditor: false }), 2200);
  };

  const handleExplainWithMuseSpark = async () => {
    if (!state.generatedSketch || !state.deterministicCode || state.mockMode || state.explaining) {
      return;
    }
    setState({ explaining: true, explainStatusMsg: null });
    try {
      const res = await explainSketchWithMuseSpark(state.deterministicCode);
      setState({
        explaining: false,
        generatedSketch: {
          ...state.generatedSketch,
          code: res.code,
        },
        explainStatusMsg: `Comments enhanced (${res.modelShortName})`,
      });
    } catch {
      setState({
        explaining: false,
        explainStatusMsg: "Couldn't improve comments",
      });
    }
  };

  const renderTriggerButton = () => (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="sr-only"
        aria-label="Upload or capture breadboard photo"
      />
      <button
        type="button"
        onClick={handleButtonClick}
        disabled={state.status === "scanning"}
        title="Upload a breadboard photo to verify physical wiring against the digital twin (Shift+Click to toggle Demo mode)"
        className={`px-3 py-1.5 rounded-lg border font-medium text-xs flex items-center gap-1.5 transition cursor-pointer disabled:opacity-60 shrink-0 ${
          isDark
            ? "border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-100"
            : "border-slate-300 bg-white hover:bg-slate-50 text-slate-800"
        }`}
      >
        {state.status === "scanning" ? (
          <>
            <Loader2 className="w-3.5 h-3.5 motion-safe:animate-spin text-slate-300 shrink-0" />
            <span>Thinking…</span>
          </>
        ) : state.status === "done" && state.report ? (
          <>
            {state.report.passed ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            )}
            <span>
              Scan Breadboard ·{" "}
              <span className="font-mono">
                {state.report.matched}/{state.report.total}
              </span>
            </span>
          </>
        ) : (
          <>
            <Camera className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            <span>Scan Breadboard</span>
          </>
        )}
        {state.mockMode && (
          <span
            title="Deterministic Demo Mode active (Shift+Click button to toggle)"
            className="ml-1 px-1.5 py-0.2 rounded border border-[#06b6d4]/40 bg-[#06b6d4]/15 text-[#06b6d4] font-mono text-[10px]"
          >
            Demo
          </span>
        )}
      </button>
    </div>
  );

  const renderErrorGroup = (title: string, items: string[]) => {
    if (items.length === 0) return null;
    const shown = state.showAllErrors ? items : items.slice(0, 6);
    const extra = Math.max(0, items.length - shown.length);
    return (
      <div className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-rose-300/90">
          {title}
        </div>
        <ul className="space-y-0.5 text-[11px] list-disc list-inside text-rose-100/95">
          {shown.map((err, i) => (
            <li key={`${title}-${err}-${i}`} className="leading-snug">
              <span className="font-mono">{err}</span>
            </li>
          ))}
        </ul>
        {extra > 0 && (
          <button
            type="button"
            onClick={() => setState({ showAllErrors: true })}
            className="text-[10px] font-medium text-[#06b6d4] hover:underline cursor-pointer"
          >
            +{extra} more
          </button>
        )}
      </div>
    );
  };

  const renderHudOverlay = () => {
    if (state.status === "idle") return null;

    const cardSurface = isDark
      ? "bg-[#0f172a]/95 border-slate-700/90 text-slate-100 shadow-xl shadow-black/50"
      : "bg-white/95 border-slate-300 text-slate-900 shadow-lg shadow-slate-900/10";

    const subtleText = isDark ? "text-slate-400" : "text-slate-500";
    const mutedBg = isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-100 border-slate-200";

    const totalDetectedCount = state.found
      ? state.found.components.length + state.found.connections.length
      : 0;
    const activeDetectedCount = Math.max(
      0,
      totalDetectedCount -
        state.excludedComponents.length -
        state.excludedConnections.length,
    );

    const isLockedForCodegen = state.generatedSketch !== null;

    const phaseSubtext = state.longWait
      ? "Still thinking… this can take up to a minute"
      : state.scanPhase === "preparing"
        ? "Preparing your photo"
        : state.scanPhase === "checking"
          ? "Checking against the digital twin"
          : "Reading the circuit";

    return (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute top-14 right-3 z-30 w-96 max-w-[calc(100%-1.5rem)] max-h-[calc(100%-4.25rem)] flex flex-col motion-safe:transition-opacity motion-safe:duration-150"
      >
        <div
          className={`pointer-events-auto rounded-xl border backdrop-blur-md overflow-hidden flex flex-col max-h-full ${cardSurface}`}
        >
          {/* Card Header */}
          <div
            className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 shrink-0 ${
              isDark ? "border-slate-800" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 h-5">
              {state.status === "scanning" && (
                <Loader2 className="w-4 h-4 text-slate-300 motion-safe:animate-spin shrink-0" />
              )}
              {state.status === "done" && state.report?.passed && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              {state.status === "done" && state.report && !state.report.passed && (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              {state.status === "error" && (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              )}

              <span className="font-semibold text-xs truncate">
                {state.status === "scanning"
                  ? "Thinking…"
                  : state.status === "done" && state.report?.passed
                    ? "Physical Twin Verified"
                    : state.status === "done"
                      ? "Mismatch Detected"
                      : "Breadboard Scan Issue"}
              </span>

              {state.mockMode && (
                <span className="px-1.5 py-0.5 rounded border border-[#06b6d4]/40 bg-[#06b6d4]/15 text-[#06b6d4] font-mono text-[10px] shrink-0">
                  Demo
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setState({ collapsed: !state.collapsed })}
                title={state.collapsed ? "Expand verification details" : "Collapse card"}
                aria-label={state.collapsed ? "Expand verification details" : "Collapse card"}
                className={`p-1 rounded-md transition cursor-pointer ${
                  isDark
                    ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    : "hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                }`}
              >
                {state.collapsed ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronUp className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                title="Dismiss (Esc)"
                aria-label="Dismiss verification panel"
                className={`p-1 rounded-md transition cursor-pointer ${
                  isDark
                    ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                    : "hover:bg-slate-100 text-slate-500 hover:text-slate-800"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Card Body */}
          {!state.collapsed && (
            <div className="p-3.5 space-y-3 text-xs overflow-y-auto">
              {/* Thumbnail + File metadata (no model names shown here) */}
              {state.previewUrl && (
                <div className={`flex items-center gap-2.5 p-2 rounded-lg border ${mutedBg}`}>
                  <img
                    src={state.previewUrl}
                    alt="Scanned breadboard thumbnail"
                    className="w-12 h-9 object-cover rounded border border-slate-700 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate text-[11px]">
                      {state.fileName ?? "breadboard.jpg"}
                    </div>
                    <div className={`text-[10px] ${subtleText}`}>
                      {state.mockMode ? "Demo Twin · 1280px JPEG" : "1280px JPEG"}
                    </div>
                  </div>
                </div>
              )}

              {/* Calm Thinking state with real phase subtext + Cancel button */}
              {state.status === "scanning" && (
                <div className="flex items-center justify-between gap-2 min-h-[24px]">
                  <p
                    key={phaseSubtext}
                    className={`text-[11px] h-5 flex items-center truncate motion-safe:transition-opacity motion-safe:duration-150 ${subtleText}`}
                  >
                    {phaseSubtext}
                  </p>
                  <button
                    type="button"
                    onClick={handleCancelOrDismiss}
                    aria-label="Cancel breadboard scan"
                    className={`px-2 py-1 rounded-md border text-[11px] font-medium shrink-0 transition cursor-pointer ${
                      isDark
                        ? "border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200"
                        : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800"
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {/* Done: PASS */}
              {state.status === "done" && state.report && state.report.passed && (
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-medium leading-snug">
                        Verification passed — physical circuit matches the digital twin.
                      </p>
                      <p className="font-mono text-[11px] text-emerald-300/90">
                        {state.report.matched}/{state.report.total} checks matched (
                        {expected.components.length} parts · {expected.connections.length} nets)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Done: FAIL (Grouped: Components / Wiring / Power) */}
              {state.status === "done" && state.report && !state.report.passed && (
                <div className="space-y-1.5">
                  <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-300">Mismatch detected</span>
                      <span className="font-mono text-[11px] text-rose-300">
                        {state.report.matched}/{state.report.total} matched
                      </span>
                    </div>
                    {renderErrorGroup("Components", state.report.groupedErrors.components)}
                    {renderErrorGroup("Wiring", state.report.groupedErrors.wiring)}
                    {renderErrorGroup("Power", state.report.groupedErrors.power)}
                  </div>
                </div>
              )}

              {/* Collapsed "Details" row in result HUD for Model & timing */}
              {state.status === "done" && state.modelShortName && (
                <div>
                  <button
                    type="button"
                    onClick={() => setState({ detailsExpanded: !state.detailsExpanded })}
                    className={`inline-flex items-center gap-1 text-[10px] ${subtleText} hover:underline cursor-pointer`}
                  >
                    {state.detailsExpanded ? (
                      <ChevronUp className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    <span>Details</span>
                  </button>
                  {state.detailsExpanded && (
                    <div className={`mt-1 text-[10px] font-mono ${subtleText}`}>
                      Model: {state.modelShortName}
                      {state.elapsedSec !== null ? ` · ${state.elapsedSec}s` : ""}
                    </div>
                  )}
                </div>
              )}

              {/* Collapsible "Detected circuit" list + Generate Arduino code section */}
              {state.status === "done" && state.found && (
                <div className={`rounded-lg border ${mutedBg} overflow-hidden`}>
                  <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setState({ detectedExpanded: !state.detectedExpanded })}
                      className="flex items-center gap-1.5 text-left font-medium text-[11px] cursor-pointer"
                    >
                      {state.detectedExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>Detected circuit</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                        Detected {activeDetectedCount}/{totalDetectedCount}
                      </span>
                    </button>

                    {isLockedForCodegen && (
                      <button
                        type="button"
                        onClick={() =>
                          setState({
                            generatedSketch: null,
                            deterministicCode: null,
                            explainStatusMsg: null,
                            detectedExpanded: true,
                          })
                        }
                        className="text-[10px] text-[#06b6d4] hover:underline cursor-pointer"
                      >
                        Edit detections
                      </button>
                    )}
                  </div>

                  {state.detectedExpanded && (
                    <div
                      className={`px-2.5 pb-2.5 pt-1 border-t space-y-2 max-h-40 overflow-y-auto ${
                        isDark ? "border-slate-800" : "border-slate-200"
                      }`}
                    >
                      {state.found.components.length > 0 && (
                        <div className="space-y-1">
                          <div className={`text-[10px] font-medium ${subtleText}`}>
                            Components ({state.found.components.length})
                          </div>
                          {state.found.components.map((comp, idx) => {
                            const checked = !state.excludedComponents.includes(idx);
                            return (
                              <label
                                key={`comp-${comp.type}-${comp.label ?? idx}`}
                                className={`flex items-center gap-2 text-[11px] font-mono ${
                                  isLockedForCodegen
                                    ? "opacity-70 cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isLockedForCodegen}
                                  onChange={() => handleToggleComponent(idx)}
                                  className="rounded border-slate-600 accent-[#06b6d4]"
                                />
                                <span className={checked ? "" : "line-through opacity-50"}>
                                  {comp.label ? `${comp.label} (${comp.type})` : comp.type}
                                  {comp.value ? ` · ${comp.value}` : ""}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {state.found.connections.length > 0 && (
                        <div className="space-y-1">
                          <div className={`text-[10px] font-medium ${subtleText}`}>
                            Connections ({state.found.connections.length})
                          </div>
                          {state.found.connections.map((conn, idx) => {
                            const checked = !state.excludedConnections.includes(idx);
                            return (
                              <label
                                key={`conn-${conn.from}-${conn.to}-${idx}`}
                                className={`flex items-center gap-2 text-[11px] font-mono ${
                                  isLockedForCodegen
                                    ? "opacity-70 cursor-not-allowed"
                                    : "cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isLockedForCodegen}
                                  onChange={() => handleToggleConnection(idx)}
                                  className="rounded border-slate-600 accent-[#06b6d4]"
                                />
                                <span className={checked ? "" : "line-through opacity-50"}>
                                  {conn.from} ↔ {conn.to}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Primary Button: Generate Arduino code */}
              {state.status === "done" && state.found && (
                <div className="space-y-2.5">
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    aria-label="Generate Arduino code from scanned circuit"
                    className="w-full py-1.5 px-3 rounded-lg bg-[#06b6d4] hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Generate Arduino code</span>
                  </button>

                  {state.generatedSketch && (
                    <div className="space-y-2">
                      {/* Secondary Action Buttons: Copy, Download .ino, Send to editor, Explain */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void handleCopyCode()}
                          aria-label="Copy generated Arduino code"
                          className={`px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
                            isDark
                              ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                              : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800"
                          }`}
                        >
                          {state.copied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleDownloadIno}
                          aria-label="Download .ino sketch file"
                          className={`px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
                            isDark
                              ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                              : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800"
                          }`}
                        >
                          <Download className="w-3 h-3" />
                          <span>Download .ino</span>
                        </button>

                        {onSendToEditor && (
                          <button
                            type="button"
                            onClick={handleSendToEditor}
                            aria-label="Send generated sketch to code editor"
                            className={`px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer ${
                              state.sentToEditor
                                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                : "border-[#06b6d4]/40 bg-[#06b6d4]/15 hover:bg-[#06b6d4]/25 text-[#06b6d4]"
                            }`}
                          >
                            {state.sentToEditor ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Sent to editor</span>
                              </>
                            ) : (
                              <>
                                <Send className="w-3 h-3" />
                                <span>Send to editor</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={state.mockMode || state.explaining}
                          onClick={() => void handleExplainWithMuseSpark()}
                          title={
                            state.mockMode
                              ? "Explain with Muse Spark requires live API mode (disabled in offline Demo mode)"
                              : "Add concise line-by-line comments with Muse Spark"
                          }
                          aria-label="Explain sketch with Muse Spark"
                          className={`px-2 py-1 rounded-md border text-[11px] font-medium flex items-center gap-1 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
                            isDark
                              ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                              : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800"
                          }`}
                        >
                          {state.explaining ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin text-[#06b6d4]" />
                              <span>Explaining…</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-[#06b6d4]" />
                              <span>Explain with Muse Spark</span>
                            </>
                          )}
                        </button>
                      </div>

                      {state.explainStatusMsg && (
                        <div className={`text-[10px] font-mono ${subtleText}`}>
                          {state.explainStatusMsg}
                        </div>
                      )}

                      {/* Read-only scrollable code preview (max-height 240px) */}
                      <pre
                        className={`p-2.5 rounded-lg border font-mono text-[10px] leading-relaxed overflow-auto max-h-[240px] select-all ${
                          isDark
                            ? "bg-[#080c13] border-slate-800 text-slate-200"
                            : "bg-slate-900 border-slate-300 text-slate-100"
                        }`}
                      >
                        <code>{state.generatedSketch.code}</code>
                      </pre>

                      {/* Warnings list (amber) */}
                      {state.generatedSketch.warnings.length > 0 && (
                        <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 space-y-1">
                          <div className="font-semibold text-[10px] uppercase tracking-wider text-amber-300">
                            Warnings ({state.generatedSketch.warnings.length})
                          </div>
                          <ul className="space-y-0.5 text-[11px] list-disc list-inside">
                            {state.generatedSketch.warnings.map((w, i) => (
                              <li key={`warn-${i}`} className="leading-snug">
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Notes list (neutral) */}
                      {state.generatedSketch.notes.length > 0 && (
                        <div className={`p-2 rounded-lg border ${mutedBg} space-y-1`}>
                          <div className={`font-semibold text-[10px] uppercase tracking-wider ${subtleText}`}>
                            Notes
                          </div>
                          <ul className={`space-y-0.5 text-[11px] list-disc list-inside ${subtleText}`}>
                            {state.generatedSketch.notes.map((n, i) => (
                              <li key={`note-${i}`} className="leading-snug">
                                {n}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error state (friendly message + collapsed per-model Details) */}
              {state.status === "error" && (
                <div className="space-y-2">
                  <div className={`p-2.5 rounded-lg border ${mutedBg} space-y-1.5`}>
                    <div className="font-medium text-amber-300">
                      {state.errorStatus === 503 || state.errorKind === "unconfigured"
                        ? "Server is not configured"
                        : state.errorStatus === 429 || state.errorKind === "rate_limit"
                          ? "Demo limit reached"
                          : state.errorStatus === 413 || state.errorKind === "image_too_large"
                            ? "Photo too large"
                            : "Scan issue"}
                    </div>
                    <p className={`text-[11px] leading-relaxed break-words ${subtleText}`}>
                      {state.errorMsg ??
                        "Couldn't read the circuit. Try a clearer photo or Demo Twin."}
                    </p>
                    {state.errorDetails && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setState({ detailsExpanded: !state.detailsExpanded })}
                          className={`inline-flex items-center gap-1 text-[10px] ${subtleText} hover:underline cursor-pointer`}
                        >
                          {state.detailsExpanded ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )}
                          <span>Details</span>
                        </button>
                        {state.detailsExpanded && (
                          <div className={`mt-1 text-[10px] font-mono break-words ${subtleText}`}>
                            {state.errorDetails}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* "Use my own key" disclosure (sessionStorage only) */}
              {state.status !== "scanning" && (
                <div className="space-y-1.5 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setState({ keyDisclosureOpen: !state.keyDisclosureOpen })}
                      className={`inline-flex items-center gap-1 text-[10px] ${subtleText} hover:underline cursor-pointer`}
                    >
                      {state.keyDisclosureOpen ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      <span>
                        {state.hasSavedUserKey ? "Use my own key (saved)" : "Use my own key"}
                      </span>
                    </button>
                    {state.hasSavedUserKey && (
                      <button
                        type="button"
                        onClick={handleRemoveUserKey}
                        className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                      >
                        Remove key
                      </button>
                    )}
                  </div>

                  {state.keyDisclosureOpen && (
                    <div className={`p-2 rounded-lg border space-y-1.5 ${mutedBg}`}>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="password"
                          value={userKeyDraft}
                          onChange={(e) => setUserKeyDraft(e.target.value)}
                          placeholder="Fireworks API key"
                          autoComplete="off"
                          aria-label="Fireworks API key"
                          className={`flex-1 min-w-0 px-2 py-1 rounded border text-[11px] font-mono focus:outline-none focus:border-[#06b6d4] ${
                            isDark
                              ? "bg-slate-950 border-slate-700 text-slate-100"
                              : "bg-white border-slate-300 text-slate-900"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={handleSaveUserKey}
                          disabled={!userKeyDraft.trim()}
                          className="px-2.5 py-1 rounded bg-[#06b6d4] hover:bg-cyan-400 disabled:opacity-45 text-slate-950 font-semibold text-[11px] transition cursor-pointer shrink-0"
                        >
                          Save
                        </button>
                        {state.hasSavedUserKey && (
                          <button
                            type="button"
                            onClick={handleRemoveUserKey}
                            className={`px-2 py-1 rounded border text-[11px] transition cursor-pointer shrink-0 ${
                              isDark
                                ? "border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200"
                                : "border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                            }`}
                          >
                            Remove key
                          </button>
                        )}
                      </div>
                      <p className={`text-[10px] leading-snug ${subtleText}`}>
                        Your key stays in this browser tab and is sent only to our proxy to call
                        Fireworks.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Actions */}
              {state.status !== "scanning" && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                        fileInputRef.current.click();
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      isDark
                        ? "border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200"
                        : "border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800"
                    }`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Try again</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setState({ mockMode: true });
                      void runVerification(null, true);
                    }}
                    title="Run deterministic verification against current circuit"
                    className="px-2.5 py-1.5 rounded-lg bg-[#06b6d4]/15 hover:bg-[#06b6d4]/25 border border-[#06b6d4]/40 text-[#06b6d4] text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Verify with Demo Twin</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (mode === "trigger") {
    return renderTriggerButton();
  }

  if (mode === "hud") {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Upload or capture breadboard photo"
        />
        {renderHudOverlay()}
      </>
    );
  }

  return (
    <>
      {renderTriggerButton()}
      {renderHudOverlay()}
    </>
  );
}
