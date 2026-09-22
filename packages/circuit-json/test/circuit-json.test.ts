import { describe, expect, it } from "vitest";
import { CIRCUIT_JSON_VERSION } from "../src/index.js";

describe("@s2c/circuit-json package scaffolding", () => {
  it("exports package version constant", () => {
    expect(CIRCUIT_JSON_VERSION).toBe("0.1.0");
  });
});
