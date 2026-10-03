/**
 * @license Apache-2.0
 * @s2c/playground — Dedicated Bill of Materials (BOM) Workbench Tab (M14)
 * Provides comprehensive component aggregation, placement correlation,
 * footprint categorization, costing metrics, and multi-format export.
 */

import type { Circuit, Component } from "@s2c/circuit-json";
import { getPartDefinition } from "@s2c/parts";
import type { PcbLayout } from "@s2c/pcb-json";
import {
  Boxes,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  DollarSign,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Layers,
  Search,
} from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

export interface BomViewerTabProps {
  circuit: Circuit;
  layout?: PcbLayout;
  sketchName?: string;
  theme?: "dark" | "light";
}

export type BomCategory =
  | "all"
  | "mcu"
  | "passive"
  | "semiconductor"
  | "sensor"
  | "electromechanical"
  | "connector";

export interface EnrichedBomItem {
  itemNumber: number;
  designators: string[];
  designatorStr: string;
  quantity: number;
  value: string;
  kind: string;
  category: BomCategory;
  description: string;
  footprint: string;
  isThroughHole: boolean;
  coordinates: Array<{ id: string; x: number; y: number; rotation: number }>;
  unitCostEstimate: number;
  extendedCostEstimate: number;
  supplierPartNumber: string;
  datasheetUrl?: string;
  verified: boolean;
}

export function classifyComponentCategory(kind: string): BomCategory {
  const k = kind.toLowerCase();
  if (
    k.includes("mcu") ||
    k.includes("atmega") ||
    k.includes("microcontroller") ||
    k.includes("arduino")
  ) {
    return "mcu";
  }
  if (k.includes("resistor") || k.includes("capacitor") || k.includes("inductor")) {
    return "passive";
  }
  if (
    k.includes("led") ||
    k.includes("diode") ||
    k.includes("transistor") ||
    k.includes("mosfet") ||
    k.includes("bjt") ||
    k.includes("ic") ||
    k.includes("opamp") ||
    k.includes("gate") ||
    k.includes("optocoupler")
  ) {
    return "semiconductor";
  }
  if (
    k.includes("sensor") ||
    k.includes("ldr") ||
    k.includes("photocell") ||
    k.includes("thermistor") ||
    k.includes("ultrasonic")
  ) {
    return "sensor";
  }
  if (
    k.includes("motor") ||
    k.includes("servo") ||
    k.includes("relay") ||
    k.includes("buzzer") ||
    k.includes("switch") ||
    k.includes("button")
  ) {
    return "electromechanical";
  }
  if (
    k.includes("header") ||
    k.includes("jack") ||
    k.includes("terminal") ||
    k.includes("connector")
  ) {
    return "connector";
  }
  return "passive";
}

export function estimateUnitCost(category: BomCategory, kind: string, value: string): number {
  switch (category) {
    case "passive":
      return 0.04;
    case "semiconductor":
      if (kind.includes("led")) return 0.08;
      if (kind.includes("diode")) return 0.06;
      if (kind.includes("transistor")) return 0.12;
      return 0.45;
    case "sensor":
      if (kind.includes("ldr")) return 0.35;
      return 2.5;
    case "electromechanical":
      if (kind.includes("switch") || kind.includes("button")) return 0.2;
      if (kind.includes("buzzer")) return 0.85;
      if (kind.includes("servo")) return 4.5;
      return 1.2;
    case "connector":
      return 0.3;
    case "mcu":
      return 3.85;
    default:
      return 0.15;
  }
}

export const BomViewerTab: React.FC<BomViewerTabProps> = ({
  circuit,
  layout,
  sketchName = "SynthesizedCircuit",
  theme = "dark",
}) => {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<BomCategory>("all");
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Correlation map of component placements
  const placementMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; rotation: number; footprintId: string }>();
    if (!layout) return map;
    for (const pl of layout.placements) {
      map.set(pl.componentId, {
        x: pl.x,
        y: pl.y,
        rotation: pl.rotation,
        footprintId: pl.footprintId,
      });
    }
    return map;
  }, [layout]);

  // Aggregate components into grouped line items
  const bomItems: EnrichedBomItem[] = useMemo(() => {
    if (!circuit || !circuit.components || circuit.components.length === 0) return [];

    // Grouping key: kind + value + footprint + partNumber
    const groups = new Map<string, Component[]>();
    for (const comp of circuit.components) {
      const val = comp.value ? String(comp.value) : "—";
      const fp = comp.footprint ?? placementMap.get(comp.id)?.footprintId ?? "DEFAULT";
      const key = `${comp.kind}:::${val}:::${fp}:::${comp.partNumber ?? ""}`;
      const existing = groups.get(key) ?? [];
      existing.push(comp);
      groups.set(key, existing);
    }

    const items: EnrichedBomItem[] = [];
    let idx = 1;

    for (const [, compList] of groups) {
      const first = compList[0];
      const kind = first.kind;
      const val = first.value ? String(first.value) : "—";
      const category = classifyComponentCategory(kind);
      const catDef = getPartDefinition(first.partNumber || kind);

      const desc =
        catDef?.description && catDef.description !== kind
          ? catDef.description
          : kind === "resistor"
            ? `${val} Carbon Film / Metal Film Resistor`
            : kind === "led"
              ? `${val !== "—" ? val : "5mm"} Indicator LED`
              : kind === "capacitor"
                ? `${val} Decoupling / Filter Capacitor`
                : first.name || `${kind.toUpperCase()} Component`;

      const footprint =
        first.footprint ??
        placementMap.get(first.id)?.footprintId ??
        catDef?.defaultFootprint ??
        "Through-Hole Standard";

      const coords = compList.map((c) => {
        const pl = placementMap.get(c.id);
        return {
          id: c.id,
          x: pl ? Number(pl.x.toFixed(2)) : 0,
          y: pl ? Number(pl.y.toFixed(2)) : 0,
          rotation: pl ? pl.rotation : 0,
        };
      });

      const isThroughHole =
        footprint.toUpperCase().includes("THT") ||
        footprint.toUpperCase().includes("DIP") ||
        footprint.toUpperCase().includes("HEADER") ||
        footprint.toUpperCase().includes("AXIAL") ||
        footprint.toUpperCase().includes("RADIAL");

      const unitCost = estimateUnitCost(category, kind, val);
      const extCost = Number((unitCost * compList.length).toFixed(2));

      items.push({
        itemNumber: idx++,
        designators: compList.map((c) => c.id).sort(),
        designatorStr: compList
          .map((c) => c.id)
          .sort()
          .join(", "),
        quantity: compList.length,
        value: val,
        kind,
        category,
        description: desc,
        footprint,
        isThroughHole,
        coordinates: coords,
        unitCostEstimate: unitCost,
        extendedCostEstimate: extCost,
        supplierPartNumber:
          first.partNumber ?? catDef?.partNumber ?? `GENERIC-${kind.toUpperCase()}`,
        datasheetUrl: catDef?.datasheetUrl,
        verified: catDef?.verified ?? first.verified ?? false,
      });
    }

    return items;
  }, [circuit, placementMap]);

  // Filtered line items
  const filteredItems = useMemo(() => {
    return bomItems.filter((item) => {
      const matchCategory = selectedCategory === "all" || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchCategory;

      const matchSearch =
        item.designatorStr.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.footprint.toLowerCase().includes(q) ||
        item.supplierPartNumber.toLowerCase().includes(q) ||
        item.kind.toLowerCase().includes(q);

      return matchCategory && matchSearch;
    });
  }, [bomItems, selectedCategory, searchQuery]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const totalComponents = bomItems.reduce((acc, i) => acc + i.quantity, 0);
    const thtCount = bomItems
      .filter((i) => i.isThroughHole)
      .reduce((acc, i) => acc + i.quantity, 0);
    const smdCount = totalComponents - thtCount;
    const totalCost = Number(
      bomItems.reduce((acc, i) => acc + i.extendedCostEstimate, 0).toFixed(2),
    );
    const placedCount = layout ? layout.placements.length : 0;

    return {
      lineItems: bomItems.length,
      totalComponents,
      thtCount,
      smdCount,
      totalCost,
      placedCount,
    };
  }, [bomItems, layout]);

  // Export CSV
  const handleExportCsv = () => {
    const headers = [
      "Item",
      "Designators",
      "Quantity",
      "Value",
      "Description",
      "Package/Footprint",
      "Type",
      "Coordinates (X,Y,Rot)",
      "Est. Unit Price ($)",
      "Est. Ext Price ($)",
      "Supplier P/N",
    ];

    const rows = bomItems.map((item) => [
      item.itemNumber,
      `"${item.designatorStr}"`,
      item.quantity,
      `"${item.value}"`,
      `"${item.description.replace(/"/g, '""')}"`,
      `"${item.footprint}"`,
      item.isThroughHole ? "Through-Hole" : "Surface-Mount",
      `"${item.coordinates.map((c) => `${c.id}:(${c.x},${c.y},${c.rotation}°)`).join("; ")}"`,
      item.unitCostEstimate.toFixed(2),
      item.extendedCostEstimate.toFixed(2),
      `"${item.supplierPartNumber}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    downloadFile(csvContent, `${sketchName}_BOM.csv`, "text/csv;charset=utf-8;");
  };

  // Export TSV (for Excel/Google Sheets direct paste)
  const handleExportTsv = () => {
    const headers = [
      "Item",
      "Designators",
      "Qty",
      "Value",
      "Description",
      "Package",
      "Type",
      "Locations",
      "Unit Cost",
      "Ext Cost",
      "Part Number",
    ];

    const rows = bomItems.map((item) => [
      item.itemNumber,
      item.designatorStr,
      item.quantity,
      item.value,
      item.description,
      item.footprint,
      item.isThroughHole ? "THT" : "SMD",
      item.coordinates.map((c) => `${c.id}:(${c.x},${c.y})`).join(" "),
      `$${item.unitCostEstimate.toFixed(2)}`,
      `$${item.extendedCostEstimate.toFixed(2)}`,
      item.supplierPartNumber,
    ]);

    const tsvContent = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    downloadFile(tsvContent, `${sketchName}_BOM.tsv`, "text/tab-separated-values;charset=utf-8;");
  };

  // Copy TSV to clipboard
  const handleCopyTsv = async () => {
    const headers = [
      "Item",
      "Designators",
      "Qty",
      "Value",
      "Description",
      "Package",
      "Type",
      "Unit Cost",
      "Ext Cost",
    ];

    const rows = bomItems.map((item) => [
      item.itemNumber,
      item.designatorStr,
      item.quantity,
      item.value,
      item.description,
      item.footprint,
      item.isThroughHole ? "THT" : "SMD",
      `$${item.unitCostEstimate.toFixed(2)}`,
      `$${item.extendedCostEstimate.toFixed(2)}`,
    ]);

    const tsvContent = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    try {
      await navigator.clipboard.writeText(tsvContent);
      setCopiedFormat("tsv");
      setTimeout(() => setCopiedFormat(null), 2000);
    } catch {
      // Fallback
    }
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="flex-1 flex flex-col space-y-3 font-mono text-xs"
      style={{ color: "var(--text-main)" }}
    >
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div
          className="p-2.5 border rounded-[2px] flex flex-col justify-between"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
          }}
        >
          <span
            className="text-[10px] uppercase font-bold tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            TOTAL PARTS
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold">{stats.totalComponents}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              UNITS
            </span>
          </div>
        </div>

        <div
          className="p-2.5 border rounded-[2px] flex flex-col justify-between"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
          }}
        >
          <span
            className="text-[10px] uppercase font-bold tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            LINE ITEMS
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold">{stats.lineItems}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              DISTINCT
            </span>
          </div>
        </div>

        <div
          className="p-2.5 border rounded-[2px] flex flex-col justify-between"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
          }}
        >
          <span
            className="text-[10px] uppercase font-bold tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            THROUGH-HOLE
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-emerald-400">{stats.thtCount}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              THT
            </span>
          </div>
        </div>

        <div
          className="p-2.5 border rounded-[2px] flex flex-col justify-between"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
          }}
        >
          <span
            className="text-[10px] uppercase font-bold tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            SURFACE-MOUNT
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-cyan-400">{stats.smdCount}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              SMD
            </span>
          </div>
        </div>

        <div
          className="p-2.5 border rounded-[2px] flex flex-col justify-between"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
          }}
        >
          <span
            className="text-[10px] uppercase font-bold tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            PLACED ON PCB
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-amber-400">{stats.placedCount}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              / {stats.totalComponents}
            </span>
          </div>
        </div>

        <div
          className="p-2.5 border rounded-[2px] flex flex-col justify-between"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
          }}
        >
          <span
            className="text-[10px] uppercase font-bold tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            EST. TOTAL COST
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-amber-300">${stats.totalCost}</span>
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              USD
            </span>
          </div>
        </div>
      </div>

      {/* Control Bar: Search + Category Filters + Actions */}
      <div
        className="p-2.5 border rounded-[2px] flex flex-wrap items-center justify-between gap-3"
        style={{
          backgroundColor: "var(--bg-subpanel)",
          borderColor: "var(--border-app)",
        }}
      >
        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div
            className="flex items-center w-full px-2 py-1 border rounded-[2px]"
            style={{
              backgroundColor: "var(--bg-sunken)",
              borderColor: "var(--border-app)",
            }}
          >
            <Search className="w-3.5 h-3.5 mr-2 opacity-60" />
            <input
              type="text"
              placeholder="Search RefDes, value, footprint, description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none"
              style={{ color: "var(--text-main)" }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-[10px] opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ["all", "ALL"],
              ["passive", "PASSIVES"],
              ["semiconductor", "SEMIS"],
              ["sensor", "SENSORS"],
              ["electromechanical", "ELECTROMECH"],
              ["connector", "HEADERS"],
              ["mcu", "MCU"],
            ] as Array<[BomCategory, string]>
          ).map(([catKey, catLabel]) => (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`px-2 py-0.5 text-[10px] uppercase font-bold border rounded-[1px] transition ${
                selectedCategory === catKey
                  ? "border-emerald-400 text-emerald-300 bg-emerald-950/40"
                  : "border-slate-700 text-slate-400 hover:text-white"
              }`}
            >
              {catLabel}
            </button>
          ))}
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyTsv}
            className="eng-btn flex items-center gap-1 text-[11px]"
            title="Copy TSV to clipboard (for pasting directly into Google Sheets / Excel)"
          >
            {copiedFormat === "tsv" ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">COPIED!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>COPY TSV</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="eng-btn flex items-center gap-1 text-[11px]"
            title="Download CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportTsv}
            className="eng-btn flex items-center gap-1 text-[11px]"
            title="Download TSV format"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>TSV</span>
          </button>
        </div>
      </div>

      {/* Main BOM Table */}
      <div
        className="flex-1 border rounded-[2px] overflow-hidden flex flex-col"
        style={{
          backgroundColor: "var(--bg-panel)",
          borderColor: "var(--border-app)",
        }}
      >
        <div className="overflow-x-auto flex-1 max-h-[600px]">
          <table className="w-full text-left text-xs border-collapse">
            <thead
              className="sticky top-0 z-10 uppercase text-[10px] tracking-wider border-b"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
                color: "var(--text-muted)",
              }}
            >
              <tr>
                <th className="py-2.5 px-3 w-12 text-center">#</th>
                <th className="py-2.5 px-3 w-28">REF DES</th>
                <th className="py-2.5 px-3 w-14 text-center">QTY</th>
                <th className="py-2.5 px-3 w-28">VALUE</th>
                <th className="py-2.5 px-3 min-w-[200px]">DESCRIPTION &amp; SPECIFICATION</th>
                <th className="py-2.5 px-3 w-36">FOOTPRINT / PKG</th>
                <th className="py-2.5 px-3 w-20 text-center">TYPE</th>
                <th className="py-2.5 px-3 min-w-[140px]">PCB COORDINATES</th>
                <th className="py-2.5 px-3 w-24 text-right">UNIT ($)</th>
                <th className="py-2.5 px-3 w-24 text-right">EXT ($)</th>
              </tr>
            </thead>
            <tbody className="divide-y font-mono" style={{ borderColor: "var(--border-app)" }}>
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="py-8 text-center text-sm"
                    style={{ color: "var(--text-muted)" }}
                  >
                    NO BILL OF MATERIALS ITEMS MATCH CURRENT FILTER CRITERIA
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.itemNumber}
                    className="hover:bg-white/5 transition"
                    style={{ borderColor: "var(--border-subtle)" }}
                  >
                    <td className="py-2 px-3 text-center opacity-60">{item.itemNumber}</td>
                    <td className="py-2 px-3 font-bold" style={{ color: "var(--accent-copper)" }}>
                      {item.designatorStr}
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{item.quantity}</td>
                    <td className="py-2 px-3 font-bold" style={{ color: "var(--text-main)" }}>
                      {item.value}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1.5">
                        <span>{item.description}</span>
                        {item.verified && (
                          <span title="Verified against hardware datasheet">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-60 flex items-center gap-2 mt-0.5">
                        <span>P/N: {item.supplierPartNumber}</span>
                        {item.datasheetUrl && (
                          <a
                            href={item.datasheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-0.5"
                          >
                            <span>Datasheet</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] opacity-80">{item.footprint}</td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`px-1.5 py-0.5 text-[9px] uppercase font-bold border rounded-[1px] ${
                          item.isThroughHole
                            ? "border-emerald-600/50 text-emerald-400 bg-emerald-950/20"
                            : "border-cyan-600/50 text-cyan-400 bg-cyan-950/20"
                        }`}
                      >
                        {item.isThroughHole ? "THT" : "SMD"}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[10px] opacity-75">
                      {item.coordinates.length > 0 ? (
                        <div className="space-y-0.5">
                          {item.coordinates.slice(0, 3).map((c) => (
                            <div key={c.id}>
                              <span className="font-bold text-amber-300">{c.id}</span>: ({c.x},{" "}
                              {c.y}) mm @ {c.rotation}°
                            </div>
                          ))}
                          {item.coordinates.length > 3 && (
                            <div className="opacity-50">+{item.coordinates.length - 3} more...</div>
                          )}
                        </div>
                      ) : (
                        <span className="opacity-50">—</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right opacity-80">
                      ${item.unitCostEstimate.toFixed(2)}
                    </td>
                    <td
                      className="py-2 px-3 text-right font-bold"
                      style={{ color: "var(--text-main)" }}
                    >
                      ${item.extendedCostEstimate.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div
          className="p-2 border-t flex flex-wrap items-center justify-between text-[11px]"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
            color: "var(--text-muted)",
          }}
        >
          <span>
            SHOWING {filteredItems.length} OF {bomItems.length} LINE ITEMS ({stats.totalComponents}{" "}
            TOTAL COMPONENTS)
          </span>
          <span className="font-bold" style={{ color: "var(--text-main)" }}>
            ESTIMATED BOM SUM: ${stats.totalCost} USD
          </span>
        </div>
      </div>
    </div>
  );
};
