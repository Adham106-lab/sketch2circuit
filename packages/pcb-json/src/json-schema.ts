/**
 * @license Apache-2.0
 * @s2c/pcb-json — JSON Schema (Draft-07) generator for PCB Layout specification.
 */

import { zodToJsonSchema } from "zod-to-json-schema";
import { PcbLayoutSchema } from "./schema.js";

/**
 * Returns the canonical JSON Schema (Draft-07) for PcbLayout v0.1.0.
 */
export function getPcbJsonSchema(): Record<string, unknown> {
  const schema = zodToJsonSchema(PcbLayoutSchema, {
    target: "jsonSchema7",
    $refStrategy: "none",
  }) as Record<string, unknown>;

  schema.$schema = "http://json-schema.org/draft-07/schema#";
  schema.title = "PcbLayout";
  schema.description = "sketch2circuit PCB Layout v0.1.0 specification";

  return schema;
}
