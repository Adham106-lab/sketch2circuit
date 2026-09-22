import { describe, expect, it } from "vitest";
import { CLI_VERSION } from "../src/index.js";

describe("@s2c/cli package scaffolding", () => {
  it("exports package version constant", () => {
    expect(CLI_VERSION).toBe("0.1.0");
  });
});
