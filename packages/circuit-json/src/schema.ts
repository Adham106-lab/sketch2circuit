/**
 * @license Apache-2.0
 * @s2c/circuit-json — Zod schemas and referential integrity validation.
 */

import { z } from "zod";
import type { Circuit } from "./types.js";

export const ComponentKindSchema = z.enum([
  "resistor",
  "capacitor",
  "led",
  "button",
  "switch",
  "diode",
  "potentiometer",
  "mcu",
  "sensor",
  "ic",
  "module",
  "connector",
  "buzzer",
  "transistor",
  "relay",
  "generic",
]);

export const PortKindSchema = z.enum([
  "passive",
  "power",
  "ground",
  "input",
  "output",
  "bidirectional",
  "no_connect",
]);

export const NetKindSchema = z.enum(["signal", "power", "ground"]);

export const PinCapabilitySchema = z.enum([
  "GPIO",
  "PWM",
  "ADC",
  "DAC",
  "I2C_SDA",
  "I2C_SCL",
  "SPI_MOSI",
  "SPI_MISO",
  "SPI_SCK",
  "SPI_SS",
  "UART_TX",
  "UART_RX",
  "INTERRUPT",
  "RESET",
]);

export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  rotation: z.number().optional(),
});

export const PortSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  pinNumber: z.union([z.string(), z.number()]).optional(),
  kind: PortKindSchema,
  netId: z.string().optional(),
  pinCapabilities: z.array(PinCapabilitySchema).optional(),
  voltageRange: z.tuple([z.number(), z.number()]).optional(),
  currentLimit: z.number().positive().optional(),
  pull: z.enum(["up", "down", "none"]).optional(),
});

export const ComponentSchema = z.object({
  id: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, {
    message:
      "Component ID must start with a letter and contain only alphanumeric/underscore characters",
  }),
  kind: ComponentKindSchema,
  name: z.string().optional(),
  partNumber: z.string().optional(),
  value: z.string().optional(),
  footprint: z.string().optional(),
  properties: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  ports: z.array(PortSchema),
  position: PositionSchema.optional(),
  verified: z.boolean().optional(),
});

export const NetSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  kind: NetKindSchema,
  voltage: z.number().optional(),
  portIds: z.array(z.string().min(1)),
});

export const DiagnosticTargetSchema = z.object({
  type: z.enum(["component", "port", "net", "circuit", "code"]),
  id: z.string().min(1),
});

export const SourceRangeSchema = z.object({
  file: z.string(),
  startLine: z.number().int().positive(),
  startCol: z.number().int().positive(),
  endLine: z.number().int().positive(),
  endCol: z.number().int().positive(),
});

export const DiagnosticSchema = z.object({
  ruleId: z.string().min(1),
  severity: z.enum(["error", "warning", "info"]),
  message: z.string().min(1),
  explanation: z.string().min(1),
  target: DiagnosticTargetSchema,
  suggestion: z.string().optional(),
  sourceRange: SourceRangeSchema.optional(),
});

export const AssumptionSchema = z.object({
  id: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()),
  alternativeOptions: z.array(z.string()).optional(),
  selectedOption: z.string().optional(),
});

export const CircuitMetadataSchema = z.object({
  board: z.string().optional(),
  sketchName: z.string().optional(),
  author: z.string().optional(),
  generatedAt: z.string().optional(),
  description: z.string().optional(),
});

export const CircuitSchema = z.object({
  schemaVersion: z.literal("0.1.0"),
  name: z.string().min(1),
  components: z.array(ComponentSchema),
  nets: z.array(NetSchema),
  diagnostics: z.array(DiagnosticSchema).optional(),
  assumptions: z.array(AssumptionSchema).optional(),
  metadata: CircuitMetadataSchema.optional(),
});

export interface IntegrityError {
  path: string;
  message: string;
}

/**
 * Validates structural and referential integrity of a Circuit object:
 * 1. Component IDs must be unique.
 * 2. Net IDs must be unique.
 * 3. Every port ID within a component must be unique.
 * 4. Every port ID referenced in a net must exist on a component in the circuit.
 * 5. A port cannot be assigned to multiple distinct nets.
 */
export function validateCircuitIntegrity(circuit: Circuit): IntegrityError[] {
  const errors: IntegrityError[] = [];

  // Check unique component IDs
  const componentIds = new Set<string>();
  const allKnownPorts = new Set<string>();

  for (let i = 0; i < circuit.components.length; i++) {
    const comp = circuit.components[i];
    if (!comp) continue;
    if (componentIds.has(comp.id)) {
      errors.push({
        path: `components[${i}].id`,
        message: `Duplicate component id: "${comp.id}"`,
      });
    } else {
      componentIds.add(comp.id);
    }

    const componentPortNames = new Set<string>();
    for (let p = 0; p < comp.ports.length; p++) {
      const port = comp.ports[p];
      if (!port) continue;
      if (componentPortNames.has(port.name)) {
        errors.push({
          path: `components[${i}].ports[${p}].name`,
          message: `Duplicate port name "${port.name}" on component "${comp.id}"`,
        });
      } else {
        componentPortNames.add(port.name);
      }

      if (allKnownPorts.has(port.id)) {
        errors.push({
          path: `components[${i}].ports[${p}].id`,
          message: `Duplicate global port id: "${port.id}"`,
        });
      } else {
        allKnownPorts.add(port.id);
      }
    }
  }

  // Check unique net IDs & valid port references
  const netIds = new Set<string>();
  const portToNetMap = new Map<string, string>();

  for (let n = 0; n < circuit.nets.length; n++) {
    const net = circuit.nets[n];
    if (!net) continue;
    if (netIds.has(net.id)) {
      errors.push({
        path: `nets[${n}].id`,
        message: `Duplicate net id: "${net.id}"`,
      });
    } else {
      netIds.add(net.id);
    }

    for (let p = 0; p < net.portIds.length; p++) {
      const portId = net.portIds[p];
      if (!portId) continue;
      if (!allKnownPorts.has(portId)) {
        errors.push({
          path: `nets[${n}].portIds[${p}]`,
          message: `Net "${net.id}" references non-existent port "${portId}"`,
        });
      }

      const existingNet = portToNetMap.get(portId);
      if (existingNet && existingNet !== net.id) {
        errors.push({
          path: `nets[${n}].portIds[${p}]`,
          message: `Port "${portId}" is already mapped to net "${existingNet}", cannot also attach to "${net.id}"`,
        });
      } else {
        portToNetMap.set(portId, net.id);
      }
    }
  }

  return errors;
}

/**
 * Validates raw data with Zod schema and enforces referential integrity.
 */
export function parseCircuit(data: unknown): Circuit {
  const parsed = CircuitSchema.parse(data) as unknown as Circuit;
  const integrityErrors = validateCircuitIntegrity(parsed);
  if (integrityErrors.length > 0) {
    throw new Error(
      `Circuit integrity validation failed:\n${integrityErrors
        .map((e) => `  - [${e.path}] ${e.message}`)
        .join("\n")}`,
    );
  }
  return parsed;
}

export function safeParseCircuit(
  data: unknown,
): { success: true; data: Circuit } | { success: false; errors: string[] } {
  const schemaResult = CircuitSchema.safeParse(data);
  if (!schemaResult.success) {
    return {
      success: false,
      errors: schemaResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
    };
  }

  const circuit = schemaResult.data as unknown as Circuit;
  const integrityErrors = validateCircuitIntegrity(circuit);
  if (integrityErrors.length > 0) {
    return {
      success: false,
      errors: integrityErrors.map((e) => `[${e.path}] ${e.message}`),
    };
  }

  return { success: true, data: circuit };
}
