/**
 * @license Apache-2.0
 * @s2c/circuit-json — JSON Schema (draft-07) generator for Circuit IR.
 */

import { zodToJsonSchema } from "zod-to-json-schema";
import { CircuitSchema } from "./schema.js";

/**
 * Returns the canonical JSON Schema (Draft-07) for Circuit IR v0.1.0.
 */
export function getCircuitJsonSchema(): Record<string, unknown> {
  const schema = zodToJsonSchema(CircuitSchema, {
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Record<string, unknown>;

  schema.$schema = "http://json-schema.org/draft-07/schema#";
  schema.title = "Circuit";
  schema.description = "sketch2circuit Circuit IR v0.1.0 specification";

  return schema;
}
