import { describe, expect, it } from "vitest";
import { ARDUINO_SYNTH_VERSION } from "../src/index.js";

describe("@s2c/arduino package scaffolding", () => {
  it("exports package version constant", () => {
    expect(ARDUINO_SYNTH_VERSION).toBe("0.1.0");
  });
});
