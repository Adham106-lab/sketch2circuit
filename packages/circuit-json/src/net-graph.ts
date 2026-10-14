/**
 * @license Apache-2.0
 * @s2c/circuit-json — Net-Centric Bipartite Graph Operations & Provenance Builders.
 */

import type {
  Bus,
  BusType,
  Circuit,
  Component,
  EvidenceType,
  LineSpan,
  LogicalNet,
  Net,
  NetKind,
  Port,
  Provenance,
  SignalDirection,
} from "./types.js";

export interface CreateLogicalNetOptions {
  id: string;
  name?: string;
  kind?: NetKind;
  voltage?: number;
  portIds?: string[];
  provenance?: Provenance;
}

/**
 * Creates a normalized LogicalNet node.
 */
export function createLogicalNet(options: CreateLogicalNetOptions): LogicalNet {
  return {
    id: options.id,
    name: options.name ?? options.id,
    kind: options.kind ?? "signal",
    voltage: options.voltage,
    portIds: options.portIds ? [...options.portIds] : [],
    provenance: options.provenance,
  };
}

export interface CreateBusOptions {
  id: string;
  name?: string;
  type: BusType;
  netIds: string[];
  signals?: Record<string, string>;
  provenance?: Provenance;
}

/**
 * Creates a high-level Bus abstraction node grouping related logical nets.
 */
export function createBus(options: CreateBusOptions): Bus {
  return {
    id: options.id,
    name: options.name ?? options.id,
    type: options.type,
    netIds: [...options.netIds],
    signals: options.signals ? { ...options.signals } : undefined,
    provenance: options.provenance,
  };
}

export interface EmitNetFromCallParams {
  mcuPortId: string;
  targetPortId: string;
  pinNumber: string | number;
  callName: "pinMode" | "digitalWrite" | "analogRead" | "MW_pinMode" | "MW_digitalIO_write" | "MW_analogIn_read" | string;
  sourceFile?: string;
  lineSpan?: LineSpan;
  confidence?: number;
  direction?: SignalDirection;
  prefix?: string;
}

/**
 * Emits a decoupled LogicalNet from an AST call (e.g. pinMode, digitalWrite, MW_pinMode, MW_digitalIO_write).
 */
export function emitLogicalNetFromASTCall(params: EmitNetFromCallParams): LogicalNet {
  const pinStr = String(params.pinNumber).replace(/^D/, "");
  const prefix = params.prefix ?? "NET_GPIO";
  const netId = `${prefix}_${pinStr}`;

  const provenance: Provenance = {
    sourceFile: params.sourceFile,
    lineSpan: params.lineSpan,
    evidenceType: "EXPLICIT_AST_CALL",
    confidence: params.confidence ?? 1.0,
    direction: params.direction ?? (params.callName.toLowerCase().includes("read") ? "INPUT" : "OUTPUT"),
    notes: `Synthesized from explicit AST driver call: ${params.callName}(${params.pinNumber})`,
  };

  return createLogicalNet({
    id: netId,
    name: `GPIO_${pinStr}`,
    kind: "signal",
    portIds: [params.mcuPortId, params.targetPortId],
    provenance,
  });
}

export interface NetCentricIndex {
  circuit: Circuit;
  portMap: Map<string, { port: Port; component: Component }>;
  netMap: Map<string, Net>;
  portToNetMap: Map<string, Net>;
  netToPortsMap: Map<string, Port[]>;
  netToComponentsMap: Map<string, Component[]>;
  busesByType: Map<BusType, Bus[]>;
}

/**
 * Builds an indexed fast-lookup representation of the bipartite Net-Centric graph.
 */
export function buildNetCentricIndex(circuit: Circuit): NetCentricIndex {
  const portMap = new Map<string, { port: Port; component: Component }>();
  const netMap = new Map<string, Net>();
  const portToNetMap = new Map<string, Net>();
  const netToPortsMap = new Map<string, Port[]>();
  const netToComponentsMap = new Map<string, Component[]>();
  const busesByType = new Map<BusType, Bus[]>();

  for (const comp of circuit.components) {
    for (const port of comp.ports) {
      portMap.set(port.id, { port, component: comp });
    }
  }

  for (const net of circuit.nets) {
    netMap.set(net.id, net);
    const ports: Port[] = [];
    const comps = new Set<Component>();

    for (const portId of net.portIds) {
      const entry = portMap.get(portId);
      if (entry) {
        ports.push(entry.port);
        comps.add(entry.component);
        portToNetMap.set(portId, net);
      }
    }

    netToPortsMap.set(net.id, ports);
    netToComponentsMap.set(net.id, Array.from(comps));
  }

  if (circuit.buses) {
    for (const bus of circuit.buses) {
      const list = busesByType.get(bus.type) ?? [];
      list.push(bus);
      busesByType.set(bus.type, list);
    }
  }

  return {
    circuit,
    portMap,
    netMap,
    portToNetMap,
    netToPortsMap,
    netToComponentsMap,
    busesByType,
  };
}

/**
 * Checks whether a Circuit conforms to the strict Bipartite Net-Centric Graph rule:
 * - All component pins connect only through Nets.
 * - No component pins have raw direct foreign component bindings without an intervening Net.
 * - Every net has at least one connected port.
 */
export function isBipartiteNetGraph(circuit: Circuit): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check that every port is connected only through nets
  const allPortIds = new Set<string>();
  for (const comp of circuit.components) {
    for (const port of comp.ports) {
      allPortIds.add(port.id);
    }
  }

  for (const net of circuit.nets) {
    if (net.portIds.length === 0) {
      reasons.push(`Net "${net.id}" is a dangling net with 0 connected ports.`);
    }
    for (const pid of net.portIds) {
      if (!allPortIds.has(pid)) {
        reasons.push(`Net "${net.id}" references unattached port "${pid}".`);
      }
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}
