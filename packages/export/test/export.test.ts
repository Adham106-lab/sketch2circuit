import { describe, expect, it } from "vitest";
import { EXPORT_VERSION } from "../src/index.js";

describe("@s2c/export package scaffolding", () => {
  it("exports package version constant", () => {
    expect(EXPORT_VERSION).toBe("0.1.0");
  });
});
