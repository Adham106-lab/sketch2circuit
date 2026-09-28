/**
 * @license Apache-2.0
 * Parts Catalog Explorer component powered by @s2c/parts.
 * Deduplicated, token-based engineering CAD layout.
 */

import { getFootprintDefinition } from "@s2c/footprints";
import { getPartDefinition, PARTS_CATALOG, type PartDefinition } from "@s2c/parts";
import { Cpu, ExternalLink, Search, Zap } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

export const PartsCatalogBrowser: React.FC = () => {
  const [search, setSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [selectedPartId, setSelectedPartId] = useState<string>("ARDUINO_UNO_R3");

  // Deduplicate all parts strictly by canonical part ID
  const allParts: PartDefinition[] = useMemo(() => {
    const map = new Map<string, PartDefinition>();
    for (const p of Object.values(PARTS_CATALOG)) {
      if (!map.has(p.id)) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }, []);

  const kinds = useMemo(() => {
    const set = new Set<string>();
    for (const p of allParts) {
      set.add(p.kind);
    }
    return Array.from(set).sort();
  }, [allParts]);

  const filteredParts = useMemo(() => {
    return allParts.filter((p) => {
      const matchKind = selectedKind === "all" || p.kind === selectedKind;
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.id.toLowerCase().includes(search.toLowerCase()) ||
        p.partNumber.toLowerCase() === search.toLowerCase() ||
        p.partNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      return matchKind && matchSearch;
    });
  }, [allParts, selectedKind, search]);

  const currentPart = useMemo(() => {
    return getPartDefinition(selectedPartId) || allParts[0];
  }, [selectedPartId, allParts]);

  return (
    <div
      className="flex flex-col md:flex-row h-full border rounded-none overflow-hidden font-mono"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: "var(--border-app)",
        color: "var(--text-main)",
      }}
    >
      {/* Sidebar List */}
      <div
        className="w-full md:w-80 border-r flex flex-col"
        style={{
          borderColor: "var(--border-app)",
          backgroundColor: "var(--bg-subpanel)",
        }}
      >
        <div className="p-3 border-b space-y-2" style={{ borderColor: "var(--border-app)" }}>
          <div className="relative">
            <Search
              className="w-3.5 h-3.5 absolute left-3 top-2.5"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              type="text"
              placeholder="SEARCH CATALOG..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-none pl-8 pr-3 py-1.5 text-xs outline-none uppercase"
              style={{
                backgroundColor: "var(--bg-panel)",
                borderColor: "var(--border-app)",
                color: "var(--text-main)",
              }}
            />
          </div>

          <div className="flex gap-1 overflow-x-auto text-[11px] pb-1">
            <button
              type="button"
              onClick={() => setSelectedKind("all")}
              className="px-2 py-0.5 rounded-none border transition uppercase text-[10px] font-bold"
              style={{
                backgroundColor: selectedKind === "all" ? "var(--bg-panel)" : "transparent",
                borderColor: selectedKind === "all" ? "var(--border-strong)" : "var(--border-app)",
                color: selectedKind === "all" ? "var(--text-main)" : "var(--text-muted)",
              }}
            >
              ALL ({allParts.length})
            </button>
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKind(k)}
                className="px-2 py-0.5 rounded-none border transition uppercase text-[10px]"
                style={{
                  backgroundColor: selectedKind === k ? "var(--bg-panel)" : "transparent",
                  borderColor: selectedKind === k ? "var(--border-strong)" : "var(--border-app)",
                  color: selectedKind === k ? "var(--text-main)" : "var(--text-muted)",
                }}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Parts list */}
        <div
          className="flex-1 overflow-y-auto divide-y"
          style={{ borderColor: "var(--border-app)" }}
        >
          {filteredParts.map((p, idx) => {
            const isSelected = p.id === selectedPartId;
            return (
              <button
                key={`${p.id}-${idx}`}
                type="button"
                onClick={() => setSelectedPartId(p.id)}
                className="w-full text-left p-3 transition flex items-start gap-2.5 border-l-2"
                style={{
                  borderLeftColor: isSelected ? "var(--border-strong)" : "transparent",
                  backgroundColor: isSelected ? "var(--bg-panel)" : "transparent",
                }}
              >
                <div
                  className="p-1.5 border rounded-none shrink-0 mt-0.5"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-app)",
                    color: "var(--text-main)",
                  }}
                >
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4
                      className="text-xs font-semibold truncate uppercase"
                      style={{ color: "var(--text-main)" }}
                    >
                      {p.name}
                    </h4>
                    <span
                      className="text-[9px] font-mono uppercase px-1.5 py-0.2 border rounded-none shrink-0"
                      style={{
                        borderColor: "var(--border-app)",
                        backgroundColor: "var(--bg-sunken)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {p.kind}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <p
                      className="text-[10px] font-mono mt-0.5 truncate"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {p.partNumber}
                    </p>
                    {(() => {
                      const fpId = p.footprintId || p.defaultFootprint;
                      const fpDef = fpId ? getFootprintDefinition(fpId) : undefined;
                      const isVerified =
                        fpDef?.verification === "cross-checked-kicad-lib" ||
                        fpDef?.verification === "datasheet-checked";
                      if (!isVerified) {
                        return (
                          <span className="text-[8px] font-mono uppercase px-1 py-0.2 border rounded-none text-amber-500 border-amber-500/40 bg-amber-500/10 shrink-0 font-bold">
                            unverified
                          </span>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Part Detail View */}
      {currentPart && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div
            className="flex items-start justify-between gap-4 border-b pb-5"
            style={{ borderColor: "var(--border-app)" }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-xs px-2 py-0.5 border rounded-none font-bold"
                  style={{
                    borderColor: "var(--border-strong)",
                    backgroundColor: "var(--bg-sunken)",
                    color: "var(--text-main)",
                  }}
                >
                  {currentPart.id}
                </span>
                {(() => {
                  const fpId = currentPart.footprintId || currentPart.defaultFootprint;
                  const fpDef = fpId ? getFootprintDefinition(fpId) : undefined;
                  const isVerifiedFp =
                    fpDef?.verification === "cross-checked-kicad-lib" ||
                    fpDef?.verification === "datasheet-checked";
                  if (!isVerifiedFp) {
                    return (
                      <span className="text-xs font-mono flex items-center gap-1 font-bold text-amber-500">
                        [⚠] UNVERIFIED GEOMETRY
                      </span>
                    );
                  }
                  return (
                    <span
                      className="text-xs font-mono flex items-center gap-1 font-bold"
                      style={{ color: "var(--accent-valid)" }}
                    >
                      [✓] VERIFIED LIBRARY COMPONENT
                    </span>
                  );
                })()}
              </div>
              <h2
                className="text-lg font-bold mt-2 uppercase tracking-wide"
                style={{ color: "var(--text-main)" }}
              >
                {currentPart.name}
              </h2>
              <p
                className="text-xs mt-1 max-w-2xl leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {currentPart.description}
              </p>
            </div>

            {currentPart.datasheetUrl && (
              <a
                href={currentPart.datasheetUrl}
                target="_blank"
                rel="noreferrer"
                className="eng-btn"
              >
                <span>DATASHEET</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {/* Properties & Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div
              className="p-3 border rounded-none"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
              }}
            >
              <span
                className="text-[10px] uppercase font-mono block"
                style={{ color: "var(--text-muted)" }}
              >
                PART NUMBER
              </span>
              <p
                className="font-mono font-bold mt-1 truncate"
                style={{ color: "var(--text-main)" }}
              >
                {currentPart.partNumber}
              </p>
            </div>
            <div
              className="p-3 border rounded-none"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
              }}
            >
              <span
                className="text-[10px] uppercase font-mono block"
                style={{ color: "var(--text-muted)" }}
              >
                COMPONENT KIND
              </span>
              <p
                className="font-mono font-bold mt-1 uppercase"
                style={{ color: "var(--text-main)" }}
              >
                {currentPart.kind}
              </p>
            </div>
            <div
              className="p-3 border rounded-none"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
              }}
            >
              <span
                className="text-[10px] uppercase font-mono block"
                style={{ color: "var(--text-muted)" }}
              >
                DEFAULT FOOTPRINT
              </span>
              <p
                className="font-mono font-bold mt-1 truncate"
                style={{ color: "var(--text-main)" }}
              >
                {currentPart.defaultFootprint || "Generic"}
              </p>
              {(() => {
                const fpId = currentPart.footprintId || currentPart.defaultFootprint;
                const fpDef = fpId ? getFootprintDefinition(fpId) : undefined;
                const isVerified =
                  fpDef?.verification === "cross-checked-kicad-lib" ||
                  fpDef?.verification === "datasheet-checked";
                if (!isVerified) {
                  return (
                    <span className="inline-block mt-1 text-[9px] font-mono px-1 py-0.5 border text-amber-500 border-amber-500/50 bg-amber-500/10 font-bold uppercase">
                      ⚠ unverified geometry
                    </span>
                  );
                }
                return (
                  <span className="inline-block mt-1 text-[9px] font-mono px-1 py-0.5 border text-emerald-600 border-emerald-500/50 bg-emerald-500/10 font-bold uppercase">
                    ✓ KiCad verified
                  </span>
                );
              })()}
            </div>
            <div
              className="p-3 border rounded-none"
              style={{
                backgroundColor: "var(--bg-subpanel)",
                borderColor: "var(--border-app)",
              }}
            >
              <span
                className="text-[10px] uppercase font-mono block"
                style={{ color: "var(--text-muted)" }}
              >
                PIN COUNT
              </span>
              <p className="font-mono font-bold mt-1" style={{ color: "var(--text-main)" }}>
                {currentPart.ports.length} PORTS
              </p>
            </div>
          </div>

          {/* Port / Pinout Table */}
          <div className="space-y-3">
            <h3
              className="text-xs font-bold uppercase flex items-center gap-2 tracking-wide"
              style={{ color: "var(--text-main)" }}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>PORT PINOUT &amp; ELECTRICAL RATINGS</span>
            </h3>

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
                    <th className="py-2.5 px-3">PORT NAME</th>
                    <th className="py-2.5 px-3">HEADER PIN</th>
                    <th className="py-2.5 px-3">DIRECTION</th>
                    <th className="py-2.5 px-3">CAPABILITIES</th>
                    <th className="py-2.5 px-3">VOLTAGE RANGE</th>
                    <th className="py-2.5 px-3">CURRENT LIMIT</th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y font-mono text-xs"
                  style={{ borderColor: "var(--border-app)" }}
                >
                  {currentPart.ports.map((pt) => (
                    <tr key={pt.name} className="transition" style={{ color: "var(--text-main)" }}>
                      <td className="py-2 px-3 font-bold">{pt.name}</td>
                      <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>
                        {pt.pinNumber ?? "—"}
                      </td>
                      <td className="py-2 px-3 uppercase">{pt.kind}</td>
                      <td className="py-2 px-3">
                        {pt.pinCapabilities && pt.pinCapabilities.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {pt.pinCapabilities.map((cap) => (
                              <span
                                key={cap}
                                className="px-1.5 py-0.2 border rounded-none text-[9px]"
                                style={{
                                  borderColor: "var(--border-app)",
                                  backgroundColor: "var(--bg-sunken)",
                                  color: "var(--text-main)",
                                }}
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td className="py-2 px-3" style={{ color: "var(--accent-valid)" }}>
                        {pt.voltageRange ? `${pt.voltageRange[0]}V – ${pt.voltageRange[1]}V` : "—"}
                      </td>
                      <td className="py-2 px-3">
                        {pt.currentLimit ? `${pt.currentLimit * 1000} mA` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
