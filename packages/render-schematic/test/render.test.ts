import { describe, expect, it } from "vitest";
import { RENDER_SCHEMATIC_VERSION } from "../src/index.js";

describe("@s2c/render-schematic package scaffolding", () => {
  it("exports package version constant", () => {
    expect(RENDER_SCHEMATIC_VERSION).toBe("0.1.0");
  });
});
