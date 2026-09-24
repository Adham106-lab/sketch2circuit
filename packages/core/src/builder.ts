/**
 * @license Apache-2.0
 * @s2c/core — Fluent Programmatic Circuit Builder.
 * Implements Union-Find Disjoint Set net resolution per specification §8.
 */

import type {
  Circuit,
  Component,
  ComponentKind,
  Net,
  NetKind,
  PinCapability,
  PortKind,
} from "@s2c/circuit-json";
import { instantiatePart, type PartDefinition } from "@s2c/parts";
import { DisjointSet } from "./disjoint-set.js";

export interface ComponentBuilderOptions {
  name?: string;
  partNumber?: string;
  value?: string;
  footprint?: string;
  properties?: Record<string, string | number | boolean>;
  ports?: Array<{
    name: string;
    kind?: PortKind;
    pinNumber?: string | number;
    pinCapabilities?: PinCapability[];
    voltageRange?: [number, number];
    currentLimit?: number;
    pull?: "up" | "down" | "none";
  }>;
}

/**
 * Computes Levenshtein distance between two strings for actionable error suggestions.
 */
function levenshteinDistance(a: string, b: string): number {
  const an = a.length;
  const bn = b.length;
  if (an === 0) return bn;
  if (bn === 0) return an;
  const matrix: number[][] = [];
  for (let i = 0; i <= bn; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= an; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bn; i++) {
    for (let j = 1; j <= an; j++) {
      if (b.charAt(i - 1).toLowerCase() === a.charAt(j - 1).toLowerCase()) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[bn][an];
}

/**
 * Finds the closest matching string candidate.
 */
function findClosestCandidate(query: string, candidates: string[]): string | undefined {
  let bestCandidate: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const cand of candidates) {
    const d = levenshteinDistance(query, cand);
    if (d < bestDistance) {
      bestDistance = d;
      bestCandidate = cand;
    }
  }

  if (bestCandidate && bestDistance <= Math.max(4, Math.floor(query.length * 0.7))) {
    return bestCandidate;
  }
  return undefined;
}

export class CircuitBuilder {
  private title?: string;
  private description?: string;
  private components: Map<string, Component> = new Map();

  // Disjoint-Set Union for port connectivity tracking
  private portDsu: DisjointSet<string> = new DisjointSet<string>();

  // Explicit named net definitions (e.g. GND, 5V, VCC)
  private namedNets: Map<string, { kind: NetKind; voltage?: number }> = new Map();
  // Mapping from port ID to explicit net name
  private portExplicitNets: Map<string, string> = new Map();

  private autoNetCounter = 1;

  constructor(metadata?: { title?: string; description?: string }) {
    this.title = metadata?.title;
    this.description = metadata?.description;
  }

  /**
   * Adds an instantiated part from @s2c/parts or raw definition.
   */
  addPart(
    part: PartDefinition | string,
    id: string,
    options?: {
      value?: string;
      name?: string;
      properties?: Record<string, string | number | boolean>;
    },
  ): this {
    const existing = this.components.get(id);
    if (existing) {
      throw new Error(
        `Duplicate reference designator '${id}': component '${id}' (${existing.name ?? existing.kind}) is already registered in circuit.`,
      );
    }
    const comp = instantiatePart(part, id, options);
    this.components.set(id, comp);
    for (const p of comp.ports) {
      this.portDsu.makeSet(p.id);
    }
    return this;
  }

  /**
   * Adds a custom component with custom ports.
   */
  addComponent(id: string, kind: ComponentKind, options: ComponentBuilderOptions = {}): this {
    const existing = this.components.get(id);
    if (existing) {
      throw new Error(
        `Duplicate reference designator '${id}': component '${id}' (${existing.name ?? existing.kind}) is already registered in circuit.`,
      );
    }

    const defaultPorts =
      options.ports && options.ports.length > 0
        ? options.ports.map((p) => ({
            id: `${id}.${p.name}`,
            name: p.name,
            kind: p.kind ?? "passive",
            pinNumber: p.pinNumber,
            pinCapabilities: p.pinCapabilities ? [...p.pinCapabilities] : undefined,
            voltageRange: p.voltageRange,
            currentLimit: p.currentLimit,
            pull: p.pull,
          }))
        : [
            { id: `${id}.1`, name: "1", kind: "passive" as const },
            { id: `${id}.2`, name: "2", kind: "passive" as const },
          ];

    const comp: Component = {
      id,
      kind,
      name: options.name,
      partNumber: options.partNumber,
      value: options.value,
      footprint: options.footprint,
      properties: options.properties ? { ...options.properties } : undefined,
      ports: defaultPorts,
    };

    this.components.set(id, comp);
    for (const p of comp.ports) {
      this.portDsu.makeSet(p.id);
    }
    return this;
  }

  addResistor(id: string, value: string, options?: Omit<ComponentBuilderOptions, "value">): this {
    return this.addComponent(id, "resistor", {
      ...options,
      value,
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
    });
  }

  addLed(id: string, color?: string, options?: ComponentBuilderOptions): this {
    return this.addComponent(id, "led", {
      ...options,
      value: color ?? options?.value ?? "Red",
      ports: [
        { name: "A", kind: "passive" },
        { name: "K", kind: "passive" },
      ],
    });
  }

  addCapacitor(id: string, value: string, options?: ComponentBuilderOptions): this {
    return this.addComponent(id, "capacitor", {
      ...options,
      value,
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
    });
  }

  addButton(id: string, options?: ComponentBuilderOptions): this {
    return this.addComponent(id, "button", {
      ...options,
      name: options?.name ?? "Pushbutton",
      ports: [
        { name: "1", kind: "passive" },
        { name: "2", kind: "passive" },
      ],
    });
  }

  /**
   * Connects two or more port references (e.g. "R1.1", "LED1.A").
   * Merges their equivalence classes in the Disjoint-Set Union (Union-Find) data structure.
   */
  connect(portA: string, portB: string, ...rest: string[]): this {
    const allPorts = [portA, portB, ...rest];
    const resolvedPortIds: string[] = [];

    for (const portRef of allPorts) {
      const portId = this.resolvePortId(portRef);
      resolvedPortIds.push(portId);
    }

    // Union all ports together in the disjoint set
    const firstPort = resolvedPortIds[0];
    for (let i = 1; i < resolvedPortIds.length; i++) {
      this.portDsu.union(firstPort, resolvedPortIds[i]);
    }

    return this;
  }

  /**
   * Connects ports to a named Net (e.g. "GND", "5V").
   * Assigns explicit net attributes and unions the ports into the named net.
   */
  connectNet(netId: string, ports: string[], options?: { kind?: NetKind; voltage?: number }): this {
    const defaultKind: NetKind =
      netId.toUpperCase() === "GND"
        ? "ground"
        : netId.toUpperCase() === "5V" ||
            netId.toUpperCase() === "3V3" ||
            netId.toUpperCase() === "VCC"
          ? "power"
          : "signal";

    const defaultVoltage: number | undefined =
      options?.voltage ??
      (netId.toUpperCase() === "GND"
        ? 0.0
        : netId.toUpperCase() === "5V"
          ? 5.0
          : netId.toUpperCase() === "3V3"
            ? 3.3
            : undefined);

    if (!this.namedNets.has(netId)) {
      this.namedNets.set(netId, {
        kind: options?.kind ?? defaultKind,
        voltage: defaultVoltage,
      });
    } else if (options?.voltage !== undefined) {
      const existingNet = this.namedNets.get(netId);
      if (existingNet) {
        existingNet.voltage = options.voltage;
      }
    }

    const netSentinel = `__NET__:${netId}`;
    this.portDsu.makeSet(netSentinel);

    for (const portRef of ports) {
      const portId = this.resolvePortId(portRef);
      this.portExplicitNets.set(portId, netId);
      this.portDsu.union(netSentinel, portId, (rootA, rootB) => {
        // Sentinel or named net root always takes priority
        if (rootA.startsWith("__NET__:")) return rootA;
        if (rootB.startsWith("__NET__:")) return rootB;
        return rootA;
      });
    }

    return this;
  }

  /**
   * Resolves a port reference string to a canonical port ID (e.g. "R1.1").
   * Throws actionable error with closest candidate suggestion if component or port not found.
   */
  private resolvePortId(portRef: string): string {
    const parts = portRef.split(".");
    if (parts.length === 2) {
      const [compId, pinName] = parts;
      const comp = this.components.get(compId);
      if (!comp) {
        const available = Array.from(this.components.keys());
        const closest = findClosestCandidate(compId, available);
        const didYouMean = closest ? ` Did you mean '${closest}'?` : "";
        const compList =
          available.length > 0
            ? ` Available components: [${available.join(", ")}].`
            : " No components registered.";
        throw new Error(
          `Component '${compId}' not found while connecting port '${portRef}'.${didYouMean}${compList}`,
        );
      }

      const port = comp.ports.find((p) => p.name === pinName || p.id === portRef);
      if (!port) {
        const pinNames = comp.ports.map((p) => p.name);
        const closest = findClosestCandidate(pinName, pinNames);
        const didYouMean = closest ? ` Did you mean '${closest}'?` : "";
        const portList = ` Available ports: [${pinNames.join(", ")}].`;
        throw new Error(
          `Port '${pinName}' not found on component '${compId}' (${comp.name ?? comp.kind}).${didYouMean}${portList}`,
        );
      }
      return port.id;
    }

    // Direct port ID check
    const [compId] = portRef.split(".");
    const comp = this.components.get(compId);
    if (!comp) {
      const available = Array.from(this.components.keys());
      const closest = findClosestCandidate(compId, available);
      const didYouMean = closest ? ` Did you mean '${closest}'?` : "";
      throw new Error(
        `Component '${compId}' not found while connecting port '${portRef}'.${didYouMean}`,
      );
    }
    return portRef;
  }

  /**
   * Produces the canonical Circuit JSON IR object using Disjoint-Set Union classes.
   */
  build(): Circuit {
    const equivalenceClasses = this.portDsu.getEquivalenceClasses();
    const resolvedNets: Net[] = [];

    for (const members of equivalenceClasses.values()) {
      // Filter out sentinel IDs from the actual member ports
      const realPorts = members.filter((m) => !m.startsWith("__NET__:"));
      if (realPorts.length === 0) {
        continue;
      }

      // Check if any member has an explicit named net attached
      const explicitNetNames = new Set<string>();
      for (const m of members) {
        if (m.startsWith("__NET__:")) {
          explicitNetNames.add(m.replace("__NET__:", ""));
        }
        const mapped = this.portExplicitNets.get(m);
        if (mapped) {
          explicitNetNames.add(mapped);
        }
      }

      let netId: string;
      let netKind: NetKind = "signal";
      let voltage: number | undefined;

      if (explicitNetNames.size > 0) {
        // Priority named net
        netId = Array.from(explicitNetNames)[0];
        const netDef = this.namedNets.get(netId);
        if (netDef) {
          netKind = netDef.kind;
          voltage = netDef.voltage;
        } else if (netId.toUpperCase() === "GND") {
          netKind = "ground";
          voltage = 0.0;
        }
      } else {
        // Only create auto net if 2 or more ports are connected together
        if (realPorts.length < 2) {
          continue;
        }
        netId = `N$${this.autoNetCounter++}`;
      }

      // Update component port netId references
      for (const portId of realPorts) {
        const [compId] = portId.split(".");
        const comp = this.components.get(compId);
        if (comp) {
          const p = comp.ports.find((pt) => pt.id === portId);
          if (p) {
            p.netId = netId;
          }
        }
      }

      resolvedNets.push({
        id: netId,
        kind: netKind,
        voltage,
        portIds: realPorts,
      });
    }

    return {
      schemaVersion: "0.1.0",
      name: this.title || "Untitled Circuit",
      metadata: {
        description: this.description,
        generatedAt: new Date().toISOString(),
      },
      components: Array.from(this.components.values()),
      nets: resolvedNets,
    };
  }
}

/**
 * Functional factory for circuit builder.
 */
export function createCircuit(metadata?: { title?: string; description?: string }): CircuitBuilder {
  return new CircuitBuilder(metadata);
}
