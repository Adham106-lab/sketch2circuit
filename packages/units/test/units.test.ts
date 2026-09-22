import { describe, expect, it } from "vitest";
import { UNITS_VERSION } from "../src/index.js";

describe("@s2c/units package scaffolding", () => {
  it("exports package version constant", () => {
    expect(UNITS_VERSION).toBe("0.1.0");
  });
});
