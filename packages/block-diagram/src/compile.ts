/**
 * @license Apache-2.0
 * @s2c/block-diagram — Validation, Algebraic Loop Detection, and Execution Compiler.
 */

import { type OdeSimulationOptions, type OdeSolution, solveRk4, solveRkf45 } from "@s2c/sim-engine";
import { type BlockDefinition, getBlockDefinition } from "./blocks.js";
import type { BlockConnection, BlockDiagram, BlockNode } from "./graph.js";
import "./stdlib/index.js"; // Ensure standard blocks are registered

export interface DiagramDiagnostic {
  ruleId:
    | "diagram.unconnected-required-input"
    | "diagram.algebraic-loop"
    | "diagram.multiple-drivers"
    | "diagram.unknown-block"
    | "diagram.invalid-port";
  severity: "error" | "warning";
  blockId?: string;
  portId?: string;
  message: string;
  blocksInLoop?: string[];
  suggestion?: string;
}

export interface StateAllocation {
  blockId: string;
  startIndex: number;
  count: number;
  names: string[];
}

export interface ScopeSignalSeries {
  blockId: string;
  title: string;
  points: { x: number; y: number }[];
}

export interface DiagramSimulationResult {
  success: boolean;
  diagnostics: DiagramDiagnostic[];
  timePoints: number[];
  scopeSignals: Record<string, ScopeSignalSeries>;
  stateLabels: string[];
  solution?: OdeSolution;
}

export interface CompiledBlockDiagram {
  valid: boolean;
  diagnostics: DiagramDiagnostic[];
  numStates: number;
  initialState: number[];
  stateLabels: string[];
  stateAllocations: StateAllocation[];
  algebraicOrder: string[]; // Block IDs in topological evaluation order
  evaluateStep: (
    t: number,
    y: number[],
  ) => {
    stateDerivatives: number[];
    blockOutputs: Map<string, Record<string, number>>;
    scopeValues: Map<string, number>;
  };
  runSimulation: (
    options: OdeSimulationOptions,
    solver?: "rk4" | "rkf45",
  ) => DiagramSimulationResult;
}

/**
 * Validates a BlockDiagram and compiles it into an executable mathematical representation.
 */
export function compileBlockDiagram(diagram: BlockDiagram): CompiledBlockDiagram {
  const diagnostics: DiagramDiagnostic[] = [];
  const blockMap = new Map<string, BlockNode>();
  const defMap = new Map<string, BlockDefinition>();

  for (const block of diagram.blocks) {
    blockMap.set(block.id, block);
    const def = getBlockDefinition(block.type);
    if (!def) {
      diagnostics.push({
        ruleId: "diagram.unknown-block",
        severity: "error",
        blockId: block.id,
        message: `Unknown block type "${block.type}" on block "${block.label || block.id}".`,
      });
    } else {
      defMap.set(block.id, def);
    }
  }

  // 1. Validate connection endpoints
  const incomingConnections = new Map<string, BlockConnection>(); // key: `${toBlockId}:${toPortId}`
  for (const conn of diagram.connections) {
    const srcBlock = blockMap.get(conn.fromBlockId);
    const dstBlock = blockMap.get(conn.toBlockId);
    const srcDef = defMap.get(conn.fromBlockId);
    const dstDef = defMap.get(conn.toBlockId);

    if (!srcBlock || !srcDef) {
      diagnostics.push({
        ruleId: "diagram.invalid-port",
        severity: "error",
        message: `Connection "${conn.id}" originates from non-existent block "${conn.fromBlockId}".`,
      });
      continue;
    }
    if (!dstBlock || !dstDef) {
      diagnostics.push({
        ruleId: "diagram.invalid-port",
        severity: "error",
        message: `Connection "${conn.id}" targets non-existent block "${conn.toBlockId}".`,
      });
      continue;
    }

    const srcPort = srcDef.outputs.find((p) => p.id === conn.fromPortId);
    if (!srcPort) {
      diagnostics.push({
        ruleId: "diagram.invalid-port",
        severity: "error",
        blockId: conn.fromBlockId,
        portId: conn.fromPortId,
        message: `Output port "${conn.fromPortId}" does not exist on block "${srcBlock.label || srcBlock.id}" (${srcBlock.type}).`,
      });
    }

    const dstPort = dstDef.inputs.find((p) => p.id === conn.toPortId);
    if (!dstPort) {
      diagnostics.push({
        ruleId: "diagram.invalid-port",
        severity: "error",
        blockId: conn.toBlockId,
        portId: conn.toPortId,
        message: `Input port "${conn.toPortId}" does not exist on block "${dstBlock.label || dstBlock.id}" (${dstBlock.type}).`,
      });
    }

    const portKey = `${conn.toBlockId}:${conn.toPortId}`;
    if (incomingConnections.has(portKey)) {
      diagnostics.push({
        ruleId: "diagram.multiple-drivers",
        severity: "error",
        blockId: conn.toBlockId,
        portId: conn.toPortId,
        message: `Input port "${conn.toPortId}" on block "${dstBlock.label || dstBlock.id}" has multiple incoming connections.`,
        suggestion: "Use a Sum block to combine multiple incoming signals.",
      });
    } else {
      incomingConnections.set(portKey, conn);
    }
  }

  // 2. Validate unconnected required inputs
  for (const block of diagram.blocks) {
    const def = defMap.get(block.id);
    if (!def) continue;

    for (const inputPort of def.inputs) {
      if (inputPort.required !== false) {
        const portKey = `${block.id}:${inputPort.id}`;
        if (!incomingConnections.has(portKey)) {
          diagnostics.push({
            ruleId: "diagram.unconnected-required-input",
            severity: "error",
            blockId: block.id,
            portId: inputPort.id,
            message: `Block "${block.label || block.id}" (${block.type}) has unconnected required input port "${inputPort.id}".`,
            suggestion: `Wire a signal to input port "${inputPort.id}".`,
          });
        }
      }
    }
  }

  // 3. Algebraic Loop Detection & Direct-Feedthrough Cycle Check
  // Build directed algebraic dependency graph:
  // Edge A -> B exists if there is a wire from A to B AND block B has direct feedthrough.
  const directFeedthroughMap = new Map<string, boolean>();
  for (const block of diagram.blocks) {
    const def = defMap.get(block.id);
    const hasDf = def ? def.hasDirectFeedthrough(block.params) : false;
    directFeedthroughMap.set(block.id, hasDf);
  }

  const algebraicAdj = new Map<string, string[]>();
  for (const block of diagram.blocks) {
    algebraicAdj.set(block.id, []);
  }

  for (const conn of diagram.connections) {
    const isDstDirect = directFeedthroughMap.get(conn.toBlockId) ?? false;
    if (isDstDirect) {
      const neighbors = algebraicAdj.get(conn.fromBlockId);
      if (neighbors && !neighbors.includes(conn.toBlockId)) {
        neighbors.push(conn.toBlockId);
      }
    }
  }

  // Detect cycles using 3-color DFS
  // 0 = White (unvisited), 1 = Gray (in current call stack), 2 = Black (visited)
  const visitState = new Map<string, number>();
  for (const block of diagram.blocks) {
    visitState.set(block.id, 0);
  }

  const stack: string[] = [];
  const cycleHolder: { found?: string[] } = {};

  function dfsDetectLoop(nodeId: string): boolean {
    visitState.set(nodeId, 1);
    stack.push(nodeId);

    const neighbors = algebraicAdj.get(nodeId) ?? [];
    for (const nextId of neighbors) {
      const state = visitState.get(nextId) ?? 0;
      if (state === 1) {
        // Cycle detected: slice stack from nextId to end
        const cycleStartIndex = stack.indexOf(nextId);
        if (cycleStartIndex !== -1) {
          cycleHolder.found = [...stack.slice(cycleStartIndex), nextId];
          return true;
        }
      }
      if (state === 0) {
        if (dfsDetectLoop(nextId)) return true;
      }
    }

    stack.pop();
    visitState.set(nodeId, 2);
    return false;
  }

  for (const block of diagram.blocks) {
    if ((visitState.get(block.id) ?? 0) === 0) {
      if (dfsDetectLoop(block.id)) {
        break;
      }
    }
  }

  if (cycleHolder.found && cycleHolder.found.length > 0) {
    const cycleLabels = cycleHolder.found.map((id) => {
      const b = blockMap.get(id);
      return b?.label || id;
    });
    const loopStr = `[${cycleLabels.join(" -> ")}]`;
    diagnostics.push({
      ruleId: "diagram.algebraic-loop",
      severity: "error",
      blocksInLoop: cycleHolder.found,
      message: `Algebraic loop detected: cycle of direct-feedthrough blocks found: ${loopStr}. Pure algebraic loops are not supported in v1 without an implicit iterative solver. Insert an Integrator or Delay block into this loop to break the algebraic dependence.`,
      suggestion: `Insert an Integrator or Delay block in this loop: ${loopStr}`,
    });
  }

  // 4. Allocate state variables for continuous state blocks
  const stateAllocations: StateAllocation[] = [];
  const stateLabels: string[] = [];
  const initialState: number[] = [];
  let currentStateIdx = 0;

  for (const block of diagram.blocks) {
    const def = defMap.get(block.id);
    if (!def) continue;

    const count = def.numStates(block.params);
    if (count > 0) {
      const names = def.stateNames ? def.stateNames(block.params) : [`x`];
      const inits = def.initialState
        ? def.initialState(block.params)
        : Array.from({ length: count }, () => 0.0);

      stateAllocations.push({
        blockId: block.id,
        startIndex: currentStateIdx,
        count,
        names,
      });

      for (let i = 0; i < count; i++) {
        const stateName = names[i] || `x${i + 1}`;
        stateLabels.push(`${block.label || block.id}.${stateName}`);
        initialState.push(inits[i] ?? 0.0);
      }
      currentStateIdx += count;
    }
  }

  // 5. Compute topological order for direct-feedthrough blocks
  // When no algebraic loop exists, standard topological sort via Kahn's algorithm or post-order DFS
  const algebraicOrder: string[] = [];
  if (!cycleHolder.found) {
    const inDegree = new Map<string, number>();
    for (const block of diagram.blocks) {
      inDegree.set(block.id, 0);
    }
    for (const [, neighbors] of algebraicAdj) {
      for (const n of neighbors) {
        inDegree.set(n, (inDegree.get(n) ?? 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) {
        queue.push(id);
      }
    }

    while (queue.length > 0) {
      const curr = queue.shift()!;
      algebraicOrder.push(curr);
      const neighbors = algebraicAdj.get(curr) ?? [];
      for (const n of neighbors) {
        const d = (inDegree.get(n) ?? 1) - 1;
        inDegree.set(n, d);
        if (d === 0) {
          queue.push(n);
        }
      }
    }
  }

  const isValid = diagnostics.every((d) => d.severity !== "error");

  // Step evaluator function
  const evaluateStep = (
    t: number,
    y: number[],
  ): {
    stateDerivatives: number[];
    blockOutputs: Map<string, Record<string, number>>;
    scopeValues: Map<string, number>;
  } => {
    const blockOutputs = new Map<string, Record<string, number>>();
    const scopeValues = new Map<string, number>();
    const stateDerivatives: number[] = new Array(currentStateIdx).fill(0.0);

    // Helper to resolve inputs for a given block
    const resolveInputs = (blockId: string): Record<string, number> => {
      const inputs: Record<string, number> = {};
      const def = defMap.get(blockId);
      if (!def) return inputs;

      for (const port of def.inputs) {
        const portKey = `${blockId}:${port.id}`;
        const conn = incomingConnections.get(portKey);
        if (conn) {
          const srcOutputs = blockOutputs.get(conn.fromBlockId);
          inputs[port.id] = srcOutputs?.[conn.fromPortId] ?? 0.0;
        } else {
          inputs[port.id] = 0.0;
        }
      }
      return inputs;
    };

    // Phase 1: Evaluate state blocks that DO NOT have direct feedthrough (outputs depend only on state y)
    for (const alloc of stateAllocations) {
      const block = blockMap.get(alloc.blockId);
      const def = defMap.get(alloc.blockId);
      if (!block || !def) continue;

      // If the block has direct feedthrough (e.g. PID or biproper transfer function),
      // its output depends on current inputs, so it must be evaluated in Phase 3!
      if (def.hasDirectFeedthrough(block.params)) continue;

      const slice = y.slice(alloc.startIndex, alloc.startIndex + alloc.count);
      // Run with state slice and empty inputs to extract instantaneous output
      const res = def.execute({
        t,
        params: block.params,
        inputs: {},
        stateSlice: slice,
      });
      blockOutputs.set(block.id, res.outputs);
    }

    // Phase 2: Evaluate pure sources (depend only on time t)
    for (const block of diagram.blocks) {
      const def = defMap.get(block.id);
      if (!def) continue;
      if (def.category === "source") {
        const res = def.execute({
          t,
          params: block.params,
          inputs: {},
          stateSlice: [],
        });
        blockOutputs.set(block.id, res.outputs);
      }
    }

    // Phase 3: Evaluate algebraic & composite blocks in topological order
    for (const blockId of algebraicOrder) {
      const block = blockMap.get(blockId);
      const def = defMap.get(blockId);
      if (!block || !def) continue;

      // Skip blocks already evaluated (sources and state blocks)
      if (blockOutputs.has(blockId)) continue;

      const inputs = resolveInputs(blockId);
      const alloc = stateAllocations.find((a) => a.blockId === blockId);
      const slice = alloc ? y.slice(alloc.startIndex, alloc.startIndex + alloc.count) : [];

      const res = def.execute({
        t,
        params: block.params,
        inputs,
        stateSlice: slice,
      });
      blockOutputs.set(block.id, res.outputs);

      if (res.derivatives && alloc) {
        for (let i = 0; i < alloc.count; i++) {
          stateDerivatives[alloc.startIndex + i] = res.derivatives[i] ?? 0.0;
        }
      }
    }

    // Phase 4: Compute state derivatives for pure state blocks now that all inputs are resolved
    for (const alloc of stateAllocations) {
      const block = blockMap.get(alloc.blockId);
      const def = defMap.get(alloc.blockId);
      if (!block || !def) continue;

      const inputs = resolveInputs(block.id);
      const slice = y.slice(alloc.startIndex, alloc.startIndex + alloc.count);

      const res = def.execute({
        t,
        params: block.params,
        inputs,
        stateSlice: slice,
      });

      if (res.derivatives) {
        for (let i = 0; i < alloc.count; i++) {
          stateDerivatives[alloc.startIndex + i] = res.derivatives[i] ?? 0.0;
        }
      }
    }

    // Phase 5: Collect Scope values
    for (const block of diagram.blocks) {
      if (block.type === "Scope") {
        const inputs = resolveInputs(block.id);
        scopeValues.set(block.id, inputs.in ?? 0.0);
      }
    }

    return {
      stateDerivatives,
      blockOutputs,
      scopeValues,
    };
  };

  // Simulation runner reusing @s2c/sim-engine integrators
  const runSimulation = (
    options: OdeSimulationOptions,
    solver: "rk4" | "rkf45" = "rk4",
  ): DiagramSimulationResult => {
    if (!isValid) {
      return {
        success: false,
        diagnostics,
        timePoints: [],
        scopeSignals: {},
        stateLabels,
      };
    }

    const scopes = diagram.blocks.filter((b) => b.type === "Scope");
    const scopeSignals: Record<string, ScopeSignalSeries> = {};
    for (const sc of scopes) {
      scopeSignals[sc.id] = {
        blockId: sc.id,
        title: (sc.params.title as string) || sc.label || "Scope Signal",
        points: [],
      };
    }

    const timePoints: number[] = [];

    // Case 1: Dynamic system with continuous state variables (Integrators, TFs, PID)
    if (currentStateIdx > 0) {
      const f = (t: number, y: number[]) => evaluateStep(t, y).stateDerivatives;

      const solution =
        solver === "rkf45"
          ? solveRkf45(f, initialState, options)
          : solveRk4(f, initialState, options);

      // Re-evaluate outputs at each solved step to populate Scope histories
      for (const pt of solution.points) {
        timePoints.push(pt.t);
        const { scopeValues } = evaluateStep(pt.t, pt.y);
        for (const sc of scopes) {
          const val = scopeValues.get(sc.id) ?? 0.0;
          scopeSignals[sc.id]?.points.push({ x: pt.t, y: val });
        }
      }

      return {
        success: true,
        diagnostics,
        timePoints,
        scopeSignals,
        stateLabels,
        solution,
      };
    }

    // Case 2: Pure algebraic system without states (static functions of time)
    const { t0, tEnd } = options;
    const dt = options.dt ?? (tEnd - t0) / 200;
    const steps = Math.min(options.maxSteps ?? 50000, Math.ceil((tEnd - t0) / dt));

    for (let i = 0; i <= steps; i++) {
      const t = Math.min(tEnd, t0 + i * dt);
      timePoints.push(t);
      const { scopeValues } = evaluateStep(t, []);
      for (const sc of scopes) {
        const val = scopeValues.get(sc.id) ?? 0.0;
        scopeSignals[sc.id]?.points.push({ x: t, y: val });
      }
    }

    return {
      success: true,
      diagnostics,
      timePoints,
      scopeSignals,
      stateLabels,
    };
  };

  return {
    valid: isValid,
    diagnostics,
    numStates: currentStateIdx,
    initialState,
    stateLabels,
    stateAllocations,
    algebraicOrder,
    evaluateStep,
    runSimulation,
  };
}
