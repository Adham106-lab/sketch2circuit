/**
 * @license Apache-2.0
 * Multi-Format Artifact Export Panel powered by @s2c/export.
 * Features a dynamic Bill of Materials (BOM) engine with parts catalog enrichment,
 * category filtering, real-time search, multi-format exports (CSV, TSV, Markdown, JSON),
 * and an engineering drafting CAD aesthetic.
 */

import type { Circuit, Component, Diagnostic } from "@s2c/circuit-json";
import {
  type BomRow,
  exportBomCsv,
  exportKicadNetlist,
  formatBomMarkdown,
  formatWiringTableAscii,
  formatWiringTableMarkdown,
  generateBom,
  generateSynthesisReport,
  generateWiringTable,
  type WiringRow,
} from "@s2c/export";
import { getPartDefinition } from "@s2c/parts";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Cpu,
  Download,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileText,
  ListOrdered,
  Search,
  Share2,
  Table,
} from "lucide-react";
import React, { useMemo, useState } from "react";

interface ExportArtifactsProps {
  circuit: Circuit;
  diagnostics: Diagnostic[];
  sketchName?: string;
  sourceCode?: string;
}

export type BomCategory =
  | "all"
  | "mcu"
  | "passive"
  | "semiconductor"
  | "sensor"
  | "module"
  | "other";

export interface EnrichedBomRow extends BomRow {
  category: BomCategory;
  datasheetUrl?: string;
  catalogName?: string;
  verified?: boolean;
  components: Component[];
}

/**
 * Categorizes a component into high-level BOM categories.
 */
function classifyCategory(kind: string): BomCategory {
  const k = kind.toLowerCase();
  if (
    k.includes("mcu") ||
    k.includes("microcontroller") ||
    k.includes("arduino") ||
    k.includes("esp32")
  ) {
    return "mcu";
  }
  if (
    k.includes("resistor") ||
    k.includes("capacitor") ||
    k.includes("potentiometer") ||
    k.includes("inductor")
  ) {
    return "passive";
  }
  if (
    k.includes("led") ||
    k.includes("diode") ||
    k.includes("transistor") ||
    k.includes("mosfet")
  ) {
    return "semiconductor";
  }
  if (k.includes("sensor") || k.includes("ldr") || k.includes("ultrasonic") || k.includes("temp")) {
    return "sensor";
  }
  if (
    k.includes("module") ||
    k.includes("relay") ||
    k.includes("buzzer") ||
    k.includes("motor") ||
    k.includes("servo") ||
    k.includes("i2c")
  ) {
    return "module";
  }
  return "other";
}

/**
 * Exports BOM as TSV (Tab-Separated Values) for copy-pasting directly into Excel/Google Sheets.
 */
function exportBomTsv(rows: BomRow[]): string {
  const headers = ["Item", "Qty", "Reference", "Value", "Part Number", "Description", "Footprint"];
  const lines = [headers.join("\t")];
  for (const r of rows) {
    lines.push(
      [
        r.item,
        r.quantity,
        r.designators,
        r.value || "—",
        r.partNumber,
        r.description,
        r.footprint || "—",
      ].join("\t"),
    );
  }
  return lines.join("\n");
}

export const ExportArtifacts: React.FC<ExportArtifactsProps> = ({
  circuit,
  diagnostics,
  sketchName = "SketchCircuit",
  sourceCode = "",
}) => {
  const [activeExportTab, setActiveExportTab] = useState<
    "bom" | "wiring" | "kicad" | "report" | "circuit_json"
  >("bom");

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [bomSearch, setBomSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<BomCategory>("all");
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  // 1. Dynamic Enriched Bill of Materials
  const enrichedBomRows: EnrichedBomRow[] = useMemo(() => {
    const rawBom = generateBom(circuit);
    if (!rawBom || rawBom.length === 0) return [];

    return rawBom.map((row) => {
      // Find matching physical circuit components
      const desigList = row.designators.split(",").map((s) => s.trim());
      const matchedComps = circuit.components.filter((c) => desigList.includes(c.id));
      const firstComp = matchedComps[0];
      const kind = firstComp?.kind || "generic";
      const category = classifyCategory(kind);

      // Query catalog for rich specifications
      const catalogQuery = row.partNumber || firstComp?.partNumber || kind || firstComp?.id;
      const catDef =
        getPartDefinition(catalogQuery) ||
        getPartDefinition(kind) ||
        (firstComp?.partNumber ? getPartDefinition(firstComp.partNumber) : undefined);

      let enrichedDesc = row.description;
      if (!enrichedDesc || enrichedDesc === "—" || enrichedDesc === kind) {
        if (catDef?.description) {
          enrichedDesc = catDef.description;
        } else if (kind === "resistor") {
          enrichedDesc = `${row.value !== "—" ? row.value : ""} Current-Limiting Resistor`.trim();
        } else if (kind === "led") {
          enrichedDesc = `${row.value !== "—" ? row.value : "Standard 5mm"} Indicator LED`.trim();
        } else if (kind === "capacitor") {
          enrichedDesc =
            `${row.value !== "—" ? row.value : ""} Ceramic/Electrolytic Capacitor`.trim();
        } else if (firstComp?.name) {
          enrichedDesc = firstComp.name;
        }
      }

      const footprint =
        row.footprint || firstComp?.footprint || catDef?.defaultFootprint || "Generic THT/SMD";

      return {
        ...row,
        description: enrichedDesc,
        footprint,
        category,
        datasheetUrl: catDef?.datasheetUrl,
        catalogName: catDef?.name,
        verified: catDef?.verified ?? firstComp?.verified ?? false,
        components: matchedComps,
      };
    });
  }, [circuit]);

  // Filtered BOM rows based on search and category
  const filteredBomRows = useMemo(() => {
    return enrichedBomRows.filter((r) => {
      const matchCategory = selectedCategory === "all" || r.category === selectedCategory;
      const q = bomSearch.toLowerCase().trim();
      if (!q) return matchCategory;

      const matchSearch =
        r.designators.toLowerCase().includes(q) ||
        r.partNumber.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.value.toLowerCase().includes(q) ||
        r.footprint?.toLowerCase().includes(q) ||
        r.catalogName?.toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [enrichedBomRows, selectedCategory, bomSearch]);

  // Aggregate BOM statistics
  const bomStats = useMemo(() => {
    const totalUnits = enrichedBomRows.reduce((acc, r) => acc + r.quantity, 0);
    const mcuCount = enrichedBomRows
      .filter((r) => r.category === "mcu")
      .reduce((acc, r) => acc + r.quantity, 0);
    const passiveCount = enrichedBomRows
      .filter((r) => r.category === "passive")
      .reduce((acc, r) => acc + r.quantity, 0);
    const semiconductorCount = enrichedBomRows
      .filter((r) => r.category === "semiconductor")
      .reduce((acc, r) => acc + r.quantity, 0);
    const sensorCount = enrichedBomRows
      .filter((r) => r.category === "sensor")
      .reduce((acc, r) => acc + r.quantity, 0);
    const moduleCount = enrichedBomRows
      .filter((r) => r.category === "module")
      .reduce((acc, r) => acc + r.quantity, 0);

    const mcuRow = enrichedBomRows.find((r) => r.category === "mcu");
    const mcuLabel = mcuRow ? mcuRow.catalogName || mcuRow.partNumber : "N/A (Discrete)";

    return {
      totalLineItems: enrichedBomRows.length,
      totalUnits,
      mcuCount,
      passiveCount,
      semiconductorCount,
      sensorCount,
      moduleCount,
      mcuLabel,
    };
  }, [enrichedBomRows]);

  // BOM export strings
  const bomCsv = useMemo(() => exportBomCsv(enrichedBomRows), [enrichedBomRows]);
  const bomTsv = useMemo(() => exportBomTsv(enrichedBomRows), [enrichedBomRows]);
  const bomMarkdown = useMemo(() => formatBomMarkdown(enrichedBomRows), [enrichedBomRows]);
  const _bomJson = useMemo(() => JSON.stringify(enrichedBomRows, null, 2), [enrichedBomRows]);

  // 2. Wiring Table
  const wiringRows: WiringRow[] = useMemo(() => generateWiringTable(circuit), [circuit]);
  const wiringMarkdown = useMemo(() => formatWiringTableMarkdown(wiringRows), [wiringRows]);
  const _wiringAscii = useMemo(() => formatWiringTableAscii(wiringRows), [wiringRows]);

  // 3. KiCad Netlist (.kicad.net)
  const kicadNetlist = useMemo(() => {
    try {
      return exportKicadNetlist(circuit);
    } catch (e: unknown) {
      return `; Error generating netlist: ${(e as Error).message}`;
    }
  }, [circuit]);

  // 4. Synthesis Report
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
    <div
      className="flex flex-col h-full border rounded-none overflow-hidden font-mono text-xs"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-app)",
        color: "var(--text-main)",
      }}
    >
      {/* Top Header / Sub-Navigation */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b"
        style={{
          borderColor: "var(--border-app)",
          backgroundColor: "var(--bg-subpanel)",
        }}
      >
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs">
          <button
            type="button"
            onClick={() => setActiveExportTab("bom")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: activeExportTab === "bom" ? "var(--bg-panel)" : "transparent",
              borderColor: activeExportTab === "bom" ? "var(--border-strong)" : "var(--border-app)",
              color: activeExportTab === "bom" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>BILL OF MATERIALS ({enrichedBomRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab("wiring")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: activeExportTab === "wiring" ? "var(--bg-panel)" : "transparent",
              borderColor:
                activeExportTab === "wiring" ? "var(--border-strong)" : "var(--border-app)",
              color: activeExportTab === "wiring" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>WIRING TABLE ({wiringRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab("kicad")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: activeExportTab === "kicad" ? "var(--bg-panel)" : "transparent",
              borderColor:
                activeExportTab === "kicad" ? "var(--border-strong)" : "var(--border-app)",
              color: activeExportTab === "kicad" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>KICAD NETLIST (.NET)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab("report")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor: activeExportTab === "report" ? "var(--bg-panel)" : "transparent",
              borderColor:
                activeExportTab === "report" ? "var(--border-strong)" : "var(--border-app)",
              color: activeExportTab === "report" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>SYNTHESIS REPORT</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveExportTab("circuit_json")}
            className="px-3 py-1.5 border rounded-none flex items-center gap-1.5 transition font-bold uppercase text-[11px]"
            style={{
              backgroundColor:
                activeExportTab === "circuit_json" ? "var(--bg-panel)" : "transparent",
              borderColor:
                activeExportTab === "circuit_json" ? "var(--border-strong)" : "var(--border-app)",
              color: activeExportTab === "circuit_json" ? "var(--text-main)" : "var(--text-muted)",
            }}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>CIRCUIT JSON IR</span>
          </button>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {activeExportTab === "bom" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyToClipboard(bomCsv, "bom_csv")}
                className="eng-btn"
                title="Copy CSV formatted text"
              >
                {copiedKey === "bom_csv" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--accent-valid)" }} />
                ) : (
                  <ClipboardCopy className="w-3 h-3" />
                )}
                <span>COPY CSV</span>
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(bomTsv, "bom_tsv")}
                className="eng-btn"
                title="Copy TSV formatted text for Excel / Sheets"
              >
                {copiedKey === "bom_tsv" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--accent-valid)" }} />
                ) : (
                  <Table className="w-3 h-3" />
                )}
                <span>COPY TSV</span>
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(bomMarkdown, "bom_md")}
                className="eng-btn"
                title="Copy Markdown table"
              >
                {copiedKey === "bom_md" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--accent-valid)" }} />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                <span>COPY MD</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFile(bomCsv, `${sketchName}_bom.csv`, "text/csv")}
                className="eng-btn primary"
              >
                <Download className="w-3 h-3" />
                <span>DOWNLOAD CSV</span>
              </button>
            </div>
          )}

          {activeExportTab === "wiring" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyToClipboard(wiringMarkdown, "wiring_md")}
                className="eng-btn"
              >
                {copiedKey === "wiring_md" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--accent-valid)" }} />
                ) : (
                  <ClipboardCopy className="w-3 h-3" />
                )}
                <span>COPY TABLE (MD)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFile(wiringMarkdown, `${sketchName}_wiring.md`, "text/markdown")
                }
                className="eng-btn primary"
              >
                <Download className="w-3 h-3" />
                <span>DOWNLOAD WIRING</span>
              </button>
            </div>
          )}

          {activeExportTab === "kicad" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyToClipboard(kicadNetlist, "kicad_clip")}
                className="eng-btn"
              >
                {copiedKey === "kicad_clip" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--accent-valid)" }} />
                ) : (
                  <ClipboardCopy className="w-3 h-3" />
                )}
                <span>COPY</span>
              </button>
              <button
                type="button"
                onClick={() => downloadFile(kicadNetlist, `${sketchName}.kicad.net`, "text/plain")}
                className="eng-btn primary"
              >
                <Download className="w-3 h-3" />
                <span>DOWNLOAD .NET</span>
              </button>
            </div>
          )}

          {activeExportTab === "report" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyToClipboard(synthesisReport, "report_clip")}
                className="eng-btn"
              >
                {copiedKey === "report_clip" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--accent-valid)" }} />
                ) : (
                  <ClipboardCopy className="w-3 h-3" />
                )}
                <span>COPY REPORT</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFile(synthesisReport, `${sketchName}_report.md`, "text/markdown")
                }
                className="eng-btn primary"
              >
                <Download className="w-3 h-3" />
                <span>DOWNLOAD MD</span>
              </button>
            </div>
          )}

          {activeExportTab === "circuit_json" && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyToClipboard(circuitJsonFormatted, "json_clip")}
                className="eng-btn"
              >
                {copiedKey === "json_clip" ? (
                  <Check className="w-3 h-3" style={{ color: "var(--accent-valid)" }} />
                ) : (
                  <ClipboardCopy className="w-3 h-3" />
                )}
                <span>COPY JSON</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  downloadFile(
                    circuitJsonFormatted,
                    `${sketchName}.circuit.json`,
                    "application/json",
                  )
                }
                className="eng-btn primary"
              >
                <Download className="w-3 h-3" />
                <span>DOWNLOAD JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Tab Area */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* ========================================================================= */}
        {/* TAB: BILL OF MATERIALS (BOM)                                              */}
        {/* ========================================================================= */}
        {activeExportTab === "bom" && (
          <div className="space-y-4">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <div
                className="p-3 border rounded-none"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <span
                  className="text-[10px] uppercase font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  TOTAL LINE ITEMS
                </span>
                <p
                  className="font-mono text-base font-bold mt-1"
                  style={{ color: "var(--text-main)" }}
                >
                  {bomStats.totalLineItems} ITEMS
                </p>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Unique component types
                </span>
              </div>

              <div
                className="p-3 border rounded-none"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <span
                  className="text-[10px] uppercase font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  TOTAL UNIT QUANTITY
                </span>
                <p
                  className="font-mono text-base font-bold mt-1"
                  style={{ color: "var(--text-main)" }}
                >
                  {bomStats.totalUnits} UNITS
                </p>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Physical hardware components
                </span>
              </div>

              <div
                className="p-3 border rounded-none"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <span
                  className="text-[10px] uppercase font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  ACTIVE CONTROLLER
                </span>
                <p
                  className="font-mono text-xs font-bold mt-1 truncate"
                  style={{ color: "var(--text-main)" }}
                >
                  {bomStats.mcuLabel}
                </p>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  Primary MCU platform
                </span>
              </div>

              <div
                className="p-3 border rounded-none"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <span
                  className="text-[10px] uppercase font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  PASSIVES &amp; DISCRETES
                </span>
                <p
                  className="font-mono text-base font-bold mt-1"
                  style={{ color: "var(--text-main)" }}
                >
                  {bomStats.passiveCount + bomStats.semiconductorCount} UNITS
                </p>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {bomStats.passiveCount} passives, {bomStats.semiconductorCount} semiconductors
                </span>
              </div>

              <div
                className="p-3 border rounded-none col-span-2 sm:col-span-4 lg:col-span-1"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <span
                  className="text-[10px] uppercase font-bold block"
                  style={{ color: "var(--text-muted)" }}
                >
                  MODULES &amp; SENSORS
                </span>
                <p
                  className="font-mono text-base font-bold mt-1"
                  style={{ color: "var(--text-main)" }}
                >
                  {bomStats.sensorCount + bomStats.moduleCount} UNITS
                </p>
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {bomStats.sensorCount} sensors, {bomStats.moduleCount} modules
                </span>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div
              className="p-3 border rounded-none flex flex-col md:flex-row md:items-center justify-between gap-3"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
              }}
            >
              {/* Search Field */}
              <div className="relative flex-1 max-w-md">
                <Search
                  className="w-3.5 h-3.5 absolute left-3 top-2.5"
                  style={{ color: "var(--text-muted)" }}
                />
                <input
                  type="text"
                  placeholder="FILTER BY DESIGNATOR, PART #, OR DESCRIPTION..."
                  value={bomSearch}
                  onChange={(e) => setBomSearch(e.target.value)}
                  className="w-full border rounded-none pl-8 pr-3 py-1.5 text-xs outline-none uppercase font-mono"
                  style={{
                    backgroundColor: "var(--bg-panel)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-main)",
                  }}
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-1 overflow-x-auto text-[10px] items-center">
                <span
                  className="text-[10px] font-bold mr-1 shrink-0"
                  style={{ color: "var(--text-muted)" }}
                >
                  FILTER:
                </span>
                {(
                  [
                    { id: "all", label: `ALL (${enrichedBomRows.length})` },
                    { id: "mcu", label: `MCU (${bomStats.mcuCount})` },
                    { id: "passive", label: `PASSIVE (${bomStats.passiveCount})` },
                    { id: "semiconductor", label: `SEMI (${bomStats.semiconductorCount})` },
                    { id: "sensor", label: `SENSOR (${bomStats.sensorCount})` },
                    { id: "module", label: `MODULE (${bomStats.moduleCount})` },
                  ] as { id: BomCategory; label: string }[]
                ).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className="px-2 py-0.5 border rounded-none uppercase transition font-bold shrink-0"
                    style={{
                      backgroundColor:
                        selectedCategory === c.id ? "var(--bg-panel)" : "transparent",
                      borderColor:
                        selectedCategory === c.id ? "var(--border-strong)" : "var(--border-app)",
                      color: selectedCategory === c.id ? "var(--text-main)" : "var(--text-muted)",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* BOM Table */}
            {filteredBomRows.length === 0 ? (
              <div
                className="p-8 border rounded-none text-center space-y-2"
                style={{
                  backgroundColor: "var(--bg-subpanel)",
                  borderColor: "var(--border-app)",
                }}
              >
                <Cpu className="w-8 h-8 mx-auto" style={{ color: "var(--text-muted)" }} />
                <h4 className="font-bold text-xs uppercase" style={{ color: "var(--text-main)" }}>
                  {enrichedBomRows.length === 0
                    ? "NO COMPONENTS IN SYNTHESIZED CIRCUIT"
                    : "NO BOM ITEMS MATCH CURRENT FILTER"}
                </h4>
                <p className="text-[11px] max-w-md mx-auto" style={{ color: "var(--text-muted)" }}>
                  {enrichedBomRows.length === 0
                    ? "Synthesize an Arduino sketch in Sketch Studio or select a benchmark preset to dynamically generate the Bill of Materials."
                    : "Adjust your search keywords or clear category filters to view full list of components."}
                </p>
                {bomSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setBomSearch("");
                      setSelectedCategory("all");
                    }}
                    className="eng-btn mt-2"
                  >
                    CLEAR FILTERS
                  </button>
                )}
              </div>
            ) : (
              <div
                className="border rounded-none overflow-x-auto"
                style={{ borderColor: "var(--border-app)" }}
              >
                <table className="w-full text-left border-collapse text-xs">
                  <thead
                    className="uppercase font-mono text-[9px] tracking-wider border-b"
                    style={{
                      backgroundColor: "var(--bg-subpanel)",
                      borderColor: "var(--border-app)",
                      color: "var(--text-muted)",
                    }}
                  >
                    <tr>
                      <th className="py-2.5 px-3 w-12 text-center">ITEM</th>
                      <th className="py-2.5 px-3 w-16 text-center">QTY</th>
                      <th className="py-2.5 px-3">DESIGNATOR(S)</th>
                      <th className="py-2.5 px-3">PART NUMBER</th>
                      <th className="py-2.5 px-3">PART DESCRIPTION</th>
                      <th className="py-2.5 px-3">VALUE / RATING</th>
                      <th className="py-2.5 px-3">FOOTPRINT</th>
                      <th className="py-2.5 px-3 text-right">SPECS</th>
                    </tr>
                  </thead>
                  <tbody
                    className="divide-y font-mono"
                    style={{ borderColor: "var(--border-app)" }}
                  >
                    {filteredBomRows.map((b, bIdx) => {
                      const isExpanded = expandedItem === b.item;
                      return (
                        <React.Fragment key={`bom-row-${b.item}-${b.partNumber}-${bIdx}`}>
                          <tr
                            onClick={() => setExpandedItem(isExpanded ? null : b.item)}
                            className="cursor-pointer transition select-none"
                            style={{
                              backgroundColor: isExpanded
                                ? "var(--bg-subpanel)"
                                : bIdx % 2 === 0
                                  ? "var(--bg-panel)"
                                  : "var(--bg-sunken)",
                            }}
                          >
                            <td
                              className="py-2 px-3 text-center font-bold"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {b.item}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className="px-1.5 py-0.5 border rounded-none font-bold text-[11px]"
                                style={{
                                  borderColor: "var(--border-strong)",
                                  backgroundColor: "var(--bg-panel)",
                                  color: "var(--text-main)",
                                }}
                              >
                                {b.quantity}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex gap-1 flex-wrap items-center">
                                {b.designators.split(",").map((d) => (
                                  <span
                                    key={d.trim()}
                                    className="px-1.5 py-0.2 border rounded-none text-[10px] font-bold"
                                    style={{
                                      borderColor: "var(--border-app)",
                                      backgroundColor: "var(--bg-panel)",
                                      color: "var(--text-main)",
                                    }}
                                  >
                                    {d.trim()}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td
                              className="py-2 px-3 font-bold"
                              style={{ color: "var(--text-main)" }}
                            >
                              {b.partNumber}
                            </td>
                            <td className="py-2 px-3" style={{ color: "var(--text-main)" }}>
                              <div className="flex items-center gap-1.5">
                                <span>{b.description}</span>
                                {b.verified && (
                                  <span
                                    className="text-[9px] px-1 py-0.2 border rounded-none font-bold"
                                    style={{
                                      borderColor: "var(--accent-valid)",
                                      color: "var(--accent-valid)",
                                    }}
                                  >
                                    VERIFIED
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3" style={{ color: "var(--accent-warning)" }}>
                              {b.value || "—"}
                            </td>
                            <td
                              className="py-2 px-3 text-[11px] truncate max-w-xs"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {b.footprint || "—"}
                            </td>
                            <td className="py-2 px-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                {b.datasheetUrl && (
                                  <a
                                    href={b.datasheetUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="p-1 border rounded-none hover:bg-slate-700/20"
                                    style={{
                                      borderColor: "var(--border-app)",
                                      color: "var(--text-muted)",
                                    }}
                                    title="Open Datasheet"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                <span
                                  className="p-1"
                                  style={{ color: "var(--text-muted)" }}
                                  title={isExpanded ? "Collapse" : "Expand details"}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5" />
                                  )}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {isExpanded && (
                            <tr
                              style={{
                                backgroundColor: "var(--bg-sunken)",
                              }}
                            >
                              <td
                                colSpan={8}
                                className="p-4 border-b"
                                style={{ borderColor: "var(--border-app)" }}
                              >
                                <div className="space-y-3">
                                  <div
                                    className="flex items-center justify-between border-b pb-2"
                                    style={{ borderColor: "var(--border-app)" }}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="font-bold uppercase text-[11px]"
                                        style={{ color: "var(--text-main)" }}
                                      >
                                        SYNTHESIZED NETLIST CONNECTIONS ({b.components.length}{" "}
                                        instance{b.components.length > 1 ? "s" : ""})
                                      </span>
                                      <span
                                        className="text-[9px] px-1.5 py-0.2 border rounded-none uppercase font-bold"
                                        style={{
                                          borderColor: "var(--border-app)",
                                          backgroundColor: "var(--bg-panel)",
                                          color: "var(--text-muted)",
                                        }}
                                      >
                                        CATEGORY: {b.category}
                                      </span>
                                    </div>
                                    {b.datasheetUrl && (
                                      <a
                                        href={b.datasheetUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="eng-btn"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                        <span>MANUFACTURER DATASHEET</span>
                                      </a>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {b.components.map((comp, compIdx) => (
                                      <div
                                        key={`${comp.id}-${compIdx}`}
                                        className="p-3 border rounded-none space-y-2"
                                        style={{
                                          backgroundColor: "var(--bg-panel)",
                                          borderColor: "var(--border-app)",
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span
                                            className="font-bold text-xs"
                                            style={{ color: "var(--text-main)" }}
                                          >
                                            DESIGNATOR: {comp.id}
                                          </span>
                                          <span
                                            className="text-[10px]"
                                            style={{ color: "var(--text-muted)" }}
                                          >
                                            {comp.ports.length} PORTS
                                          </span>
                                        </div>

                                        <div className="space-y-1">
                                          <span
                                            className="text-[9px] uppercase font-bold block"
                                            style={{ color: "var(--text-muted)" }}
                                          >
                                            PIN CONNECTIONS &amp; NETS:
                                          </span>
                                          <div className="space-y-1">
                                            {comp.ports.map((pt) => {
                                              // Find connected net
                                              const net = circuit.nets.find((n) =>
                                                n.portIds.includes(`${comp.id}.${pt.name}`),
                                              );
                                              return (
                                                <div
                                                  key={pt.name}
                                                  className="flex items-center justify-between text-[10px] p-1 border rounded-none"
                                                  style={{
                                                    borderColor: "var(--border-app)",
                                                    backgroundColor: "var(--bg-subpanel)",
                                                  }}
                                                >
                                                  <span
                                                    className="font-bold"
                                                    style={{ color: "var(--text-main)" }}
                                                  >
                                                    PIN {pt.name} ({pt.kind})
                                                  </span>
                                                  <span
                                                    className="font-mono text-[9px] px-1 py-0.2 border rounded-none"
                                                    style={{
                                                      borderColor: "var(--border-app)",
                                                      backgroundColor: "var(--bg-sunken)",
                                                      color: net
                                                        ? "var(--text-main)"
                                                        : "var(--text-muted)",
                                                    }}
                                                  >
                                                    {net ? net.id : "UNCONNECTED"}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: POINT-TO-POINT WIRING TABLE                                          */}
        {/* ========================================================================= */}
        {activeExportTab === "wiring" && (
          <div className="space-y-4">
            <div
              className="p-3 border rounded-none leading-relaxed"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
                color: "var(--text-muted)",
              }}
            >
              <strong style={{ color: "var(--text-main)" }}>
                Point-to-Point Breadboard Guide:
              </strong>{" "}
              Connect each jumper wire directly from the source microcontroller port to the target
              component pin as indicated below. Net assignments reflect canonical netlist routing.
            </div>

            <div
              className="overflow-x-auto border rounded-none"
              style={{ borderColor: "var(--border-app)" }}
            >
              <table className="w-full text-left border-collapse text-xs">
                <thead
                  className="uppercase font-mono text-[9px] tracking-wider border-b"
                  style={{
                    backgroundColor: "var(--bg-subpanel)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-muted)",
                  }}
                >
                  <tr>
                    <th className="py-2.5 px-3">FROM PIN / SOURCE</th>
                    <th className="py-2.5 px-3">TARGET COMPONENT</th>
                    <th className="py-2.5 px-3">TERMINAL</th>
                    <th className="py-2.5 px-3">NET NAME</th>
                    <th className="py-2.5 px-3">WIRING NOTE / COLOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono" style={{ borderColor: "var(--border-app)" }}>
                  {wiringRows.map((r, i) => (
                    <tr
                      key={`wire-${r.fromPort}-${r.toPort}-${i}`}
                      className="transition"
                      style={{
                        backgroundColor: i % 2 === 0 ? "var(--bg-panel)" : "var(--bg-sunken)",
                        color: "var(--text-main)",
                      }}
                    >
                      <td
                        className="py-2 px-3 font-bold"
                        style={{ color: "var(--accent-warning)" }}
                      >
                        {r.fromPort}
                      </td>
                      <td className="py-2 px-3">
                        <span className="font-bold">{r.componentRef}</span>{" "}
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          ({r.componentKind})
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold" style={{ color: "var(--text-main)" }}>
                        {r.terminal}
                      </td>
                      <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>
                        {r.netId}
                      </td>
                      <td className="py-2 px-3" style={{ color: "var(--text-main)" }}>
                        {r.notes || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: KICAD NETLIST S-EXPRESSION                                           */}
        {/* ========================================================================= */}
        {activeExportTab === "kicad" && (
          <div className="h-full flex flex-col space-y-2">
            <div
              className="p-2 border rounded-none text-[11px]"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
                color: "var(--text-muted)",
              }}
            >
              Industry-standard KiCad EDA v6+ S-Expression Netlist export (.kicad.net). Ready for
              direct import into KiCad PCB Layout editor.
            </div>
            <pre
              className="flex-1 p-4 border rounded-none font-mono text-[11px] overflow-auto whitespace-pre leading-relaxed"
              style={{
                backgroundColor: "var(--bg-sunken)",
                borderColor: "var(--border-app)",
                color: "var(--text-main)",
              }}
            >
              {kicadNetlist}
            </pre>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: FULL SYNTHESIS AUDIT REPORT                                          */}
        {/* ========================================================================= */}
        {activeExportTab === "report" && (
          <div className="h-full flex flex-col space-y-2">
            <div
              className="p-2 border rounded-none text-[11px]"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
                color: "var(--text-muted)",
              }}
            >
              Complete hardware audit report including executive summary, ERC diagnostics check
              results, wiring schedules, and BOM.
            </div>
            <pre
              className="flex-1 p-4 border rounded-none font-mono text-[11px] overflow-auto whitespace-pre-wrap leading-relaxed"
              style={{
                backgroundColor: "var(--bg-sunken)",
                borderColor: "var(--border-app)",
                color: "var(--text-main)",
              }}
            >
              {synthesisReport}
            </pre>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: CANONICAL CIRCUIT JSON IR                                            */}
        {/* ========================================================================= */}
        {activeExportTab === "circuit_json" && (
          <div className="h-full flex flex-col space-y-2">
            <div
              className="p-2 border rounded-none text-[11px]"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
                color: "var(--text-muted)",
              }}
            >
              Canonical Intermediate Representation (Circuit IR Doc §12.9) containing normalized
              component trees, port topologies, and net graphs.
            </div>
            <pre
              className="flex-1 p-4 border rounded-none font-mono text-[11px] overflow-auto whitespace-pre leading-relaxed"
              style={{
                backgroundColor: "var(--bg-sunken)",
                borderColor: "var(--border-app)",
                color: "var(--accent-valid)",
              }}
            >
              {circuitJsonFormatted}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
