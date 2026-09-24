/**
 * @license Apache-2.0
 * Parts Catalog Explorer component powered by @s2c/parts.
 */

import { getPartDefinition, PARTS_CATALOG, type PartDefinition } from "@s2c/parts";
import { Cpu, ExternalLink, Search, Zap } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";

export const PartsCatalogBrowser: React.FC = () => {
  const [search, setSearch] = useState("");
  const [selectedKind, setSelectedKind] = useState<string>("all");
  const [selectedPartId, setSelectedPartId] = useState<string>("ARDUINO_UNO_R3");

  const allParts: PartDefinition[] = useMemo(() => Object.values(PARTS_CATALOG), []);

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
        p.partNumber.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      return matchKind && matchSearch;
    });
  }, [allParts, selectedKind, search]);

  const currentPart = useMemo(() => {
    return getPartDefinition(selectedPartId) || allParts[0];
  }, [selectedPartId, allParts]);

  return (
    <div className="flex flex-col md:flex-row h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
      {/* Sidebar List */}
      <div className="w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-950/60">
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search parts catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex gap-1 overflow-x-auto text-[11px] pb-1">
            <button
              type="button"
              onClick={() => setSelectedKind("all")}
              className={`px-2 py-0.5 rounded transition capitalize ${
                selectedKind === "all"
                  ? "bg-indigo-600 text-white font-medium"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              All ({allParts.length})
            </button>
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelectedKind(k)}
                className={`px-2 py-0.5 rounded transition capitalize ${
                  selectedKind === k
                    ? "bg-indigo-600 text-white font-medium"
                    : "bg-slate-900 text-slate-400 hover:text-slate-200"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        {/* Parts list */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
          {filteredParts.map((p) => {
            const isSelected = p.id === selectedPartId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPartId(p.id)}
                className={`w-full text-left p-3 transition flex items-start gap-2.5 ${
                  isSelected
                    ? "bg-indigo-600/10 border-l-2 border-indigo-500"
                    : "hover:bg-slate-800/30"
                }`}
              >
                <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-indigo-400 mt-0.5">
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-semibold text-slate-200 truncate">{p.name}</h4>
                    <span className="text-[10px] font-mono text-slate-500 uppercase px-1.5 py-0.2 rounded bg-slate-900">
                      {p.kind}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">{p.partNumber}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Part Detail View */}
      {currentPart && (
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  {currentPart.id}
                </span>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Verified Library Part
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-100 mt-2">{currentPart.name}</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">{currentPart.description}</p>
            </div>

            {currentPart.datasheetUrl && (
              <a
                href={currentPart.datasheetUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition"
              >
                <span>Datasheet</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
            )}
          </div>

          {/* Properties & Specs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Part Number</span>
              <p className="text-xs font-mono font-semibold text-slate-200 mt-1">
                {currentPart.partNumber}
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Component Kind</span>
              <p className="text-xs font-mono font-semibold text-indigo-400 mt-1 capitalize">
                {currentPart.kind}
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono">
                Default Footprint
              </span>
              <p className="text-xs font-mono font-semibold text-slate-300 mt-1">
                {currentPart.defaultFootprint || "Generic"}
              </p>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase font-mono">Pin Count</span>
              <p className="text-xs font-mono font-semibold text-amber-300 mt-1">
                {currentPart.ports.length} Ports
              </p>
            </div>
          </div>

          {/* Port / Pinout Table */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Port Pinout &amp; Electrical Ratings</span>
            </h3>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-950 text-slate-300 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Port Name</th>
                    <th className="py-2.5 px-3">Header Pin</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3">Capabilities</th>
                    <th className="py-2.5 px-3">Voltage Range</th>
                    <th className="py-2.5 px-3">Current Limit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-slate-300">
                  {currentPart.ports.map((pt) => (
                    <tr key={pt.name} className="hover:bg-slate-800/40 transition">
                      <td className="py-2 px-3 font-semibold text-indigo-400">{pt.name}</td>
                      <td className="py-2 px-3 text-slate-400">{pt.pinNumber ?? "—"}</td>
                      <td className="py-2 px-3 capitalize text-slate-300">{pt.kind}</td>
                      <td className="py-2 px-3">
                        {pt.pinCapabilities && pt.pinCapabilities.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {pt.pinCapabilities.map((cap) => (
                              <span
                                key={cap}
                                className="px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-300"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-emerald-400">
                        {pt.voltageRange ? `${pt.voltageRange[0]}V – ${pt.voltageRange[1]}V` : "—"}
                      </td>
                      <td className="py-2 px-3 text-amber-300">
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
