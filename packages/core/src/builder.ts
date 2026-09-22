/**
 * @license Apache-2.0
 * @s2c/core — Fluent Programmatic Circuit Builder.
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

export class CircuitBuilder {
  private title?: string;
  private description?: string;
  private components: Map<string, Component> = new Map();
  private nets: Map<string, Net> = new Map();
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
    if (this.components.has(id)) {
      throw new Error(`Component with ID '${id}' is already registered in circuit`);
    }
    const comp = instantiatePart(part, id, options);
    this.components.set(id, comp);
    return this;
  }

  /**
   * Adds a custom component with custom ports.
   */
  addComponent(id: string, kind: ComponentKind, options: ComponentBuilderOptions = {}): this {
    if (this.components.has(id)) {
      throw new Error(`Component with ID '${id}' is already registered in circuit`);
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

  /**
   * Connects two or more port references (e.g. "R1.1", "LED1.A").
   * Automatically resolves or creates a Net.
   */
  connect(portA: string, portB: string, ...rest: string[]): this {
    const allPorts = [portA, portB, ...rest];
    const resolvedPortIds: string[] = [];

    for (const portRef of allPorts) {
      const portId = this.resolvePortId(portRef);
      resolvedPortIds.push(portId);
    }

    // Check if any of these ports are already connected to an existing net
    let targetNet: Net | undefined;
    const existingNets: Net[] = [];

    for (const portId of resolvedPortIds) {
      const net = this.findNetForPort(portId);
      if (net && !existingNets.includes(net)) {
        existingNets.push(net);
      }
    }

    if (existingNets.length === 0) {
      // Create new net
      const netId = `N$${this.autoNetCounter++}`;
      targetNet = {
        id: netId,
        kind: "signal",
        portIds: [...new Set(resolvedPortIds)],
      };
      this.nets.set(netId, targetNet);
    } else {
      // Merge into the primary existing net
      targetNet = existingNets[0];
      for (const portId of resolvedPortIds) {
        if (!targetNet.portIds.includes(portId)) {
          targetNet.portIds.push(portId);
        }
      }
      // If multiple nets were bridged, merge all others into targetNet
      for (let i = 1; i < existingNets.length; i++) {
        const netToMerge = existingNets[i];
        for (const p of netToMerge.portIds) {
          if (!targetNet.portIds.includes(p)) {
            targetNet.portIds.push(p);
          }
        }
        this.nets.delete(netToMerge.id);
      }
    }

    // Update port.netId references on components
    for (const portId of targetNet.portIds) {
      this.setPortNetId(portId, targetNet.id);
    }

    return this;
  }

  /**
   * Connects ports to a named Net (e.g. "GND", "5V").
   */
  connectNet(netId: string, ports: string[], options?: { kind?: NetKind; voltage?: number }): this {
    let net = this.nets.get(netId);
    if (!net) {
      net = {
        id: netId,
        kind: options?.kind ?? (netId.toUpperCase() === "GND" ? "ground" : "signal"),
        voltage: options?.voltage,
        portIds: [],
      };
      this.nets.set(netId, net);
    } else if (options?.voltage !== undefined) {
      net.voltage = options.voltage;
    }

    for (const portRef of ports) {
      const portId = this.resolvePortId(portRef);
      if (!net.portIds.includes(portId)) {
        net.portIds.push(portId);
      }
      this.setPortNetId(portId, net.id);
    }

    return this;
  }

  private resolvePortId(portRef: string): string {
    const parts = portRef.split(".");
    if (parts.length === 2) {
      const [compId, pinName] = parts;
      const comp = this.components.get(compId);
      if (!comp) {
        throw new Error(`Component '${compId}' not found while connecting port '${portRef}'`);
      }
      const port = comp.ports.find((p) => p.name === pinName || p.id === portRef);
      if (!port) {
        throw new Error(`Port '${pinName}' not found on component '${compId}'`);
      }
      return port.id;
    }
    // Direct port ID
    return portRef;
  }

  private findNetForPort(portId: string): Net | undefined {
    for (const net of this.nets.values()) {
      if (net.portIds.includes(portId)) {
        return net;
      }
    }
    return undefined;
  }

  private setPortNetId(portId: string, netId: string): void {
    const [compId] = portId.split(".");
    const comp = this.components.get(compId);
    if (comp) {
      const p = comp.ports.find((pt) => pt.id === portId);
      if (p) {
        p.netId = netId;
      }
    }
  }

  /**
   * Produces the canonical Circuit JSON IR object.
   */
  build(): Circuit {
    return {
      version: "0.1.0",
      metadata: {
        title: this.title,
        description: this.description,
        createdAt: new Date().toISOString(),
      },
      components: Array.from(this.components.values()),
      nets: Array.from(this.nets.values()),
    };
  }
}

/**
 * Functional factory for circuit builder.
 */
export function createCircuit(metadata?: { title?: string; description?: string }): CircuitBuilder {
  return new CircuitBuilder(metadata);
}
