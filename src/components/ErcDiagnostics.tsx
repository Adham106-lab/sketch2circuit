/**
 * @license Apache-2.0
 * ERC Diagnostics Panel component powered by @s2c/rules.
 */

import type { Diagnostic } from "@s2c/circuit-json";
import { DEFAULT_RULES, type RuleDefinition } from "@s2c/rules";
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Info,
  ShieldCheck,
} from "lucide-react";
import type React from "react";
import { useState } from "react";

const ruleMap = new Map<string, RuleDefinition>(DEFAULT_RULES.map((r) => [r.id, r]));
function getRuleDefinition(id: string): RuleDefinition | undefined {
  return ruleMap.get(id);
}

interface ErcDiagnosticsProps {
  diagnostics: Diagnostic[];
}

export const ErcDiagnostics: React.FC<ErcDiagnosticsProps> = ({ diagnostics }) => {
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const [activeRuleModal, setActiveRuleModal] = useState<string | null>(null);

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
  const infoCount = diagnostics.filter((d) => d.severity === "info").length;

  const filteredDiagnostics = diagnostics.filter((d) => {
    if (filter === "all") return true;
    return d.severity === filter;
  });

  const selectedRuleDef = activeRuleModal ? getRuleDefinition(activeRuleModal) : null;

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-lg ${
              errorCount > 0
                ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                : warningCount > 0
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            }`}
          >
            {errorCount > 0 ? (
              <AlertCircle className="w-5 h-5" />
            ) : warningCount > 0 ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-sm text-slate-100 flex items-center gap-2">
              Electrical Rules Check (ERC)
              {errorCount === 0 && warningCount === 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                  PASSED
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-400">
              Deterministic 18-rule physics &amp; electrical rating validation
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 text-xs bg-slate-900 p-1 rounded-lg border border-slate-800">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded transition ${
              filter === "all"
                ? "bg-slate-800 text-slate-100 font-medium"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            All ({diagnostics.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("error")}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
              filter === "error"
                ? "bg-rose-500/20 text-rose-300 font-medium border border-rose-500/30"
                : "text-slate-400 hover:text-rose-300"
            }`}
          >
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Errors ({errorCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("warning")}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
              filter === "warning"
                ? "bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30"
                : "text-slate-400 hover:text-amber-300"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Warnings ({warningCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("info")}
            className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
              filter === "info"
                ? "bg-sky-500/20 text-sky-300 font-medium border border-sky-500/30"
                : "text-slate-400 hover:text-sky-300"
            }`}
          >
            <Info className="w-3.5 h-3.5 text-sky-400" />
            Notices ({infoCount})
          </button>
        </div>
      </div>

      {/* Diagnostics List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredDiagnostics.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3 opacity-80" />
            <h4 className="font-semibold text-slate-200">Zero Violations Detected</h4>
            <p className="text-xs text-slate-400 max-w-sm mt-1">
              All 18 electrical rules passed cleanly. The circuit obeys voltage ratings, current
              limits, pin directional compatibility, and power distribution.
            </p>
          </div>
        ) : (
          filteredDiagnostics.map((diag, idx) => {
            const isError = diag.severity === "error";
            const isWarning = diag.severity === "warning";

            return (
              <div
                key={`${diag.ruleId}-${idx}`}
                className={`p-4 rounded-xl border transition ${
                  isError
                    ? "bg-rose-950/20 border-rose-500/30 text-rose-100"
                    : isWarning
                      ? "bg-amber-950/20 border-amber-500/30 text-amber-100"
                      : "bg-sky-950/20 border-sky-500/30 text-sky-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {isError ? (
                        <AlertCircle className="w-4 h-4 text-rose-400" />
                      ) : isWarning ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Info className="w-4 h-4 text-sky-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                          {diag.ruleId}
                        </span>
                        {diag.target && (
                          <span className="text-xs font-mono text-slate-300">
                            Target: <span className="font-bold">{diag.target.id}</span> (
                            {diag.target.type})
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-1.5 text-slate-100">{diag.message}</p>
                      {diag.explanation && (
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          <strong className="text-slate-300">Physics &amp; Rating:</strong>{" "}
                          {diag.explanation}
                        </p>
                      )}
                      {diag.suggestion && (
                        <div className="mt-2 text-xs bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 text-emerald-300 flex items-start gap-2">
                          <span className="font-semibold text-emerald-400 shrink-0">
                            Remediation:
                          </span>
                          <span>{diag.suggestion}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveRuleModal(diag.ruleId)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition shrink-0"
                    title="View Rule Specification & Physics"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Rule Details Modal */}
      {selectedRuleDef && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  {selectedRuleDef.id}
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-2">{selectedRuleDef.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveRuleModal(null)}
                className="text-slate-400 hover:text-slate-200 text-lg font-mono p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
              <div>
                <h4 className="font-semibold text-slate-100 mb-1">
                  Standard Severity &amp; Category:
                </h4>
                <div className="flex gap-2">
                  <span className="capitalize px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300">
                    {selectedRuleDef.defaultSeverity}
                  </span>
                  <span className="capitalize px-2 py-0.5 rounded bg-slate-800 font-mono text-slate-300">
                    {selectedRuleDef.category}
                  </span>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-100 mb-1">Specification &amp; Physics:</h4>
                <p className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {selectedRuleDef.description}
                </p>
              </div>

              {selectedRuleDef.formula && (
                <div>
                  <h4 className="font-semibold text-slate-100 mb-1">Governing Formula:</h4>
                  <pre className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-indigo-300">
                    {selectedRuleDef.formula}
                  </pre>
                </div>
              )}

              {selectedRuleDef.remediation && (
                <div>
                  <h4 className="font-semibold text-slate-100 mb-1">Engineering Remediation:</h4>
                  <p className="bg-emerald-950/20 text-emerald-300 p-2.5 rounded-lg border border-emerald-500/30">
                    {selectedRuleDef.remediation}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveRuleModal(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
              >
                Close Rule Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
