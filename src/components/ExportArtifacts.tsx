/**
 * @license Apache-2.0
 * Multi-Format Artifact Export Panel powered by @s2c/export.
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import {
  exportBomCsv,
  exportKicadNetlist,
  formatWiringTableAscii,
  formatWiringTableMarkdown,
  generateBom,
  generateSynthesisReport,
  generateWiringTable,
} from "@s2c/export";
import {
  Check,
  ClipboardCopy,
  Download,
  FileCode,
  FileSpreadsheet,
  FileText,
  ListOrdered,
  Share2,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

interface ExportArtifactsProps {
  circuit: Circuit;
  diagnostics: Diagnostic[];
  sketchName?: string;
  sourceCode?: string;
}

export const ExportArtifacts: React.FC<ExportArtifactsProps> = ({
  circuit,
  diagnostics,
  sketchName = "SketchCircuit",
  sourceCode = "",
}) => {
  const [activeExportTab, setActiveExportTab] = useState<
    "kicad" | "bom" | "wiring" | "report" | "circuit_json"
  >("wiring");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 1. KiCad Netlist (.kicad.net)
  const kicadNetlist = useMemo(() => {
    try {
      return exportKicadNetlist(circuit);
    } catch (e: unknown) {
      return `; Error generating netlist: ${(e as Error).message}`;
    }
  }, [circuit]);

  // 2. Bill of Materials
  const bomRows = useMemo(() => generateBom(circuit), [circuit]);
  const bomCsv = useMemo(() => exportBomCsv(bomRows), [bomRows]);

  // 3. Wiring Table
  const wiringRows = useMemo(() => generateWiringTable(circuit), [circuit]);
  const wiringMarkdown = useMemo(() => formatWiringTableMarkdown(wiringRows), [wiringRows]);
  const _wiringAscii = useMemo(() => formatWiringTableAscii(wiringRows), [wiringRows]);

  // 4. Full Synthesis Report
  const synthesisReport = useMemo(() => {
    return generateSynthesisReport(circuit, {
      title: `${sketchName} Synthesis Report`,
      sourceFile: `${sketchName}.ino`,
      sketchSource: sourceCode,
      diagnostics,
    });
  }, [circuit, sketchName, sourceCode, diagnostics]);

  // 5. Canonical Circuit JSON
  const circuitJsonFormatted = useMemo(() => {
    return JSON.stringify(circuit, null, 2);
  }, [circuit]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveExportTab("wiring")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeExportTab === "wiring"
                ? "bg-indigo-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Wiring Table</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab("bom")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeExportTab === "bom"
                ? "bg-indigo-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>BOM ({bomRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab("kicad")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeExportTab === "kicad"
                ? "bg-indigo-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>KiCad Netlist (.net)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab("report")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeExportTab === "report"
                ? "bg-indigo-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Synthesis Report</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab("circuit_json")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              activeExportTab === "circuit_json"
                ? "bg-indigo-600 text-white font-medium"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Circuit JSON IR</span>
          </button>
        </div>

        {/* Global Tab Actions */}
        <div className="flex items-center gap-2">
          {activeExportTab === "wiring" && (
            <button
              type="button"
              onClick={() => copyToClipboard(wiringMarkdown, "wiring_md")}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 text-[11px]"
            >
              {copiedKey === "wiring_md" ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <ClipboardCopy className="w-3 h-3" />
              )}
              <span>Copy Table (MD)</span>
            </button>
          )}

          {activeExportTab === "bom" && (
            <button
              type="button"
              onClick={() => downloadFile(bomCsv, `${sketchName}_bom.csv`, "text/csv")}
              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1 text-[11px] font-medium"
            >
              <Download className="w-3 h-3" />
              <span>Download CSV</span>
            </button>
          )}

          {activeExportTab === "kicad" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyToClipboard(kicadNetlist, "kicad_clip")}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 text-[11px]"
              >
                {copiedKey === "kicad_clip" ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <ClipboardCopy className="w-3 h-3" />
                )}
                <span>Copy</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFile(kicadNetlist, `${sketchName}.kicad.net`, "text/plain")}
                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 text-[11px] font-medium"
              >
                <Download className="w-3 h-3" />
                <span>Download .net</span>
              </button>
            </div>
          )}

          {activeExportTab === "report" && (
            <button
              type="button"
              onClick={() =>
                downloadFile(synthesisReport, `${sketchName}_report.md`, "text/markdown")
              }
              className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 text-[11px] font-medium"
            >
              <Download className="w-3 h-3" />
              <span>Download Markdown</span>
            </button>
          )}

          {activeExportTab === "circuit_json" && (
            <button
              type="button"
              onClick={() => copyToClipboard(circuitJsonFormatted, "json_clip")}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 text-[11px]"
            >
              {copiedKey === "json_clip" ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <ClipboardCopy className="w-3 h-3" />
              )}
              <span>Copy JSON</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-auto p-4 text-xs">
        {/* 1. Wiring Table */}
        {activeExportTab === "wiring" && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-slate-400 leading-relaxed">
              <strong className="text-slate-200">Point-to-Point Breadboard Guide:</strong> Connect
              each jumper wire directly from the source port to the target component pin as
              indicated below.
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-300 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">From Pin / Source</th>
                    <th className="py-2.5 px-3">Target Component</th>
                    <th className="py-2.5 px-3">Terminal</th>
                    <th className="py-2.5 px-3">Net Name</th>
                    <th className="py-2.5 px-3">Wiring Note / Color</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {wiringRows.map((r, i) => (
                    <tr key={`wire-${i}`} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 px-3 font-semibold text-indigo-400">{r.fromPort}</td>
                      <td className="py-2 px-3 text-slate-200">
                        {r.componentRef}{" "}
                        <span className="text-[10px] text-slate-400 font-sans">
                          ({r.componentKind})
                        </span>
                      </td>
                      <td className="py-2 px-3 text-amber-300">{r.terminal}</td>
                      <td className="py-2 px-3 text-slate-400">{r.netId}</td>
                      <td className="py-2 px-3 font-sans text-slate-300">{r.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. BOM Table */}
        {activeExportTab === "bom" && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-950 text-slate-300 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Reference</th>
                    <th className="py-2.5 px-3">Value</th>
                    <th className="py-2.5 px-3">Part Number</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Footprint</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {bomRows.map((b) => (
                    <tr key={`bom-${b.item}`} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 px-3 text-slate-400">{b.item}</td>
                      <td className="py-2 px-3 font-bold text-slate-100">{b.quantity}</td>
                      <td className="py-2 px-3 text-indigo-400">{b.designators.join(", ")}</td>
                      <td className="py-2 px-3 text-amber-300">{b.value || "—"}</td>
                      <td className="py-2 px-3 text-slate-200">{b.partNumber}</td>
                      <td className="py-2 px-3 font-sans text-slate-300">{b.description}</td>
                      <td className="py-2 px-3 text-[11px] text-slate-400">{b.footprint || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. KiCad S-Expression */}
        {activeExportTab === "kicad" && (
          <div className="h-full flex flex-col">
            <pre className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-auto whitespace-pre leading-relaxed">
              {kicadNetlist}
            </pre>
          </div>
        )}

        {/* 4. Synthesis Report */}
        {activeExportTab === "report" && (
          <div className="h-full flex flex-col">
            <pre className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 overflow-auto whitespace-pre-wrap leading-relaxed">
              {synthesisReport}
            </pre>
          </div>
        )}

        {/* 5. Circuit JSON */}
        {activeExportTab === "circuit_json" && (
          <div className="h-full flex flex-col">
            <pre className="flex-1 bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-auto whitespace-pre leading-relaxed">
              {circuitJsonFormatted}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
