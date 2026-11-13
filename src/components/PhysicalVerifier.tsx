/**
 * @license Apache-2.0
 * PhysicalVerifier — Physical breadboard camera/file scanner + non-blocking 3D HUD verification card.
 */

import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
  XCircle,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzePhysicalCircuit,
  downscaleImageFile,
  isVisionConfigured,
  mockScan,
  ScanError,
  type ScanResult,
  type ScanVerificationReport,
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
}

type VerifierStatus = "idle" | "scanning" | "done" | "error";

interface SharedScanState {
  status: VerifierStatus;
  mockMode: boolean;
  previewUrl: string | null;
  fileName: string | null;
  report: ScanVerificationReport | null;
  found: ScanResult | null;
  errorMsg: string | null;
  errorKind: string | null;
  collapsed: boolean;
  showAllErrors: boolean;
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
  report: null,
  found: null,
  errorMsg: null,
  errorKind: null,
  collapsed: false,
  showAllErrors: false,
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

export function PhysicalVerifier({
  expected,
  theme = "dark",
  mode = "full",
}: PhysicalVerifierProps) {
  const [state, setState] = useSharedScanState();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expectedRef = useRef<ScanResult>(expected);
  expectedRef.current = expected;

  const isDark = theme === "dark";
  const visionConfigured = isVisionConfigured();

  // Re-verify automatically if the user edits the sketch while a scan result is open
  useEffect(() => {
    if (state.status === "done" && state.found) {
      const updatedReport = verifyScan(expected, state.found);
      setState({ report: updatedReport });
    }
  }, [expected, state.status, state.found, setState]);

  // Escape key dismisses the HUD overlay
  useEffect(() => {
    if (mode === "trigger") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && sharedState.status !== "idle") {
        if (activeAbortController) {
          activeAbortController.abort();
          activeAbortController = null;
        }
        setState({
          status: "idle",
          report: null,
          found: null,
          errorMsg: null,
          errorKind: null,
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, setState]);

  // Abort in-flight scan only when the last mounted instance unmounts
  useEffect(() => {
    return () => {
      if (listeners.size === 0 && activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
    };
  }, []);

  const runVerification = useCallback(
    async (file: File | null, forceMock?: boolean) => {
      if (activeAbortController) {
        activeAbortController.abort();
      }
      const controller = new AbortController();
      activeAbortController = controller;

      const useMock = forceMock ?? sharedState.mockMode;

      setState({
        status: "scanning",
        fileName: file ? file.name : "demo-breadboard.jpg",
        report: null,
        found: null,
        errorMsg: null,
        errorKind: null,
        collapsed: false,
        showAllErrors: false,
      });

      try {
        let base64 = "";
        let mime = "image/jpeg";

        if (file) {
          const prepared = await downscaleImageFile(file, 1280, 0.85);
          base64 = prepared.base64;
          mime = prepared.mime;
          setState({ previewUrl: prepared.previewUrl });
        } else {
          setState({ previewUrl: null });
        }

        let scanResult: ScanResult;
        if (useMock) {
          scanResult = await mockScan(expectedRef.current, controller.signal);
        } else {
          if (!isVisionConfigured()) {
            throw new ScanError(
              "unconfigured",
              "Vision API not configured. Set VITE_FIREWORKS_API_KEY or VITE_VISION_PROXY_URL, or switch to Demo mode.",
            );
          }
          scanResult = await analyzePhysicalCircuit(base64, mime, controller.signal);
        }

        if (controller.signal.aborted) return;

        const verification = verifyScan(expectedRef.current, scanResult);
        setState({
          status: "done",
          found: scanResult,
          report: verification,
          errorMsg: null,
          errorKind: null,
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        const kind = err instanceof ScanError ? err.kind : "network";
        const message =
          err instanceof Error
            ? err.message
            : "Unexpected error while analyzing the breadboard image.";
        setState({
          status: "error",
          errorKind: kind,
          errorMsg: message,
          report: null,
        });
      } finally {
        if (activeAbortController === controller) {
          activeAbortController = null;
        }
      }
    },
    [setState],
  );

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    // Shift+click secretly toggles deterministic Demo / Mock mode
    if (e.shiftKey) {
      e.preventDefault();
      const nextMock = !state.mockMode;
      setState({ mockMode: nextMock });
      return;
    }
    if (state.status === "scanning") return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void runVerification(file);
  };

  const handleDismiss = () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
    setState({
      status: "idle",
      report: null,
      found: null,
      errorMsg: null,
      errorKind: null,
    });
  };

  const renderTriggerButton = () => (
    <div className="inline-flex items-center gap-1.5 shrink-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
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
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#06b6d4] shrink-0" />
            <span>Scanning…</span>
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

  const renderHudOverlay = () => {
    if (state.status === "idle") return null;

    const cardSurface = isDark
      ? "bg-[#0f172a]/95 border-slate-700/90 text-slate-100 shadow-xl shadow-black/50"
      : "bg-white/95 border-slate-300 text-slate-900 shadow-lg shadow-slate-900/10";

    const subtleText = isDark ? "text-slate-400" : "text-slate-500";
    const mutedBg = isDark ? "bg-slate-900/90 border-slate-800" : "bg-slate-100 border-slate-200";

    const visibleErrors = state.report
      ? state.showAllErrors
        ? state.report.errors
        : state.report.errors.slice(0, 6)
      : [];
    const hiddenErrorCount = state.report
      ? Math.max(0, state.report.errors.length - visibleErrors.length)
      : 0;

    return (
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none absolute top-14 right-3 z-30 w-80 max-w-[calc(100%-1.5rem)] motion-safe:transition-opacity motion-safe:duration-150"
      >
        <div
          className={`pointer-events-auto rounded-xl border backdrop-blur-md overflow-hidden ${cardSurface}`}
        >
          {/* Card Header */}
          <div
            className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${
              isDark ? "border-slate-800" : "border-slate-200"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              {state.status === "scanning" && (
                <Loader2 className="w-4 h-4 text-[#06b6d4] animate-spin shrink-0" />
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
                  ? "Scanning Physical Circuit…"
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
            <div className="p-3.5 space-y-3 text-xs">
              {/* Thumbnail + File metadata */}
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
                      {state.mockMode
                        ? "Simulated SAM 3.1 + Vision graph"
                        : "Llama 3.2 90B Vision · 1280px JPEG"}
                    </div>
                  </div>
                </div>
              )}

              {/* Scanning state */}
              {state.status === "scanning" && (
                <div className="space-y-1.5">
                  <p className={subtleText}>
                    Extracting breadboard components, resistor bands, and jumper endpoints…
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div className="h-full w-2/3 bg-[#06b6d4] rounded-full animate-pulse" />
                  </div>
                </div>
              )}

              {/* Done: PASS */}
              {state.status === "done" && state.report && state.report.passed && (
                <div className="space-y-2.5">
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

              {/* Done: FAIL */}
              {state.status === "done" && state.report && !state.report.passed && (
                <div className="space-y-2.5">
                  <div className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-rose-300">Mismatch detected</span>
                      <span className="font-mono text-[11px] text-rose-300">
                        {state.report.matched}/{state.report.total} matched
                      </span>
                    </div>
                    <ul className="space-y-1 text-[11px] list-disc list-inside text-rose-100/95">
                      {visibleErrors.map((err, i) => (
                        <li key={`${err}-${i}`} className="leading-snug">
                          <span className="font-mono">{err}</span>
                        </li>
                      ))}
                    </ul>
                    {hiddenErrorCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setState({ showAllErrors: true })}
                        className="text-[11px] font-medium text-[#06b6d4] hover:underline cursor-pointer pt-0.5"
                      >
                        +{hiddenErrorCount} more issue{hiddenErrorCount > 1 ? "s" : ""}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Error state (API / Parse / Unconfigured) */}
              {state.status === "error" && (
                <div className="space-y-2.5">
                  <div className={`p-2.5 rounded-lg border ${mutedBg} space-y-1`}>
                    <div className="font-medium text-amber-300">
                      {!visionConfigured || state.errorKind === "unconfigured"
                        ? "Vision API not configured"
                        : "Could not complete vision scan"}
                    </div>
                    <p className={`text-[11px] leading-relaxed ${subtleText}`}>
                      {state.errorMsg ?? "Check your network connection or API configuration."}
                    </p>
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              {state.status !== "scanning" && (
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
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
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
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
