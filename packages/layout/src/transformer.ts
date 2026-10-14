/**
 * @license Apache-2.0
 * @s2c/layout — Circuit IR to ELK JSON Graph Transformer.
 */

import type { Circuit } from "@s2c/circuit-json";
import { classifyPortSide } from "./port-classifier.js";
import { compressPowerRails } from "./power-rail-compressor.js";
import type { ElkEdge, ElkGraph, ElkNode, ElkPort, LayoutOptions } from "./types.js";

/**
 * Calculates standard dimensions for schematic component symbols.
 */
function estimateNodeDimensions(portCount: number, kind: string): { width: number; height: number } {
  if (kind === "mcu") {
    const sideCount = Math.ceil(portCount / 4);
    return {
      width: Math.max(160, sideCount * 30),
      height: Math.max(220, sideCount * 30),
    };
  }
  if (kind === "resistor" || kind === "capacitor" || kind === "diode" || kind === "led") {
    return { width: 60, height: 40 };
  }
  if (kind === "module" || kind === "sensor" || kind === "display") {
    return {
      width: 120,
      height: Math.max(80, portCount * 20),
    };
  }
  return {
    width: 100,
    height: Math.max(60, portCount * 22),
  };
}

/**
 * Transforms Circuit IR into an Eclipse Layout Kernel (ELK) Graph structure.
 */
export function circuitToElkGraph(circuit: Circuit, options: LayoutOptions = {}): ElkGraph {
  const compressPower = options.compressPowerRails ?? true;
  const algorithm = options.algorithm ?? "layered";
  const direction = options.direction ?? "RIGHT";
  const nodeSpacing = options.nodeSpacing ?? 40;
  const layerSpacing = options.layerSpacing ?? 60;
  const edgeNodeSpacing = options.edgeNodeSpacing ?? 25;

  const { signalNets, powerStubs } = compressPower
    ? compressPowerRails(circuit, { powerRailNames: options.powerRailNames })
    : { signalNets: circuit.nets, powerStubs: [] };

  const elkNodes: ElkNode[] = [];

  for (const comp of circuit.components) {
    const { width, height } = estimateNodeDimensions(comp.ports.length, comp.kind);

    const ports: ElkPort[] = comp.ports.map((port) => {
      const side = classifyPortSide(port, comp);
      return {
        id: port.id,
        width: 8,
        height: 8,
        layoutOptions: {
          "org.eclipse.elk.port.side": side,
          "port.side": side,
        },
        labels: [{ text: port.name }],
        properties: {
          side,
          originalName: port.name,
          kind: port.kind,
        },
      };
    });

    elkNodes.push({
      id: comp.id,
      width,
      height,
      ports,
      labels: [{ text: comp.id }, ...(comp.name ? [{ text: comp.name }] : [])],
      properties: {
        kind: comp.kind,
        value: comp.value,
      },
      layoutOptions: {
        "org.eclipse.elk.portConstraints": "FIXED_SIDE",
      },
    });
  }

  // Create edges from signal nets
  const elkEdges: ElkEdge[] = [];
  let edgeCounter = 1;

  for (const net of signalNets) {
    if (net.portIds.length < 2) continue;

    // For a multi-point net, create pairwise edge links or star topology
    const rootPort = net.portIds[0];
    for (let i = 1; i < net.portIds.length; i++) {
      const targetPort = net.portIds[i];
      elkEdges.push({
        id: `e_${net.id}_${edgeCounter++}`,
        sources: [rootPort],
        targets: [targetPort],
        layoutOptions: {
          "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
        },
        labels: [{ text: net.id }],
        properties: {
          netId: net.id,
          netKind: net.kind,
        },
      });
    }
  }

  return {
    id: circuit.name ? `graph_${circuit.name.replace(/\W+/g, "_")}` : "root_circuit",
    layoutOptions: {
      "org.eclipse.elk.algorithm": algorithm === "layered" ? "org.eclipse.elk.layered" : algorithm,
      "org.eclipse.elk.direction": direction,
      "org.eclipse.elk.edgeRouting": "ORTHOGONAL",
      "org.eclipse.elk.portConstraints": "FIXED_SIDE",
      "org.eclipse.elk.spacing.nodeNode": String(nodeSpacing),
      "org.eclipse.elk.layered.spacing.nodeNodeBetweenLayers": String(layerSpacing),
      "org.eclipse.elk.spacing.edgeNode": String(edgeNodeSpacing),
      "org.eclipse.elk.layered.thoroughness": "7",
      "org.eclipse.elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
    },
    children: elkNodes,
    edges: elkEdges,
    powerStubs: compressPower ? powerStubs : undefined,
  };
}
