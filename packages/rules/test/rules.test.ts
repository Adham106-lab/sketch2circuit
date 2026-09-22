import { describe, expect, it } from "vitest";
import { RULES_VERSION } from "../src/index.js";

describe("@s2c/rules package scaffolding", () => {
  it("exports package version constant", () => {
    expect(RULES_VERSION).toBe("0.1.0");
  });
});
