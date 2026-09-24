/**
 * @license Apache-2.0
 * Comprehensive Physical GND Header Allocation & Rail Fallback Tests (GAP-02).
 */

import { PhysicalGndAllocator } from "@s2c/arduino";
import { createCircuit } from "@s2c/core";
import { describe, expect, it } from "vitest";
import {
  formatWiringTableAscii,
  formatWiringTableMarkdown,
  generateWiringTable,
} from "../src/index.js";

describe("Physical Header GND Pin Allocation & Breadboard Rail Fallback (GAP-02)", () => {
  describe("PhysicalGndAllocator Unit Tests", () => {
    it("allocates exactly 3 distinct physical header pins matching the Uno R3 schematic", () => {
      const allocator = new PhysicalGndAllocator("U1", "ARDUINO_UNO_R3");

      expect(allocator.physicalPinCount).toBe(3);

      // Pin 1: Power Header JP2 Pin 6
      const gnd1 = allocator.allocate("LED Cathode");
      expect(gnd1.assignedPin).toBe("U1.POWER.GND.1");
      expect(gnd1.headerLocation).toContain("JP2 Pin 6");
      expect(gnd1.usesBreadboardRail).toBe(false);

      // Pin 2: Power Header JP2 Pin 7
      const gnd2 = allocator.allocate("Button Return");
      expect(gnd2.assignedPin).toBe("U1.POWER.GND.2");
      expect(gnd2.headerLocation).toContain("JP2 Pin 7");
      expect(gnd2.usesBreadboardRail).toBe(false);

      // Pin 3: Digital Header JP1 Pin 4
      const gnd3 = allocator.allocate("Sensor Ground");
      expect(gnd3.assignedPin).toBe("U1.DIGITAL.GND");
      expect(gnd3.headerLocation).toContain("JP1 Pin 4");
      expect(gnd3.usesBreadboardRail).toBe(false);
      expect(allocator.isRailTieInRequired).toBe(false);
    });

    it("falls back gracefully to breadboard ground rail when >3 GND connections needed", () => {
      const allocator = new PhysicalGndAllocator("U1", "ARDUINO_UNO_R3");

      // Consume first 3 physical pins
      allocator.allocate("Peripheral 1");
      allocator.allocate("Peripheral 2");
      allocator.allocate("Peripheral 3");

      // 4th GND connection exceeds 3 physical pins
      const gnd4 = allocator.allocate("Peripheral 4");
      expect(gnd4.assignedPin).toBe("Breadboard.GND_RAIL");
      expect(gnd4.usesBreadboardRail).toBe(true);
      expect(gnd4.wiringNote).toContain("Breadboard Ground Bus Rail (-)");
      expect(gnd4.wiringNote).toContain("Tie U1.POWER.GND.1 to breadboard blue rail");
      expect(allocator.isRailTieInRequired).toBe(true);

      // 5th GND connection also maps to breadboard rail without double-booking or error
      const gnd5 = allocator.allocate("Peripheral 5");
      expect(gnd5.assignedPin).toBe("Breadboard.GND_RAIL");
      expect(gnd5.usesBreadboardRail).toBe(true);
      expect(allocator.totalAllocations).toBe(5);
    });
  });

  describe("Wiring Table Physical GND Resolution", () => {
    it("resolves single GND connection to physical Uno header pin POWER.GND.1", () => {
      const circuit = createCircuit({ title: "Single LED" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addLed("D1", "Red")
        .addResistor("R1", "220Ω")
        .connect("U1.D13", "R1.1")
        .connect("R1.2", "D1.A")
        .connectNet("GND", ["D1.K", "U1.GND"])
        .build();

      const rows = generateWiringTable(circuit);
      const gndRow = rows.find((r) => r.toPort === "D1.K");

      expect(gndRow).toBeDefined();
      expect(gndRow?.fromPort).toBe("U1.POWER.GND.1");
      expect(gndRow?.notes).toContain("Power Header JP2 Pin 6");
    });

    it("rotates across POWER.GND.1, POWER.GND.2, DIGITAL.GND, and falls back to breadboard rail for 4+ peripherals", () => {
      // Build a multi-device circuit with 5 ground connections
      const circuit = createCircuit({ title: "Multi-device Circuit" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addLed("D1", "Red")
        .addLed("D2", "Green")
        .addLed("D3", "Blue")
        .addButton("SW1")
        .addButton("SW2")
        .connectNet("GND", ["U1.GND", "D1.K", "D2.K", "D3.K", "SW1.2", "SW2.2"])
        .build();

      const rows = generateWiringTable(circuit);
      const gndRows = rows.filter((r) => r.netId === "GND");

      expect(gndRows.length).toBe(5);

      const fromPorts = gndRows.map((r) => r.fromPort);

      // Exactly 3 unique physical header pins used
      expect(fromPorts).toContain("U1.POWER.GND.1");
      expect(fromPorts).toContain("U1.POWER.GND.2");
      expect(fromPorts).toContain("U1.DIGITAL.GND");

      // Remaining 2 connections gracefully assigned to breadboard ground rail
      const railRows = gndRows.filter((r) => r.fromPort === "Breadboard.GND_RAIL");
      expect(railRows.length).toBe(2);
      expect(railRows[0].notes).toContain("Breadboard Ground Rail (-)");
      expect(railRows[0].notes).toContain("Tie U1.POWER.GND.1 to blue (-) rail");

      // Verify Markdown rendering contains physical header pins and rail instructions
      const md = formatWiringTableMarkdown(rows);
      expect(md).toContain("`U1.POWER.GND.1`");
      expect(md).toContain("`U1.POWER.GND.2`");
      expect(md).toContain("`U1.DIGITAL.GND`");
      expect(md).toContain("`Breadboard.GND_RAIL`");

      // Verify ASCII table contains clean physical entries
      const ascii = formatWiringTableAscii(rows);
      expect(ascii).toContain("U1.POWER.GND.1");
      expect(ascii).toContain("Breadboard.GND_R");
    });
  });
});
