import { describe, expect, it } from "vitest";
import { getCircuitJsonSchema } from "../src/json-schema.js";

describe("Circuit IR JSON Schema Generation", () => {
  it("emits valid draft-07 JSON Schema", () => {
    const jsonSchema = getCircuitJsonSchema();
    expect(jsonSchema).toBeDefined();
    expect(jsonSchema.$schema).toBe("http://json-schema.org/draft-07/schema#");
    expect(typeof jsonSchema.properties).toBe("object");

    const props = jsonSchema.properties as Record<string, unknown>;
    expect(props.schemaVersion).toBeDefined();
    expect(props.components).toBeDefined();
    expect(props.nets).toBeDefined();
  });
});
