/**
 * @license Apache-2.0
 * @s2c/apps/playground — Custom Node Renderer for Simulink-style Block Diagram Nodes.
 */

import { getBlockDefinition } from "@s2c/block-diagram";
import { Handle, type Node, type NodeProps, Position } from "@xyflow/react";
import type React from "react";
import { useMemo } from "react";

export interface BlockNodeData extends Record<string, unknown> {
  blockType: string;
  label: string;
  params: Record<string, unknown>;
  isOffending?: boolean;
  errorMessage?: string;
}

export type BlockNodeType = Node<BlockNodeData, "blockNode">;

export const BlockNodeComponent: React.FC<NodeProps<BlockNodeType>> = ({ data, selected }) => {
  const { blockType, label, params, isOffending, errorMessage } = data;
  const def = useMemo(() => getBlockDefinition(blockType), [blockType]);

  // Color theme by block category
  const categoryBadge = useMemo(() => {
    switch (def?.category) {
      case "source":
        return {
          bg: "rgba(16, 185, 129, 0.12)",
          border: "rgba(16, 185, 129, 0.4)",
          text: "#34d399",
          label: "SRC",
        };
      case "math":
        return {
          bg: "rgba(56, 189, 248, 0.12)",
          border: "rgba(56, 189, 248, 0.4)",
          text: "#38bdf8",
          label: "MATH",
        };
      case "dynamics":
        return {
          bg: "rgba(168, 85, 247, 0.12)",
          border: "rgba(168, 85, 247, 0.4)",
          text: "#c084fc",
          label: "DYN",
        };
      case "sink":
        return {
          bg: "rgba(245, 158, 11, 0.12)",
          border: "rgba(245, 158, 11, 0.4)",
          text: "#fbbf24",
          label: "SINK",
        };
      default:
        return {
          bg: "rgba(148, 163, 184, 0.12)",
          border: "rgba(148, 163, 184, 0.4)",
          text: "#94a3b8",
          label: "BLK",
        };
    }
  }, [def]);

  const inputs = def?.inputs ?? [];
  const outputs = def?.outputs ?? [];

  // Short parameter summary to display on block body
  const paramSummary = useMemo(() => {
    if (!params) return "";
    switch (blockType) {
      case "Gain":
        return `K = ${params.gain ?? 1}`;
      case "Constant":
        return `val = ${params.value ?? 1}`;
      case "Step":
        return `t = ${params.stepTime ?? 1}`;
      case "Ramp":
        return `slope = ${params.slope ?? 1}`;
      case "Sine":
        return `f = ${params.frequency ?? 1}Hz`;
      case "Sum":
        return `[ ${params.signs ?? "+-"} ]`;
      case "Product":
        return "u1 × u2";
      case "Abs":
        return "|u|";
      case "Integrator":
        return `1/s (x0=${params.initialCondition ?? 0})`;
      case "TransferFunction": {
        const num = Array.isArray(params.numerator) ? params.numerator.join(",") : "1";
        const den = Array.isArray(params.denominator) ? params.denominator.join(",") : "1,1";
        return `[${num}] / [${den}]`;
      }
      case "PID":
        return `P:${params.Kp ?? 1} I:${params.Ki ?? 0} D:${params.Kd ?? 0}`;
      case "Delay":
        return `T = ${params.delayTime ?? 0.1}s`;
      case "Saturation":
        return `[${params.lowerLimit ?? -1}, ${params.upperLimit ?? 1}]`;
      default:
        return "";
    }
  }, [blockType, params]);

  return (
    <div
      className={`relative min-w-[150px] w-[170px] rounded-[3px] border shadow-md transition-all select-none ${
        isOffending
          ? "border-red-500 ring-2 ring-red-500/50 bg-red-950/40"
          : selected
            ? "border-sky-400 ring-1 ring-sky-400/50 bg-neutral-900"
            : "border-neutral-700 hover:border-neutral-500 bg-neutral-950/90"
      }`}
      style={{
        boxShadow: selected
          ? "0 0 12px rgba(56, 189, 248, 0.25)"
          : isOffending
            ? "0 0 12px rgba(239, 68, 68, 0.35)"
            : "0 2px 4px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Input Handles (Target) - directly attached to boundary for ReactFlow accuracy */}
      {inputs.map((port, idx) => {
        const total = inputs.length;
        const topPercent = total === 1 ? 50 : 28 + (idx * 44) / (total - 1);
        return (
          <Handle
            key={port.id}
            type="target"
            position={Position.Left}
            id={port.id}
            style={{ top: `${topPercent}%` }}
            className="!w-2.5 !h-2.5 !bg-sky-400 !border !border-black rounded-full transition-transform hover:scale-125"
          />
        );
      })}

      {/* Output Handles (Source) - directly attached to boundary for ReactFlow accuracy */}
      {outputs.map((port, idx) => {
        const total = outputs.length;
        const topPercent = total === 1 ? 50 : 28 + (idx * 44) / (total - 1);
        return (
          <Handle
            key={port.id}
            type="source"
            position={Position.Right}
            id={port.id}
            style={{ top: `${topPercent}%` }}
            className="!w-2.5 !h-2.5 !bg-emerald-400 !border !border-black rounded-full transition-transform hover:scale-125"
          />
        );
      })}

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-1.5 px-2.5 py-1 border-b border-neutral-800 bg-neutral-900/60 rounded-t-[2px]">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className="text-[8px] font-mono px-1 py-0.2 border rounded-[1px] font-bold"
            style={{
              backgroundColor: categoryBadge.bg,
              borderColor: categoryBadge.border,
              color: categoryBadge.text,
            }}
          >
            {categoryBadge.label}
          </span>
          <span className="text-[11px] font-bold text-neutral-200 truncate">{label}</span>
        </div>
        <span className="text-[9px] font-mono text-neutral-400 shrink-0">{blockType}</span>
      </div>

      {/* Body / Summary with Port Indicators separated cleanly to prevent collisions */}
      <div className="px-2.5 py-2 min-h-[34px] flex items-center justify-between gap-1.5">
        {/* Left Port Labels */}
        {inputs.length > 0 && (
          <div className="flex flex-col gap-0.5 items-start shrink-0">
            {inputs.map((port) => (
              <span
                key={port.id}
                className="text-[8.5px] font-mono text-neutral-400 select-none px-1 bg-black/30 rounded-[1px]"
              >
                {port.name || port.id}
              </span>
            ))}
          </div>
        )}

        {/* Center Parameter / Description */}
        <div className="flex-1 text-center px-1 overflow-hidden">
          {paramSummary ? (
            <span className="text-[9.5px] font-mono text-sky-300 font-semibold bg-black/40 px-1.5 py-0.5 rounded-[1px] border border-neutral-800/80 inline-block max-w-full truncate">
              {paramSummary}
            </span>
          ) : (
            <span className="text-[9px] text-neutral-500 italic block truncate">
              {def?.description || blockType}
            </span>
          )}
        </div>

        {/* Right Port Labels */}
        {outputs.length > 0 && (
          <div className="flex flex-col gap-0.5 items-end shrink-0">
            {outputs.map((port) => (
              <span
                key={port.id}
                className="text-[8.5px] font-mono text-neutral-400 select-none px-1 bg-black/30 rounded-[1px]"
              >
                {port.name || port.id}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Inline Diagnostic Tooltip */}
      {isOffending && errorMessage && (
        <div className="px-2 py-1 bg-red-950 border-t border-red-700/80 text-[9px] text-red-200 font-medium leading-tight rounded-b-[2px]">
          {errorMessage}
        </div>
      )}
    </div>
  );
};
