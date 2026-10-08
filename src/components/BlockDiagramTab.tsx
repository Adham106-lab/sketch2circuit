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
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Activity,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  HelpCircle,
  Maximize2,
  Play,
  Plus,
  Sliders,
  Trash2,
  Workflow,
  X,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { BlockNodeComponent, type BlockNodeType } from "./BlockNodeRenderer.js";
import { BlockScopeViewer, type ScopeSignalData } from "./BlockScopeViewer.js";

interface BlockDiagramTabProps {
  circuit?: unknown;
  sketchName?: string;
  theme?: "dark" | "light";
}

const nodeTypes: NodeTypes = {
  blockNode: BlockNodeComponent as unknown as React.ComponentType<NodeProps<BlockNodeType>>,
};

// Explicit node dimensions helper ensuring React Flow viewport bounds are computed immediately
function withDimensions(nodes: BlockNodeType[]): BlockNodeType[] {
  return nodes.map((n) => ({
    ...n,
    width: 170,
    height: 75,
    measured: { width: 170, height: 75 },
  }));
}

// Preset 1: Valid closed-loop dynamic filter
const PRESET_VALID_FEEDBACK: { nodes: BlockNodeType[]; edges: Edge[] } = {
  nodes: withDimensions([
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
  ]),
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
  nodes: withDimensions([
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
  ]),
  edges: [
    { id: "e1", source: "ref_src", sourceHandle: "out", target: "sum_alg", targetHandle: "in1" },
    { id: "e2", source: "sum_alg", sourceHandle: "out", target: "gain_alg", targetHandle: "in" },
    // Direct algebraic feedback into Sum with no state block:
    { id: "e3", source: "gain_alg", sourceHandle: "out", target: "sum_alg", targetHandle: "in2" },
  ],
};

// Preset 3: Harmonic Oscillator
const PRESET_OSCILLATOR: { nodes: BlockNodeType[]; edges: Edge[] } = {
  nodes: withDimensions([
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
  ]),
  edges: [
    { id: "e1", source: "gain_accel", sourceHandle: "out", target: "int_vel", targetHandle: "in" },
    { id: "e2", source: "int_vel", sourceHandle: "out", target: "int_pos", targetHandle: "in" },
    { id: "e3", source: "int_pos", sourceHandle: "out", target: "gain_accel", targetHandle: "in" },
    { id: "e4", source: "int_pos", sourceHandle: "out", target: "scope_pos", targetHandle: "in" },
  ],
};

// Preset 4: PID Closed-Loop DC Motor Actuator Speed Control (M17 Actuator Model, tau = 80ms)
const PRESET_PID_MOTOR: { nodes: BlockNodeType[]; edges: Edge[] } = {
  nodes: withDimensions([
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
  ]),
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

const BlockDiagramTabContent: React.FC<BlockDiagramTabProps> = ({ theme: _theme = "dark" }) => {
  const componentInstanceId = useId();
  const { fitView } = useReactFlow();
  const [showUsageGuide, setShowUsageGuide] = useState<boolean>(false);

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
  const [simDuration, setSimDuration] = useState<number>(2.0);
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

  // Scope blocks currently configured on the canvas
  const scopeBlocks = useMemo(
    () => nodes.filter((n) => n.data.blockType === "Scope"),
    [nodes],
  );

  // Fallback empty scope signals before any simulation has been executed
  const emptyScopeSignals: Record<string, ScopeSignalData> = useMemo(() => {
    const map: Record<string, ScopeSignalData> = {};
    for (const b of scopeBlocks) {
      map[b.id] = {
        blockId: b.id,
        title: (b.data.params?.title as string) || b.data.label || "Scope Signal",
        points: [],
      };
    }
    return map;
  }, [scopeBlocks]);

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

  // Initial mount fitView to ensure viewport is focused on blocks
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 60);
    return () => clearTimeout(timer);
  }, [fitView]);

  // Add block to canvas
  const handleAddBlock = useCallback((blockType: string) => {
    const def = getBlockDefinition(blockType);
    if (!def) return;

    const id = `${blockType.toLowerCase()}_${Date.now().toString(36).substring(4)}`;
    const newNode: BlockNodeType = {
      id,
      type: "blockNode",
      position: { x: 250 + Math.random() * 80, y: 180 + Math.random() * 80 },
      width: 170,
      height: 75,
      measured: { width: 170, height: 75 },
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

        // Smoothly scroll Scope waveform viewer into view
        setTimeout(() => {
          document.getElementById("block-scope-viewer")?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        }, 50);
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

      // Re-fit canvas viewport after preset layout
      setTimeout(() => {
        fitView({ padding: 0.2, duration: 250 });
      }, 50);
    },
    [fitView],
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
      className="flex-1 flex flex-col overflow-y-auto"
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

          {/* Scope Toggle Button (available if diagram has scope blocks or simulation has run) */}
          {(simResult || scopeBlocks.length > 0) && (
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

          <button
            type="button"
            onClick={() => setShowUsageGuide(true)}
            className="eng-btn text-[11px] flex items-center gap-1 text-sky-300 border-sky-800/80 bg-sky-950/30 hover:bg-sky-900/40"
            title="Open In-App Usage Guide & Solver Reference"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Usage Guide</span>
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
      <div
        className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-[600px] shrink-0"
        style={{ minHeight: "600px" }}
      >
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
          className="flex-1 h-full min-h-[600px] w-full relative bg-[#090d14]"
          id="block-diagram-canvas"
          style={{ minHeight: "600px", height: "100%" }}
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
            fitViewOptions={{ padding: 0.2 }}
            attributionPosition="bottom-left"
            className="w-full h-full select-none"
            style={{ width: "100%", height: "100%", minHeight: "600px" }}
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls className="!bg-neutral-900 !border-neutral-700 !fill-white" />
          </ReactFlow>

          {/* Quick instructions floating badge & action toolbar */}
          <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-mono text-neutral-400 bg-neutral-950/90 px-2.5 py-1 border border-neutral-800 rounded-[2px] shadow-sm backdrop-blur-sm pointer-events-none">
              Drag ports to wire • Click block to edit params • Press Delete to remove
            </div>
            <button
              type="button"
              onClick={() => setShowUsageGuide(true)}
              className="text-[10px] font-mono text-sky-400 bg-neutral-950/90 hover:bg-neutral-900 px-2 py-1 border border-sky-800/80 rounded-[2px] shadow-sm flex items-center gap-1 transition cursor-pointer"
              title="Open In-App Usage Guide"
            >
              <BookOpen className="w-3 h-3" />
              <span>Usage Guide</span>
            </button>
            <button
              type="button"
              onClick={() => fitView({ padding: 0.2, duration: 200 })}
              className="text-[10px] font-mono text-neutral-300 bg-neutral-950/90 hover:bg-neutral-900 px-2 py-1 border border-neutral-700 rounded-[2px] shadow-sm flex items-center gap-1 transition cursor-pointer"
              title="Fit all blocks into view"
            >
              <Maximize2 className="w-3 h-3 text-emerald-400" />
              <span>Fit View</span>
            </button>
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
      {showScope && (simResult || scopeBlocks.length > 0) && (
        <BlockScopeViewer
          signals={simResult?.scopeSignals ?? emptyScopeSignals}
          tEnd={simDuration}
          solverMethod={solverMethod}
          hasRun={Boolean(simResult && simResult.success)}
          onClose={() => setShowScope(false)}
        />
      )}

      {/* In-App Usage Guide Modal (Part 2 UX Addition) */}
      <BlockDiagramUsageGuideModal
        isOpen={showUsageGuide}
        onClose={() => setShowUsageGuide(false)}
      />
    </div>
  );
};

interface UsageGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BlockDiagramUsageGuideModal: React.FC<UsageGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="usage-guide-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col border shadow-2xl rounded-[3px] overflow-hidden"
        style={{
          backgroundColor: "var(--bg-panel)",
          borderColor: "var(--border-strong)",
          color: "var(--text-main)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b shrink-0"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
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
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2
                  id="usage-guide-title"
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  Block-Diagram Simulation Editor — In-App Usage Guide
                </h2>
                <span
                  className="text-[9px] px-1.5 py-0.2 border rounded-[1px] font-mono tracking-wider font-semibold"
                  style={{
                    borderColor: "rgba(56, 189, 248, 0.4)",
                    backgroundColor: "rgba(56, 189, 248, 0.1)",
                    color: "#38bdf8",
                  }}
                >
                  M18 SPECIFICATION
                </span>
              </div>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Continuous-Time ODE Modeling • Graphical Wiring • Numerical Solvers • Algebraic Loop Detection
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[2px] border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 text-neutral-300 transition"
            title="Close Usage Guide (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs leading-relaxed">
          {/* Section 1: Quick Start & Canvas Wiring */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-800">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <h3 className="font-bold uppercase tracking-wider text-[11px] text-emerald-400">
                1. Quick Start &amp; Graphical Canvas Controls
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div
                className="p-3 border rounded-[2px]"
                style={{
                  backgroundColor: "var(--bg-sunken)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="font-bold text-[10px] uppercase text-sky-400 mb-1">
                  Adding &amp; Wiring Blocks
                </div>
                <ul className="space-y-1 text-[11px] list-disc list-inside text-neutral-300">
                  <li>
                    <strong className="text-neutral-100">Add Blocks:</strong> Click any block in the left <em>Block Palette</em> (Sources, Math, Dynamics, Sinks).
                  </li>
                  <li>
                    <strong className="text-neutral-100">Connect Wires:</strong> Drag from an output port (<span className="text-emerald-400 font-bold">green dot</span> on right) to an input port (<span className="text-sky-400 font-bold">blue dot</span> on left).
                  </li>
                  <li>
                    <strong className="text-neutral-100">Port Typing:</strong> Self-loops on the same block are prohibited by default. Multi-input blocks (Sum, Product) accept multiple named wires.
                  </li>
                </ul>
              </div>

              <div
                className="p-3 border rounded-[2px]"
                style={{
                  backgroundColor: "var(--bg-sunken)",
                  borderColor: "var(--border-subtle)",
                }}
              >
                <div className="font-bold text-[10px] uppercase text-purple-400 mb-1">
                  Selecting &amp; Editing Parameters
                </div>
                <ul className="space-y-1 text-[11px] list-disc list-inside text-neutral-300">
                  <li>
                    <strong className="text-neutral-100">Select Block:</strong> Click any block on the canvas to open its parameters in the right <em>Block Inspector</em>.
                  </li>
                  <li>
                    <strong className="text-neutral-100">Tune Live:</strong> Modify gains, time constants, transfer function polynomials, and setpoints in real-time.
                  </li>
                  <li>
                    <strong className="text-neutral-100">Delete Block:</strong> Press <kbd className="px-1 border rounded bg-neutral-800 text-[10px]">Delete</kbd> or click the red trash icon in the Inspector.
                  </li>
                  <li>
                    <strong className="text-neutral-100">Fit View:</strong> Click <em>Fit View</em> on the top-left canvas badge or Controls panel to re-center all blocks.
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2: Numerical Solvers & Discontinuity Handling */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-800">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <h3 className="font-bold uppercase tracking-wider text-[11px] text-sky-400">
                2. Numerical ODE Solvers (RKF45 Adaptive vs. RK4 Fixed-Step)
              </h3>
            </div>
            <div className="space-y-2 text-[11px] text-neutral-300">
              <p>
                The in-browser simulation engine compiles the block diagram into state-space ordinary differential equations (ODEs) of the form <code className="px-1 py-0.5 bg-neutral-900 border border-neutral-800 rounded font-mono">dx/dt = f(t, x, u)</code> and integrates them continuously:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div
                  className="p-3 border rounded-[2px]"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[10px] uppercase text-emerald-400 font-mono">
                      RKF45 Adaptive (Default Recommended)
                    </span>
                    <span className="text-[9px] px-1 py-0.2 bg-emerald-950 border border-emerald-700 text-emerald-300 rounded font-mono">
                      ACCURACY: &lt; 10⁻⁶
                    </span>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-neutral-300">
                    Embeds 4th and 5th-order Runge-Kutta-Fehlberg approximations to estimate local truncation error at every step. It automatically refines time step size <code className="text-sky-300">dt</code> near steep transients and step discontinuities, avoiding artificial simulation offsets.
                  </p>
                </div>

                <div
                  className="p-3 border rounded-[2px]"
                  style={{
                    backgroundColor: "var(--bg-sunken)",
                    borderColor: "var(--border-subtle)",
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-[10px] uppercase text-amber-400 font-mono">
                      RK4 Fixed-Step
                    </span>
                    <span className="text-[9px] px-1 py-0.2 bg-amber-950 border border-amber-700 text-amber-300 rounded font-mono">
                      FIXED dt
                    </span>
                  </div>
                  <p className="text-[10.5px] leading-relaxed text-neutral-300">
                    Classic 4th-order Runge-Kutta evaluation with a constant user-specified <code className="text-amber-300">dt</code>. Suitable for smooth harmonic oscillators, but suffers from an <code className="text-amber-300">O(dt)</code> sampling error across non-aligned discontinuous transitions (Step inputs).
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-neutral-900/80 border border-neutral-800 rounded-[2px] font-mono text-[10px] text-neutral-400">
                <span className="text-amber-400 font-bold">DISCONTINUITY NOTICE (DOC §19): </span>
                When simulating diagrams containing <code className="text-sky-300">Step</code> blocks, stage <code className="text-neutral-200">k4</code> of fixed-step RK4 evaluates across the discontinuity boundary during the step immediately preceding it, creating an initial offset of <code className="text-neutral-200">(dt/6)·Δu</code>. Always select <strong>RKF45 Adaptive</strong> for circuits with step sources.
              </div>
            </div>
          </section>

          {/* Section 3: Algebraic Loops & Topological Order */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-800">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <h3 className="font-bold uppercase tracking-wider text-[11px] text-amber-400">
                3. Algebraic Loops &amp; Topological Validation (Tarjan SCC)
              </h3>
            </div>
            <div className="space-y-2 text-[11px] text-neutral-300">
              <p>
                Before executing ODE integration, the compiler runs a topological sort and strongly connected component (SCC) cycle analysis on all direct-feedthrough connections:
              </p>
              <ul className="space-y-1 list-disc list-inside text-neutral-300">
                <li>
                  <strong>Direct Feedthrough:</strong> Blocks where output depends strictly on instantaneous inputs with no state delay (<code className="text-sky-300">Sum</code>, <code className="text-sky-300">Gain</code>, <code className="text-sky-300">Product</code>, <code className="text-sky-300">Saturation</code>, <code className="text-sky-300">Abs</code>).
                </li>
                <li>
                  <strong>Algebraic Loop Error:</strong> If direct-feedthrough blocks form a closed feedback loop with no state block (e.g. <code className="text-red-400 font-mono">Sum → Gain → Sum</code>), the circuit represents an unsolvable instantaneous circular algebraic constraint.
                </li>
                <li>
                  <strong>Resolution:</strong> Insert an <strong>Integrator (1/s)</strong> or a <strong>Delay (T)</strong> into the feedback path. Dynamic state blocks break algebraic loops by introducing independent continuous state variables (<code className="text-emerald-400 font-mono">dx/dt</code>).
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4: Standard Library Blocks & Categories */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-800">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <h3 className="font-bold uppercase tracking-wider text-[11px] text-purple-400">
                4. Standard Library Block Reference
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              <div className="p-2 border border-emerald-900/50 bg-emerald-950/20 rounded-[2px]">
                <div className="font-bold text-emerald-400 uppercase mb-1">Sources</div>
                <ul className="space-y-0.5 text-neutral-300">
                  <li>• <strong>Constant:</strong> Fixed scalar value</li>
                  <li>• <strong>Step:</strong> Step transition at t_step</li>
                  <li>• <strong>Ramp:</strong> Linear slope ramp</li>
                  <li>• <strong>Sine:</strong> Sinusoidal oscillator</li>
                </ul>
              </div>

              <div className="p-2 border border-sky-900/50 bg-sky-950/20 rounded-[2px]">
                <div className="font-bold text-sky-400 uppercase mb-1">Math &amp; Algebraic</div>
                <ul className="space-y-0.5 text-neutral-300">
                  <li>• <strong>Gain:</strong> Linear multiplier (K·u)</li>
                  <li>• <strong>Sum:</strong> Multi-input adder/subtractor</li>
                  <li>• <strong>Product:</strong> Multiplier (u1 × u2)</li>
                  <li>• <strong>Saturation:</strong> Clamped upper/lower limits</li>
                  <li>• <strong>Abs:</strong> Absolute value (|u|)</li>
                </ul>
              </div>

              <div className="p-2 border border-purple-900/50 bg-purple-950/20 rounded-[2px]">
                <div className="font-bold text-purple-400 uppercase mb-1">Dynamics (State)</div>
                <ul className="space-y-0.5 text-neutral-300">
                  <li>• <strong>Integrator:</strong> 1/s dynamic state</li>
                  <li>• <strong>TransferFunction:</strong> N(s)/D(s) state-space</li>
                  <li>• <strong>PID Controller:</strong> Parallel Kp + Ki/s + Kd·s</li>
                  <li>• <strong>Delay:</strong> Fixed transport delay T</li>
                </ul>
              </div>

              <div className="p-2 border border-amber-900/50 bg-amber-950/20 rounded-[2px]">
                <div className="font-bold text-amber-400 uppercase mb-1">Sinks &amp; Display</div>
                <ul className="space-y-0.5 text-neutral-300">
                  <li>• <strong>Scope:</strong> Time-domain signal recorder</li>
                  <li>• Records waveforms over full tEnd</li>
                  <li>• Interactive hover inspect readout</li>
                  <li>• Multi-channel comparison support</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 5: Presets Overview */}
          <section className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-neutral-800">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <h3 className="font-bold uppercase tracking-wider text-[11px] text-cyan-400">
                5. Built-in Engineering Presets
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10.5px]">
              <div className="p-2.5 bg-neutral-900/60 border border-neutral-800 rounded-[2px]">
                <div className="font-bold text-sky-300 font-mono">1. Valid Feedback Loop</div>
                <p className="text-neutral-400 text-[10px] mt-0.5">
                  Closed-loop 1st order dynamic system with Step input, error summation, Integrator, and unity feedback gain. Validated with 1 continuous state variable.
                </p>
              </div>

              <div className="p-2.5 bg-neutral-900/60 border border-neutral-800 rounded-[2px]">
                <div className="font-bold text-amber-300 font-mono">2. Algebraic Loop Error</div>
                <p className="text-neutral-400 text-[10px] mt-0.5">
                  Direct algebraic feedback between Sum and Gain without state blocks. Intentionally triggers compiler rejection and diagnostic guidance to demonstrate loop safety.
                </p>
              </div>

              <div className="p-2.5 bg-neutral-900/60 border border-neutral-800 rounded-[2px]">
                <div className="font-bold text-emerald-300 font-mono">3. Harmonic Oscillator (2-State)</div>
                <p className="text-neutral-400 text-[10px] mt-0.5">
                  Second-order undamped harmonic oscillator (x&apos;&apos; = -omega^2 * x) composed of dual coupled Integrators and negative feedback gain. Produces sinusoidal state-space orbits.
                </p>
              </div>

              <div className="p-2.5 bg-neutral-900/60 border border-neutral-800 rounded-[2px]">
                <div className="font-bold text-purple-300 font-mono">4. PID DC Motor Actuator Speed Control</div>
                <p className="text-neutral-400 text-[10px] mt-0.5">
                  Complete closed-loop actuator control benchmark matching the M17 physical DC motor model (tau = 80ms, H(s) = 12.5 / (s + 12.5)) with filtered PID speed regulating to 1000 RPM.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-2.5 border-t shrink-0 text-xs"
          style={{
            backgroundColor: "var(--bg-subpanel)",
            borderColor: "var(--border-app)",
          }}
        >
          <span className="text-[10px] text-neutral-400 font-mono">
            Press <kbd className="px-1 border rounded bg-neutral-800 text-[9px]">Esc</kbd> or click outside to dismiss
          </span>
          <button
            type="button"
            onClick={onClose}
            className="eng-btn primary text-[11px]"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};

export const BlockDiagramTab: React.FC<BlockDiagramTabProps> = (props) => {
  return (
    <ReactFlowProvider>
      <BlockDiagramTabContent {...props} />
    </ReactFlowProvider>
  );
};
