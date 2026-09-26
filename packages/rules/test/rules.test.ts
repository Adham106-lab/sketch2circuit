import { createCircuit } from "@s2c/core";
import { describe, expect, it } from "vitest";
import { DEFAULT_RULES, RULE_REGISTRY, RULES_VERSION, runErc } from "../src/index.js";

describe("@s2c/rules Electrical Rules Check (ERC) Complete 18-Rule Engine (Doc §9.1)", () => {
  it("exports package version constant and full 18-rule registry per Doc §9.1", () => {
    expect(RULES_VERSION).toBe("0.1.0");
    expect(DEFAULT_RULES).toHaveLength(18);
    const expectedRuleIds = [
      "erc.floating-input",
      "erc.unconnected-port",
      "erc.power-short",
      "erc.output-contention",
      "erc.led-no-resistor",
      "erc.led-current",
      "erc.pin-current",
      "erc.total-current",
      "erc.i2c-pullups",
      "erc.i2c-address-conflict",
      "erc.decoupling",
      "erc.logic-level-mismatch",
      "erc.inductive-load-no-flyback",
      "erc.servo-power",
      "erc.pwm-capability",
      "erc.adc-capability",
      "erc.reserved-pin",
      "erc.power-budget",
    ];

    for (const ruleId of expectedRuleIds) {
      expect(RULE_REGISTRY.has(ruleId)).toBe(true);
    }
  });

  // -------------------------------------------------------------
  // Rule 1: erc.floating-input
  // -------------------------------------------------------------
  describe("Rule: erc.floating-input", () => {
    it("NEGATIVE: detects button connected to MCU input without pull-up or pull-down resistor", () => {
      const circuit = createCircuit({ title: "Floating Button Circuit" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addButton("SW1")
        .connect("U1.D2", "SW1.1")
        .connectNet("GND", ["SW1.2", "U1.GND"])
        .connectNet("5V", ["U1.5V"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.floating-input"] });
      const buttonDiag = diags.find((d) => d.target.id === "U1.D2");
      expect(buttonDiag).toBeDefined();
      expect(buttonDiag?.severity).toBe("warning");
      expect(buttonDiag?.message).toContain("lacks a pull-up or pull-down resistor");
      expect(buttonDiag?.explanation).toContain(">10MΩ");
      expect(buttonDiag?.suggestion).toContain("10kΩ pull-up resistor");
    });

    it("POSITIVE: passes when button net has a 10kΩ pull-up resistor to 5V", () => {
      const circuit = createCircuit({ title: "Pulled Button Circuit" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addButton("SW1")
        .addResistor("R_PULL", "10kΩ")
        .connect("U1.D2", "SW1.1", "R_PULL.1")
        .connectNet("5V", ["R_PULL.2", "U1.5V"])
        .connectNet("GND", ["SW1.2", "U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.floating-input"] });
      const buttonDiag = diags.find((d) => d.target.id === "U1.D2");
      expect(buttonDiag).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // Rule 2: erc.unconnected-port
  // -------------------------------------------------------------
  describe("Rule: erc.unconnected-port", () => {
    it("NEGATIVE: detects unconnected passive component port", () => {
      const circuit = createCircuit({ title: "Floating Resistor" })
        .addResistor("R1", "1kΩ")
        .connectNet("5V", ["R1.1"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.unconnected-port"] });
      expect(diags.some((d) => d.target.id === "R1.2")).toBe(true);
    });

    it("POSITIVE: passes when both terminals are connected", () => {
      const circuit = createCircuit({ title: "Connected Resistor" })
        .addResistor("R1", "1kΩ")
        .connectNet("5V", ["R1.1"])
        .connectNet("GND", ["R1.2"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.unconnected-port"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 3: erc.power-short
  // -------------------------------------------------------------
  describe("Rule: erc.power-short", () => {
    it("NEGATIVE: detects direct connection between 5V power and GND return", () => {
      const circuit = createCircuit({ title: "Dead Short" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .connectNet("5V_GND_SHORT", ["U1.5V", "U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.power-short"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.power-short");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].explanation).toContain("~0Ω resistance");
      expect(diags[0].suggestion).toContain("Separate the power rail and ground return paths");
    });

    it("POSITIVE: passes with distinct isolated power and ground nets", () => {
      const circuit = createCircuit({ title: "Isolated Rails" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .connectNet("5V", ["U1.5V"])
        .connectNet("GND", ["U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.power-short"] });
      expect(diags).toHaveLength(0);
    });

    it("POSITIVE: does NOT flag false collision between SG90 servo VCC (4.8-6.0V rating) and 5V power net", () => {
      const circuit = createCircuit({ title: "Servo on 5V" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("SG90_SERVO", "SERVO1")
        .connectNet("5V", ["U1.5V", "SERVO1.VCC"])
        .connectNet("GND", ["U1.GND", "SERVO1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.power-short"] });
      expect(diags).toHaveLength(0);
    });

    it("NEGATIVE: detects direct collision between distinct supply rails (5V and 3.3V)", () => {
      const circuit = createCircuit({ title: "Rail Collision" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .connectNet("COLLIDING_RAILS", ["U1.5V", "U1.3V3"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.power-short"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.power-short");
      expect(diags[0].message).toContain(
        "Direct collision between distinct power rails (5V and 3.3V)",
      );
    });
  });

  // -------------------------------------------------------------
  // Rule 4: erc.output-contention
  // -------------------------------------------------------------
  describe("Rule: erc.output-contention", () => {
    it("NEGATIVE: detects two active output ports driving the same net", () => {
      const circuit = createCircuit({ title: "Driver Collision" })
        .addComponent("U1", "ic", {
          ports: [{ name: "OUT1", kind: "output" }],
        })
        .addComponent("U2", "ic", {
          ports: [{ name: "OUT2", kind: "output" }],
        })
        .connect("U1.OUT1", "U2.OUT2")
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.output-contention"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.output-contention");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].explanation).toContain("push-pull output stages");
      expect(diags[0].suggestion).toContain("tri-state buffers");
    });

    it("POSITIVE: passes when one output drives an input", () => {
      const circuit = createCircuit({ title: "Single Driver" })
        .addComponent("U1", "ic", {
          ports: [{ name: "OUT", kind: "output" }],
        })
        .addComponent("U2", "ic", {
          ports: [{ name: "IN", kind: "input" }],
        })
        .connect("U1.OUT", "U2.IN")
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.output-contention"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 5: erc.led-no-resistor
  // -------------------------------------------------------------
  describe("Rule: erc.led-no-resistor", () => {
    it("NEGATIVE: detects missing series resistor with numeric overcurrent explanation and suggested fix", () => {
      const circuit = createCircuit({ title: "Unprotected LED" })
        .addLed("LED1", "Red")
        .connectNet("5V", ["LED1.A"])
        .connectNet("GND", ["LED1.K"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.led-no-resistor"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.led-no-resistor");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].message).toContain("without a current-limiting resistor");
      expect(diags[0].explanation).toContain("Vf = 2.0V");
      expect(diags[0].explanation).toContain("5.0V supply");
      expect(diags[0].suggestion).toContain("Add a 200Ω series resistor");
    });

    it("POSITIVE: passes when series resistor is present", () => {
      const circuit = createCircuit({ title: "Resistor Present" })
        .addLed("LED1", "Red")
        .addResistor("R1", "330Ω")
        .connectNet("5V", ["R1.1"])
        .connect("R1.2", "LED1.A")
        .connectNet("GND", ["LED1.K"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.led-no-resistor"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 6: erc.led-current
  // -------------------------------------------------------------
  describe("Rule: erc.led-current", () => {
    it("NEGATIVE: detects series resistor that is too small (excessive current > 25mA)", () => {
      const circuit = createCircuit({ title: "Overdriven LED" })
        .addLed("LED1", "Green")
        .addResistor("R1", "10Ω")
        .connectNet("5V", ["R1.1"])
        .connect("R1.2", "LED1.A")
        .connectNet("GND", ["LED1.K"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.led-current"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.led-current");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].message).toContain("excessive forward current");
      expect(diags[0].explanation).toContain("300.0mA");
      expect(diags[0].explanation).toContain("25.0mA by 275.0mA");
      expect(diags[0].suggestion).toContain("Increase series resistor");
    });

    it("NEGATIVE: detects series resistor that is too large (insufficient current < 1mA)", () => {
      const circuit = createCircuit({ title: "Underdriven LED" })
        .addLed("LED1", "Green")
        .addResistor("R1", "100kΩ")
        .connectNet("5V", ["R1.1"])
        .connect("R1.2", "LED1.A")
        .connectNet("GND", ["LED1.K"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.led-current"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].severity).toBe("warning");
      expect(diags[0].explanation).toContain("0.03mA");
      expect(diags[0].explanation).toContain("typical minimum visible threshold of 1.0mA");
      expect(diags[0].suggestion).toContain("Decrease series resistor");
    });

    it("POSITIVE: passes with properly sized 330Ω current-limiting resistor", () => {
      const circuit = createCircuit({ title: "Safe LED" })
        .addLed("LED1", "Red")
        .addResistor("R1", "330Ω")
        .connectNet("5V", ["R1.1"])
        .connect("R1.2", "LED1.A")
        .connectNet("GND", ["LED1.K"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.led-current"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 7: erc.pin-current
  // -------------------------------------------------------------
  describe("Rule: erc.pin-current", () => {
    it("NEGATIVE: detects excessive current drawn directly from MCU pin", () => {
      const circuit = createCircuit({ title: "Pin Overcurrent" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addResistor("R_LOAD", "10Ω")
        .connect("U1.D9", "R_LOAD.1")
        .connectNet("GND", ["R_LOAD.2", "U1.GND"])
        .connectNet("5V", ["U1.5V"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.pin-current"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.pin-current");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].explanation).toContain("500.0mA");
      expect(diags[0].explanation).toContain("40.0mA");
      expect(diags[0].suggestion).toContain("transistor buffer stage");
    });

    it("POSITIVE: passes with safe high-impedance load (e.g. 1kΩ)", () => {
      const circuit = createCircuit({ title: "Safe Pin Current" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addResistor("R_LOAD", "1kΩ")
        .connect("U1.D9", "R_LOAD.1")
        .connectNet("GND", ["R_LOAD.2", "U1.GND"])
        .connectNet("5V", ["U1.5V"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.pin-current"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 8: erc.total-current
  // -------------------------------------------------------------
  describe("Rule: erc.total-current", () => {
    it("NEGATIVE: detects total GPIO current exceeding 200mA package budget", () => {
      // 15 LEDs each drawing 15mA = 225mA > 200mA budget
      const b = createCircuit({ title: "Heavy Load" }).addPart("ARDUINO_UNO_R3", "U1");
      for (let i = 2; i <= 12; i++) {
        b.addLed(`LED_${i}`, "Red", { properties: { forwardCurrentA: 0.02 } });
        b.connect(`U1.D${i}`, `LED_${i}.A`);
      }
      const circuit = b.build();

      const diags = runErc(circuit, { enabledRules: ["erc.total-current"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.total-current");
      expect(diags[0].severity).toBe("warning");
      expect(diags[0].explanation).toContain("220.0mA");
      expect(diags[0].explanation).toContain("200.0mA");
    });
  });

  // -------------------------------------------------------------
  // Rule 9: erc.i2c-pullups
  // -------------------------------------------------------------
  describe("Rule: erc.i2c-pullups", () => {
    it("NEGATIVE: detects I2C bus missing pull-up resistors to power", () => {
      const circuit = createCircuit({ title: "Unpulled I2C Bus" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .connectNet("SDA", ["U1.SDA"])
        .connectNet("SCL", ["U1.SCL"])
        .connectNet("5V", ["U1.5V"])
        .connectNet("GND", ["U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.i2c-pullups"] });
      expect(diags.length).toBeGreaterThanOrEqual(2);
      expect(diags.some((d) => d.target.id === "SDA")).toBe(true);
      expect(diags.some((d) => d.target.id === "SCL")).toBe(true);
      expect(diags[0].explanation).toContain("open-drain topology");
      expect(diags[0].suggestion).toContain("4.7kΩ");
    });

    it("POSITIVE: passes when 4.7kΩ pull-up resistors are installed on SDA and SCL to 5V", () => {
      const circuit = createCircuit({ title: "Proper I2C Bus" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addResistor("R_SDA", "4.7kΩ")
        .addResistor("R_SCL", "4.7kΩ")
        .connectNet("SDA", ["U1.SDA", "R_SDA.1"])
        .connectNet("SCL", ["U1.SCL", "R_SCL.1"])
        .connectNet("5V", ["R_SDA.2", "R_SCL.2", "U1.5V"])
        .connectNet("GND", ["U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.i2c-pullups"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 10: erc.i2c-address-conflict
  // -------------------------------------------------------------
  describe("Rule: erc.i2c-address-conflict", () => {
    it("NEGATIVE: detects two I2C devices with the same slave address on one bus", () => {
      const circuit = createCircuit({ title: "I2C Conflict" })
        .addComponent("SENSOR1", "sensor", {
          properties: { i2cAddress: "0x68" },
          ports: [{ name: "SDA", kind: "bidirectional" }],
        })
        .addComponent("SENSOR2", "sensor", {
          properties: { i2cAddress: "0x68" },
          ports: [{ name: "SDA", kind: "bidirectional" }],
        })
        .connectNet("SDA", ["SENSOR1.SDA", "SENSOR2.SDA"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.i2c-address-conflict"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.i2c-address-conflict");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].explanation).toContain("0x68");
      expect(diags[0].suggestion).toContain("TCA9548A");
    });
  });

  // -------------------------------------------------------------
  // Rule 11: erc.decoupling
  // -------------------------------------------------------------
  describe("Rule: erc.decoupling", () => {
    it("NEGATIVE: detects IC with connected power and ground lacking bypass decoupling capacitor", () => {
      const circuit = createCircuit({ title: "Undecoupled IC" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .connectNet("5V", ["U1.5V"])
        .connectNet("GND", ["U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.decoupling"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.decoupling");
      expect(diags[0].severity).toBe("warning");
      expect(diags[0].explanation).toContain("di/dt");
      expect(diags[0].suggestion).toContain("100nF (0.1µF) ceramic capacitor");
    });

    it("POSITIVE: passes when a 100nF ceramic capacitor is connected between 5V and GND", () => {
      const circuit = createCircuit({ title: "Decoupled IC" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addCapacitor("C_BYPASS", "100nF")
        .connectNet("5V", ["U1.5V", "C_BYPASS.1"])
        .connectNet("GND", ["U1.GND", "C_BYPASS.2"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.decoupling"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 12: erc.logic-level-mismatch
  // -------------------------------------------------------------
  describe("Rule: erc.logic-level-mismatch", () => {
    it("NEGATIVE: detects 5V MCU driving 3.3V MCU input without level shifter", () => {
      const circuit = createCircuit({ title: "Level Mismatch" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("ESP32_WROOM_32", "U2")
        .connect("U1.D9", "U2.GPIO4")
        .connectNet("5V", ["U1.5V"])
        .connectNet("3V3", ["U2.3V3"])
        .connectNet("GND", ["U1.GND", "U2.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.logic-level-mismatch"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.logic-level-mismatch");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].explanation).toContain("5.0V");
      expect(diags[0].explanation).toContain("3.3V");
      expect(diags[0].suggestion).toContain("logic level shifter or resistor voltage divider");
    });

    it("POSITIVE: passes when pins share compatible 3.3V voltage levels", () => {
      const circuit = createCircuit({ title: "Compatible Levels" })
        .addPart("ESP32_WROOM_32", "U1")
        .addPart("ESP32_WROOM_32", "U2")
        .connect("U1.GPIO4", "U2.GPIO5")
        .connectNet("3V3", ["U1.3V3", "U2.3V3"])
        .connectNet("GND", ["U1.GND", "U2.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.logic-level-mismatch"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 13: erc.inductive-load-no-flyback
  // -------------------------------------------------------------
  describe("Rule: erc.inductive-load-no-flyback", () => {
    it("NEGATIVE: detects relay coil switched by transistor without flyback clamp diode", () => {
      const circuit = createCircuit({ title: "Unprotected Relay" })
        .addComponent("RELAY1", "relay", {
          name: "5V SPDT Relay",
          ports: [
            { name: "COIL1", kind: "passive" },
            { name: "COIL2", kind: "passive" },
          ],
        })
        .addPart("TRANSISTOR_2N2222", "Q1")
        .connectNet("5V", ["RELAY1.COIL1"])
        .connect("RELAY1.COIL2", "Q1.C")
        .connectNet("GND", ["Q1.E"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.inductive-load-no-flyback"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.inductive-load-no-flyback");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].explanation).toContain("back-EMF spike");
      expect(diags[0].suggestion).toContain("1N4007");
    });

    it("POSITIVE: passes when 1N4007 flyback diode is connected across relay coil", () => {
      const circuit = createCircuit({ title: "Protected Relay" })
        .addComponent("RELAY1", "relay", {
          name: "5V SPDT Relay",
          ports: [
            { name: "COIL1", kind: "passive" },
            { name: "COIL2", kind: "passive" },
          ],
        })
        .addPart("TRANSISTOR_2N2222", "Q1")
        .addPart("DIODE_1N4007", "D1")
        .connectNet("5V", ["RELAY1.COIL1", "D1.K"]) // Cathode to positive supply
        .connect("RELAY1.COIL2", "Q1.C", "D1.A") // Anode to transistor collector
        .connectNet("GND", ["Q1.E"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.inductive-load-no-flyback"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 14: erc.servo-power
  // -------------------------------------------------------------
  describe("Rule: erc.servo-power", () => {
    it("NEGATIVE: warns when micro servo is powered directly from MCU 5V rail", () => {
      const circuit = createCircuit({ title: "Servo MCU Power" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("SG90_SERVO", "SERVO1")
        .connectNet("5V", ["U1.5V", "SERVO1.VCC"])
        .connectNet("GND", ["U1.GND", "SERVO1.GND"])
        .connect("U1.D9", "SERVO1.PWM")
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.servo-power"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.servo-power");
      expect(diags[0].severity).toBe("warning");
      expect(diags[0].explanation).toContain("650mA");
      expect(diags[0].suggestion).toContain("dedicated external 5V/6V supply");
    });

    it("POSITIVE: passes when servo is powered from external supply rail", () => {
      const circuit = createCircuit({ title: "Servo External Power" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("SG90_SERVO", "SERVO1")
        .connectNet("EXT_5V", ["SERVO1.VCC"])
        .connectNet("GND", ["U1.GND", "SERVO1.GND"])
        .connect("U1.D9", "SERVO1.PWM")
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.servo-power"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 15: erc.pwm-capability
  // -------------------------------------------------------------
  describe("Rule: erc.pwm-capability", () => {
    it("NEGATIVE: detects PWM signal / servo driven from non-PWM Uno pin (e.g. D2)", () => {
      const circuit = createCircuit({ title: "Non-PWM Pin Error" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("SG90_SERVO", "SERVO1")
        .connect("U1.D2", "SERVO1.PWM") // D2 lacks PWM on Uno
        .connectNet("GND", ["U1.GND", "SERVO1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.pwm-capability"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.pwm-capability");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].explanation).toContain("hardware timer/counter");
      expect(diags[0].suggestion).toContain("D3, D5, D6, D9, D10, D11");
    });

    it("POSITIVE: passes when PWM peripheral is attached to PWM pin (e.g. D9)", () => {
      const circuit = createCircuit({ title: "Valid PWM Pin" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("SG90_SERVO", "SERVO1")
        .connect("U1.D9", "SERVO1.PWM") // D9 has PWM on Uno
        .connectNet("GND", ["U1.GND", "SERVO1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.pwm-capability"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 16: erc.adc-capability
  // -------------------------------------------------------------
  describe("Rule: erc.adc-capability", () => {
    it("NEGATIVE: detects analog potentiometer wiper connected to digital-only pin (e.g. D2)", () => {
      const circuit = createCircuit({ title: "Non-ADC Pin Error" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("POTENTIOMETER_10K", "POT1")
        .connect("U1.D2", "POT1.2") // D2 is not an ADC pin!
        .connectNet("5V", ["POT1.1", "U1.5V"])
        .connectNet("GND", ["POT1.3", "U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.adc-capability"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.adc-capability");
      expect(diags[0].severity).toBe("error");
      expect(diags[0].explanation).toContain("Successive Approximation Register (SAR) ADC");
      expect(diags[0].suggestion).toContain("A0, A1, A2, A3, A4, A5");
    });

    it("POSITIVE: passes when analog potentiometer is connected to ADC pin (e.g. A0)", () => {
      const circuit = createCircuit({ title: "Valid ADC Pin" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("POTENTIOMETER_10K", "POT1")
        .connect("U1.A0", "POT1.2") // A0 is an ADC pin
        .connectNet("5V", ["POT1.1", "U1.5V"])
        .connectNet("GND", ["POT1.3", "U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.adc-capability"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 17: erc.reserved-pin
  // -------------------------------------------------------------
  describe("Rule: erc.reserved-pin", () => {
    it("NEGATIVE: warns when hardware bootloader UART pin D0 is wired to external button", () => {
      const circuit = createCircuit({ title: "Reserved D0 Usage" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addButton("SW1")
        .connect("U1.D0", "SW1.1")
        .connectNet("GND", ["SW1.2", "U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.reserved-pin"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.reserved-pin");
      expect(diags[0].severity).toBe("warning");
      expect(diags[0].explanation).toContain("USB-to-Serial interface");
      expect(diags[0].suggestion).toContain("D2–D12");
    });

    it("POSITIVE: passes when unreserved pin (e.g. D4) is used for external button", () => {
      const circuit = createCircuit({ title: "Unreserved Pin Usage" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addButton("SW1")
        .connect("U1.D4", "SW1.1")
        .connectNet("GND", ["SW1.2", "U1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.reserved-pin"] });
      expect(diags).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------
  // Rule 18: erc.power-budget
  // -------------------------------------------------------------
  describe("Rule: erc.power-budget", () => {
    it("NEGATIVE: warns when multiple high-current servos exceed 500mA USB power budget", () => {
      const circuit = createCircuit({ title: "Over-Budget Servos" })
        .addPart("ARDUINO_UNO_R3", "U1")
        .addPart("SG90_SERVO", "S1") // 650mA stall
        .connectNet("5V", ["U1.5V", "S1.VCC"])
        .connectNet("GND", ["U1.GND", "S1.GND"])
        .build();

      const diags = runErc(circuit, { enabledRules: ["erc.power-budget"] });
      expect(diags).toHaveLength(1);
      expect(diags[0].ruleId).toBe("erc.power-budget");
      expect(diags[0].severity).toBe("warning");
      expect(diags[0].explanation).toContain("500mA");
      expect(diags[0].suggestion).toContain("VIN barrel jack");
    });
  });
});
