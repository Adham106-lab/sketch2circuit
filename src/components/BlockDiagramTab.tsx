/**
 * @license Apache-2.0
 * @s2c/apps/playground — Milestone 18b: Block Diagram Simulation Canvas & Wiring UI.
 */

import {
  type BlockConnection,
  type BlockDiagram,
  type BlockNode,
  type CompiledBlockDiagram,
  compileBlockDiagram,
  type DiagramSimulationResult,
  getAllBlockDefinitions,
  getBlockDefinition,
} from "@s2c/block-diagram";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type Connection,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type NodeTypes,
  ReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Play,
  Plus,
  Sliders,
  Trash2,
  Workflow,
} from "lucide-react";
import type React from "react";
import { useCallback, useId, useMemo, useState } from "react";
import { BlockNodeComponent, type BlockNodeType } from "./BlockNodeRenderer.js";
import { BlockScopeViewer } from "./BlockScopeViewer.js";

interface BlockDiagramTabProps {
  circuit?: unknown;
  sketchName?: string;
  theme?: "dark" | "light";
}

const nodeTypes: NodeTypes = {
  blockNode: BlockNodeComponent as unknown as React.ComponentType<NodeProps<BlockNodeType>>,
};

// Preset 1: Valid closed-loop dynamic filter
const PRESET_VALID_FEEDBACK: { nodes: BlockNodeType[]; edges: Edge[] } = {
  nodes: [
    {
      id: "step_src",
      type: "blockNode",
      position: { x: 60, y: 150 },
      data: {
        blockType: "Step",
        label: "StepInput",
        params: { stepTime: 0.1, initialValue: 0.0, finalValue: 1.0 },
      },
    },
    {
      id: "sum_err",
      type: "blockNode",
      position: { x: 260, y: 150 },
      data: {
        blockType: "Sum",
        label: "ErrorSum",
        params: { signs: "+-" },
      },
    },
    {
      id: "integ_state",
      type: "blockNode",
      position: { x: 460, y: 150 },
      data: {
        blockType: "Integrator",
        label: "Integrator",
        params: { initialCondition: 0.0 },
      },
    },
    {
      id: "gain_fb",
      type: "blockNode",
      position: { x: 360, y: 300 },
      data: {
        blockType: "Gain",
        label: "FeedbackGain",
        params: { gain: 1.0 },
      },
    },
    {
      id: "scope_out",
      type: "blockNode",
      position: { x: 680, y: 150 },
      data: {
        blockType: "Scope",
        label: "Scope",
        params: { title: "Filtered Output" },
      },
    },
  ],
  edges: [
    { id: "e1", source: "step_src", sourceHandle: "out", target: "sum_err", targetHandle: "in1" },
    {
      id: "e2",
      source: "sum_err",
      sourceHandle: "out",
      target: "integ_state",
      targetHandle: "in",
    },
    {
      id: "e3",
      source: "integ_state",
      sourceHandle: "out",
      target: "gain_fb",
      targetHandle: "in",
    },
    { id: "e4", source: "gain_fb", sourceHandle: "out", target: "sum_err", targetHandle: "in2" },
    {
      id: "e5",
      source: "integ_state",
      sourceHandle: "out",
      target: "scope_out",
      targetHandle: "in",
    },
  ],
};

// Preset 2: Pure algebraic loop without dynamics (Intentionally broken)
const PRESET_ALGEBRAIC_LOOP: { nodes: BlockNodeType[]; edges: Edge[] } = {
  nodes: [
    {
      id: "ref_src",
      type: "blockNode",
      position: { x: 80, y: 160 },
      data: {
        blockType: "Constant",
        label: "RefInput",
        params: { value: 5.0 },
      },
    },
    {
      id: "sum_alg",
      type: "blockNode",
      position: { x: 280, y: 160 },
      data: {
        blockType: "Sum",
        label: "Sum1",
        params: { signs: "+-" },
      },
    },
    {
      id: "gain_alg",
      type: "blockNode",
      position: { x: 480, y: 160 },
      data: {
        blockType: "Gain",
        label: "Gain1",
        params: { gain: 10.0 },
      },
    },
  ],
  edges: [
    { id: "e1", source: "ref_src", sourceHandle: "out", target: "sum_alg", targetHandle: "in1" },
    { id: "e2", source: "sum_alg", sourceHandle: "out", target: "gain_alg", targetHandle: "in" },
    // Direct algebraic feedback into Sum with no state block:
    { id: "e3", source: "gain_alg", sourceHandle: "out", target: "sum_alg", targetHandle: "in2" },
  ],
};

// Preset 3: Harmonic Oscillator
const PRESET_OSCILLATOR: { nodes: BlockNodeType[]; edges: Edge[] } = {
  nodes: [
    {
      id: "gain_accel",
      type: "blockNode",
      position: { x: 100, y: 280 },
      data: {
        blockType: "Gain",
        label: "NegOmegaSq",
        params: { gain: -4.0 },
      },
    },
    {
      id: "int_vel",
      type: "blockNode",
      position: { x: 280, y: 160 },
      data: {
        blockType: "Integrator",
        label: "IntegratorVelocity",
        params: { initialCondition: 0.0 },
      },
    },
    {
      id: "int_pos",
      type: "blockNode",
      position: { x: 480, y: 160 },
      data: {
        blockType: "Integrator",
        label: "IntegratorPosition",
        params: { initialCondition: 1.0 },
      },
    },
    {
      id: "scope_pos",
      type: "blockNode",
      position: { x: 680, y: 160 },
      data: {
        blockType: "Scope",
        label: "ScopePosition",
        params: { title: "Harmonic Oscillator Position" },
      },
    },
  ],
  edges: [
    { id: "e1", source: "gain_accel", sourceHandle: "out", target: "int_vel", targetHandle: "in" },
    { id: "e2", source: "int_vel", sourceHandle: "out", target: "int_pos", targetHandle: "in" },
    { id: "e3", source: "int_pos", sourceHandle: "out", target: "gain_accel", targetHandle: "in" },
    { id: "e4", source: "int_pos", sourceHandle: "out", target: "scope_pos", targetHandle: "in" },
  ],
};

// Preset 4: PID Closed-Loop DC Motor Actuator Speed Control (M17 Actuator Model, tau = 80ms)
const PRESET_PID_MOTOR: { nodes: BlockNodeType[]; edges: Edge[] } = {
  nodes: [
    {
      id: "setpoint",
      type: "blockNode",
      position: { x: 50, y: 150 },
      data: {
        blockType: "Step",
        label: "TargetRPM",
        params: { stepTime: 0.05, initialValue: 0.0, finalValue: 1000.0 },
      },
    },
    {
      id: "sum_err",
      type: "blockNode",
      position: { x: 240, y: 150 },
      data: {
        blockType: "Sum",
        label: "ErrorJunction",
        params: { signs: "+-" },
      },
    },
    {
      id: "pid_ctrl",
      type: "blockNode",
      position: { x: 420, y: 150 },
      data: {
        blockType: "PID",
        label: "SpeedPID",
        params: { Kp: 0.5, Ki: 20.0, Kd: 0.01, N: 50.0 },
      },
    },
    {
      id: "motor_actuator",
      type: "blockNode",
      position: { x: 620, y: 150 },
      data: {
        blockType: "TransferFunction",
        label: "DCMotorSpeed",
        params: { numerator: [12.5], denominator: [1.0, 12.5] },
      },
    },
    {
      id: "scope_speed",
      type: "blockNode",
      position: { x: 840, y: 150 },
      data: {
        blockType: "Scope",
        label: "SpeedScope",
        params: { title: "DC Motor Shaft Speed (RPM)" },
      },
    },
  ],
  edges: [
    { id: "e1", source: "setpoint", sourceHandle: "out", target: "sum_err", targetHandle: "in1" },
    { id: "e2", source: "sum_err", sourceHandle: "out", target: "pid_ctrl", targetHandle: "in" },
    {
      id: "e3",
      source: "pid_ctrl",
      sourceHandle: "out",
      target: "motor_actuator",
      targetHandle: "in",
    },
    {
      id: "e4",
      source: "motor_actuator",
      sourceHandle: "out",
      target: "sum_err",
      targetHandle: "in2",
    },
    {
      id: "e5",
      source: "motor_actuator",
      sourceHandle: "out",
      target: "scope_speed",
      targetHandle: "in",
    },
  ],
};

export const BlockDiagramTab: React.FC<BlockDiagramTabProps> = ({ theme: _theme = "dark" }) => {
  const componentInstanceId = useId();

  // Canvas State: Nodes and Edges
  const [nodes, setNodes] = useState<BlockNodeType[]>(
    PRESET_VALID_FEEDBACK.nodes.map((n, i) => (i === 0 ? { ...n, selected: true } : n)),
  );
  const [edges, setEdges] = useState<Edge[]>(PRESET_VALID_FEEDBACK.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(
    PRESET_VALID_FEEDBACK.nodes[0]?.id ?? null,
  );

  // Simulation Execution & Solver Method State (M18a Hard Requirement: RKF45 Adaptive by default)
  const [solverMethod, setSolverMethod] = useState<"rkf45" | "rk4">("rkf45");
  const [simDuration, setSimDuration] = useState<number>(1.5);
  const [simDt, setSimDt] = useState<number>(0.005);
  const [simResult, setSimResult] = useState<DiagramSimulationResult | null>(null);
  const [showScope, setShowScope] = useState<boolean>(true);

  // Validation State from M18a Compiler
  const [compileResult, setCompileResult] = useState<CompiledBlockDiagram | null>(null);
  const [hasRunValidation, setHasRunValidation] = useState<boolean>(false);

  // Palette blocks grouped by category
  const allDefinitions = useMemo(() => getAllBlockDefinitions(), []);
  const categorizedBlocks = useMemo(() => {
    return {
      sources: allDefinitions.filter((b) => b.category === "source"),
      math: allDefinitions.filter((b) => b.category === "math"),
      dynamics: allDefinitions.filter((b) => b.category === "dynamics"),
      sinks: allDefinitions.filter((b) => b.category === "sink"),
    };
  }, [allDefinitions]);

  // Selected Node for Inspector
  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) || null,
    [nodes, selectedNodeId],
  );

  const selectedDef = useMemo(
    () => (selectedNode ? getBlockDefinition(selectedNode.data.blockType) : null),
    [selectedNode],
  );

  // Convert ReactFlow Nodes/Edges to pure BlockDiagram schema
  const currentDiagram: BlockDiagram = useMemo(() => {
    const blocks: BlockNode[] = nodes.map((n) => ({
      id: n.id,
      type: n.data.blockType,
      label: n.data.label,
      params: n.data.params,
      position: n.position,
    }));

    const connections: BlockConnection[] = edges.map((e) => ({
      id: e.id,
      fromBlockId: e.source,
      fromPortId: e.sourceHandle || "out",
      toBlockId: e.target,
      toPortId: e.targetHandle || "in",
    }));

    return { blocks, connections };
  }, [nodes, edges]);

  // Node Changes Handler
  const onNodesChange = useCallback((changes: NodeChange<BlockNodeType>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    setHasRunValidation(false);
  }, []);

  // Edge Changes Handler
  const onEdgesChange = useCallback((changes: EdgeChange<Edge>[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    setHasRunValidation(false);
  }, []);

  // New Connection Handler (Validated: Output -> Input)
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    if (connection.source === connection.target) return; // Prevent self-loop

    const newEdge: Edge = {
      ...connection,
      id: `edge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      animated: true,
      style: { stroke: "#38bdf8", strokeWidth: 2 },
    } as Edge;

    setEdges((eds) => addEdge(newEdge, eds));
    setHasRunValidation(false);
  }, []);

  // Selection Handler
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Add block to canvas
  const handleAddBlock = useCallback((blockType: string) => {
    const def = getBlockDefinition(blockType);
    if (!def) return;

    const id = `${blockType.toLowerCase()}_${Date.now().toString(36).substring(4)}`;
    const newNode: BlockNodeType = {
      id,
      type: "blockNode",
      position: { x: 250 + Math.random() * 80, y: 180 + Math.random() * 80 },
      data: {
        blockType: def.type,
        label: `${def.name}`,
        params: { ...def.defaultParams },
      },
    };

    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(id);
    setHasRunValidation(false);
  }, []);

  // Delete selected node
  const handleDeleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId),
    );
    setSelectedNodeId(null);
    setHasRunValidation(false);
  }, [selectedNodeId]);

  // Update selected node parameter
  const handleUpdateParam = useCallback(
    (paramKey: string, value: unknown) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedNodeId) return n;
          return {
            ...n,
            data: {
              ...n.data,
              params: {
                ...n.data.params,
                [paramKey]: value,
              },
            },
          };
        }),
      );
      setHasRunValidation(false);
    },
    [selectedNodeId],
  );

  // Update selected node label
  const handleUpdateLabel = useCallback(
    (label: string) => {
      if (!selectedNodeId) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, label } } : n)),
      );
      setHasRunValidation(false);
    },
    [selectedNodeId],
  );

  // Run Compilation & Simulation Execution (M18c requirement: validates and runs ODE solver)
  const handleRunSimulation = useCallback(() => {
    const compiled = compileBlockDiagram(currentDiagram);
    setCompileResult(compiled);
    setHasRunValidation(true);

    // Collect offending blocks to highlight them on the canvas
    const offendingBlockIds = new Set<string>();
    const blockErrorMap = new Map<string, string>();

    for (const d of compiled.diagnostics) {
      if (d.blockId) {
        offendingBlockIds.add(d.blockId);
        blockErrorMap.set(d.blockId, d.message);
      }
      if (d.blocksInLoop) {
        for (const bid of d.blocksInLoop) {
          offendingBlockIds.add(bid);
          blockErrorMap.set(bid, d.suggestion || d.message);
        }
      }
    }

    // Update node states with error highlights
    setNodes((nds) =>
      nds.map((n) => {
        const isOff = offendingBlockIds.has(n.id);
        return {
          ...n,
          data: {
            ...n.data,
            isOffending: isOff,
            errorMessage: isOff ? blockErrorMap.get(n.id) : undefined,
          },
        };
      }),
    );

    // If valid, execute simulation using chosen solver (defaulting to RKF45)
    if (compiled.valid) {
      try {
        const res = compiled.runSimulation(
          {
            t0: 0,
            tEnd: simDuration,
            dt: simDt,
            relTol: 1e-5,
            absTol: 1e-7,
          },
          solverMethod,
        );
        setSimResult(res);
        setShowScope(true);
      } catch (err: unknown) {
        console.error("Simulation run error:", err);
      }
    } else {
      setSimResult(null);
    }
  }, [currentDiagram, simDuration, simDt, solverMethod]);

  // Load Preset
  const handleLoadPreset = useCallback(
    (presetKey: "valid" | "algebraic_loop" | "oscillator" | "pid_motor") => {
      setSelectedNodeId(null);
      setCompileResult(null);
      setHasRunValidation(false);
      setSimResult(null);

      if (presetKey === "valid") {
        setNodes(PRESET_VALID_FEEDBACK.nodes);
        setEdges(PRESET_VALID_FEEDBACK.edges);
        setSimDuration(2.0);
      } else if (presetKey === "algebraic_loop") {
        setNodes(PRESET_ALGEBRAIC_LOOP.nodes);
        setEdges(PRESET_ALGEBRAIC_LOOP.edges);
      } else if (presetKey === "oscillator") {
        setNodes(PRESET_OSCILLATOR.nodes);
        setEdges(PRESET_OSCILLATOR.edges);
        setSimDuration(6.28);
      } else if (presetKey === "pid_motor") {
        setNodes(PRESET_PID_MOTOR.nodes.map((n, i) => (i === 2 ? { ...n, selected: true } : n)));
        setEdges(PRESET_PID_MOTOR.edges);
        setSelectedNodeId("pid_ctrl");
        setSimDuration(1.0);
      }
    },
    [],
  );

  // Clear Canvas
  const handleClearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setCompileResult(null);
    setHasRunValidation(false);
    setSimResult(null);
  }, []);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-main)",
      }}
    >
      {/* Top Action Ribbon */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b select-none shrink-0"
        style={{
          borderColor: "var(--border-strong)",
          backgroundColor: "var(--bg-panel)",
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 flex items-center justify-center border rounded-[2px]"
            style={{
              borderColor: "var(--border-strong)",
              backgroundColor: "var(--bg-sunken)",
              color: "#38bdf8",
            }}
          >
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Block-Diagram Simulation Editor
              </span>
              <span
                className="text-[9px] px-1.5 py-0.2 border rounded-[1px] font-mono tracking-wider font-semibold"
                style={{
                  borderColor: "rgba(56, 189, 248, 0.4)",
                  backgroundColor: "rgba(56, 189, 248, 0.1)",
                  color: "#38bdf8",
                }}
              >
                M18c ENGINE &amp; SCOPE
              </span>
            </div>
            <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              General Simulink-style graphical wiring • Topological sort • RKF45/RK4 execution •
              Scope display
            </p>
          </div>
        </div>

        {/* Action Controls & Presets */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset Buttons */}
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-[3px] border border-white/10 text-xs">
            <span className="text-[10px] text-neutral-400 font-mono px-1">PRESETS:</span>
            <button
              type="button"
              onClick={() => handleLoadPreset("valid")}
              className="px-2 py-0.5 rounded-[2px] text-[11px] font-medium transition hover:bg-white/10 text-sky-300"
              title="Valid Feedback Loop with Integrator dynamics"
            >
              1. Valid Feedback
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset("algebraic_loop")}
              className="px-2 py-0.5 rounded-[2px] text-[11px] font-medium transition hover:bg-white/10 text-amber-300"
              title="Pure Algebraic Loop without state blocks (triggers compiler rejection)"
            >
              2. Algebraic Loop Error
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset("oscillator")}
              className="px-2 py-0.5 rounded-[2px] text-[11px] font-medium transition hover:bg-white/10 text-emerald-300"
              title="Harmonic Oscillator reproducing M17"
            >
              3. Oscillator (2-State)
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset("pid_motor")}
              className="px-2 py-0.5 rounded-[2px] text-[11px] font-medium transition hover:bg-white/10 text-purple-300 font-bold"
              title="PID Speed Control of Synthesized DC Motor Actuator (M17 model, tau = 80ms)"
            >
              4. PID DC Motor
            </button>
          </div>

          {/* Solver Settings Ribbon (M18a hard requirement: RKF45 default) */}
          <div className="flex items-center gap-1.5 bg-black/30 px-2 py-1 rounded-[2px] border border-neutral-800 text-[11px] font-mono">
            <label
              htmlFor={`solver-method-select-${componentInstanceId}`}
              className="text-neutral-400 text-[10px]"
            >
              SOLVER:
            </label>
            <select
              id={`solver-method-select-${componentInstanceId}`}
              value={solverMethod}
              onChange={(e) => setSolverMethod(e.target.value as "rkf45" | "rk4")}
              className="bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-[1px] px-1.5 py-0.5 text-[10px] font-mono focus:outline-none"
              title="Select ODE Integration Scheme (RKF45 Adaptive is recommended default for Step sources)"
            >
              <option value="rkf45">RKF45 Adaptive (Default)</option>
              <option value="rk4">RK4 Fixed-Step</option>
            </select>

            <label
              htmlFor={`sim-duration-input-${componentInstanceId}`}
              className="text-neutral-400 pl-1 text-[10px]"
            >
              tEnd:
            </label>
            <input
              id={`sim-duration-input-${componentInstanceId}`}
              type="number"
              step="any"
              value={simDuration}
              onChange={(e) => setSimDuration(Number(e.target.value))}
              className="w-12 bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-[1px] px-1 py-0.5 text-[10px] font-mono text-center focus:outline-none"
            />
            <span className="text-neutral-500 text-[10px]">s</span>

            {solverMethod === "rk4" && (
              <>
                <label
                  htmlFor={`sim-dt-input-${componentInstanceId}`}
                  className="text-neutral-400 pl-1 text-[10px]"
                >
                  dt:
                </label>
                <input
                  id={`sim-dt-input-${componentInstanceId}`}
                  type="number"
                  step="any"
                  value={simDt}
                  onChange={(e) => setSimDt(Number(e.target.value))}
                  className="w-12 bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-[1px] px-1 py-0.5 text-[10px] font-mono text-center focus:outline-none"
                />
                <span className="text-neutral-500 text-[10px]">s</span>
              </>
            )}
          </div>

          {/* Run Simulation Button */}
          <button
            type="button"
            onClick={handleRunSimulation}
            className="px-3.5 py-1 rounded-[2px] text-xs font-bold tracking-wide transition flex items-center gap-1.5 shadow-sm cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white"
            title="Compile Block Diagram & Execute Numerical ODE Simulation"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Run Simulation</span>
          </button>

          {/* Scope Toggle Button (if simulation has run) */}
          {simResult && (
            <button
              type="button"
              onClick={() => setShowScope(!showScope)}
              className={`px-2.5 py-1 rounded-[2px] text-xs font-mono transition flex items-center gap-1 border ${
                showScope
                  ? "bg-amber-950 border-amber-700 text-amber-300 font-bold"
                  : "bg-neutral-900 border-neutral-700 text-neutral-400 hover:text-neutral-200"
              }`}
              title="Toggle Scope Waveform Pane"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Scope</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleClearCanvas}
            className="eng-btn text-[11px]"
            title="Clear all nodes and wires"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Compiler Diagnostic Banner (Inline feedback) */}
      {hasRunValidation && compileResult && (
        <div
          className={`px-4 py-2 border-b text-xs flex items-center justify-between shrink-0 ${
            compileResult.valid
              ? "bg-emerald-950/70 border-emerald-700/80 text-emerald-200"
              : "bg-red-950/70 border-red-700/80 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {compileResult.valid ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <div>
              <span className="font-bold uppercase tracking-wider text-[10px] mr-2">
                {compileResult.valid ? "Diagram Validated:" : "Validation Error:"}
              </span>
              <span>
                {compileResult.valid
                  ? `Topology is executable: ${compileResult.numStates} continuous state variable(s), ${compileResult.algebraicOrder.length} direct-feedthrough block(s) in topological order.`
                  : compileResult.diagnostics[0]?.message}
              </span>
              {!compileResult.valid && compileResult.diagnostics[0]?.suggestion && (
                <span className="block text-[11px] text-amber-300 mt-0.5 font-mono">
                  Suggestion: {compileResult.diagnostics[0].suggestion}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-300">
            <span>Blocks: {nodes.length}</span>
            <span>·</span>
            <span>Connections: {edges.length}</span>
          </div>
        </div>
      )}

      {/* Main Workspace: Palette (Left) + Canvas (Center) + Inspector (Right) */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Left Palette: Categorized Blocks */}
        <aside
          className="w-full md:w-56 border-b md:border-b-0 md:border-r flex flex-col shrink-0 select-none overflow-y-auto"
          style={{
            borderColor: "var(--border-strong)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div className="p-3 border-b border-neutral-800 text-[10px] uppercase font-bold tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            <span>Block Palette</span>
          </div>

          <div className="p-2.5 space-y-4 text-xs">
            {/* Category 1: Sources */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Sources</span>
              </div>
              <div className="space-y-1">
                {categorizedBlocks.sources.map((b) => (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() => handleAddBlock(b.type)}
                    className="w-full text-left px-2 py-1.5 rounded-[2px] border border-neutral-800 hover:border-emerald-500/50 hover:bg-emerald-950/20 text-neutral-300 transition flex items-center justify-between group"
                  >
                    <span className="font-semibold text-[11px]">{b.name}</span>
                    <Plus className="w-3 h-3 text-neutral-500 group-hover:text-emerald-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Category 2: Math / Algebraic */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-sky-400 font-bold mb-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span>Math &amp; Algebraic</span>
              </div>
              <div className="space-y-1">
                {categorizedBlocks.math.map((b) => (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() => handleAddBlock(b.type)}
                    className="w-full text-left px-2 py-1.5 rounded-[2px] border border-neutral-800 hover:border-sky-500/50 hover:bg-sky-950/20 text-neutral-300 transition flex items-center justify-between group"
                  >
                    <span className="font-semibold text-[11px]">{b.name}</span>
                    <Plus className="w-3 h-3 text-neutral-500 group-hover:text-sky-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Category 3: Dynamics / State */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-purple-400 font-bold mb-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                <span>Dynamics (State)</span>
              </div>
              <div className="space-y-1">
                {categorizedBlocks.dynamics.map((b) => (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() => handleAddBlock(b.type)}
                    className="w-full text-left px-2 py-1.5 rounded-[2px] border border-neutral-800 hover:border-purple-500/50 hover:bg-purple-950/20 text-neutral-300 transition flex items-center justify-between group"
                  >
                    <span className="font-semibold text-[11px]">{b.name}</span>
                    <Plus className="w-3 h-3 text-neutral-500 group-hover:text-purple-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Category 4: Sinks */}
            <div>
              <div className="text-[9px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-1.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Sinks</span>
              </div>
              <div className="space-y-1">
                {categorizedBlocks.sinks.map((b) => (
                  <button
                    key={b.type}
                    type="button"
                    onClick={() => handleAddBlock(b.type)}
                    className="w-full text-left px-2 py-1.5 rounded-[2px] border border-neutral-800 hover:border-amber-500/50 hover:bg-amber-950/20 text-neutral-300 transition flex items-center justify-between group"
                  >
                    <span className="font-semibold text-[11px]">{b.name}</span>
                    <Plus className="w-3 h-3 text-neutral-500 group-hover:text-amber-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center: ReactFlow Wiring Canvas */}
        <div
          className="flex-1 h-full min-h-[450px] relative bg-[#090d14]"
          id="block-diagram-canvas"
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
            className="select-none"
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls className="!bg-neutral-900 !border-neutral-700 !fill-white" />
          </ReactFlow>

          {/* Quick instructions floating badge */}
          <div className="absolute top-3 left-3 pointer-events-none text-[10px] font-mono text-neutral-400 bg-neutral-950/80 px-2.5 py-1 border border-neutral-800 rounded-[2px] shadow-sm backdrop-blur-sm">
            Drag ports to wire • Click block to edit params • Press Delete to remove
          </div>
        </div>

        {/* Right: Inspector Panel */}
        <aside
          className="w-full md:w-72 border-t md:border-t-0 md:border-l flex flex-col shrink-0 overflow-y-auto"
          style={{
            borderColor: "var(--border-strong)",
            backgroundColor: "var(--bg-panel)",
          }}
        >
          <div className="p-3 border-b border-neutral-800 text-[10px] uppercase font-bold tracking-wider text-neutral-400 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              <span>Block Inspector</span>
            </div>
            {selectedNode && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                className="text-red-400 hover:text-red-300 p-1 rounded-[2px] hover:bg-red-950/40 transition"
                title="Delete Selected Block"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-3 text-xs space-y-4">
            {selectedNode ? (
              <>
                {/* Block Identity */}
                <div className="space-y-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block mb-1">
                      BLOCK LABEL
                    </span>
                    <input
                      type="text"
                      value={selectedNode.data.label}
                      onChange={(e) => handleUpdateLabel(e.target.value)}
                      className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono focus:outline-none"
                      style={{
                        backgroundColor: "var(--bg-sunken)",
                        borderColor: "var(--border-app)",
                        color: "var(--text-main)",
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-1">
                    <span>Type: {selectedNode.data.blockType}</span>
                    <span className="text-[9px] uppercase px-1 py-0.2 border rounded-[1px] border-neutral-800">
                      {selectedDef?.category}
                    </span>
                  </div>
                </div>

                {/* Block Parameters */}
                <div className="space-y-3 pt-2 border-t border-neutral-800">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
                    PARAMETERS
                  </span>

                  {/* Dynamic Inputs Based on Block Type */}
                  {selectedNode.data.blockType === "Gain" && (
                    <div>
                      <label
                        htmlFor={`param-gain-${componentInstanceId}`}
                        className="text-[10px] font-mono text-neutral-400 block mb-1"
                      >
                        Gain Factor (K):
                      </label>
                      <input
                        id={`param-gain-${componentInstanceId}`}
                        type="number"
                        step="any"
                        value={Number(selectedNode.data.params.gain ?? 1.0)}
                        onChange={(e) =>
                          handleUpdateParam("gain", Number.parseFloat(e.target.value))
                        }
                        className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                        style={{
                          backgroundColor: "var(--bg-sunken)",
                          borderColor: "var(--border-app)",
                          color: "var(--text-main)",
                        }}
                      />
                    </div>
                  )}

                  {selectedNode.data.blockType === "Constant" && (
                    <div>
                      <label
                        htmlFor={`param-val-${componentInstanceId}`}
                        className="text-[10px] font-mono text-neutral-400 block mb-1"
                      >
                        Constant Value:
                      </label>
                      <input
                        id={`param-val-${componentInstanceId}`}
                        type="number"
                        step="any"
                        value={Number(selectedNode.data.params.value ?? 1.0)}
                        onChange={(e) =>
                          handleUpdateParam("value", Number.parseFloat(e.target.value))
                        }
                        className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                        style={{
                          backgroundColor: "var(--bg-sunken)",
                          borderColor: "var(--border-app)",
                          color: "var(--text-main)",
                        }}
                      />
                    </div>
                  )}

                  {selectedNode.data.blockType === "Step" && (
                    <div className="space-y-2">
                      <div>
                        <label
                          htmlFor={`param-steptime-${componentInstanceId}`}
                          className="text-[10px] font-mono text-neutral-400 block mb-1"
                        >
                          Step Time (s):
                        </label>
                        <input
                          id={`param-steptime-${componentInstanceId}`}
                          type="number"
                          step="any"
                          value={Number(selectedNode.data.params.stepTime ?? 1.0)}
                          onChange={(e) =>
                            handleUpdateParam("stepTime", Number.parseFloat(e.target.value))
                          }
                          className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                          style={{
                            backgroundColor: "var(--bg-sunken)",
                            borderColor: "var(--border-app)",
                            color: "var(--text-main)",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`param-finalval-${componentInstanceId}`}
                          className="text-[10px] font-mono text-neutral-400 block mb-1"
                        >
                          Final Value:
                        </label>
                        <input
                          id={`param-finalval-${componentInstanceId}`}
                          type="number"
                          step="any"
                          value={Number(selectedNode.data.params.finalValue ?? 1.0)}
                          onChange={(e) =>
                            handleUpdateParam("finalValue", Number.parseFloat(e.target.value))
                          }
                          className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                          style={{
                            backgroundColor: "var(--bg-sunken)",
                            borderColor: "var(--border-app)",
                            color: "var(--text-main)",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.data.blockType === "Sum" && (
                    <div>
                      <label
                        htmlFor={`param-signs-${componentInstanceId}`}
                        className="text-[10px] font-mono text-neutral-400 block mb-1"
                      >
                        Port Signs (e.g. "+-", "++", "+-+"):
                      </label>
                      <input
                        id={`param-signs-${componentInstanceId}`}
                        type="text"
                        value={String(selectedNode.data.params.signs ?? "+-")}
                        onChange={(e) => handleUpdateParam("signs", e.target.value)}
                        className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                        style={{
                          backgroundColor: "var(--bg-sunken)",
                          borderColor: "var(--border-app)",
                          color: "var(--text-main)",
                        }}
                      />
                    </div>
                  )}

                  {selectedNode.data.blockType === "Integrator" && (
                    <div>
                      <label
                        htmlFor={`param-x0-${componentInstanceId}`}
                        className="text-[10px] font-mono text-neutral-400 block mb-1"
                      >
                        Initial Condition x(0):
                      </label>
                      <input
                        id={`param-x0-${componentInstanceId}`}
                        type="number"
                        step="any"
                        value={Number(selectedNode.data.params.initialCondition ?? 0.0)}
                        onChange={(e) =>
                          handleUpdateParam("initialCondition", Number.parseFloat(e.target.value))
                        }
                        className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                        style={{
                          backgroundColor: "var(--bg-sunken)",
                          borderColor: "var(--border-app)",
                          color: "var(--text-main)",
                        }}
                      />
                    </div>
                  )}

                  {selectedNode.data.blockType === "TransferFunction" && (
                    <div className="space-y-2">
                      <div>
                        <label
                          htmlFor={`param-num-${componentInstanceId}`}
                          className="text-[10px] font-mono text-neutral-400 block mb-1"
                        >
                          Numerator Polynomial [b_m, ..., b_0]:
                        </label>
                        <input
                          id={`param-num-${componentInstanceId}`}
                          type="text"
                          value={
                            Array.isArray(selectedNode.data.params.numerator)
                              ? (selectedNode.data.params.numerator as number[]).join(", ")
                              : "1.0"
                          }
                          onChange={(e) => {
                            const arr = e.target.value
                              .split(",")
                              .map((v) => Number.parseFloat(v.trim()))
                              .filter((n) => !Number.isNaN(n));
                            handleUpdateParam("numerator", arr);
                          }}
                          className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                          style={{
                            backgroundColor: "var(--bg-sunken)",
                            borderColor: "var(--border-app)",
                            color: "var(--text-main)",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`param-den-${componentInstanceId}`}
                          className="text-[10px] font-mono text-neutral-400 block mb-1"
                        >
                          Denominator Polynomial [a_n, ..., a_0]:
                        </label>
                        <input
                          id={`param-den-${componentInstanceId}`}
                          type="text"
                          value={
                            Array.isArray(selectedNode.data.params.denominator)
                              ? (selectedNode.data.params.denominator as number[]).join(", ")
                              : "1.0, 1.0"
                          }
                          onChange={(e) => {
                            const arr = e.target.value
                              .split(",")
                              .map((v) => Number.parseFloat(v.trim()))
                              .filter((n) => !Number.isNaN(n));
                            handleUpdateParam("denominator", arr);
                          }}
                          className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                          style={{
                            backgroundColor: "var(--bg-sunken)",
                            borderColor: "var(--border-app)",
                            color: "var(--text-main)",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedNode.data.blockType === "PID" && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        <div>
                          <label
                            htmlFor={`param-kp-${componentInstanceId}`}
                            className="text-[9px] font-mono text-neutral-400 block mb-0.5"
                          >
                            Kp:
                          </label>
                          <input
                            id={`param-kp-${componentInstanceId}`}
                            type="number"
                            step="any"
                            value={Number(selectedNode.data.params.Kp ?? 1.0)}
                            onChange={(e) =>
                              handleUpdateParam("Kp", Number.parseFloat(e.target.value))
                            }
                            className="w-full border rounded-[2px] px-1.5 py-1 text-xs font-mono"
                            style={{
                              backgroundColor: "var(--bg-sunken)",
                              borderColor: "var(--border-app)",
                              color: "var(--text-main)",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`param-ki-${componentInstanceId}`}
                            className="text-[9px] font-mono text-neutral-400 block mb-0.5"
                          >
                            Ki:
                          </label>
                          <input
                            id={`param-ki-${componentInstanceId}`}
                            type="number"
                            step="any"
                            value={Number(selectedNode.data.params.Ki ?? 0.0)}
                            onChange={(e) =>
                              handleUpdateParam("Ki", Number.parseFloat(e.target.value))
                            }
                            className="w-full border rounded-[2px] px-1.5 py-1 text-xs font-mono"
                            style={{
                              backgroundColor: "var(--bg-sunken)",
                              borderColor: "var(--border-app)",
                              color: "var(--text-main)",
                            }}
                          />
                        </div>
                        <div>
                          <label
                            htmlFor={`param-kd-${componentInstanceId}`}
                            className="text-[9px] font-mono text-neutral-400 block mb-0.5"
                          >
                            Kd:
                          </label>
                          <input
                            id={`param-kd-${componentInstanceId}`}
                            type="number"
                            step="any"
                            value={Number(selectedNode.data.params.Kd ?? 0.0)}
                            onChange={(e) =>
                              handleUpdateParam("Kd", Number.parseFloat(e.target.value))
                            }
                            className="w-full border rounded-[2px] px-1.5 py-1 text-xs font-mono"
                            style={{
                              backgroundColor: "var(--bg-sunken)",
                              borderColor: "var(--border-app)",
                              color: "var(--text-main)",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedNode.data.blockType === "Scope" && (
                    <div>
                      <label
                        htmlFor={`param-scope-title-${componentInstanceId}`}
                        className="text-[10px] font-mono text-neutral-400 block mb-1"
                      >
                        Scope Plot Title:
                      </label>
                      <input
                        id={`param-scope-title-${componentInstanceId}`}
                        type="text"
                        value={String(selectedNode.data.params.title ?? "Scope Signal")}
                        onChange={(e) => handleUpdateParam("title", e.target.value)}
                        className="w-full border rounded-[2px] px-2 py-1 text-xs font-mono"
                        style={{
                          backgroundColor: "var(--bg-sunken)",
                          borderColor: "var(--border-app)",
                          color: "var(--text-main)",
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Ports Info */}
                <div className="pt-2 border-t border-neutral-800 space-y-1 text-[11px] font-mono text-neutral-400">
                  <div className="flex justify-between">
                    <span>Inputs:</span>
                    <span>{selectedDef?.inputs.map((p) => p.id).join(", ") || "none"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Outputs:</span>
                    <span>{selectedDef?.outputs.map((p) => p.id).join(", ") || "none"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Direct Feedthrough:</span>
                    <span
                      className={
                        selectedDef?.hasDirectFeedthrough(selectedNode.data.params)
                          ? "text-amber-400 font-bold"
                          : "text-emerald-400 font-bold"
                      }
                    >
                      {selectedDef?.hasDirectFeedthrough(selectedNode.data.params) ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-neutral-500 space-y-2">
                <Sliders className="w-6 h-6 mx-auto opacity-40" />
                <p className="text-[11px]">
                  Select a block on the canvas to inspect its parameters.
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Scope Waveform Viewer Pane (M18c Requirement) */}
      {showScope && simResult && Object.keys(simResult.scopeSignals).length > 0 && (
        <BlockScopeViewer
          signals={simResult.scopeSignals}
          tEnd={simDuration}
          solverMethod={solverMethod}
          onClose={() => setShowScope(false)}
        />
      )}
    </div>
  );
};
