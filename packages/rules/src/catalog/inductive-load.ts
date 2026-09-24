/**
 * @license Apache-2.0
 * @s2c/rules — ERC: Inductive Load Flyback Diode Verification (Doc §9.1: erc.inductive-load-no-flyback).
 */

import type { Circuit, Diagnostic } from "@s2c/circuit-json";
import type { RuleContext, RuleDefinition } from "../types.js";

export const inductiveLoadFlybackRule: RuleDefinition = {
  id: "erc.inductive-load-no-flyback",
  name: "Inductive Load Flyback Diode Verification",
  description:
    "Verifies that inductive loads (relay coils, DC motors, solenoids) driven by switching transistors have an antiparallel flyback clamp diode.",
  category: "electrical-safety",
  defaultSeverity: "error",
  run(circuit: Circuit, context: RuleContext): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Find inductive components
    const inductiveComps = circuit.components.filter((c) => {
      const idUpper = c.id.toUpperCase();
      const nameUpper = (c.name || "").toUpperCase();
      const partUpper = (c.partNumber || "").toUpperCase();
      return (
        idUpper.includes("RELAY") ||
        idUpper.includes("MOTOR") ||
        idUpper.includes("COIL") ||
        idUpper.includes("SOLENOID") ||
        nameUpper.includes("RELAY") ||
        nameUpper.includes("MOTOR") ||
        partUpper.includes("RELAY") ||
        partUpper.includes("MOTOR")
      );
    });

    for (const load of inductiveComps) {
      // For bare relay coils or motors, find the 2 coil terminals
      const coilPorts = load.ports.filter(
        (p) =>
          p.name.includes("COIL") ||
          p.name === "1" ||
          p.name === "2" ||
          p.name === "+" ||
          p.name === "-",
      );

      if (coilPorts.length < 2) continue;

      const net1 = context.portToNet.get(coilPorts[0].id);
      const net2 = context.portToNet.get(coilPorts[1].id);
      if (!net1 || !net2) continue;

      // Check if one net connects to a switching element (transistor collector/drain)
      const isSwitchedByTransistor =
        hasSwitchingTransistor(net1, context) || hasSwitchingTransistor(net2, context);

      if (!isSwitchedByTransistor) continue;

      // Check if there is an antiparallel diode bridging net1 and net2
      const hasDiode = hasBridgingDiode(net1.id, net2.id, context);

      if (!hasDiode) {
        diagnostics.push({
          ruleId: "erc.inductive-load-no-flyback",
          severity: "error",
          message: `Inductive load '${load.id}' (${load.name || load.kind}) lacks an antiparallel flyback protection diode.`,
          explanation: `When switching transistor turns OFF, rapid interruption of coil current induces a high-voltage back-EMF spike: V = -L * (di/dt) (often > 100V). Without a flyback/freewheeling diode across coil terminals '${coilPorts[0].name}' and '${coilPorts[1].name}', this inductive transient exceeds transistor breakdown voltage (V_CEO) and causes silicon breakdown.`,
          target: { type: "component", id: load.id },
          suggestion: `Connect a 1N4007 (or 1N4148) flyback diode in reverse parallel across '${load.id}' terminals: cathode to positive supply and anode to transistor collector/drain.`,
        });
      }
    }

    return diagnostics;
  },
};

function hasSwitchingTransistor(net: { id: string }, context: RuleContext): boolean {
  const ports = context.netToPorts.get(net.id) ?? [];
  for (const p of ports) {
    const comp = context.portToComponent.get(p.id);
    if (comp?.kind === "transistor") {
      // Collector or Drain
      if (
        p.name === "C" ||
        p.name === "D" ||
        p.name === "3" ||
        p.name.toUpperCase().includes("COLLECTOR") ||
        p.name.toUpperCase().includes("DRAIN")
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasBridgingDiode(net1Id: string, net2Id: string, context: RuleContext): boolean {
  const ports1 = context.netToPorts.get(net1Id) ?? [];
  for (const p1 of ports1) {
    const comp = context.portToComponent.get(p1.id);
    if (comp?.kind === "diode") {
      const otherPort = comp.ports.find((p) => p.id !== p1.id);
      if (otherPort) {
        const otherNet = context.portToNet.get(otherPort.id);
        if (otherNet?.id === net2Id) {
          return true;
        }
      }
    }
  }
  return false;
}
