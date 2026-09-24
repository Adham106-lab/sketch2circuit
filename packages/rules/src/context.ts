/**
 * @license Apache-2.0
 * @s2c/rules — ERC context builder.
 */

import type { Circuit, Component, Net, Port } from "@s2c/circuit-json";
import type { RuleContext } from "./types.js";

/**
 * Builds fast index lookup maps for a circuit to accelerate ERC rule evaluation.
 */
export function buildRuleContext(circuit: Circuit): RuleContext {
  const componentsById = new Map<string, Component>();
  const netsById = new Map<string, Net>();
  const portsById = new Map<string, Port>();
  const portToNet = new Map<string, Net>();
  const portToComponent = new Map<string, Component>();
  const netToPorts = new Map<string, Port[]>();

  for (const comp of circuit.components) {
    componentsById.set(comp.id, comp);
    for (const port of comp.ports) {
      portsById.set(port.id, port);
      portToComponent.set(port.id, comp);
    }
  }

  for (const net of circuit.nets) {
    netsById.set(net.id, net);
    const portsInNet: Port[] = [];

    for (const portId of net.portIds) {
      const port = portsById.get(portId);
      if (port) {
        portsInNet.push(port);
        portToNet.set(portId, net);
      }
    }

    netToPorts.set(net.id, portsInNet);
  }

  return {
    componentsById,
    netsById,
    portsById,
    portToNet,
    portToComponent,
    netToPorts,
  };
}
